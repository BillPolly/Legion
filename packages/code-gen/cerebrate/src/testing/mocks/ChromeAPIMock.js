/**
 * Chrome Extension API Mock for Testing
 * Simulates Chrome extension APIs in test environment
 */
export class ChromeAPIMock {
  constructor(options = {}) {
    this.config = {
      enableStorage: options.enableStorage !== false,
      enableMessaging: options.enableMessaging !== false,
      enableTabs: options.enableTabs !== false,
      enableDevtools: options.enableDevtools !== false,
      ...options
    };
    
    // Mock storage
    this.storage = {
      local: new Map(),
      sync: new Map(),
      session: new Map()
    };
    
    // Message history
    this.messageHistory = [];
    this.listeners = new Map();
    
    // Tab data
    this.tabs = [
      {
        id: 1,
        url: 'https://example.com',
        title: 'Example Page',
        active: true,
        windowId: 1,
        index: 0,
        pinned: false,
        highlighted: true,
        incognito: false,
        selected: true,
        audible: false,
        mutedInfo: { muted: false },
        status: 'complete'
      }
    ];
    
    // Panel registry
    this.panels = [];
  }
  
  /**
   * Get Chrome extension API object
   * @returns {Object} - Chrome API mock
   */
  getAPI() {
    return {
      runtime: this.createRuntimeAPI(),
      devtools: this.createDevToolsAPI(),
      tabs: this.createTabsAPI(),
      storage: this.createStorageAPI(),
      scripting: this.createScriptingAPI(),
      permissions: this.createPermissionsAPI(),
      action: this.createActionAPI(),
      alarms: this.createAlarmsAPI(),
      cookies: this.createCookiesAPI(),
      webNavigation: this.createWebNavigationAPI()
    };
  }
  
  /**
   * Create runtime API
   * @returns {Object} - Runtime API
   * @private
   */
  createRuntimeAPI() {
    return {
      id: 'test-extension-id',
      
      sendMessage: (message, options, callback) => {
        // Handle both 2 and 3 parameter versions
        if (typeof options === 'function') {
          callback = options;
          options = undefined;
        }
        
        this.messageHistory.push({
          type: 'runtime.sendMessage',
          message,
          options: options || callback,
          callback: callback || options,
          timestamp: Date.now()
        });
        
        const actualCallback = callback || (typeof options === 'function' ? options : null);
        if (actualCallback) {
          setTimeout(() => {
            actualCallback({ success: true, response: 'Mock response' });
          }, 10);
        }
      },
      
      connect: (connectInfo) => {
        return {
          name: connectInfo?.name || 'mock-port',
          postMessage: (message) => {
            this.messageHistory.push({
              type: 'port.postMessage',
              message,
              timestamp: Date.now()
            });
          },
          disconnect: () => {},
          onMessage: { addListener: () => {}, removeListener: () => {} },
          onDisconnect: { addListener: () => {}, removeListener: () => {} }
        };
      },
      
      onMessage: {
        addListener: (listener) => {
          this.addListener('runtime.onMessage', listener);
        },
        removeListener: (listener) => {
          this.removeListener('runtime.onMessage', listener);
        }
      },
      
      onConnect: {
        addListener: (listener) => {
          this.addListener('runtime.onConnect', listener);
        },
        removeListener: (listener) => {
          this.removeListener('runtime.onConnect', listener);
        }
      },
      
      getManifest: () => ({
        name: 'Test Extension',
        version: '1.0.0',
        manifest_version: 3,
        permissions: ['activeTab', 'storage']
      }),
      
      getURL: (path) => `chrome-extension://test-extension-id/${path}`,
      
      lastError: null
    };
  }
  
  /**
   * Create DevTools API
   * @returns {Object} - DevTools API
   * @private
   */
  createDevToolsAPI() {
    if (!this.config.enableDevtools) return undefined;
    
    return {
      panels: {
        create: (title, iconPath, pagePath, callback) => {
          const panel = {
            title,
            iconPath,
            pagePath,
            onShown: { addListener: () => {} },
            onHidden: { addListener: () => {} }
          };
          
          this.panels.push(panel);
          
          if (callback) {
            setTimeout(() => callback(panel), 10);
          }
        },
        
        elements: {
          createSidebarPane: (title, callback) => {
            const pane = {
              title,
              setHeight: () => {},
              setExpression: () => {},
              setObject: () => {},
              setPage: () => {},
              onShown: { addListener: () => {} },
              onHidden: { addListener: () => {} }
            };
            
            if (callback) {
              setTimeout(() => callback(pane), 10);
            }
          }
        }
      },
      
      inspectedWindow: {
        eval: (expression, options, callback) => {
          // Handle both 2 and 3 parameter versions
          if (typeof options === 'function') {
            callback = options;
            options = {};
          }
          
          let result = 'Mock Page Title';
          let isException = false;
          
          // Simulate some common evaluations
          if (expression.includes('document.title')) {
            result = 'Mock Page Title';
          } else if (expression.includes('document.querySelector')) {
            result = { tagName: 'DIV', id: 'mock-element' };
          } else if (expression.includes('window.location')) {
            result = { href: 'https://example.com', hostname: 'example.com' };
          } else if (expression.includes('throw')) {
            isException = true;
            result = { message: 'Mock error' };
          }
          
          if (callback) {
            setTimeout(() => {
              callback(result, isException ? result : null);
            }, 10);
          }
        },
        
        reload: (options) => {
          // Mock page reload
        },
        
        getResources: (callback) => {
          const resources = [
            { url: 'https://example.com/style.css', type: 'stylesheet' },
            { url: 'https://example.com/script.js', type: 'script' },
            { url: 'https://example.com/image.png', type: 'image' }
          ];
          
          if (callback) {
            setTimeout(() => callback(resources), 10);
          }
        }
      },
      
      network: {
        onRequestFinished: {
          addListener: (listener) => {
            this.addListener('devtools.network.onRequestFinished', listener);
          }
        },
        
        getHAR: (callback) => {
          const har = {
            log: {
              version: '1.2',
              creator: { name: 'Mock HAR', version: '1.0' },
              entries: []
            }
          };
          
          if (callback) {
            setTimeout(() => callback(har), 10);
          }
        }
      }
    };
  }
  
  /**
   * Create tabs API
   * @returns {Object} - Tabs API
   * @private
   */
  createTabsAPI() {
    if (!this.config.enableTabs) return undefined;
    
    return {
      query: (queryInfo, callback) => {
        let results = [...this.tabs];
        
        // Apply filters
        if (queryInfo.active !== undefined) {
          results = results.filter(tab => tab.active === queryInfo.active);
        }
        if (queryInfo.currentWindow !== undefined) {
          results = results.filter(tab => tab.windowId === 1);
        }
        if (queryInfo.url !== undefined) {
          results = results.filter(tab => tab.url.includes(queryInfo.url));
        }
        
        if (callback) {
          setTimeout(() => callback(results), 10);
        }
      },
      
      get: (tabId, callback) => {
        const tab = this.tabs.find(t => t.id === tabId);
        if (callback) {
          setTimeout(() => callback(tab), 10);
        }
      },
      
      create: (createProperties, callback) => {
        const newTab = {
          id: Math.max(...this.tabs.map(t => t.id)) + 1,
          url: createProperties.url || 'chrome://newtab/',
          title: 'New Tab',
          active: createProperties.active !== false,
          windowId: createProperties.windowId || 1,
          index: this.tabs.length,
          pinned: false,
          highlighted: createProperties.active !== false,
          incognito: false,
          selected: createProperties.active !== false,
          audible: false,
          mutedInfo: { muted: false },
          status: 'loading'
        };
        
        this.tabs.push(newTab);
        
        if (callback) {
          setTimeout(() => callback(newTab), 10);
        }
      },
      
      update: (tabId, updateProperties, callback) => {
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab) {
          Object.assign(tab, updateProperties);
        }
        
        if (callback) {
          setTimeout(() => callback(tab), 10);
        }
      },
      
      executeScript: (tabId, details, callback) => {
        if (callback) {
          setTimeout(() => {
            callback(['Mock script result']);
          }, 10);
        }
      },
      
      onUpdated: {
        addListener: (listener) => {
          this.addListener('tabs.onUpdated', listener);
        }
      },
      
      onActivated: {
        addListener: (listener) => {
          this.addListener('tabs.onActivated', listener);
        }
      }
    };
  }
  
  /**
   * Create storage API
   * @returns {Object} - Storage API
   * @private
   */
  createStorageAPI() {
    if (!this.config.enableStorage) return undefined;
    
    const createStorageArea = (area) => ({
      get: (keys, callback) => {
        let result = {};
        
        if (keys === null || keys === undefined) {
          // Get all items
          result = Object.fromEntries(this.storage[area]);
        } else if (typeof keys === 'string') {
          // Single key
          if (this.storage[area].has(keys)) {
            result[keys] = this.storage[area].get(keys);
          }
        } else if (Array.isArray(keys)) {
          // Array of keys
          keys.forEach(key => {
            if (this.storage[area].has(key)) {
              result[key] = this.storage[area].get(key);
            }
          });
        } else if (typeof keys === 'object') {
          // Object with default values
          Object.keys(keys).forEach(key => {
            result[key] = this.storage[area].has(key) 
              ? this.storage[area].get(key) 
              : keys[key];
          });
        }
        
        if (callback) {
          setTimeout(() => callback(result), 10);
        }
      },
      
      set: (items, callback) => {
        Object.entries(items).forEach(([key, value]) => {
          this.storage[area].set(key, value);
        });
        
        if (callback) {
          setTimeout(() => callback(), 10);
        }
      },
      
      remove: (keys, callback) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach(key => {
          this.storage[area].delete(key);
        });
        
        if (callback) {
          setTimeout(() => callback(), 10);
        }
      },
      
      clear: (callback) => {
        this.storage[area].clear();
        
        if (callback) {
          setTimeout(() => callback(), 10);
        }
      }
    });
    
    return {
      local: createStorageArea('local'),
      sync: createStorageArea('sync'),
      session: createStorageArea('session')
    };
  }
  
  /**
   * Create scripting API
   * @returns {Object} - Scripting API
   * @private
   */
  createScriptingAPI() {
    return {
      executeScript: (details, callback) => {
        if (callback) {
          setTimeout(() => {
            callback([{ result: 'Mock script result' }]);
          }, 10);
        }
      },
      
      insertCSS: (details, callback) => {
        if (callback) {
          setTimeout(() => callback(), 10);
        }
      }
    };
  }
  
  /**
   * Create permissions API
   * @returns {Object} - Permissions API
   * @private
   */
  createPermissionsAPI() {
    return {
      contains: (permissions, callback) => {
        if (callback) {
          setTimeout(() => callback(true), 10);
        }
      },
      
      request: (permissions, callback) => {
        if (callback) {
          setTimeout(() => callback(true), 10);
        }
      }
    };
  }
  
  /**
   * Create action API
   * @returns {Object} - Action API
   * @private
   */
  createActionAPI() {
    return {
      setBadgeText: (details, callback) => {
        if (callback) {
          setTimeout(() => callback(), 10);
        }
      },
      
      setBadgeBackgroundColor: (details, callback) => {
        if (callback) {
          setTimeout(() => callback(), 10);
        }
      }
    };
  }
  
  /**
   * Create alarms API
   * @returns {Object} - Alarms API
   * @private
   */
  createAlarmsAPI() {
    return {
      create: (name, alarmInfo) => {},
      clear: (name, callback) => {
        if (callback) {
          setTimeout(() => callback(true), 10);
        }
      },
      onAlarm: {
        addListener: (listener) => {
          this.addListener('alarms.onAlarm', listener);
        }
      }
    };
  }
  
  /**
   * Create cookies API
   * @returns {Object} - Cookies API
   * @private
   */
  createCookiesAPI() {
    return {
      get: (details, callback) => {
        const cookie = {
          name: details.name,
          value: 'mock-value',
          domain: details.url ? new URL(details.url).hostname : 'example.com'
        };
        
        if (callback) {
          setTimeout(() => callback(cookie), 10);
        }
      }
    };
  }
  
  /**
   * Create web navigation API
   * @returns {Object} - Web navigation API
   * @private
   */
  createWebNavigationAPI() {
    return {
      onCompleted: {
        addListener: (listener) => {
          this.addListener('webNavigation.onCompleted', listener);
        }
      }
    };
  }
  
  /**
   * Add event listener
   * @param {string} eventName - Event name
   * @param {Function} listener - Event listener
   * @private
   */
  addListener(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(listener);
  }
  
  /**
   * Remove event listener
   * @param {string} eventName - Event name
   * @param {Function} listener - Event listener
   * @private
   */
  removeListener(eventName, listener) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).delete(listener);
    }
  }
  
  /**
   * Trigger event
   * @param {string} eventName - Event name
   * @param {...any} args - Event arguments
   */
  triggerEvent(eventName, ...args) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${eventName}:`, error);
        }
      });
    }
  }
  
  /**
   * Get message history
   * @returns {Array} - Message history
   */
  getMessageHistory() {
    return [...this.messageHistory];
  }
  
  /**
   * Clear message history
   */
  clearMessageHistory() {
    this.messageHistory = [];
  }
  
  /**
   * Add tab
   * @param {Object} tab - Tab object
   */
  addTab(tab) {
    this.tabs.push({
      id: Math.max(...this.tabs.map(t => t.id)) + 1,
      ...tab
    });
  }
  
  /**
   * Reset mock to initial state
   */
  reset() {
    this.storage.local.clear();
    this.storage.sync.clear();
    this.storage.session.clear();
    this.clearMessageHistory();
    this.listeners.clear();
    this.panels = [];
    
    // Reset to default tab
    this.tabs = [{
      id: 1,
      url: 'https://example.com',
      title: 'Example Page',
      active: true,
      windowId: 1,
      index: 0,
      pinned: false,
      highlighted: true,
      incognito: false,
      selected: true,
      audible: false,
      mutedInfo: { muted: false },
      status: 'complete'
    }];
  }
}