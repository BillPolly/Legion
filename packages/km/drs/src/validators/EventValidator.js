/**
 * EventValidator - Validates events, unary facts, and binary facts
 */

export class EventValidator {
  /**
   * @param {string[]} entityIds - Array of entity IDs from DiscourseMemory
   * @param {RelationInventory} inventory - Relation inventory with allowed predicates and roles
   */
  constructor(entityIds, inventory) {
    this.entityIds = new Set(entityIds);
    this.inventory = inventory;
    this.eventIds = new Set();
  }

  /**
   * Validate events, unary facts, and binary facts
   * @param {Event[]} events - Array of events
   * @param {UnaryFact[]} unaryFacts - Array of unary facts
   * @param {BinaryFact[]} binaryFacts - Array of binary facts
   * @returns {{isValid: boolean, errors: Array<{path: string, message: string}>}}
   */
  validate(events, unaryFacts, binaryFacts) {
    const errors = [];

    // First pass: collect event IDs
    for (const event of events) {
      this.eventIds.add(event.id);
    }

    // Validate events
    this.validateEvents(events, errors);

    // Validate unary facts
    this.validateUnaryFacts(unaryFacts, errors);

    // Validate binary facts
    this.validateBinaryFacts(binaryFacts, errors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate events
   */
  validateEvents(events, errors) {
    const seenIds = new Set();

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const path = `events[${i}]`;

      // Check for duplicate event IDs
      if (seenIds.has(event.id)) {
        errors.push({
          path: `${path}.id`,
          message: `duplicate event ID ${event.id}`
        });
      } else {
        seenIds.add(event.id);
      }

      // Validate roles
      this.validateRoles(event, path, errors);
    }
  }

  /**
   * Validate event roles
   */
  validateRoles(event, path, errors) {
    const { roles } = event;

    for (const [roleName, target] of Object.entries(roles)) {
      // Check role name is in inventory (roles have 'label' field)
      const validRole = this.inventory.roles.some(role => role.label === roleName);
      if (!validRole) {
        const roleLabels = this.inventory.roles.map(r => r.label).join(', ');
        errors.push({
          path: `${path}.roles`,
          message: `role ${roleName} not in inventory: ${roleLabels}`
        });
      }

      // Check role target is a valid referent (entity or event)
      if (!this.isValidReferent(target)) {
        errors.push({
          path: `${path}.roles.${roleName}`,
          message: `target ${target} is not a known entity ID or event ID`
        });
      }
    }
  }

  /**
   * Validate unary facts
   */
  validateUnaryFacts(unaryFacts, errors) {
    for (let i = 0; i < unaryFacts.length; i++) {
      const fact = unaryFacts[i];
      const path = `unaryFacts[${i}]`;

      // Check predicate is in inventory (predicates have 'synonyms' array)
      const validPred = this.inventory.unaryPredicates.some(synset =>
        synset.synonyms && synset.synonyms.includes(fact.pred)
      );
      if (!validPred) {
        const predList = this.inventory.unaryPredicates
          .map(s => s.synonyms?.[0] || s.id || 'unknown')
          .join(', ');
        errors.push({
          path: `${path}.pred`,
          message: `predicate "${fact.pred}" not in inventory: ${predList}`
        });
      }

      // Check arity
      if (fact.args.length !== 1) {
        errors.push({
          path: `${path}.args`,
          message: `unary fact must have exactly 1 argument, got ${fact.args.length}`
        });
      }

      // Check arguments are valid referents
      for (let j = 0; j < fact.args.length; j++) {
        if (!this.isValidReferent(fact.args[j])) {
          errors.push({
            path: `${path}.args[${j}]`,
            message: `argument ${fact.args[j]} not a valid referent (entity or event ID)`
          });
        }
      }
    }
  }

  /**
   * Validate binary facts
   */
  validateBinaryFacts(binaryFacts, errors) {
    for (let i = 0; i < binaryFacts.length; i++) {
      const fact = binaryFacts[i];
      const path = `binaryFacts[${i}]`;

      // Check relation is in inventory (relations have 'synonyms' array)
      const validRel = this.inventory.binaryRelations.some(synset =>
        synset.synonyms && synset.synonyms.includes(fact.pred)
      );
      if (!validRel) {
        const relList = this.inventory.binaryRelations
          .map(s => s.synonyms?.[0] || s.id || 'unknown')
          .join(', ');
        errors.push({
          path: `${path}.pred`,
          message: `relation "${fact.pred}" not in inventory: ${relList}`
        });
      }

      // Check arity
      if (fact.args.length !== 2) {
        errors.push({
          path: `${path}.args`,
          message: `binary fact must have exactly 2 arguments, got ${fact.args.length}`
        });
      }

      // Check arguments are valid referents
      for (let j = 0; j < fact.args.length; j++) {
        if (!this.isValidReferent(fact.args[j])) {
          errors.push({
            path: `${path}.args[${j}]`,
            message: `argument ${fact.args[j]} not a valid referent (entity or event ID)`
          });
        }
      }
    }
  }

  /**
   * Check if a referent is valid (entity ID or event ID)
   */
  isValidReferent(ref) {
    return this.entityIds.has(ref) || this.eventIds.has(ref);
  }
}
