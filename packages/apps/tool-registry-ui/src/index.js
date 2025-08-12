/**
 * ToolRegistryUI - Main Umbilical Component
 * 
 * Comprehensive UI for managing Legion tool registry, database collections,
 * and semantic search/Qdrant operations.
 */

import { ToolRegistryModel } from './model/ToolRegistryModel.js';
import { ToolRegistryView } from './view/ToolRegistryView.js';
import { ToolRegistryViewModel } from './viewmodel/ToolRegistryViewModel.js';
import { ToolRegistryActor } from './actors/ToolRegistryActor.js';
import { DatabaseActor } from './actors/DatabaseActor.js';
import { SemanticSearchActor } from './actors/SemanticSearchActor.js';

export const ToolRegistryUI = {
  /**
   * Create ToolRegistryUI instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode - describe requirements
    if (umbilical?.describe) {
      const requirements = {
        name: 'ToolRegistryUI',
        version: '1.0.0',
        description: 'Tool Registry management interface with database and vector search',
        required: {
          dom: 'HTMLElement - Container element for the UI',
          serverUrl: 'string - WebSocket server URL (default: ws://localhost:8080)'
        },
        optional: {
          theme: 'string - UI theme: "light" or "dark" (default: "dark")',
          initialTab: 'string - Initial tab: "tools" or "database" (default: "tools")',
          onToolExecuted: 'function - Callback when a tool is executed',
          onSearchPerformed: 'function - Callback when semantic search is performed',
          onError: 'function - Error handler callback',
          onMount: 'function - Called after component mounts',
          onDestroy: 'function - Called before component destroys'
        }
      };
      umbilical.describe(requirements);
      return;
    }

    // Validation mode
    if (umbilical?.validate) {
      return {
        valid: !!(umbilical.dom && umbilical.dom.nodeType === 1),
        hasDOM: !!(umbilical.dom && umbilical.dom.nodeType === 1),
        hasServerUrl: typeof umbilical.serverUrl === 'string'
      };
    }

    // No umbilical - return component info
    if (!umbilical) {
      return {
        name: 'ToolRegistryUI',
        version: '1.0.0',
        capabilities: [
          'tool-listing', 'tool-execution', 'semantic-search',
          'database-browsing', 'vector-search', 'real-time-updates'
        ]
      };
    }

    // Instance creation mode
    const {
      dom,
      serverUrl = 'ws://localhost:8080',
      theme = 'dark',
      initialTab = 'tools',
      onToolExecuted,
      onSearchPerformed,
      onError,
      onMount,
      onDestroy
    } = umbilical;

    // Validation
    if (!dom || dom.nodeType !== 1) {
      throw new Error('ToolRegistryUI requires a DOM container element');
    }

    // Create actor system
    let actorSpace = null;
    let channel = null;
    let toolActor = null;
    let dbActor = null;
    let searchActor = null;
    let ws = null;

    // Create MVVM components
    const model = new ToolRegistryModel({
      onError: error => {
        console.error('Model error:', error);
        if (onError) onError(error);
      }
    });

    const view = new ToolRegistryView(dom, {
      theme,
      initialTab
    });

    const viewModel = new ToolRegistryViewModel(model, view, {
      onToolExecuted: (tool, params, result) => {
        if (onToolExecuted) {
          onToolExecuted(tool, params, result);
        }
      },
      onSearchPerformed: (query, results) => {
        if (onSearchPerformed) {
          onSearchPerformed(query, results);
        }
      }
    });

    // Initialize WebSocket and actors
    const connectToServer = async () => {
      try {
        // Import actor dependencies dynamically
        const { ActorSpace } = await import('/lib/shared/actors');
        
        // Create ActorSpace
        actorSpace = new ActorSpace('tool-registry-ui-' + Date.now());
        
        // Create client actors
        toolActor = new ToolRegistryActor(model, viewModel);
        dbActor = new DatabaseActor(model, viewModel);
        searchActor = new SemanticSearchActor(model, viewModel);
        
        // Register actors
        actorSpace.register(toolActor, 'client-tools');
        actorSpace.register(dbActor, 'client-database');
        actorSpace.register(searchActor, 'client-search');
        
        // Connect to server
        ws = new WebSocket(serverUrl);
        
        ws.onopen = () => {
          console.log('Connected to server:', serverUrl);
          channel = actorSpace.addChannel(ws);
          
          // Send handshake
          ws.send(JSON.stringify({
            type: 'actor_handshake',
            clientActors: {
              tools: 'client-tools',
              database: 'client-database',
              search: 'client-search'
            }
          }));
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Handle handshake response
            if (message.type === 'actor_handshake_ack') {
              const serverActors = message.serverActors;
              
              // Create remote actors for server-side actors
              const remoteToolActor = channel.makeRemote(serverActors.tools);
              const remoteDbActor = channel.makeRemote(serverActors.database);
              const remoteSearchActor = channel.makeRemote(serverActors.search);
              
              // Give remote actors to local actors
              toolActor.setRemoteActor(remoteToolActor);
              dbActor.setRemoteActor(remoteDbActor);
              searchActor.setRemoteActor(remoteSearchActor);
              
              // Initial data load
              viewModel.loadInitialData();
            }
          } catch (error) {
            console.error('Message handling error:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (onError) onError(error);
        };
        
        ws.onclose = () => {
          console.log('WebSocket connection closed');
          // Attempt reconnection after delay
          setTimeout(connectToServer, 5000);
        };
        
      } catch (error) {
        console.error('Failed to connect:', error);
        if (onError) onError(error);
      }
    };

    // Initial render
    viewModel.render();
    
    // Connect to server
    connectToServer();

    // Create instance API
    const instance = {
      // Tool operations
      async loadTools() {
        return viewModel.loadTools();
      },

      async executeTool(toolName, params) {
        return viewModel.executeTool(toolName, params);
      },

      async searchTools(query) {
        return viewModel.searchTools(query);
      },

      // Database operations
      async loadCollections() {
        return viewModel.loadCollections();
      },

      async queryCollection(collection, query) {
        return viewModel.queryCollection(collection, query);
      },

      // Vector operations
      async performSemanticSearch(query, options = {}) {
        return viewModel.performSemanticSearch(query, options);
      },

      async getVectorStats() {
        return viewModel.getVectorStats();
      },

      // UI operations
      switchTab(tabName) {
        view.switchTab(tabName);
      },

      setTheme(theme) {
        view.setTheme(theme);
      },

      refresh() {
        viewModel.render();
      },

      // State
      getState() {
        return {
          tools: model.getTools(),
          collections: model.getCollections(),
          selectedTool: model.getSelectedTool(),
          activeTab: view.getActiveTab()
        };
      },

      // Cleanup
      destroy() {
        // Close WebSocket
        if (ws) {
          ws.close();
        }
        
        // Cleanup actors
        if (actorSpace) {
          actorSpace.destroy();
        }
        
        // Cleanup MVVM
        viewModel.destroy();
        view.destroy();
        model.destroy();
        
        if (onDestroy) {
          onDestroy(instance);
        }
      }
    };

    // Call onMount callback
    if (onMount) {
      onMount(instance);
    }

    return instance;
  }
};

// Default export
export default ToolRegistryUI;