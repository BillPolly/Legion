/**
 * DecentPlannerAdapter
 * Adapter for the DecentPlanner
 */

import { DecentPlanner } from '@legion/decent-planner';
import { PlannerService } from '../../application/ports/PlannerService.js';
import { InfrastructureError } from '../errors/InfrastructureError.js';

export class DecentPlannerAdapter extends PlannerService {
  constructor() {
    super();
    this.planner = null;
    this.currentInformalResult = null;
    this.initialized = false;
  }
  
  async initialize() {
    try {
      // Create planner with configuration
      this.planner = new DecentPlanner({
        maxDepth: 5,
        confidenceThreshold: 0.5,
        enableFormalPlanning: true,
        validateBehaviorTrees: true,
        logLevel: 'info'
      });
      
      // Initialize the planner
      await this.planner.initialize();
      
      this.initialized = true;
    } catch (error) {
      throw new InfrastructureError(
        `Failed to initialize planner: ${error.message}`,
        'PLANNER_INIT_FAILED',
        error
      );
    }
  }
  
  async planInformal(goal, context = {}, progressCallback = null) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Use planInformalOnly method from refactored planner
      const result = await this.planner.planInformalOnly(goal, context, progressCallback);
      
      if (result.success) {
        // Store the result for later formal planning
        this.currentInformalResult = result.data;
        
        return {
          success: true,
          goal,
          informal: {
            hierarchy: result.data.rootTask,
            statistics: result.data.statistics
          },
          duration: result.duration
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      throw new InfrastructureError(
        `Informal planning failed: ${error.message}`,
        'INFORMAL_PLANNING_FAILED',
        error
      );
    }
  }
  
  async planFormal(informalResult, progressCallback = null) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.currentInformalResult) {
      throw new InfrastructureError(
        'No informal planning result available',
        'NO_INFORMAL_RESULT'
      );
    }
    
    try {
      // Continue with formal planning using the stored result
      const result = await this.planner.plan(
        this.currentInformalResult.goal,
        {},
        progressCallback
      );
      
      if (result.success) {
        return {
          success: true,
          behaviorTrees: result.data.behaviorTrees,
          validation: result.data.validation,
          duration: result.duration
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      throw new InfrastructureError(
        `Formal planning failed: ${error.message}`,
        'FORMAL_PLANNING_FAILED',
        error
      );
    }
  }
  
  async discoverTools(hierarchy, progressCallback = null) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Use the DiscoverToolsUseCase through the planner
      const discoverToolsResult = await this.planner.useCases.discoverTools.execute({
        rootTask: hierarchy,
        progressCallback
      });
      
      if (discoverToolsResult.success) {
        return discoverToolsResult.data;
      } else {
        throw new Error(discoverToolsResult.error);
      }
    } catch (error) {
      throw new InfrastructureError(
        `Tool discovery failed: ${error.message}`,
        'TOOL_DISCOVERY_FAILED',
        error
      );
    }
  }
  
  async searchTools(query, searchType, limit = 50) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const toolRegistry = this.planner.dependencies.toolRegistry;
      
      if (searchType === 'SEMANTIC') {
        // Use semantic search
        return await toolRegistry.searchTools(query, { limit });
      } else {
        // Use text-based filtering
        const allTools = await toolRegistry.listTools();
        const queryLower = query.toLowerCase();
        
        return allTools
          .filter(tool => {
            const nameMatch = tool.name.toLowerCase().includes(queryLower);
            const descMatch = (tool.description || '').toLowerCase().includes(queryLower);
            return nameMatch || descMatch;
          })
          .slice(0, limit);
      }
    } catch (error) {
      throw new InfrastructureError(
        `Tool search failed: ${error.message}`,
        'TOOL_SEARCH_FAILED',
        error
      );
    }
  }
  
  async listAllTools() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const toolRegistry = this.planner.dependencies.toolRegistry;
      return await toolRegistry.listTools();
    } catch (error) {
      throw new InfrastructureError(
        `Failed to list tools: ${error.message}`,
        'LIST_TOOLS_FAILED',
        error
      );
    }
  }
  
  async getRegistryStats() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const toolRegistry = this.planner.dependencies.toolRegistry;
      const allTools = await toolRegistry.listTools();
      
      // Count unique modules
      const uniqueModules = new Set(allTools.map(t => t.moduleName)).size;
      
      return {
        totalTools: allTools.length,
        totalModules: uniqueModules
      };
    } catch (error) {
      throw new InfrastructureError(
        `Failed to get registry stats: ${error.message}`,
        'REGISTRY_STATS_FAILED',
        error
      );
    }
  }
  
  cancel() {
    if (this.planner) {
      this.planner.cancel();
    }
  }
  
  generateReport(plan) {
    if (!this.planner) {
      throw new InfrastructureError('Planner not initialized', 'PLANNER_NOT_INITIALIZED');
    }
    
    return this.planner.generateReport(plan);
  }
}