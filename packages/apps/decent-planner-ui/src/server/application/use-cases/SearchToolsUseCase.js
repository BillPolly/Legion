/**
 * SearchToolsUseCase
 * Searches for tools in the registry
 */

import { ToolSearchQuery } from '../../domain/entities/ToolSearchQuery.js';
import { ApplicationError } from '../errors/ApplicationError.js';

export class SearchToolsUseCase {
  constructor({ plannerService, uiRenderer }) {
    this.plannerService = plannerService;
    this.uiRenderer = uiRenderer;
  }
  
  async execute({ query, searchType, limit = 50 }) {
    try {
      // Create search query entity
      const searchQuery = new ToolSearchQuery(query, searchType, limit);
      
      // Update UI to show loading
      this.uiRenderer.showLoading('search', `Searching for "${query}"...`);
      
      // Execute search
      const results = await this.plannerService.searchTools(
        searchQuery.query,
        searchQuery.searchType,
        searchQuery.limit
      );
      
      // Update search query with results
      searchQuery.setResults(results);
      
      // Update UI with results
      this.uiRenderer.updateComponent('search', {
        query: searchQuery.query,
        searchType: searchQuery.searchType,
        results,
        count: results.length
      });
      
      return {
        success: true,
        searchQuery,
        results
      };
      
    } catch (error) {
      const appError = error instanceof ApplicationError ? error :
        new ApplicationError(
          `Search failed: ${error.message}`,
          'SEARCH_FAILED'
        );
      
      // Update UI with error
      this.uiRenderer.showError('search', appError.message);
      
      return {
        success: false,
        error: appError
      };
    }
  }
  
  async listAllTools() {
    try {
      // Update UI to show loading
      this.uiRenderer.showLoading('search', 'Loading all tools...');
      
      // Get all tools
      const tools = await this.plannerService.listAllTools();
      
      // Get registry stats
      const stats = await this.plannerService.getRegistryStats();
      
      // Update UI
      this.uiRenderer.updateComponent('search', {
        allTools: tools,
        stats
      });
      
      return {
        success: true,
        tools,
        stats
      };
      
    } catch (error) {
      const appError = error instanceof ApplicationError ? error :
        new ApplicationError(
          `Failed to list tools: ${error.message}`,
          'LIST_TOOLS_FAILED'
        );
      
      // Update UI with error
      this.uiRenderer.showError('search', appError.message);
      
      return {
        success: false,
        error: appError
      };
    }
  }
}