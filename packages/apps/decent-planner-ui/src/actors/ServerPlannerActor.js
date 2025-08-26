/**
 * Server Planner Actor - Handles planning logic with real DecentPlanner
 * Uses actor framework for communication with client
 */

import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/resource-manager';
import { ServerExecutionActor } from './ServerExecutionActor.js';
import PlanFileService from '../services/PlanFileService.js';

export default class ServerPlannerActor {
  constructor(services) {
    this.services = services;
    this.remoteActor = null;
    this.decentPlanner = null;
    this.toolRegistry = null;
    this.isReady = false;
    this.currentInformalResult = null;  // Store the plan on the server!
    this.executionActor = null;  // Server execution actor for BT debugging
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
      console.error('Failed to initialize planner:', error);
      this.remoteActor.receive('error', {
        message: error.message
      });
    }
  }

  async initializePlanner() {
    console.log('Initializing DecentPlanner with REAL LLM...');
    
    // Get ResourceManager instance
    const resourceManager = ResourceManager.getInstance();
    
    // Ensure .env is loaded
    await resourceManager.initialize();
    
    // Get the real LLM client
    const llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('Failed to get LLM client from ResourceManager');
    }
    
    console.log('Got LLM client from ResourceManager');
    
    // Set up LLM event listener to forward to client
    if (llmClient && this.remoteActor) {
      llmClient.on('interaction', (event) => {
        this.remoteActor.receive('llm-interaction', event);
      });
    }
    
    // Create DecentPlanner with the REAL LLM client
    this.decentPlanner = new DecentPlanner(llmClient, {
      maxDepth: 5,
      confidenceThreshold: 0.5,
      strictValidation: true,
      enableFormalPlanning: true
    });
    
    // Initialize it (this loads toolRegistry)
    await this.decentPlanner.initialize();
    
    // Also listen to the formal planner's LLM client if it exists
    if (this.decentPlanner.formalPlanner && this.decentPlanner.formalPlanner.llmClient && this.remoteActor) {
      this.decentPlanner.formalPlanner.llmClient.on('interaction', (event) => {
        this.remoteActor.receive('llm-interaction', event);
      });
    }
    
    // Get the tool registry for direct access
    this.toolRegistry = this.decentPlanner.toolRegistry;
    
    // Pass toolRegistry to execution actor
    if (this.executionActor && this.toolRegistry) {
      this.executionActor.setToolRegistry(this.toolRegistry);
    }
    
    // Load all modules for the tool registry
    if (this.toolRegistry) {
      console.log('Loading all tool modules...');
      const loadResult = await this.toolRegistry.loadAllModules();
      console.log(`✅ Loaded ${loadResult.loaded} modules, ${loadResult.failed} failed`);
    }
    
    console.log('✅ DecentPlanner initialized with REAL LLM');
  }

  receive(messageType, data) {
    console.log('📨 Server received:', messageType);
    
    switch (messageType) {
      case 'plan':
        this.handlePlanRequest(data);
        break;
        
      case 'plan-informal':
        this.handleInformalPlanRequest(data);
        break;
        
      case 'plan-formal':
        this.handleFormalPlanRequest(data);
        break;
        
      case 'discover-tools':
        this.handleDiscoverToolsRequest(data);
        break;
        
      case 'list-all-tools':
        this.handleListAllToolsRequest();
        break;
        
      case 'search-tools-text':
        this.handleSearchToolsTextRequest(data);
        break;
        
      case 'search-tools-semantic':
        this.handleSearchToolsSemanticRequest(data);
        break;
        
      case 'get-registry-stats':
        this.handleGetRegistryStatsRequest();
        break;
        
      case 'ping':
        this.remoteActor.receive('pong', { timestamp: Date.now() });
        break;
        
      // Execution messages - forward to execution actor
      case 'load-execution-tree':
        this.handleLoadExecutionTreeRequest(data);
        break;
        
      case 'execution-step':
        if (this.executionActor) {
          this.executionActor.receive('step', data, this.remoteActor);
        }
        break;
        
      case 'execution-run':
        if (this.executionActor) {
          this.executionActor.receive('run', data, this.remoteActor);
        }
        break;
        
      case 'execution-pause':
        if (this.executionActor) {
          this.executionActor.receive('pause', data, this.remoteActor);
        }
        break;
        
      case 'execution-reset':
        if (this.executionActor) {
          this.executionActor.receive('reset', data, this.remoteActor);
        }
        break;
        
      case 'execution-set-breakpoint':
        if (this.executionActor) {
          this.executionActor.receive('set-breakpoint', data, this.remoteActor);
        }
        break;
        
      case 'execution-remove-breakpoint':
        if (this.executionActor) {
          this.executionActor.receive('remove-breakpoint', data, this.remoteActor);
        }
        break;
        
      case 'cancel':
        console.log('📨 Server received: cancel');
        console.log('🛑 About to call this.cancelPlanning()...');
        this.cancelPlanning();
        console.log('✅ Called this.cancelPlanning() successfully');
        break;
        
      // Plan file operations
      case 'save-plan':
        this.handleSavePlanRequest(data);
        break;
        
      case 'load-plan':
        this.handleLoadPlanRequest(data);
        break;
        
      case 'list-saved-plans':
        this.handleListSavedPlansRequest();
        break;
        
      default:
        console.warn('Unknown message type:', messageType);
    }
  }

  async handlePlanRequest(data) {
    const { goal } = data;
    
    if (!goal || goal.trim() === '') {
      this.remoteActor.receive('planError', {
        error: 'Goal is required'
      });
      return;
    }
    
    try {
      // Send planning started
      this.remoteActor.receive('planStarted', {
        goal,
        timestamp: new Date().toISOString()
      });
      
      // Execute planning
      const result = await this.decentPlanner.plan(goal);
      
      // Send result
      this.remoteActor.receive('planComplete', {
        goal,
        result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Planning failed:', error);
      this.remoteActor.receive('planError', {
        error: error.message
      });
    }
  }

  /**
   * Cancel current planning operation
   */
  cancelPlanning() {
    console.log('🛑🛑🛑 SERVER RECEIVED CANCEL PLANNING REQUEST 🛑🛑🛑');
    console.log('🛑 DecentPlanner instance exists:', !!this.decentPlanner);
    
    // Cancel the DecentPlanner if it exists
    if (this.decentPlanner) {
      console.log('🛑 Calling decentPlanner.cancel()...');
      this.decentPlanner.cancel();
      console.log('✅ Called decentPlanner.cancel() successfully');
    } else {
      console.log('❌ No decentPlanner instance found');
    }
    
    // Send immediate acknowledgment that we got the request
    console.log('🛑 Sending cancellation acknowledgment to client...');
    this.remoteActor.receive('planCancelled', {
      message: 'Planning cancellation processed',
      timestamp: new Date().toISOString()
    });
    console.log('✅ Sent planCancelled message to client');
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
      
      // Execute informal planning only with progress callback and cancellation checker
      const result = await this.decentPlanner.planInformalOnly(goal, {}, (message) => {
        // Send progress update to client
        this.remoteActor.receive('informalPlanProgress', {
          goal,
          message,
          timestamp: new Date().toISOString()
        });
      });
      
      // Store the result on the server!
      this.currentInformalResult = result;
      
      // Send result
      this.remoteActor.receive('informalPlanComplete', {
        goal,
        result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Informal planning failed:', error);
      
      // Check if it was a cancellation
      if (error.message.includes('cancelled')) {
        console.log('🛑 Informal planning was cancelled');
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
    // Use the server's stored result which now has tools!
    if (!this.currentInformalResult) {
      this.remoteActor.receive('formalPlanError', {
        error: 'No informal planning result found on server'
      });
      return;
    }
    
    try {
      // Send formal planning started
      this.remoteActor.receive('formalPlanStarted', {
        goal: this.currentInformalResult.goal,
        timestamp: new Date().toISOString()
      });
      
      // Execute formal planning with the server's stored (and tool-modified) result
      const result = await this.decentPlanner.planFormal(this.currentInformalResult);
      
      // Send result
      this.remoteActor.receive('formalPlanComplete', {
        goal: this.currentInformalResult.goal,
        result,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Formal planning failed:', error);
      this.remoteActor.receive('formalPlanError', {
        error: error.message
      });
    }
  }

  async handleDiscoverToolsRequest(data) {
    // Use the stored result, not data from client!
    if (!this.currentInformalResult || !this.currentInformalResult.informal || !this.currentInformalResult.informal.hierarchy) {
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
      
      // Execute tool discovery with progress callback - use server's stored hierarchy!
      console.log('🔍 [SERVER] Starting tool discovery...');
      const result = await this.decentPlanner.discoverToolsForHierarchy(
        this.currentInformalResult.informal.hierarchy, 
        (message) => {
          // Send progress update to client
          this.remoteActor.receive('toolsDiscoveryProgress', {
            message,
            timestamp: new Date().toISOString()
          });
        }
      );
      console.log('🔍 [SERVER] Tool discovery completed, result keys:', Object.keys(result || {}));
      
      // Enhance result with full tool metadata from ToolRegistry
      console.log('🔍 [SERVER] About to enhance tool discovery result...');
      const enhancedResult = await this.enhanceToolDiscoveryWithMetadata(result);
      console.log('🔍 [SERVER] Enhancement completed.');
      
      // Send result
      this.remoteActor.receive('toolsDiscoveryComplete', {
        result: enhancedResult,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Tool discovery failed:', error);
      
      // Check if it was a cancellation
      if (error.message.includes('cancelled')) {
        console.log('🛑 Tool discovery was cancelled');
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
    console.log('🔍 [ENHANCE] Starting metadata enhancement...');
    console.log('🔍 [ENHANCE] Result structure:', Object.keys(result || {}));
    
    if (!result) {
      console.log('🔍 [ENHANCE] No result provided, returning original');
      return result;
    }
    
    const enhancedResult = JSON.parse(JSON.stringify(result)); // Deep copy
    
    // Function to enhance tools with metadata
    const enhanceTools = async (tools) => {
      console.log('🔍 [ENHANCE] Enhancing tools:', tools ? tools.length : 'none');
      if (!Array.isArray(tools)) return;
      
      for (const tool of tools) {
        console.log(`🔍 [ENHANCE] Processing tool: ${tool.name}`);
        try {
          // Get full tool metadata from registry
          console.log(`🔍 [ENHANCE] Calling getTool for: ${tool.name}`);
          const fullToolData = await this.toolRegistry.getTool(tool.name);
          console.log(`🔍 [ENHANCE] Tool data for ${tool.name}:`, fullToolData ? Object.keys(fullToolData) : 'null');
          
          if (fullToolData) {
            // Add the full metadata to the tool in a metadata field like a sensible dev!
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
            console.log(`✅ [ENHANCE] Added metadata to ${tool.name}`);
          } else {
            console.warn(`❌ [ENHANCE] No tool data found for ${tool.name}`);
            tool.metadata = {
              description: `Tool: ${tool.name}`,
              inputSchema: {},
              outputSchema: {},
              category: 'unknown',
              version: '1.0.0',
              author: 'unknown',
              moduleName: 'unknown',
              tags: [],
              examples: []
            };
          }
        } catch (error) {
          console.warn(`❌ [ENHANCE] Failed to get metadata for tool ${tool.name}:`, error.message);
          tool.metadata = {
            description: `Tool: ${tool.name}`,
            inputSchema: {},
            outputSchema: {},
            category: 'unknown',
            version: '1.0.0',
            author: 'unknown',
            moduleName: 'unknown', 
            tags: [],
            examples: []
          };
        }
      }
    };
    
    // Enhance tools in all possible locations where they might appear
    console.log('🔍 [ENHANCE] Checking hierarchy.tools...');
    if (enhancedResult.hierarchy && enhancedResult.hierarchy.tools) {
      console.log('🔍 [ENHANCE] Found hierarchy.tools, enhancing...');
      await enhanceTools(enhancedResult.hierarchy.tools);
    }
    
    console.log('🔍 [ENHANCE] Checking informal.hierarchy.tools...');
    if (enhancedResult.informal && enhancedResult.informal.hierarchy && enhancedResult.informal.hierarchy.tools) {
      console.log('🔍 [ENHANCE] Found informal.hierarchy.tools, enhancing...');
      await enhanceTools(enhancedResult.informal.hierarchy.tools);
    }
    
    // Also enhance tools in toolDiscovery array if present
    console.log('🔍 [ENHANCE] Checking toolDiscovery array...');
    if (enhancedResult.toolDiscovery && Array.isArray(enhancedResult.toolDiscovery)) {
      console.log(`🔍 [ENHANCE] Found toolDiscovery with ${enhancedResult.toolDiscovery.length} items`);
      for (const taskResult of enhancedResult.toolDiscovery) {
        if (taskResult.discoveryResult && taskResult.discoveryResult.tools) {
          console.log(`🔍 [ENHANCE] Enhancing tools in task: ${taskResult.taskId}`);
          await enhanceTools(taskResult.discoveryResult.tools);
        }
      }
    }
    
    console.log('🔍 [ENHANCE] Enhancement complete, returning result');
    return enhancedResult;
  }
  
  /**
   * Handle list all tools request
   */
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
      console.error('Failed to list tools:', error);
      this.remoteActor.receive('toolsListError', {
        error: error.message
      });
    }
  }
  
  /**
   * Handle text search request
   */
  async handleSearchToolsTextRequest(data) {
    try {
      const { query } = data;
      
      if (!this.toolRegistry) {
        throw new Error('Tool registry not initialized');
      }
      
      // Simple text-based filtering of all tools
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
  
  /**
   * Handle semantic search request
   */
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
  
  /**
   * Handle get registry stats request
   */
  async handleGetRegistryStatsRequest() {
    try {
      if (!this.toolRegistry) {
        throw new Error('Tool registry not initialized');
      }
      
      // Get all tools and count them
      const allTools = await this.toolRegistry.listTools();
      
      // Count unique modules
      const uniqueModules = new Set(allTools.map(t => t.moduleName)).size;
      
      const stats = {
        totalTools: allTools.length,
        totalModules: uniqueModules,
        timestamp: new Date().toISOString()
      };
      
      this.remoteActor.receive('registryStatsComplete', stats);
      
    } catch (error) {
      console.error('Failed to get registry stats:', error);
      this.remoteActor.receive('registryStatsError', {
        error: error.message
      });
    }
  }
  
  /**
   * Handle load execution tree request - enrich with tool IDs before forwarding
   */
  async handleLoadExecutionTreeRequest(data) {
    try {
      if (!this.executionActor) {
        throw new Error('Execution actor not initialized');
      }
      
      if (!this.toolRegistry) {
        throw new Error('Tool registry not initialized');
      }
      
      const { tree } = data;
      if (!tree) {
        throw new Error('No behavior tree provided');
      }
      
      console.log('[ServerPlannerActor] Enriching behavior tree with tool IDs...');
      
      // Create a copy of the tree to avoid modifying the original
      const enrichedTree = JSON.parse(JSON.stringify(tree));
      
      // Enrich the tree with tool IDs
      await this.enrichBehaviorTreeWithToolIds(enrichedTree);
      
      console.log('[ServerPlannerActor] ✅ Tree enriched, forwarding to execution actor');
      
      // Forward the enriched tree to the execution actor
      this.executionActor.receive('load-tree', { tree: enrichedTree }, this.remoteActor);
      
    } catch (error) {
      console.error('[ServerPlannerActor] Failed to load execution tree:', error);
      
      // Send error back to client
      this.remoteActor.receive('load-tree-response', {
        success: false,
        error: error.message
      });
    }
  }
  
  /**
   * Enrich behavior tree with tool IDs (same logic as FormalPlanner)
   */
  async enrichBehaviorTreeWithToolIds(behaviorTree) {
    if (!behaviorTree || !this.toolRegistry) {
      return;
    }

    console.log('[ServerPlannerActor] Creating tool name -> ID mapping...');
    
    // Create a tool name -> tool ID mapping
    const toolNameToId = new Map();
    
    try {
      // Get all tools from registry  
      const allTools = await this.toolRegistry.listTools() || [];
      for (const tool of allTools) {
        if (tool.name && tool._id) {
          toolNameToId.set(tool.name, tool._id);
        }
      }
      
      console.log(`[ServerPlannerActor] Found ${toolNameToId.size} tools for ID mapping`);
      
      // Recursively enrich the tree
      this.enrichNodeWithToolIds(behaviorTree, toolNameToId);
      
      console.log('[ServerPlannerActor] ✅ Behavior tree enriched with tool IDs');
      
    } catch (error) {
      console.error('[ServerPlannerActor] ❌ Failed to enrich behavior tree with tool IDs:', error);
      // Don't throw - this is a non-critical enhancement
    }
  }

  /**
   * Recursively enrich a node and its children with tool IDs
   */
  enrichNodeWithToolIds(node, toolNameToId) {
    if (!node) return;

    // If this is an action node with a tool, add the tool_id
    if (node.type === 'action' && node.tool) {
      const toolId = toolNameToId.get(node.tool);
      if (toolId) {
        node.tool_id = toolId;
        console.log(`[ServerPlannerActor] ✅ Enriched action '${node.id}': ${node.tool} -> ${toolId}`);
      } else {
        console.log(`[ServerPlannerActor] ❌ Tool ID not found for: ${node.tool}`);
      }
    }

    // Recursively process children
    if (node.children) {
      for (const child of node.children) {
        this.enrichNodeWithToolIds(child, toolNameToId);
      }
    }

    // Process single child (for retry nodes)
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
}