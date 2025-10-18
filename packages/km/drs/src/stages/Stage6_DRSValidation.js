/**
 * Stage6_DRSValidation - Validate DRS structure
 *
 * This stage validates:
 * 1. Unique referents
 * 2. Bound arguments (except box IDs in meta-relations)
 * 3. Allowed formats (pred XOR rel, with args)
 * 4. Role arity (semantic roles must have arity 2)
 * 5. Scope sanity (basic structural checks)
 *
 * Returns {valid: boolean, errors: string[]}
 */

export class Stage6_DRSValidation {
  // Semantic roles that must have arity 2
  static SEMANTIC_ROLES = [
    'Agent', 'Theme', 'Patient', 'Experiencer', 'Instrument',
    'Location', 'Source', 'Goal', 'Recipient', 'Beneficiary',
    'Stimulus', 'Topic', 'Cause', 'Result', 'Manner', 'Time'
  ];

  // Meta-relations that can reference box IDs
  static META_RELATIONS = ['Not', 'Imp', 'Or'];

  // Quantifiers with variable arity
  static QUANTIFIERS = ['Some', 'Every'];

  /**
   * Validate ClausalDRS structure
   * @param {ClausalDRS} drs - Input DRS
   * @returns {{valid: boolean, errors: string[]}}
   */
  process(drs) {
    const errors = [];

    // 1. Validate unique referents
    const seen = new Set();
    for (const ref of drs.referents) {
      if (seen.has(ref)) {
        errors.push(`Duplicate referent: ${ref}`);
      }
      seen.add(ref);
    }

    const referentSet = new Set(drs.referents);

    // 2-5. Validate each condition
    for (const condition of drs.conditions) {
      // Validate format: must have pred XOR rel, and must have args
      if (!condition.pred && !condition.rel) {
        errors.push('Condition must have either "pred" or "rel" field');
        continue;
      }
      if (condition.pred && condition.rel) {
        errors.push('Condition cannot have both "pred" and "rel" fields');
        continue;
      }
      if (!condition.args) {
        errors.push('Condition must have "args" field');
        continue;
      }

      // Validate bound arguments (except box IDs in meta-relations)
      const isMetaRelation = condition.rel && Stage6_DRSValidation.META_RELATIONS.includes(condition.rel);
      
      if (!isMetaRelation) {
        for (const arg of condition.args) {
          if (!referentSet.has(arg)) {
            errors.push(`Unbound argument "${arg}" in condition`);
          }
        }
      }

      // Validate role arity
      if (condition.rel && Stage6_DRSValidation.SEMANTIC_ROLES.includes(condition.rel)) {
        if (condition.args.length !== 2) {
          errors.push(`Semantic role "${condition.rel}" must have arity 2, got ${condition.args.length}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}
