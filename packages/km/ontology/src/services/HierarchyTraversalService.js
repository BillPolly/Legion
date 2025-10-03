/**
 * HierarchyTraversalService - Navigate rdfs:subClassOf chains
 *
 * Provides methods to traverse class hierarchies:
 * - getAncestors: Walk up the parent chain
 * - getDescendants: Find direct children
 * - getHierarchyContext: Get full context (ancestors + descendants + depth)
 *
 * Supports both synchronous (SimpleTripleStore) and asynchronous (MongoTripleStore) APIs
 */

export class HierarchyTraversalService {
  constructor(tripleStore) {
    if (!tripleStore) {
      throw new Error('TripleStore is required');
    }
    this.tripleStore = tripleStore;
  }

  /**
   * Get all ancestor classes (parent → grandparent → ...)
   * Traverses rdfs:subClassOf chain upward
   *
   * @param {string} classURI - The class to start from
   * @returns {Promise<Array<string>>|Array<string>} - Array of ancestor URIs in order (parent, grandparent, ...)
   */
  async getAncestors(classURI) {
    const ancestors = [];
    let current = classURI;

    while (current) {
      const parents = await this.tripleStore.query(current, 'rdfs:subClassOf', null);
      if (parents.length > 0) {
        const parent = parents[0][2]; // First parent (assuming single inheritance)
        ancestors.push(parent);
        current = parent;
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Get all descendant classes (direct children only)
   * Does NOT recursively get grandchildren
   *
   * @param {string} classURI - The parent class
   * @returns {Promise<Array<string>>|Array<string>} - Array of direct child URIs
   */
  async getDescendants(classURI) {
    const descendants = await this.tripleStore.query(null, 'rdfs:subClassOf', classURI);
    return descendants.map(t => t[0]);
  }

  /**
   * Get full hierarchy context for a class
   * Includes ancestors, descendants, and depth in hierarchy
   *
   * @param {string} classURI - The class to analyze
   * @returns {Promise<Object>|Object} - Hierarchy context
   * @returns {string} return.class - The class URI
   * @returns {Array<string>} return.ancestors - Array of ancestor URIs
   * @returns {Array<string>} return.descendants - Array of direct child URIs
   * @returns {number} return.depth - Distance from root (number of ancestors)
   */
  async getHierarchyContext(classURI) {
    const ancestors = await this.getAncestors(classURI);
    const descendants = await this.getDescendants(classURI);

    return {
      class: classURI,
      ancestors,
      descendants,
      depth: ancestors.length
    };
  }
}
