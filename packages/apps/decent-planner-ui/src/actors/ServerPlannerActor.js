/**
 * Server Planner Actor - Handles planning logic with real DecentPlanner
 * Uses actor framework for communication with client
 */

import { DecentPlanner } from '@legion/decent-planner';
import { ResourceManager } from '@legion/resource-manager';
import { ServerExecutionActor } from './ServerExecutionActor.js';

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
    
    // Create DecentPlanner with the REAL LLM client
    this.decentPlanner = new DecentPlanner(llmClient, {
      maxDepth: 5,
      confidenceThreshold: 0.5,
      strictValidation: true,
      enableFormalPlanning: true
    });
    
    // Initialize it (this loads toolRegistry)
    await this.decentPlanner.initialize();
    
    // Get the tool registry for direct access
    this.toolRegistry = this.decentPlanner.toolRegistry;
    
    // Pass toolRegistry to execution actor
    if (this.executionActor && this.toolRegistry) {
      this.executionActor.toolRegistry = this.toolRegistry;
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
        if (this.executionActor) {
          this.executionActor.receive('load-tree', data, this.remoteActor);
        }
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
      
      // Send result
      this.remoteActor.receive('toolsDiscoveryComplete', {
        result,
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
}