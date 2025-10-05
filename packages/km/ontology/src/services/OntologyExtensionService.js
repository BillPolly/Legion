/**
 * OntologyExtensionService - Extend ontology with new classes, properties, and relationships
 *
 * Adds new types to the ontology based on gap analysis results:
 * - Creates classes with rdfs:subClassOf relationships
 * - Adds specialized properties via rdfs:subPropertyOf
 * - Adds missing properties and relationships
 * - Indexes new classes in semantic search
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class OntologyExtensionService {
  constructor(tripleStore, semanticSearch, llmClient, hierarchyTraversal, verification = null) {
    if (!tripleStore) {
      throw new Error('Triple store is required');
    }
    if (!semanticSearch) {
      throw new Error('Semantic search is required');
    }
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    if (!hierarchyTraversal) {
      throw new Error('Hierarchy traversal is required');
    }

    this.tripleStore = tripleStore;
    this.semanticSearch = semanticSearch;
    this.llmClient = llmClient;
    this.hierarchyTraversal = hierarchyTraversal;
    this.verification = verification;
    this.determineParentTemplate = null;
    this.determineParentRelTemplate = null;
  }

  /**
   * Bootstrap top-level relationship kg:relatesTo
   * All ObjectProperties should be rdfs:subPropertyOf kg:relatesTo
   *
   * @returns {Promise<boolean>} - True if bootstrapped, false if already exists
   */
  async bootstrapTopLevelRelationship() {
    // Check if kg:relatesTo already exists
    const existing = await this.tripleStore.query('kg:relatesTo', 'rdf:type', 'owl:ObjectProperty');

    if (existing.length > 0) {
      return false; // Already exists
    }

    console.log('  🔧 Bootstrapping top-level relationship: kg:relatesTo');

    // Add kg:relatesTo as universal relationship
    await this.tripleStore.add('kg:relatesTo', 'rdf:type', 'owl:ObjectProperty');
    await this.tripleStore.add('kg:relatesTo', 'rdfs:label', '"relatesTo"');
    await this.tripleStore.add('kg:relatesTo', 'rdfs:comment', '"Universal relationship connecting any entity to any entity"');
    await this.tripleStore.add('kg:relatesTo', 'rdfs:domain', 'owl:Thing');
    await this.tripleStore.add('kg:relatesTo', 'rdfs:range', 'owl:Thing');

    console.log('  ✅ kg:relatesTo bootstrapped (domain: owl:Thing, range: owl:Thing)');

    return true;
  }

  /**
   * Extend ontology from gap analysis results
   *
   * @param {Object} gaps - Gap analysis results
   * @param {Array} gaps.missingClasses - Classes to add
   * @param {Array} gaps.missingProperties - Properties to add
   * @param {Array} gaps.missingRelationships - Relationships to add
   * @param {Array} gaps.canReuseFromHierarchy - Candidates with decisions
   * @param {string} domain - Domain context
   * @returns {Promise<Object>} - Stats about additions
   */
  async extendFromGaps(gaps, domain = 'general') {
    const additions = [];
    const createdParents = new Set(); // Track parents created in this batch

    // 1. Add missing classes with multi-perspective descriptions
    for (const missingClass of gaps.missingClasses) {
      const parent = await this.determineParentClass(missingClass, domain, createdParents);
      const classURI = `kg:${missingClass.name}`;

      // Add core class structure
      additions.push(
        [classURI, 'rdf:type', 'owl:Class'],
        [classURI, 'rdfs:label', `"${missingClass.name}"`],
        [classURI, 'rdfs:subClassOf', parent]
      );

      // Add multi-perspective descriptions using SKOS vocabulary
      additions.push(
        [classURI, 'skos:definition', `"${missingClass.definition || missingClass.name}"`],
        [classURI, 'rdfs:comment', `"${missingClass.supertypeDescription || missingClass.definition || missingClass.name}"`],
        [classURI, 'skos:scopeNote', `"${missingClass.usageDescription || missingClass.definition || missingClass.name}"`],
        [classURI, 'skos:altLabel', `"${missingClass.synonyms || missingClass.name}"`]
      );
    }

    // 2. Handle specialization decisions
    for (const candidate of gaps.canReuseFromHierarchy) {
      if (candidate.decision?.action === 'SPECIALIZE') {
        const newURI = `kg:${candidate.implied.name}`;
        const propertyType = candidate.type === 'property' ? 'owl:DatatypeProperty' : 'owl:ObjectProperty';

        additions.push(
          [newURI, 'rdf:type', propertyType],
          [newURI, 'rdfs:subPropertyOf', candidate.existing.property || candidate.existing.relationship],
          [newURI, 'rdfs:domain', `kg:${candidate.implied.domain}`],
          [newURI, 'rdfs:label', `"${candidate.implied.name}"`]
        );

        // Add range for relationships
        if (candidate.type === 'relationship' && candidate.implied.range) {
          additions.push([newURI, 'rdfs:range', `kg:${candidate.implied.range}`]);
        } else if (candidate.type === 'property' && candidate.implied.type) {
          additions.push([newURI, 'rdfs:range', this.mapToXSDType(candidate.implied.type)]);
        }
      }
      // If REUSE, no action needed - inherited property is sufficient
    }

    // 3. Add missing properties
    for (const missingProp of gaps.missingProperties) {
      const propURI = `kg:${missingProp.name}`;
      additions.push(
        [propURI, 'rdf:type', 'owl:DatatypeProperty'],
        [propURI, 'rdfs:domain', `kg:${missingProp.domain}`],
        [propURI, 'rdfs:range', this.mapToXSDType(missingProp.type)],
        [propURI, 'rdfs:label', `"${missingProp.name}"`]
      );
    }

    // 4. Add missing relationships
    const createdRelParents = new Set(); // Track relationship parents created in this batch

    if (gaps.missingRelationships.length > 0) {
      // Bootstrap kg:relatesTo if not already present
      await this.bootstrapTopLevelRelationship();

      for (const missingRel of gaps.missingRelationships) {
        // Determine parent relationship using LLM with subsumption filtering
        const parent = await this.determineParentRelationship(
          missingRel,
          domain,
          this.hierarchyTraversal,
          createdRelParents
        );

        const relURI = `kg:${missingRel.name}`;

        // Add core relationship structure
        additions.push(
          [relURI, 'rdf:type', 'owl:ObjectProperty'],
          [relURI, 'rdfs:subPropertyOf', parent],
          [relURI, 'rdfs:domain', `kg:${missingRel.domain}`],
          [relURI, 'rdfs:range', `kg:${missingRel.range}`],
          [relURI, 'rdfs:label', `"${missingRel.name}"`]
        );

        // Add multi-perspective descriptions using SKOS vocabulary
        additions.push(
          [relURI, 'skos:definition', `"${missingRel.definition || missingRel.name}"`],
          [relURI, 'rdfs:comment', `"${missingRel.supertypeDescription || missingRel.definition || missingRel.name}"`],
          [relURI, 'skos:scopeNote', `"${missingRel.usageDescription || missingRel.definition || missingRel.name}"`],
          [relURI, 'skos:altLabel', `"${missingRel.synonyms || missingRel.name}"`]
        );
      }
    }

    // 5. PRE-VERIFICATION: Verify BEFORE adding to triple store
    const verifyResult = await this._verifyBeforeAdd(additions);

    if (!verifyResult.valid) {
      console.warn('⚠️  Extension would violate axioms:', verifyResult.violations);

      if (this.verification && this.verification.config.failOnViolation) {
        throw new Error(`Z3 verification failed: ${verifyResult.violations.join(', ')}`);
      }

      // Return failure with violations for caller to handle
      return {
        success: false,
        violations: verifyResult.violations,
        addedClasses: 0,
        addedProperties: 0,
        addedRelationships: 0,
        reusedFromHierarchy: 0,
        specialized: 0
      };
    }

    // 6. Store in triplestore (ONLY if verified)
    for (const triple of additions) {
      await this.tripleStore.add(...triple);
    }

    // 7. Index new classes and relationships
    await this.indexNewClasses(additions);
    await this.indexNewRelationships(additions);

    return {
      success: true,
      violations: [],
      addedClasses: gaps.missingClasses.length,
      addedProperties: gaps.missingProperties.length,
      addedRelationships: gaps.missingRelationships.length,
      reusedFromHierarchy: gaps.canReuseFromHierarchy.filter(c => c.decision?.action === 'REUSE').length,
      specialized: gaps.canReuseFromHierarchy.filter(c => c.decision?.action === 'SPECIALIZE').length
    };
  }

  /**
   * Determine parent class for new class using LLM with dynamic abstraction
   *
   * @param {Object} newClass - New class to add
   * @param {string} newClass.name - Class name
   * @param {string} newClass.description - Class description
   * @param {string} newClass.suggestedSupertype - Optional upper-level category hint (PhysicalEntity, State, Process, Task)
   * @param {string} domain - Domain context
   * @param {Set} createdParents - Track parents created in this batch to avoid duplicates
   * @returns {Promise<string>} - Parent class URI (e.g., "kg:Equipment" or "owl:Thing")
   */
  async determineParentClass(newClass, domain, createdParents = new Set()) {
    // Load template if not already loaded
    if (!this.determineParentAbstractionTemplate) {
      const templatePath = join(__dirname, '../prompts/determine-parent-with-abstraction.hbs');
      this.determineParentAbstractionTemplate = await readFile(templatePath, 'utf-8');
    }

    // Query existing classes
    const existingClassTriples = await this.tripleStore.query(null, 'rdf:type', 'owl:Class');

    if (existingClassTriples.length === 0) {
      // Bootstrap: ontology is empty - shouldn't happen now that we have upper-level ontology
      return 'owl:Thing';
    }

    // Gather detailed info about existing classes
    const existingClasses = [];
    for (const [uri] of existingClassTriples) {
      const labels = await this.tripleStore.query(uri, 'rdfs:label', null);
      const comments = await this.tripleStore.query(uri, 'rdfs:comment', null);
      const parents = await this.tripleStore.query(uri, 'rdfs:subClassOf', null);

      existingClasses.push({
        uri,
        label: labels[0]?.[2]?.replace(/"/g, '') || uri.split(':')[1],
        description: comments[0]?.[2]?.replace(/"/g, '') || '',
        parent: parents[0]?.[2] || 'owl:Thing'
      });
    }

    // Map suggested supertype to URI (if provided)
    let suggestedSuperURI = null;
    if (newClass.suggestedSupertype) {
      const categoryMap = {
        'PhysicalEntity': 'kg:PhysicalEntity',
        'State': 'kg:State',
        'Process': 'kg:Process',
        'Task': 'kg:Task'
      };
      suggestedSuperURI = categoryMap[newClass.suggestedSupertype];
    }

    // Define response schema
    const responseSchema = {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['USE_EXISTING', 'CREATE_PARENT']
        },
        parent: {
          type: 'string'
        },
        parentName: {
          type: 'string'
        },
        parentDescription: {
          type: 'string'
        },
        grandparent: {
          type: 'string'
        },
        siblingClasses: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'URIs of existing classes that should become children of the new parent'
        },
        reasoning: {
          type: 'string'
        }
      },
      required: ['action', 'reasoning']
    };

    // Create TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.determineParentAbstractionTemplate,
      responseSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    // Execute with variables (include suggested supertype as hint)
    const result = await templatedPrompt.execute({
      newClassName: newClass.name,
      newClassDescription: newClass.description || newClass.name,
      domain,
      existingClasses,
      suggestedSupertype: suggestedSuperURI  // Pass as hint for grandparent
    });

    if (!result.success) {
      throw new Error(`Parent class determination failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    const decision = result.data;

    if (decision.action === 'USE_EXISTING') {
      // Use the parent the LLM chose
      // (suggestedSupertype was already passed as a hint to the LLM)
      return decision.parent;
    }

    // CREATE_PARENT: need to create intermediate parent class first
    if (decision.action === 'CREATE_PARENT') {
      const parentURI = `kg:${decision.parentName}`;

      // Check if already created in this batch
      if (createdParents.has(parentURI)) {
        return parentURI;
      }

      // Check if already exists in triplestore (maybe added by another sentence)
      const existing = await this.tripleStore.query(parentURI, 'rdf:type', 'owl:Class');
      if (existing.length > 0) {
        return parentURI;
      }

      console.log(`  🔨 Creating intermediate parent: ${decision.parentName}`);

      // Determine grandparent:
      // 1. Use suggestedSupertype if provided (from gap analysis)
      // 2. Use LLM's decision.grandparent
      // 3. Recursively determine if needed
      let grandparent;
      if (suggestedSuperURI) {
        // Use suggested supertype as grandparent
        grandparent = suggestedSuperURI;
        console.log(`  📍 Using suggested supertype as grandparent: ${grandparent}`);
      } else if (decision.grandparent && decision.grandparent !== 'owl:Thing') {
        // Recursively determine grandparent (in case it needs abstraction too)
        grandparent = await this.determineParentClass(
          { name: decision.grandparent.split(':')[1], description: decision.parentDescription },
          domain,
          createdParents
        );
      } else {
        grandparent = decision.grandparent || 'owl:Thing';
      }

      // Add parent class to triplestore
      const parentTriples = [
        [parentURI, 'rdf:type', 'owl:Class'],
        [parentURI, 'rdfs:label', `"${decision.parentName}"`],
        [parentURI, 'rdfs:comment', `"${decision.parentDescription}"`],
        [parentURI, 'rdfs:subClassOf', grandparent]
      ];

      for (const triple of parentTriples) {
        await this.tripleStore.add(...triple);
      }

      // Index in semantic search
      await this.semanticSearch.insert('ontology-classes', {
        text: decision.parentDescription
          ? `${decision.parentName}: ${decision.parentDescription}`
          : decision.parentName,
        metadata: {
          classURI: parentURI,
          label: decision.parentName
        }
      });

      // Mark as created
      createdParents.add(parentURI);

      console.log(`  ✅ Created parent: ${parentURI} → ${grandparent}`);

      // REFACTORING STEP: Update existing siblings to be children of new parent
      if (decision.siblingClasses && decision.siblingClasses.length > 0) {
        console.log(`  🔄 Refactoring ${decision.siblingClasses.length} existing sibling(s)...`);

        for (const siblingURI of decision.siblingClasses) {
          // Get current parent
          const currentParents = await this.tripleStore.query(
            siblingURI,
            'rdfs:subClassOf',
            null
          );

          if (currentParents.length > 0) {
            const oldParent = currentParents[0][2]; // Triple format: [subject, predicate, object]

            // Remove old parent relationship
            await this.tripleStore.remove(
              siblingURI,
              'rdfs:subClassOf',
              oldParent
            );

            // Add new parent relationship
            await this.tripleStore.add(
              siblingURI,
              'rdfs:subClassOf',
              parentURI
            );

            console.log(`    ✓ Updated: ${siblingURI} (${oldParent} → ${parentURI})`);
          }
        }

        console.log(`  ✅ Refactoring complete`);
      }

      return parentURI;
    }

    throw new Error(`Unknown action from LLM: ${decision.action}`);
  }

  /**
   * Index new classes in semantic search with multi-perspective vectors
   *
   * @param {Array} additions - Array of RDF triples
   */
  async indexNewClasses(additions) {
    // Find all classes in additions
    const classTriples = additions.filter(t => t[1] === 'rdf:type' && t[2] === 'owl:Class');

    for (const classTriple of classTriples) {
      const classURI = classTriple[0];

      // Get label and all perspective descriptions
      const labelTriples = additions.filter(t => t[0] === classURI && t[1] === 'rdfs:label');
      const definitionTriples = additions.filter(t => t[0] === classURI && t[1] === 'skos:definition');
      const commentTriples = additions.filter(t => t[0] === classURI && t[1] === 'rdfs:comment');
      const scopeNoteTriples = additions.filter(t => t[0] === classURI && t[1] === 'skos:scopeNote');
      const altLabelTriples = additions.filter(t => t[0] === classURI && t[1] === 'skos:altLabel');

      const label = labelTriples[0]?.[2]?.replace(/"/g, '') || '';
      const definition = definitionTriples[0]?.[2]?.replace(/"/g, '') || '';
      const supertypeDescription = commentTriples[0]?.[2]?.replace(/"/g, '') || '';
      const usageDescription = scopeNoteTriples[0]?.[2]?.replace(/"/g, '') || '';
      const synonyms = altLabelTriples[0]?.[2]?.replace(/"/g, '') || '';

      // Create multiple perspectives like ToolIndexer pattern
      const perspectives = [
        {
          type: 'definition',
          text: definition ? `${label}: ${definition}` : label
        },
        {
          type: 'supertype',
          text: supertypeDescription ? `${label}: ${supertypeDescription}` : label
        },
        {
          type: 'usage',
          text: usageDescription ? `${label}: ${usageDescription}` : label
        },
        {
          type: 'synonyms',
          text: synonyms || label
        }
      ];

      // Index each perspective as a separate vector
      for (const perspective of perspectives) {
        await this.semanticSearch.insert('ontology-classes', {
          text: perspective.text,
          metadata: {
            classURI,
            label,
            perspectiveType: perspective.type
          }
        });
      }
    }
  }

  /**
   * Index new relationships in semantic search with multi-perspective vectors
   *
   * @param {Array} additions - Array of RDF triples
   */
  async indexNewRelationships(additions) {
    // Find all relationships in additions
    const relTriples = additions.filter(t => t[1] === 'rdf:type' && t[2] === 'owl:ObjectProperty');

    for (const relTriple of relTriples) {
      const relURI = relTriple[0];

      // Get label and all perspective descriptions
      const labelTriples = additions.filter(t => t[0] === relURI && t[1] === 'rdfs:label');
      const definitionTriples = additions.filter(t => t[0] === relURI && t[1] === 'skos:definition');
      const commentTriples = additions.filter(t => t[0] === relURI && t[1] === 'rdfs:comment');
      const scopeNoteTriples = additions.filter(t => t[0] === relURI && t[1] === 'skos:scopeNote');
      const altLabelTriples = additions.filter(t => t[0] === relURI && t[1] === 'skos:altLabel');
      const domainTriples = additions.filter(t => t[0] === relURI && t[1] === 'rdfs:domain');
      const rangeTriples = additions.filter(t => t[0] === relURI && t[1] === 'rdfs:range');

      const label = labelTriples[0]?.[2]?.replace(/"/g, '') || '';
      const definition = definitionTriples[0]?.[2]?.replace(/"/g, '') || '';
      const supertypeDescription = commentTriples[0]?.[2]?.replace(/"/g, '') || '';
      const usageDescription = scopeNoteTriples[0]?.[2]?.replace(/"/g, '') || '';
      const synonyms = altLabelTriples[0]?.[2]?.replace(/"/g, '') || '';
      const domain = domainTriples[0]?.[2] || '';
      const range = rangeTriples[0]?.[2] || '';

      // Create multiple perspectives
      const perspectives = [
        {
          type: 'definition',
          text: definition ? `${label}: ${definition}` : label
        },
        {
          type: 'supertype',
          text: supertypeDescription ? `${label}: ${supertypeDescription}` : label
        },
        {
          type: 'usage',
          text: usageDescription ? `${label}: ${usageDescription}` : label
        },
        {
          type: 'synonyms',
          text: synonyms || label
        }
      ];

      // Index each perspective as a separate vector
      for (const perspective of perspectives) {
        await this.semanticSearch.insert('ontology-relationships', {
          text: perspective.text,
          metadata: {
            relURI,
            label,
            domain,
            range,
            perspectiveType: perspective.type
          }
        });
      }
    }
  }

  /**
   * Find relationships with similar domain for potential abstraction
   *
   * Strategy: Find relationships with COMPATIBLE DOMAIN (relaxed compatibility)
   * The LLM will decide if they're semantically similar enough to group,
   * and will determine the appropriate broadened range for the parent.
   *
   * @param {string} domainA - Domain of new relationship (e.g., "kg:Plumber")
   * @param {string} rangeB - Range of new relationship (e.g., "kg:Pipe")
   * @param {Object} hierarchyTraversal - Hierarchy traversal service
   * @returns {Promise<Array>} - Potentially related relationships [{uri, label, description, domain, range, parent}]
   */
  async findCompatibleRelationships(domainA, rangeB, hierarchyTraversal) {
    // Build hierarchies for domain and range
    const domainHierarchy = [domainA, ...(await hierarchyTraversal.getAncestors(domainA))];
    const rangeHierarchy = [rangeB, ...(await hierarchyTraversal.getAncestors(rangeB))];

    // Get all ObjectProperties in ontology
    const allObjectProperties = await this.tripleStore.query(null, 'rdf:type', 'owl:ObjectProperty');

    const compatible = [];

    for (const [relURI] of allObjectProperties) {
      // Get domain and range of this relationship
      const domains = await this.tripleStore.query(relURI, 'rdfs:domain', null);
      const ranges = await this.tripleStore.query(relURI, 'rdfs:range', null);
      const labels = await this.tripleStore.query(relURI, 'rdfs:label', null);
      const comments = await this.tripleStore.query(relURI, 'rdfs:comment', null);
      const parents = await this.tripleStore.query(relURI, 'rdfs:subPropertyOf', null);

      const domainC = domains[0]?.[2];
      const rangeD = ranges[0]?.[2];
      const label = labels[0]?.[2]?.replace(/"/g, '') || relURI.split(':')[1];
      const description = comments[0]?.[2]?.replace(/"/g, '') || '';
      const parent = parents[0]?.[2] || 'kg:relatesTo';

      if (!domainC || !rangeD) continue;

      // RELAXED COMPATIBILITY: Only check domain compatibility
      // This allows LLM to group relationships like:
      //   installs (Plumber → Pipe)
      //   repairs (Plumber → Faucet)
      // Even though Pipe and Faucet are siblings (not subsumption-compatible)
      //
      // The LLM will create parent with broadened range:
      //   performs (Plumber → PlumbingComponent)
      const domainCompatible = domainHierarchy.includes(domainC); // A ⊆ C (C is A or ancestor of A)

      if (domainCompatible) {
        compatible.push({
          uri: relURI,
          label,
          description,
          domain: domainC,
          range: rangeD,
          parent
        });
      }
    }

    return compatible;
  }

  /**
   * Determine parent relationship for new relationship using LLM with dynamic abstraction
   *
   * Uses two-phase approach:
   * 1. Filter for subsumption-compatible relationships (mathematical constraint)
   * 2. LLM decides abstraction strategy from valid options
   *
   * @param {Object} newRel - New relationship to add
   * @param {string} newRel.name - Relationship name
   * @param {string} newRel.description - Relationship description
   * @param {string} newRel.domain - Domain class name (not URI)
   * @param {string} newRel.range - Range class name (not URI)
   * @param {string} domain - Domain context
   * @param {Object} hierarchyTraversal - Hierarchy traversal service
   * @param {Set} createdRelParents - Track parents created in this batch to avoid duplicates
   * @returns {Promise<string>} - Parent relationship URI (e.g., "kg:performs" or "kg:relatesTo")
   */
  async determineParentRelationship(newRel, domain, hierarchyTraversal, createdRelParents = new Set()) {
    // Convert class names to URIs for compatibility check
    const domainURI = `kg:${newRel.domain}`;
    const rangeURI = `kg:${newRel.range}`;

    // Phase 1: MATHEMATICAL FILTER - Find subsumption-compatible relationships
    const allCompatibleRels = await this.findCompatibleRelationships(domainURI, rangeURI, hierarchyTraversal);

    // Exclude kg:relatesTo from consideration (it's the universal fallback, not a meaningful abstraction)
    const compatibleRels = allCompatibleRels.filter(rel => rel.uri !== 'kg:relatesTo');

    console.log(`  🔍 Found ${compatibleRels.length} compatible relationships for ${newRel.name} (${newRel.domain} → ${newRel.range}):`,
      compatibleRels.map(r => `${r.label} (${r.domain} → ${r.range})`).join(', ') || 'none');

    // If no meaningful compatible relationships exist, use kg:relatesTo
    if (compatibleRels.length === 0) {
      console.log(`  → Using kg:relatesTo (no compatible relationships)`);
      return 'kg:relatesTo';
    }

    // Phase 2: LLM DECISION - Choose abstraction strategy from valid options
    // Load template if not already loaded
    if (!this.determineParentRelTemplate) {
      const templatePath = join(__dirname, '../prompts/determine-parent-relationship-with-abstraction.hbs');
      this.determineParentRelTemplate = await readFile(templatePath, 'utf-8');
    }

    // Define response schema
    const responseSchema = {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['USE_EXISTING', 'CREATE_PARENT'] },
        parent: { type: 'string' },
        parentName: { type: 'string' },
        parentDescription: { type: 'string' },
        grandparent: { type: 'string' },
        reasoning: { type: 'string' }
      },
      required: ['action', 'reasoning']
    };

    // Create TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.determineParentRelTemplate,
      responseSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    // Execute with variables
    const result = await templatedPrompt.execute({
      newRelationshipName: newRel.name,
      newRelationshipDescription: newRel.description || newRel.name,
      domain: newRel.domain,
      range: newRel.range,
      domainContext: domain,
      existingRelationships: compatibleRels.length > 0 ? compatibleRels : null
    });

    // Check if LLM call succeeded
    if (!result.success) {
      throw new Error(`LLM failed to determine parent relationship: ${result.errors.join('; ')}`);
    }

    const decision = result.data;

    // Handle decision
    if (decision.action === 'USE_EXISTING') {
      return decision.parent;
    }

    // CREATE_PARENT: need to create intermediate parent relationship first
    if (decision.action === 'CREATE_PARENT') {
      const parentURI = `kg:${decision.parentName}`;

      // Check if already created in this batch
      if (createdRelParents.has(parentURI)) {
        return parentURI;
      }

      // Check if already exists in triplestore (maybe added by another sentence)
      const existing = await this.tripleStore.query(parentURI, 'rdf:type', 'owl:ObjectProperty');
      if (existing.length > 0) {
        return parentURI;
      }

      console.log(`  🔨 Creating intermediate relationship parent: ${decision.parentName}`);

      // Recursively determine grandparent (in case it needs abstraction too)
      const grandparent = decision.grandparent && decision.grandparent !== 'kg:relatesTo'
        ? await this.determineParentRelationship(
            {
              name: decision.grandparent.split(':')[1],
              description: decision.parentDescription,
              domain: newRel.domain,  // Use same domain/range for recursion
              range: newRel.range
            },
            domain,
            hierarchyTraversal,
            createdRelParents
          )
        : decision.grandparent || 'kg:relatesTo';

      // Determine domain and range for parent relationship
      // Domain: Use the broadest compatible domain (first one is usually broadest due to hierarchy traversal)
      const parentDomain = compatibleRels[0]?.domain || domainURI;

      // Range: Find LCA (Lowest Common Ancestor) of all ranges
      // This ensures the parent can cover all child relationships
      const allRanges = [rangeURI, ...compatibleRels.map(r => r.range)];
      const parentRange = (await this.findLowestCommonAncestor(allRanges, hierarchyTraversal)) || 'owl:Thing';

      // Add parent relationship to triplestore
      const parentTriples = [
        [parentURI, 'rdf:type', 'owl:ObjectProperty'],
        [parentURI, 'rdfs:label', `"${decision.parentName}"`],
        [parentURI, 'rdfs:comment', `"${decision.parentDescription}"`],
        [parentURI, 'rdfs:subPropertyOf', grandparent],
        [parentURI, 'rdfs:domain', parentDomain],
        [parentURI, 'rdfs:range', parentRange]
      ];

      for (const triple of parentTriples) {
        await this.tripleStore.add(...triple);
      }

      // Mark as created
      createdRelParents.add(parentURI);

      console.log(`  ✅ Created relationship parent: ${parentURI} → ${grandparent} (${parentDomain} → ${parentRange})`);

      return parentURI;
    }

    throw new Error(`Unknown action from LLM: ${decision.action}`);
  }

  /**
   * Find Lowest Common Ancestor of multiple classes
   *
   * @param {Array<string>} classURIs - Array of class URIs
   * @param {Object} hierarchyTraversal - Hierarchy traversal service
   * @returns {Promise<string|null>} - LCA URI or null if only owl:Thing is common
   */
  async findLowestCommonAncestor(classURIs, hierarchyTraversal) {
    if (classURIs.length === 0) return null;
    if (classURIs.length === 1) return classURIs[0];

    // Get full hierarchy for first class (including itself)
    const firstClass = classURIs[0];
    const firstHierarchy = [firstClass, ...(await hierarchyTraversal.getAncestors(firstClass))];

    // Pre-fetch all hierarchies to avoid async in .every()
    const hierarchies = await Promise.all(
      classURIs.map(async (classURI) => ({
        classURI,
        hierarchy: [classURI, ...(await hierarchyTraversal.getAncestors(classURI))]
      }))
    );

    // Find first ancestor that ALL classes share
    for (const candidate of firstHierarchy) {
      const isCommonAncestor = hierarchies.every(({ hierarchy }) =>
        hierarchy.includes(candidate)
      );

      if (isCommonAncestor && candidate !== 'owl:Thing') {
        return candidate;
      }
    }

    // If only owl:Thing is common, return null (caller uses owl:Thing as fallback)
    return null;
  }

  /**
   * Map JavaScript types to XSD types
   *
   * @param {string} type - JavaScript type
   * @returns {string} - XSD type URI
   */
  mapToXSDType(type) {
    const typeMap = {
      'string': 'xsd:string',
      'number': 'xsd:decimal',
      'integer': 'xsd:integer',
      'boolean': 'xsd:boolean',
      'date': 'xsd:date'
    };
    return typeMap[type] || 'xsd:string';
  }

  /**
   * Verify triples before adding them to triple store
   *
   * @param {Array} newTriples - Triples to verify before adding
   * @returns {Promise<{valid: boolean, violations: Array}>}
   * @private
   */
  async _verifyBeforeAdd(newTriples) {
    // If verification disabled, always pass
    if (!this.verification || !this.verification.config.enabled) {
      return { valid: true, violations: [] };
    }

    return await this.verification.verifyBeforeExtension(newTriples);
  }

  /**
   * Get all axiom triples from triple store for verification
   *
   * @returns {Promise<Array>} Array of [subject, predicate, object] triples
   * @private
   */
  async _getAxiomTriples() {
    const predicates = [
      'rdf:type',
      'rdfs:subClassOf',
      'owl:disjointWith',
      'rdfs:domain',
      'rdfs:range',
      'owl:equivalentClass',
      'owl:inverseOf'
    ];

    const triples = [];

    for (const predicate of predicates) {
      const results = await this.tripleStore.query(null, predicate, null);
      for (const result of results) {
        // Triple format: [subject, predicate, object]
        // Skip if any component is undefined
        if (result[0] && result[2]) {
          triples.push([result[0], predicate, result[2]]);
        }
      }
    }

    return triples;
  }
}
