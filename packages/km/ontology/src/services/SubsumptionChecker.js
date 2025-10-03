/**
 * SubsumptionChecker - Check if concepts exist in inheritance hierarchy
 *
 * Implements subsumption reasoning:
 * - Property subsumption: Check if property exists in class or ancestors
 * - Relationship subsumption: Check if relationship exists AND validate specialization rules
 *
 * Rule 2 (Relationship Specialization Constraint):
 * A relationship can only specialize another if both domain and range are subclasses
 * (or equal) to the base relationship's domain and range.
 */

export class SubsumptionChecker {
  constructor(tripleStore, hierarchyTraversal) {
    if (!tripleStore) {
      throw new Error('TripleStore is required');
    }
    if (!hierarchyTraversal) {
      throw new Error('HierarchyTraversal is required');
    }

    this.tripleStore = tripleStore;
    this.hierarchyTraversal = hierarchyTraversal;
  }

  /**
   * Check if property exists anywhere in class hierarchy
   *
   * @param {string} classURI - The class to check
   * @param {string} propertyName - The property name to search for
   * @returns {Promise<Object>} - Subsumption result
   * @returns {boolean} return.exists - Whether property exists in hierarchy
   * @returns {string} [return.property] - Property URI if found
   * @returns {string} [return.label] - Property label if found
   * @returns {string} [return.definedIn] - Class where property is defined
   * @returns {number} [return.inheritanceDistance] - Distance from class (0=direct, 1=parent, 2=grandparent, ...)
   * @returns {boolean} [return.inherited] - Whether property is inherited (true) or direct (false)
   */
  async checkPropertySubsumption(classURI, propertyName) {
    // Build hierarchy: [classURI, parent, grandparent, ...]
    const hierarchy = [classURI, ...(await this.hierarchyTraversal.getAncestors(classURI))];

    // Search through hierarchy
    for (let i = 0; i < hierarchy.length; i++) {
      const cls = hierarchy[i];
      const properties = await this.tripleStore.query(null, 'rdfs:domain', cls);

      for (const [propURI] of properties) {
        const labels = await this.tripleStore.query(propURI, 'rdfs:label', null);
        const label = labels[0]?.[2]?.replace(/"/g, '');

        if (this.isSimilar(propertyName, label)) {
          return {
            exists: true,
            property: propURI,
            label,
            definedIn: cls,
            inheritanceDistance: i,
            inherited: i > 0
          };
        }
      }
    }

    return { exists: false };
  }

  /**
   * Check if relationship exists in hierarchy AND validate specialization
   *
   * @param {string} domainClass - Proposed domain class
   * @param {string} rangeClass - Proposed range class
   * @param {string} relationshipName - Relationship name to search for
   * @returns {Promise<Object>} - Subsumption result
   * @returns {boolean} return.exists - Whether relationship exists in hierarchy
   * @returns {string} [return.relationship] - Relationship URI if found
   * @returns {string} [return.label] - Relationship label if found
   * @returns {Object} [return.definedIn] - Where relationship is defined (domain and range classes)
   * @returns {number} [return.inheritanceDistance] - Distance from domain class
   * @returns {boolean} [return.inherited] - Whether relationship is inherited
   * @returns {boolean} [return.canSpecialize] - Whether proposed relationship can specialize the found one (Rule 2)
   * @returns {string} [return.specializationReason] - Explanation if canSpecialize=false
   */
  async checkRelationshipSubsumption(domainClass, rangeClass, relationshipName) {
    // Build hierarchies
    const domainHierarchy = [domainClass, ...(await this.hierarchyTraversal.getAncestors(domainClass))];
    const rangeHierarchy = [rangeClass, ...(await this.hierarchyTraversal.getAncestors(rangeClass))];

    // Search through domain hierarchy
    for (let i = 0; i < domainHierarchy.length; i++) {
      const dClass = domainHierarchy[i];
      const relationships = await this.tripleStore.query(null, 'rdfs:domain', dClass);

      for (const [relURI] of relationships) {
        // Check if this is an ObjectProperty (relationship, not datatype property)
        const types = await this.tripleStore.query(relURI, 'rdf:type', null);
        if (!types.some(t => t[2] === 'owl:ObjectProperty')) continue;

        const ranges = await this.tripleStore.query(relURI, 'rdfs:range', null);
        const labels = await this.tripleStore.query(relURI, 'rdfs:label', null);
        const label = labels[0]?.[2]?.replace(/"/g, '');

        const baseRangeURI = ranges[0]?.[2];

        if (this.isSimilar(relationshipName, label)) {
          // Found matching relationship!
          // Now check if specialization is VALID according to Rule 2

          // Check domain constraint: Is domainClass ⊆ dClass (or equal)?
          const domainValid = (domainClass === dClass) || domainHierarchy.includes(dClass);

          // Check range constraint: Is rangeClass ⊆ baseRangeURI (or equal)?
          const rangeValid = this.isSubClassOfOrEqual(rangeClass, baseRangeURI, rangeHierarchy);

          const canSpecialize = domainValid && rangeValid;

          return {
            exists: true,
            relationship: relURI,
            label,
            definedIn: { domain: dClass, range: baseRangeURI },
            inheritanceDistance: i,
            inherited: i > 0,
            canSpecialize,
            specializationReason: canSpecialize ? null : this.getSpecializationFailureReason(
              domainClass, rangeClass, dClass, baseRangeURI, domainValid, rangeValid
            )
          };
        }
      }
    }

    return { exists: false };
  }

  /**
   * Check if testClass is subclass of (or equal to) baseClass
   *
   * @param {string} testClass - The class to test
   * @param {string} baseClass - The base class to compare against
   * @param {Array<string>} testClassHierarchy - Hierarchy of testClass (ancestors)
   * @returns {boolean} - True if testClass ⊆ baseClass or testClass === baseClass
   */
  isSubClassOfOrEqual(testClass, baseClass, testClassHierarchy) {
    if (testClass === baseClass) return true;
    return testClassHierarchy.includes(baseClass);
  }

  /**
   * Generate explanation for why specialization failed
   *
   * @param {string} proposedDomain - Proposed domain class
   * @param {string} proposedRange - Proposed range class
   * @param {string} baseDomain - Base relationship's domain
   * @param {string} baseRange - Base relationship's range
   * @param {boolean} domainValid - Whether domain constraint is satisfied
   * @param {boolean} rangeValid - Whether range constraint is satisfied
   * @returns {string|null} - Explanation or null if valid
   */
  getSpecializationFailureReason(proposedDomain, proposedRange, baseDomain, baseRange, domainValid, rangeValid) {
    if (!domainValid && !rangeValid) {
      return `Domain ${proposedDomain} is not subclass of ${baseDomain} AND range ${proposedRange} is not subclass of ${baseRange}`;
    } else if (!domainValid) {
      return `Domain ${proposedDomain} is not subclass of ${baseDomain} (domain broadens instead of narrows)`;
    } else if (!rangeValid) {
      return `Range ${proposedRange} is not subclass of ${baseRange} (range constraint violated)`;
    }
    return null;
  }

  /**
   * Check if two names are similar (case-insensitive, ignoring separators)
   *
   * @param {string} name1 - First name
   * @param {string} name2 - Second name
   * @returns {boolean} - True if names are similar
   */
  isSimilar(name1, name2) {
    if (!name1 || !name2) return false;
    const normalize = (s) => s.toLowerCase().replace(/[_-\s]/g, '');
    return normalize(name1) === normalize(name2);
  }

  /**
   * Check if rangeURI is compatible with targetClass
   * (For backward compatibility - not currently used)
   *
   * @param {string} rangeURI - Range URI
   * @param {string} targetClass - Target class
   * @param {Array<string>} targetHierarchy - Target class hierarchy
   * @returns {boolean} - True if compatible
   */
  isCompatibleRange(rangeURI, targetClass, targetHierarchy) {
    return rangeURI === targetClass || targetHierarchy.includes(rangeURI);
  }
}
