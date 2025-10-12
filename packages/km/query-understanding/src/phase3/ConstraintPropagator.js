/**
 * Phase 3: ConstraintPropagator
 *
 * Simplifies and propagates constraints across the LogicalSkeleton.
 *
 * Operations:
 * - Remove duplicate atoms
 * - Simplify expressions
 * - Variable unification (future)
 * - Type checking (future)
 */

/**
 * ConstraintPropagator - Optimize and simplify LogicalSkeleton
 */
export class ConstraintPropagator {
  /**
   * Propagate constraints and simplify skeleton
   *
   * @param {Object} skeleton - LogicalSkeleton from TreeWalker
   * @returns {Object} Optimized LogicalSkeleton
   */
  propagate(skeleton) {
    // Clone skeleton to avoid mutations
    const optimized = {
      vars: [...skeleton.vars],
      atoms: [...skeleton.atoms],
      project: [...skeleton.project],
      order: [...skeleton.order],
      limit: skeleton.limit,
      force: skeleton.force,
      notes: [...(skeleton.notes || [])]
    };

    // Operation 1: Remove duplicate atoms
    optimized.atoms = this._removeDuplicateAtoms(optimized.atoms);

    // Future: Variable unification
    // Future: Type checking

    return optimized;
  }

  /**
   * Remove duplicate atoms
   *
   * @private
   * @param {Array} atoms - Array of atoms
   * @returns {Array} Deduplicated atoms
   */
  _removeDuplicateAtoms(atoms) {
    const seen = new Set();
    const unique = [];

    for (const atom of atoms) {
      const key = JSON.stringify(atom);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(atom);
      }
    }

    return unique;
  }
}
