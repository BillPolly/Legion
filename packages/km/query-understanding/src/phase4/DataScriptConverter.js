/**
 * Phase 4: DataScriptConverter
 *
 * Converts LogicalSkeleton to DataScript query format.
 *
 * DataScript format is used by DataSource adapters which handle
 * backend-specific translation (SPARQL, Cypher, MongoDB, etc.)
 *
 * Conversion Rules (from DESIGN.md):
 * 1. Project → Find clause
 * 2. ISA atoms → Type triples
 * 3. REL atoms → Property triples
 * 4. HAS atoms → Attribute triples
 * 5. FILTER atoms → Predicate functions
 * 6. Aggregations (COUNT, MAX, etc.)
 * 7. Operations → Complex expressions
 */

/**
 * DataScriptConverter - Convert LogicalSkeleton to DataScript query
 */
export class DataScriptConverter {
  /**
   * Convert LogicalSkeleton to DataScript query format
   *
   * @param {Object} skeleton - LogicalSkeleton from Phase 3
   * @returns {Object} DataScript query
   */
  convert(skeleton) {
    if (!skeleton) {
      throw new Error('LogicalSkeleton is required');
    }

    const dataScriptQuery = {
      find: this._convertProjection(skeleton.project),
      where: this._convertAtoms(skeleton.atoms)
    };

    // Add whereNot if negated atoms exist
    if (skeleton.whereNot && skeleton.whereNot.length > 0) {
      dataScriptQuery.whereNot = this._convertAtoms(skeleton.whereNot);
    }

    // NEW: Add compute clause if operations exist
    if (skeleton.operations && skeleton.operations.length > 0) {
      dataScriptQuery.operations = skeleton.operations;
    }

    return dataScriptQuery;
  }

  /**
   * Convert projection to find clause
   *
   * Rule 1: Project → Find clause
   * Rule 6: Aggregations
   *
   * @private
   * @param {Array} project - Projection specification
   * @returns {Array} Find clause
   */
  _convertProjection(project) {
    if (!project || project.length === 0) {
      return [];
    }

    return project.map(item => {
      // Check for aggregation: ['COUNT', '?x'] → '(count ?x)'
      if (Array.isArray(item)) {
        const [aggFunc, variable] = item;
        const funcName = aggFunc.toLowerCase();
        return `(${funcName} ${variable})`;
      }

      // Simple variable: '?x' → '?x'
      return item;
    });
  }

  /**
   * Convert atoms to where clauses
   *
   * Rule 2: ISA atoms → Type triples
   * Rule 3: REL atoms → Property triples
   * Rule 4: HAS atoms → Attribute triples
   *
   * @private
   * @param {Array} atoms - Array of atoms
   * @returns {Array} Where clauses
   */
  _convertAtoms(atoms) {
    if (!atoms || atoms.length === 0) {
      return [];
    }

    const whereClauses = [];

    for (const atom of atoms) {
      if (!Array.isArray(atom) || atom.length < 2) {
        continue;  // Skip invalid atoms
      }

      const [atomType, ...args] = atom;

      switch (atomType) {
        case 'isa':
          // Rule 2: ['isa', '?x', ':Country'] → ['?x', ':type', ':Country']
          whereClauses.push(this._convertIsaAtom(args));
          break;

        case 'rel':
          // Rule 3: ['rel', ':borders', '?x', ':Germany'] → ['?x', ':borders', ':Germany']
          whereClauses.push(this._convertRelAtom(args));
          break;

        case 'has':
          // Rule 4: ['has', '?entity', ':revenue', '?v'] → ['?entity', ':revenue', '?v']
          whereClauses.push(this._convertHasAtom(args));
          break;

        case 'filter':
          // Rule 5: Filter atoms → predicate functions
          // TODO: Implement filter conversion
          // For now, skip
          break;

        case 'op':
          // Rule 7: Operations → complex expressions
          // TODO: Implement operation conversion
          // For now, skip
          break;

        default:
          // Unknown atom type - skip
          break;
      }
    }

    return whereClauses;
  }

  /**
   * Convert ISA atom to type triple
   *
   * Rule 2: ['isa', '?x', ':Country'] → ['?x', ':type', ':Country']
   *
   * @private
   * @param {Array} args - Atom arguments: [variable, class]
   * @returns {Array} Type triple
   */
  _convertIsaAtom(args) {
    const [variable, classIRI] = args;
    return [variable, ':type', classIRI];
  }

  /**
   * Convert REL atom to property triple
   *
   * Rule 3: ['rel', ':borders', '?x', ':Germany'] → ['?x', ':borders', ':Germany']
   *
   * @private
   * @param {Array} args - Atom arguments: [property, subject, object]
   * @returns {Array} Property triple
   */
  _convertRelAtom(args) {
    const [property, subject, object] = args;
    return [subject, property, object];
  }

  /**
   * Convert HAS atom to attribute triple
   *
   * Rule 4: ['has', '?entity', ':revenue', '?v'] → ['?entity', ':revenue', '?v']
   *
   * @private
   * @param {Array} args - Atom arguments: [entity, attribute, value]
   * @returns {Array} Attribute triple
   */
  _convertHasAtom(args) {
    const [entity, attribute, value] = args;
    return [entity, attribute, value];
  }
}
