/**
 * StorageBrowser - Main Umbilical Component
 * Elegant and powerful storage browser with Actor-based backend communication
 */

import { StorageActorClient } from './actors/StorageActorClient.js';
import { StorageBrowserModel } from './model/StorageBrowserModel.js';
import { StorageBrowserView } from './view/StorageBrowserView.js';
import { StorageBrowserViewModel } from './viewmodel/StorageBrowserViewModel.js';

export const StorageBrowser = {
  /**
   * Create StorageBrowser instance or provide introspection
   */
  create(umbilical) {
    // Introspection mode
    if (umbilical?.describe) {
      return {
        name: 'StorageBrowser',
        version: '1.0.0',
        description: 'Elegant storage browser with Actor-based backend communication',
        configSchema: {
          type: 'object',
          required: ['dom', 'serverUrl'],
          properties: {
            dom: {
              type: 'object',
              description: 'DOM container element'
            },
            serverUrl: {
              type: 'string',
              pattern: '^wss?://',
              description: 'WebSocket server URL'
            },
            provider: {
              type: 'string',
              enum: ['mongodb', 'sqlite', 'memory'],
              default: 'memory',
              description: 'Storage provider to use'
            },
            database: {
              type: 'string',
              description: 'Database name'
            },
            mode: {
              type: 'string',
              enum: ['split', 'collections', 'documents'],
              default: 'split',
              description: 'UI layout mode'
            },
            theme: {
              type: 'string',
              enum: ['light', 'dark', 'auto'],
              default: 'light',
              description: 'UI theme'
            },
            features: {
              type: 'object',
              properties: {
                query: { type: 'boolean', default: true },
                create: { type: 'boolean', default: true },
                update: { type: 'boolean', default: true },
                delete: { type: 'boolean', default: true },
                export: { type: 'boolean', default: true },
                import: { type: 'boolean', default: true }
              }
            }
          }
        },
        capabilities: [
          'storage-browsing', 'crud-operations', 'query-execution',
          'real-time-updates', 'provider-switching', 'data-export'
        ]
      };
    }

    // Validation mode
    if (umbilical?.validate) {
      const config = umbilical.validate;
      const errors = [];

      // Validate required fields
      if (!config.dom) {
        errors.push('dom is required');
      } else if (!config.dom.nodeType || config.dom.nodeType !== 1) {
        errors.push('dom must be a valid DOM element');
      }

      if (!config.serverUrl) {
        errors.push('serverUrl is required');
      } else if (typeof config.serverUrl !== 'string') {
        errors.push('serverUrl must be a string');
      } else if (!/^wss?:\/\//.test(config.serverUrl)) {
        errors.push('serverUrl must be a valid WebSocket URL (ws:// or wss://)');
      }

      // Validate optional fields
      if (config.provider && !['mongodb', 'sqlite', 'memory'].includes(config.provider)) {
        errors.push('provider must be one of: mongodb, sqlite, memory');
      }

      if (config.mode && !['split', 'collections', 'documents'].includes(config.mode)) {
        errors.push('mode must be one of: split, collections, documents');
      }

      if (config.theme && !['light', 'dark', 'auto'].includes(config.theme)) {
        errors.push('theme must be one of: light, dark, auto');
      }

      if (config.features && typeof config.features === 'object') {
        Object.entries(config.features).forEach(([key, value]) => {
          if (typeof value !== 'boolean') {
            errors.push(`features.${key} must be a boolean`);
          }
        });
      }

      return {
        valid: errors.length === 0,
        errors
      };
    }

    // Validate required parameters
    if (!umbilical?.dom) {
      throw new Error('StorageBrowser requires a DOM container element');
    }
    if (!umbilical?.serverUrl) {
      throw new Error('StorageBrowser requires a server WebSocket URL');
    }

    // Extract configuration
    const {
      // Required
      dom,
      serverUrl,
      
      // Provider Selection
      provider = 'memory',
      database,
      
      // Display Options
      mode = 'split',
      theme = 'light',
      layout = {
        splitRatio: 30,
        collapsible: true
      },
      
      // Features
      features = {
        query: true,
        create: true,
        update: true,
        delete: true,
        export: true,
        import: true
      },
      
      // Display Preferences
      display = {
        documentsView: 'table',
        pageSize: 25,
        maxNesting: 5,
        dateFormat: 'iso'
      },
      
      // Event Callbacks
      onConnect,
      onDisconnect,
      onProviderChange,
      onCollectionSelect,
      onDocumentSelect,
      onDocumentChange,
      onQueryExecute,
      onError,
      
      // Lifecycle
      onMount,
      onDestroy
    } = umbilical;

    // Create Actor client
    const actorClient = new StorageActorClient(serverUrl);

    // Create Model
    const model = new StorageBrowserModel(actorClient, {
      connection: { provider },
      ui: { mode, theme, ...layout },
      documents: { pageSize: display.pageSize }
    });

    // Create View
    const view = new StorageBrowserView(dom, {
      provider,
      theme,
      mode,
      layout,
      display
    });

    // Create ViewModel
    const viewModel = new StorageBrowserViewModel(model, view, actorClient, {
      features,
      database
    });

    // Set up event handlers
    if (onConnect) {
      actorClient.on('connect', () => {
        onConnect(model.getState().connection);
      });
    }

    if (onDisconnect) {
      actorClient.on('disconnect', () => {
        onDisconnect();
      });
    }

    if (onError) {
      actorClient.on('error', onError);
      viewModel.on('error', onError);
    }

    if (onCollectionSelect) {
      model.on('collection:change', (data) => {
        onCollectionSelect(data.selected);
      });
    }

    if (onDocumentSelect) {
      model.on('selection:change', (data) => {
        onDocumentSelect(data.selected);
      });
    }

    if (onDocumentChange) {
      viewModel.on('document:change', onDocumentChange);
    }

    if (onQueryExecute) {
      viewModel.on('query:execute', onQueryExecute);
    }

    // Create instance API
    const instance = {
      // Connection Management
      connect() {
        return viewModel.connect();
      },

      disconnect() {
        actorClient.disconnect();
      },

      reconnect() {
        actorClient.disconnect();
        setTimeout(() => {
          viewModel.connect();
        }, 100);
      },

      isConnected() {
        return actorClient.isConnected();
      },

      // Provider Operations
      setProvider(name) {
        return viewModel.setProvider(name);
      },

      getProviders() {
        return ['mongodb', 'sqlite', 'memory'];
      },

      getProviderInfo() {
        const state = model.getState();
        return {
          name: state.connection.provider,
          status: state.connection.status
        };
      },

      // Collection Operations
      getCollections() {
        return viewModel.loadCollections();
      },

      selectCollection(name) {
        return viewModel.selectCollection(name);
      },

      createCollection(name) {
        return viewModel.createCollection(name);
      },

      dropCollection(name) {
        return viewModel.dropCollection(name);
      },

      // Document Operations
      getDocuments(query, options) {
        return viewModel.loadDocuments(query, options);
      },

      getDocument(id) {
        return viewModel.getDocument(id);
      },

      createDocument(data) {
        return viewModel.createDocument(data);
      },

      updateDocument(id, update) {
        return viewModel.updateDocument(id, update);
      },

      deleteDocument(id) {
        return viewModel.deleteDocument(id);
      },

      deleteDocuments(query) {
        return viewModel.deleteDocuments(query);
      },

      // Query Operations
      executeQuery(query) {
        return viewModel.executeQuery(query);
      },

      count(query) {
        return viewModel.count(query);
      },

      // UI Control
      setView(viewMode) {
        model.setUIMode(viewMode);
      },

      setTheme(newTheme) {
        model.setTheme(newTheme);
        view.setTheme(newTheme);
      },

      refresh() {
        return viewModel.refresh();
      },

      clearCache() {
        viewModel.clearCache();
      },

      // Utility
      export(format = 'json') {
        return viewModel.exportData(format);
      },

      import(data) {
        return viewModel.importData(data);
      },

      // State access
      getState() {
        return model.getState();
      },

      // Cleanup
      destroy() {
        if (onDestroy) {
          onDestroy(instance);
        }
        
        viewModel.destroy();
        view.destroy();
        model.destroy();
        actorClient.disconnect();
      }
    };

    // Initialize
    viewModel.initialize().then(() => {
      if (onMount) {
        onMount(instance);
      }
    }).catch((error) => {
      if (onError) {
        onError(error);
      }
    });

    return instance;
  }
};