/**
 * PlannerService Port
 * Interface for planning backend services
 */

export class PlannerService {
  /**
   * Initialize the planner service
   */
  async initialize() {
    throw new Error('PlannerService.initialize must be implemented');
  }
  
  /**
   * Start informal planning
   * @param {string} goal - Planning goal
   * @param {object} context - Planning context
   * @param {function} progressCallback - Progress update callback
   * @returns {Promise<object>} Planning result
   */
  async planInformal(goal, context, progressCallback) {
    throw new Error('PlannerService.planInformal must be implemented');
  }
  
  /**
   * Start formal planning
   * @param {object} informalResult - Result from informal planning
   * @param {function} progressCallback - Progress update callback
   * @returns {Promise<object>} Formal planning result
   */
  async planFormal(informalResult, progressCallback) {
    throw new Error('PlannerService.planFormal must be implemented');
  }
  
  /**
   * Discover tools for tasks
   * @param {object} hierarchy - Task hierarchy
   * @param {function} progressCallback - Progress update callback
   * @returns {Promise<object>} Tool discovery result
   */
  async discoverTools(hierarchy, progressCallback) {
    throw new Error('PlannerService.discoverTools must be implemented');
  }
  
  /**
   * Search for tools
   * @param {string} query - Search query
   * @param {string} searchType - TEXT or SEMANTIC
   * @param {number} limit - Result limit
   * @returns {Promise<array>} Search results
   */
  async searchTools(query, searchType, limit) {
    throw new Error('PlannerService.searchTools must be implemented');
  }
  
  /**
   * List all available tools
   * @returns {Promise<array>} All tools
   */
  async listAllTools() {
    throw new Error('PlannerService.listAllTools must be implemented');
  }
  
  /**
   * Get tool registry statistics
   * @returns {Promise<object>} Registry stats
   */
  async getRegistryStats() {
    throw new Error('PlannerService.getRegistryStats must be implemented');
  }
  
  /**
   * Cancel current planning operation
   */
  cancel() {
    throw new Error('PlannerService.cancel must be implemented');
  }
  
  /**
   * Generate report for planning results
   * @param {object} plan - Planning result
   * @returns {string} Report text
   */
  generateReport(plan) {
    throw new Error('PlannerService.generateReport must be implemented');
  }
}