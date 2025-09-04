/**
 * ServerPlannerActor
 * Uses DecentPlanner following Clean Architecture
 */

import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/resource-manager';
import { ServerExecutionActor } from './ServerExecutionActor.js';
import PlanFileService from '../services/PlanFileService.js';

export default class PlannerServerSubActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    this.parentActor = null;
    this.decentPlanner = null;
    this.toolRegistry = null;
    this.isReady = false;
    this.currentPlan = null;  // Store the plan entity
    this.executionActor = null;
  }

  setParentActor(parentActor) {
    this.parentActor = parentActor;
  }

  async setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
    console.log('🎭 Server planner actor connected');
    
    // Initialize execution actor
    this.executionActor = new ServerExecutionActor(this.services);
    this.executionActor.setRemoteActor(remoteActor);
    
    // Initialize DecentPlanner
    try {
      await this.initializePlanner();
      
      // Send ready signal
      this.remoteActor.receive('ready', {
        timestamp: new Date().toISOString()
      });
      
      this.isReady = true;
    } catch (error) {
      console.error('Failed to initialize planner - FULL ERROR:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error keys:', Object.keys(error));
      console.error('Error JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      this.remoteActor.receive('error', {
        message: error.message || 'Unknown error during planner initialization',
        name: error.name,
        stack: error.stack
      });
    }
  }

  async initializePlanner() {
    console.log('Initializing DecentPlanner...');
    
    // Create DecentPlanner with configuration
    this.decentPlanner = new DecentPlanner({
      maxDepth: 5,
      confidenceThreshold: 0.5,
      enableFormalPlanning: true,
      validateBehaviorTrees: true,
      logLevel: 'info'
    });
    
    // Initialize it
    await this.decentPlanner.initialize();
    
    // Get the tool registry from dependencies
    this.toolRegistry = this.decentPlanner.dependencies.toolRegistry;
    
    // Set up LLM event forwarding for ALL LLM clients used by the planner
    if (this.remoteActor) {
      this.decentPlanner.setLLMEventForwardingCallback((event) => {
        this.remoteActor.receive('llm-interaction', event);
      });
    }
    
    // Pass toolRegistry to execution actor
    if (this.executionActor && this.toolRegistry) {
      this.executionActor.setToolRegistry(this.toolRegistry);
    }

    // CRITICAL: Inject toolRegistry into shared services for chat agent
    if (this.toolRegistry && this.parentActor && this.parentActor.services) {
      this.parentActor.services.toolRegistry = this.toolRegistry;
      console.log('[PlannerServerSubActor] ✅ Injected toolRegistry into shared services');
    }
    
    // Load all modules for the tool registry
    if (this.toolRegistry) {
      console.log('Loading all tool modules...');
      const loadResult = await this.toolRegistry.loadAllModules();
      console.log(`✅ Loaded ${loadResult.loaded} modules, ${loadResult.failed} failed`);
    }
    
    console.log('✅ DecentPlanner initialized');
  }

  receive(messageType, data) {
    console.log('📨 Server received:', messageType);
    
    switch (messageType) {
      case 'plan-informal':
        this.handleInformalPlanRequest(data);
        break;
        
      case 'plan-formal':
        this.handleFormalPlanRequest(data);
        break;
        
      case 'discover-tools':
        this.handleDiscoverToolsRequest(data);
        break;
        
      // NOTE: Tool registry messages now handled by ToolRegistryServerSubActor
      case 'search-tools-text':
        this.handleSearchToolsTextRequest(data);
        break;
        
      case 'search-tools-semantic':
        this.handleSearchToolsSemanticRequest(data);
        break;
        
      case 'ping':
        this.remoteActor.receive('pong', { timestamp: Date.now() });
        break;
        
      case 'load-execution-tree':
        this.handleLoadExecutionTreeRequest(data);
        break;
        
      case 'execution-step':
      case 'execution-run':
      case 'execution-pause':
      case 'execution-reset':
      case 'execution-set-breakpoint':
      case 'execution-remove-breakpoint':
        if (this.executionActor) {
          this.executionActor.receive(messageType.replace('execution-', ''), data, this.remoteActor);
        }
        break;
        
      case 'cancel':
        this.cancelPlanning();
        break;
        
      case 'save-plan':
        this.handleSavePlanRequest(data);
        break;
        
      case 'load-plan':
        this.handleLoadPlanRequest(data);
        break;
        
      case 'list-saved-plans':
        this.handleListSavedPlansRequest();
        break;

      // NOTE: Module search now handled by ToolRegistryServerSubActor

      case 'database-query':
        this.handleDatabaseQueryRequest(data);
        break;

      case 'module-load':
        this.handleModuleLoadRequest(data);
        break;

      case 'module-unload':
        this.handleModuleUnloadRequest(data);
        break;
        
      default:
        console.warn('Unknown message type:', messageType);
    }
  }

  async handleInformalPlanRequest(data) {
    const { goal } = data;
    
    if (!goal || goal.trim() === '') {
      this.remoteActor.receive('informalPlanError', {
        error: 'Goal is required'
      });
      return;
    }
    
    try {
      // Send informal planning started
      this.remoteActor.receive('informalPlanStarted', {
        goal,
        timestamp: new Date().toISOString()
      });
      
      // Execute task decomposition only
      const result = await this.decentPlanner.planTaskDecompositionOnly(goal, {}, (message) => {
        // Send progress update to client
        this.remoteActor.receive('informalPlanProgress', {
          goal,
          message,
          timestamp: new Date().toISOString()
        });
      });
      
      if (result.success) {
        // Store the plan entity
        this.currentPlan = result.data;
        
        // Send result
        this.remoteActor.receive('informalPlanComplete', {
          goal,
          result: {
            success: true,
            goal,
            informal: {
              hierarchy: result.data,  // Send the complete plan object
              statistics: result.data.statistics ? JSON.parse(JSON.stringify(result.data.statistics)) : {}
            },
            duration: result.duration
          },
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('Informal planning failed:', error);
      
      if (error.message.includes('cancelled')) {
        this.remoteActor.receive('planCancelled', {
          message: 'Planning operation cancelled',
          timestamp: new Date().toISOString()
        });
      } else {
        this.remoteActor.receive('informalPlanError', {
          error: error.message
        });
      }
    }
  }

  async handleFormalPlanRequest(data) {
    if (!this.currentPlan) {
      this.remoteActor.receive('formalPlanError', {
        error: 'No informal planning result found on server'
      });
      return;
    }
    
    try {
      // Send formal planning started
      this.remoteActor.receive('formalPlanStarted', {
        goal: this.currentPlan.goal,
        timestamp: new Date().toISOString()
      });
      
      // Continue with full planning (which includes formal)
      const result = await this.decentPlanner.plan(
        this.currentPlan.goal,
        {},
        (message) => {
          this.remoteActor.receive('formalPlanProgress', {
            message,
            timestamp: new Date().toISOString()
          });
        }
      );
      
      if (result.success) {
        // Update stored plan
        this.currentPlan = result.data;
        
        // FIXED: Initialize BT executor with the REAL behavior tree (has tool objects)
        if (result.data.behaviorTrees && result.data.behaviorTrees.length > 0) {
          const realBehaviorTree = result.data.behaviorTrees[0]; // Get the real BT with tool objects
          console.log('🔧 Initializing BT executor with real behavior tree...');
          
          try {
            await this.executionActor.handleLoadTree({ tree: realBehaviorTree });
            console.log('✅ BT executor initialized with real behavior tree');
          } catch (error) {
            console.error('❌ Failed to initialize BT executor:', error.message);
          }
        }
        
        // Send result with cleaned behavior trees to avoid circular references
        const cleanBehaviorTrees = result.data.behaviorTrees ? 
          result.data.behaviorTrees.map(tree => this.serializeBehaviorTreeForClient(tree)) : [];
          
        this.remoteActor.receive('formalPlanComplete', {
          goal: this.currentPlan.goal,
          result: {
            success: true,
            plan: result.data.serialize ? result.data.serialize() : result.data,  // Use serialize method if available
            behaviorTrees: cleanBehaviorTrees,
            validation: result.data.validation,
            duration: result.duration
          },
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('Formal planning failed:', error);
      this.remoteActor.receive('formalPlanError', {
        error: error.message
      });
    }
  }

  async handleDiscoverToolsRequest(data) {
    if (!this.currentPlan || !this.currentPlan.rootTask) {
      this.remoteActor.receive('toolsDiscoveryError', {
        error: 'No informal planning result found on server'
      });
      return;
    }
    
    try {
      // Send tools discovery started
      this.remoteActor.receive('toolsDiscoveryStarted', {
        timestamp: new Date().toISOString()
      });
      
      // Execute tool discovery using the new method
      console.log('🔍 [SERVER] Starting tool discovery...');
      const result = await this.decentPlanner.discoverToolsForCurrentPlan((message) => {
        this.remoteActor.receive('toolsDiscoveryProgress', {
          message,
          timestamp: new Date().toISOString()
        });
      });
      
      if (result.success) {
        // Send result directly - Tool objects now have serialize() methods
        this.remoteActor.receive('toolsDiscoveryComplete', {
          result: result.data,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('Tool discovery failed:', error);
      
      if (error.message.includes('cancelled')) {
        this.remoteActor.receive('planCancelled', {
          message: 'Tool discovery cancelled',
          timestamp: new Date().toISOString()
        });
      } else {
        this.remoteActor.receive('toolsDiscoveryError', {
          error: error.message
        });
      }
    }
  }

  async enhanceToolDiscoveryWithMetadata(result) {
    if (!result) return result;
    
    const enhancedResult = JSON.parse(JSON.stringify(result));
    
    const enhanceTools = async (tools) => {
      if (!Array.isArray(tools)) return;
      
      for (const tool of tools) {
        try {
          const fullToolData = await this.toolRegistry.getTool(tool.name);
          
          if (fullToolData) {
            tool.metadata = {
              description: fullToolData.description || '',
              inputSchema: fullToolData.inputSchema || {},
              outputSchema: fullToolData.outputSchema || {},
              category: fullToolData.category || '',
              version: fullToolData.version || '',
              author: fullToolData.author || '',
              moduleName: fullToolData.moduleName || '',
              tags: fullToolData.tags || [],
              examples: fullToolData.examples || []
            };
          }
        } catch (error) {
          console.warn(`Failed to get metadata for tool ${tool.name}:`, error.message);
        }
      }
    };
    
    // Enhance tools in all possible locations
    if (enhancedResult.toolDiscovery && Array.isArray(enhancedResult.toolDiscovery)) {
      for (const taskResult of enhancedResult.toolDiscovery) {
        if (taskResult.discoveryResult && taskResult.discoveryResult.tools) {
          await enhanceTools(taskResult.discoveryResult.tools);
        }
      }
    }
    
    return enhancedResult;
  }

  async handleListAllToolsRequest() {
    try {
      if (!this.toolRegistry) {
        throw new Error('Tool registry not initialized');
      }
      
      const tools = await this.toolRegistry.listTools();
      
      this.remoteActor.receive('toolsListComplete', {
        tools,
        count: tools.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Failed to list tools - FULL ERROR:', error);
      console.error('Error message:', error.message);  
      console.error('Error stack:', error.stack);
      console.error('Error JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      this.remoteActor.receive('toolsListError', {
        error: error.message || 'Tool registry not initialized'
      });
    }
  }

  async handleSearchToolsTextRequest(data) {
    try {
      const { query } = data;
      
      if (!this.toolRegistry) {
        throw new Error('Tool registry not initialized');
      }
      
      const allTools = await this.toolRegistry.listTools();
      const queryLower = query.toLowerCase();
      
      const results = allTools.filter(tool => {
        const nameMatch = tool.name.toLowerCase().includes(queryLower);
        const descMatch = (tool.description || '').toLowerCase().includes(queryLower);
        return nameMatch || descMatch;
      });
      
      this.remoteActor.receive('toolsSearchTextComplete', {
        query,
        results,
        count: results.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Text search failed:', error);
      this.remoteActor.receive('toolsSearchTextError', {
        error: error.message
      });
    }
  }

  async handleSearchToolsSemanticRequest(data) {
    try {
      const { query, limit = 20 } = data;
      
      if (!this.toolRegistry) {
        throw new Error('Tool registry not initialized');
      }
      
      const results = await this.toolRegistry.searchTools(query, { limit });
      
      this.remoteActor.receive('toolsSearchSemanticComplete', {
        query,
        results,
        count: results.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Semantic search failed:', error);
      this.remoteActor.receive('toolsSearchSemanticError', {
        error: error.message
      });
    }
  }

  async handleGetRegistryStatsRequest() {
    try {
      if (!this.toolRegistry) {
        throw new Error('Tool registry not initialized');
      }
      
      const allTools = await this.toolRegistry.listTools();
      const uniqueModules = new Set(allTools.map(t => t.moduleName)).size;
      
      const stats = {
        totalTools: allTools.length,
        totalModules: uniqueModules,
        timestamp: new Date().toISOString()
      };
      
      this.remoteActor.receive('registryStatsComplete', stats);
      
    } catch (error) {
      console.error('Failed to get registry stats - FULL ERROR:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      this.remoteActor.receive('registryStatsError', {
        error: error.message || 'Tool registry not initialized'
      });
    }
  }
  
  // NOTE: Tool registry handlers moved to ToolRegistryServerSubActor

  cancelPlanning() {
    console.log('🛑 Cancelling planning operation');
    
    if (this.decentPlanner) {
      this.decentPlanner.cancel();
    }
    
    this.remoteActor.receive('planCancelled', {
      message: 'Planning cancellation processed',
      timestamp: new Date().toISOString()
    });
  }

  async handleLoadExecutionTreeRequest(data) {
    try {
      if (!this.executionActor) {
        throw new Error('Execution actor not initialized');
      }
      
      // Use the behavior tree stored on the server (which has actual tool objects)
      // instead of the serialized tree from the client
      if (!this.currentPlan || !this.currentPlan.behaviorTrees || this.currentPlan.behaviorTrees.length === 0) {
        throw new Error('No behavior tree available from current plan');
      }
      
      const serverBehaviorTree = this.currentPlan.behaviorTrees[0];
      console.log('[SERVER] Using server-side behavior tree with tool objects');
      console.log('[SERVER] First action tool type:', typeof serverBehaviorTree.children?.[0]?.tool);
      
      // Create a clean version of the behavior tree for the client with serialized tools
      const cleanBehaviorTree = this.serializeBehaviorTreeForClient(serverBehaviorTree);
      
      // Forward the clean tree to execution actor
      this.executionActor.receive('load-tree', { tree: cleanBehaviorTree }, this.remoteActor);
      
    } catch (error) {
      console.error('Failed to load execution tree:', error);
      
      this.remoteActor.receive('load-tree-response', {
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create a clean version of the behavior tree for client consumption
   * Replaces Tool objects with serialized representations to avoid circular references
   */
  serializeBehaviorTreeForClient(behaviorTree) {
    if (!behaviorTree) return null;
    
    const cleanTree = {
      id: behaviorTree.id,
      taskDescription: behaviorTree.taskDescription,
      type: behaviorTree.type,
      description: behaviorTree.description
    };
    
    if (behaviorTree.children) {
      cleanTree.children = behaviorTree.children.map(child => this.serializeNodeForClient(child));
    }
    
    if (behaviorTree.child) {
      cleanTree.child = this.serializeNodeForClient(behaviorTree.child);
    }
    
    return cleanTree;
  }
  
  /**
   * Serialize a behavior tree node for client consumption
   */
  serializeNodeForClient(node) {
    if (!node) return null;
    
    const cleanNode = {
      type: node.type,
      id: node.id,
      description: node.description
    };
    
    // Handle tool field - always serialize Tool objects to strings
    if (node.tool) {
      if (typeof node.tool === 'object' && node.tool.serialize) {
        cleanNode.tool = node.tool.serialize();
      } else if (typeof node.tool === 'string') {
        cleanNode.tool = node.tool;
      } else if (typeof node.tool === 'object' && node.tool.name) {
        // Fallback: create a simple string representation
        cleanNode.tool = `Tool: ${node.tool.name} - ${node.tool.description || 'No description'}`;
      } else {
        cleanNode.tool = 'Unknown tool';
      }
    }
    
    // ALWAYS include inputs and outputs, even if empty
    cleanNode.inputs = {};
    cleanNode.outputs = {};
    
    // Copy inputs as simple JSON objects to avoid circular references
    if (node.inputs) {
      try {
        cleanNode.inputs = JSON.parse(JSON.stringify(node.inputs));
      } catch (error) {
        // If inputs can't be serialized, show what we can
        console.warn(`Failed to serialize inputs for node ${node.id}:`, error.message);
        cleanNode.inputs = {
          error: `Serialization failed: ${error.message}`,
          keys: typeof node.inputs === 'object' ? Object.keys(node.inputs) : 'not an object',
          type: typeof node.inputs
        };
      }
    }
    
    // Copy outputs as simple JSON objects to avoid circular references  
    if (node.outputs) {
      try {
        cleanNode.outputs = JSON.parse(JSON.stringify(node.outputs));
      } catch (error) {
        // If outputs can't be serialized, show what we can
        console.warn(`Failed to serialize outputs for node ${node.id}:`, error.message);
        cleanNode.outputs = {
          error: `Serialization failed: ${error.message}`,
          keys: typeof node.outputs === 'object' ? Object.keys(node.outputs) : 'not an object',
          type: typeof node.outputs
        };
      }
    }
    
    // Handle parameters if present
    if (node.parameters) {
      try {
        cleanNode.parameters = JSON.parse(JSON.stringify(node.parameters));
      } catch (error) {
        console.warn(`Failed to serialize parameters for node ${node.id}:`, error.message);
        cleanNode.parameters = {
          error: `Serialization failed: ${error.message}`,
          keys: typeof node.parameters === 'object' ? Object.keys(node.parameters) : 'not an object'
        };
      }
    }
    
    // Handle children recursively
    if (node.children) {
      cleanNode.children = node.children.map(child => this.serializeNodeForClient(child));
    }
    
    if (node.child) {
      cleanNode.child = this.serializeNodeForClient(node.child);
    }
    
    return cleanNode;
  }

  async enrichBehaviorTreeWithToolIds(behaviorTree) {
    if (!behaviorTree || !this.toolRegistry) {
      return;
    }

    const toolNameToId = new Map();
    
    try {
      const allTools = await this.toolRegistry.listTools() || [];
      for (const tool of allTools) {
        if (tool.name && tool._id) {
          toolNameToId.set(tool.name, tool._id);
        }
      }
      
      this.enrichNodeWithToolIds(behaviorTree, toolNameToId);
      
    } catch (error) {
      console.error('Failed to enrich behavior tree with tool IDs:', error);
    }
  }

  enrichNodeWithToolIds(node, toolNameToId) {
    if (!node) return;

    if (node.type === 'action' && node.tool) {
      const toolId = toolNameToId.get(node.tool);
      if (toolId) {
        node.tool_id = toolId;
      }
    }

    if (node.children) {
      for (const child of node.children) {
        this.enrichNodeWithToolIds(child, toolNameToId);
      }
    }

    if (node.child) {
      this.enrichNodeWithToolIds(node.child, toolNameToId);
    }
  }

  // Plan Save/Load handlers
  async handleSavePlanRequest(data) {
    try {
      const { name, informalResult, formalResult } = data;
      
      if (!name || !name.trim()) {
        throw new Error('Plan name is required');
      }
      
      const result = await PlanFileService.savePlan(name.trim(), informalResult, formalResult);
      
      this.remoteActor.receive('planSaveComplete', {
        success: true,
        filename: result.filename,
        message: `Plan "${name}" saved successfully`
      });
      
    } catch (error) {
      console.error('Failed to save plan:', error);
      this.remoteActor.receive('planSaveError', {
        error: error.message
      });
    }
  }

  async handleLoadPlanRequest(data) {
    try {
      const { filename } = data;
      
      if (!filename) {
        throw new Error('Filename is required');
      }
      
      const planData = await PlanFileService.loadPlan(filename);
      
      this.remoteActor.receive('planLoadComplete', {
        success: true,
        planData,
        message: `Plan "${planData.name}" loaded successfully`
      });
      
    } catch (error) {
      console.error('Failed to load plan:', error);
      this.remoteActor.receive('planLoadError', {
        error: error.message
      });
    }
  }

  async handleListSavedPlansRequest() {
    try {
      const plans = await PlanFileService.listPlans();
      
      this.remoteActor.receive('planListComplete', {
        success: true,
        plans
      });
      
    } catch (error) {
      console.error('Failed to list saved plans:', error);
      this.remoteActor.receive('planListError', {
        error: error.message
      });
    }
  }

  /**
   * Handle list all modules request
   */
  async handleListAllModulesRequest(data) {
    try {
      if (!this.toolRegistry) {
        throw new Error('Tool registry not initialized');
      }

      // Use tool registry singleton to get modules (it should access the 31 modules in database)
      console.log(`[PlannerServer] Querying tool registry for modules...`);
      const databaseModules = await this.toolRegistry.queryModulesCollection();
      console.log(`[PlannerServer] Tool registry returned ${databaseModules.length} modules from database`);
      
      // Format modules for UI display
      const modules = databaseModules.map(module => ({
        name: module.name || module._id,
        status: 'database',
        toolCount: module.toolsCount || 0,
        description: module.description || `Database module: ${module.name}`,
        version: module.version,
        path: module.path
      }));

      // Send to tool registry sub-actor, not planner sub-actor
      if (this.parentActor && this.parentActor.remoteActor) {
        this.parentActor.remoteActor.receive('tool-registry-modulesListComplete', {
          success: true,
          modules,
          totalModules: modules.length,
          availableCount: modules.length
        });
      }

    } catch (error) {
      console.error('Failed to list modules:', error);
      this.remoteActor.receive('modulesListError', {
        error: error.message
      });
    }
  }

  /**
   * Handle database query request
   */
  async handleDatabaseQueryRequest(data) {
    try {
      const { collection, command, params } = data;
      
      if (!this.toolRegistry) {
        throw new Error('Tool registry not initialized');
      }

      // Execute database query through tool registry
      let result;
      if (collection === 'tools') {
        const allTools = await this.toolRegistry.listTools();
        result = allTools.filter(tool => {
          if (!params.query) return true;
          return Object.entries(params.query).every(([key, value]) => {
            if (typeof value === 'object' && value.$regex) {
              const regex = new RegExp(value.$regex, value.$options || '');
              return regex.test(tool[key]);
            }
            return tool[key] === value;
          });
        });
      } else if (collection === 'modules') {
        const moduleStats = await this.toolRegistry.getModuleStatistics?.() || {};
        result = (moduleStats.loadedModules || []).map(name => ({ name, status: 'loaded' }));
      } else {
        throw new Error(`Unsupported collection: ${collection}`);
      }

      this.remoteActor.receive('databaseQueryComplete', {
        success: true,
        collection,
        command,
        result,
        count: result.length
      });

    } catch (error) {
      console.error('Failed to execute database query:', error);
      this.remoteActor.receive('databaseQueryError', {
        error: error.message,
        collection: data.collection,
        command: data.command
      });
    }
  }

  /**
   * Handle module load request
   */
  async handleModuleLoadRequest(data) {
    try {
      const { moduleName } = data;
      
      if (!this.toolRegistry) {
        throw new Error('Tool registry not initialized');
      }

      // Attempt to load module
      console.log(`Attempting to load module: ${moduleName}`);
      
      // For now, send success response (actual loading would need tool registry enhancement)
      this.remoteActor.receive('moduleLoadComplete', {
        success: true,
        moduleName,
        message: `Module ${moduleName} load requested`
      });

    } catch (error) {
      console.error('Failed to load module:', error);
      this.remoteActor.receive('moduleLoadError', {
        error: error.message,
        moduleName: data.moduleName
      });
    }
  }

  /**
   * Handle module unload request  
   */
  async handleModuleUnloadRequest(data) {
    try {
      const { moduleName } = data;
      
      console.log(`Attempting to unload module: ${moduleName}`);
      
      this.remoteActor.receive('moduleUnloadComplete', {
        success: true,
        moduleName,
        message: `Module ${moduleName} unload requested`
      });

    } catch (error) {
      console.error('Failed to unload module:', error);
      this.remoteActor.receive('moduleUnloadError', {
        error: error.message,
        moduleName: data.moduleName
      });
    }
  }
}