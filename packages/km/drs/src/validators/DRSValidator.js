/**
 * DRSValidator - Validates ClausalDRS structures
 */

export class DRSValidator {
  constructor() {
    // Meta-relations that can have box IDs instead of referents
    this.metaRelations = new Set(['Not', 'Imp', 'Or', 'Every', 'Some']);
  }

  /**
   * Validate a ClausalDRS
   * @param {ClausalDRS} drs - ClausalDRS to validate
   * @returns {{isValid: boolean, errors: Array<{path: string, message: string}>}}
   */
  validate(drs) {
    const errors = [];
    const referentSet = new Set(drs.referents);

    // Validate unique referents
    this.validateUniqueReferents(drs.referents, errors);

    // Validate conditions
    this.validateConditions(drs.conditions, referentSet, errors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate unique referents
   */
  validateUniqueReferents(referents, errors) {
    const seen = new Set();

    for (const ref of referents) {
      if (seen.has(ref)) {
        errors.push({
          path: 'referents',
          message: `duplicate referent ${ref}`
        });
      } else {
        seen.add(ref);
      }
    }
  }

  /**
   * Validate conditions
   */
  validateConditions(conditions, referentSet, errors) {
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const path = `conditions[${i}]`;

      // Check condition has either pred or rel
      if (!condition.pred && !condition.rel) {
        errors.push({
          path: path,
          message: 'condition must have either pred or rel'
        });
        continue;
      }

      // Validate based on type
      if (condition.pred) {
        this.validatePredicate(condition, path, referentSet, errors);
      } else if (condition.rel) {
        this.validateRelation(condition, path, referentSet, errors);
      }
    }
  }

  /**
   * Validate predicate condition
   */
  validatePredicate(condition, path, referentSet, errors) {
    // Check all arguments are bound
    for (let i = 0; i < condition.args.length; i++) {
      const arg = condition.args[i];
      if (!referentSet.has(arg)) {
        errors.push({
          path: `${path}.args[${i}]`,
          message: `argument ${arg} not bound in referents`
        });
      }
    }
  }

  /**
   * Validate relation condition
   */
  validateRelation(condition, path, referentSet, errors) {
    const { rel, args } = condition;

    // Check semantic role arity (must be 2: event + participant)
    if (!this.metaRelations.has(rel)) {
      // Regular semantic role (Agent, Theme, etc.)
      if (args.length !== 2) {
        errors.push({
          path: path,
          message: `semantic role ${rel} must have arity 2 (event + participant), got ${args.length}`
        });
      }
    }

    // Check all arguments are bound (except for meta-relations which can have box IDs)
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // Allow box IDs (e.g., "S1") for meta-relations
      if (this.metaRelations.has(rel) && this.isBoxId(arg)) {
        continue;
      }

      if (!referentSet.has(arg)) {
        errors.push({
          path: `${path}.args[${i}]`,
          message: `argument ${arg} not bound in referents`
        });
      }
    }
  }

  /**
   * Check if a string looks like a box ID
   */
  isBoxId(str) {
    return /^S\d+$/.test(str);
  }
}
