/**
 * End-to-End Tests for JSON Asset Display Workflow
 * 
 * Tests complete JSON workflow from tool execution to final UI display with formatting
 * NO MOCKS - Complete workflow validation with real Legion components
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

describe('JSON Asset Display Workflow End-to-End', () => {
  let tool;
  let server;
  let clientActor;
  let displayManager;
  let assetDetector;
  let resourceManager;
  let dom;
  let document;
  let window;
  const testPort = 3794;

  beforeAll(async () => {
    // Set up virtual DOM
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    document = dom.window.document;
    window = dom.window;
    
    global.document = document;
    global.window = window;
    global.HTMLElement = window.HTMLElement;
    
    // Initialize ResourceManager
    resourceManager = await ResourceManager.getInstance();
    
    // Start server
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    
    // Initialize components
    assetDetector = new AssetTypeDetector();
    tool = new ShowAssetTool({ assetDetector, serverPort: testPort });
    
    displayManager = new AssetDisplayManager({
      serverUrl: `http://localhost:${testPort}`,
      wsUrl: `ws://localhost:${testPort}/showme`,
      container: document.getElementById('app')
    });
    await displayManager.initialize();
    
    clientActor = new ShowMeClientActor({
      serverUrl: `ws://localhost:${testPort}/showme`,
      displayManager: displayManager
    });
    await clientActor.initialize();
    await clientActor.connect();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 45000);

  afterAll(async () => {
    if (clientActor) {
      await clientActor.disconnect();
      await clientActor.cleanup();
    }
    if (displayManager) {
      await displayManager.cleanup();
    }
    if (server) {
      await server.stop();
    }
    
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
  });

  describe('simple JSON object workflow', () => {
    test('should handle complete JSON object display workflow', async () => {
      const jsonData = {
        name: 'Legion Framework',
        version: '1.0.0',
        description: 'Modular AI agent framework with extensible tool system',
        author: {
          name: 'Legion Team',
          email: 'team@legion.ai'
        },
        features: [
          'Modular architecture',
          'Tool registry system',
          'Actor-based communication',
          'Real-time UI updates'
        ],
        config: {
          maxRetries: 3,
          timeout: 5000,
          enableLogging: true,
          logLevel: 'info'
        },
        stats: {
          totalModules: 42,
          activeConnections: 15,
          uptime: 3600000,
          memoryUsage: '128MB'
        }
      };

      console.log('📄 Starting JSON object workflow...');

      // Step 1: Tool execution with JSON detection
      const startTime = Date.now();
      const toolResult = await tool.execute({
        asset: jsonData,
        title: 'Legion Framework Configuration',
        options: {
          formatJson: true,
          indentSize: 2,
          showTypes: true,
          collapsible: true,
          maxDepth: 5,
          showLineNumbers: true
        }
      });

      // Validate tool execution
      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('json');
      expect(toolResult.assetId).toBeTruthy();
      expect(toolResult.url).toContain(`http://localhost:${testPort}`);
      console.log('✅ Tool execution successful - Type detected:', toolResult.detected_type);

      // Step 2: Verify JSON storage on server (exact preservation)
      const serverResponse = await fetch(toolResult.url);
      expect(serverResponse.status).toBe(200);
      expect(serverResponse.headers.get('content-type')).toContain('json');
      
      const serverJsonData = await serverResponse.json();
      expect(serverJsonData).toEqual(jsonData); // Exact JSON preservation
      console.log('✅ Server storage verified - JSON preserved exactly');

      // Step 3: Client actor display request with JSON options
      const displayResult = await clientActor.displayAsset(toolResult.assetId, {
        width: 800,
        height: 600,
        x: 100,
        y: 50,
        formatJson: true,
        indentSize: 2,
        showTypes: true,
        collapsible: true,
        theme: 'light'
      });

      expect(displayResult).toBeTruthy();
      console.log('✅ Client display request sent');

      // Wait for UI rendering
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Verify UI window creation
      const jsonWindow = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(jsonWindow).toBeTruthy();
      expect(jsonWindow.classList.contains('showme-window')).toBe(true);
      expect(jsonWindow.classList.contains('showme-window-json')).toBe(true);

      // Verify window dimensions
      expect(jsonWindow.style.width).toContain('800');
      expect(jsonWindow.style.height).toContain('600');

      // Step 5: Verify window header and controls
      const header = jsonWindow.querySelector('.showme-window-header');
      expect(header).toBeTruthy();
      
      const title = header.querySelector('.showme-window-title');
      expect(title.textContent).toContain('Legion Framework Configuration');

      const controls = header.querySelectorAll('.showme-window-close, .showme-window-minimize, .showme-window-maximize');
      expect(controls.length).toBe(3);
      console.log('✅ Window header and controls verified');

      // Step 6: Verify JSON content rendering
      const content = jsonWindow.querySelector('.showme-window-content');
      expect(content).toBeTruthy();

      // Look for JSON viewer element
      const jsonViewer = content.querySelector('.json-viewer, .json-container, pre');
      expect(jsonViewer).toBeTruthy();

      // Check for syntax highlighting elements
      const syntaxElements = content.querySelectorAll('.json-key, .json-value, .json-string, .json-number, .json-boolean');
      if (syntaxElements.length > 0) {
        console.log(`✅ Syntax highlighting active - ${syntaxElements.length} highlighted elements`);
      }

      // Verify JSON content is present and formatted
      const jsonTextContent = content.textContent || '';
      expect(jsonTextContent).toContain('Legion Framework');
      expect(jsonTextContent).toContain('version');
      expect(jsonTextContent).toContain('features');
      expect(jsonTextContent).toContain('Modular architecture');
      expect(jsonTextContent).toContain('config');
      expect(jsonTextContent).toContain('maxRetries');
      console.log('✅ JSON content rendering verified');

      // Step 7: Test JSON tree expansion/collapse (if collapsible)
      const expandableNodes = content.querySelectorAll('.json-expandable, .json-toggle, .json-collapse');
      if (expandableNodes.length > 0) {
        // Try clicking first expandable node
        expandableNodes[0].click();
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('✅ JSON tree interaction tested');
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      console.log(`🎉 JSON object workflow completed in ${totalTime}ms`);

      // Verify workflow timing
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('complex nested JSON workflow', () => {
    test('should handle deeply nested JSON structures', async () => {
      const complexJson = {
        application: {
          name: 'ShowMe Module',
          metadata: {
            version: '2.1.0',
            build: {
              number: 12345,
              timestamp: new Date().toISOString(),
              environment: 'production',
              git: {
                commit: 'a1b2c3d4e5f6',
                branch: 'main',
                tags: ['v2.1.0', 'stable'],
                contributors: [
                  { name: 'Alice', commits: 145 },
                  { name: 'Bob', commits: 89 },
                  { name: 'Charlie', commits: 67 }
                ]
              }
            },
            dependencies: {
              core: {
                '@legion/resource-manager': '^1.0.0',
                '@legion/actors': '^1.0.0'
              },
              development: {
                'jest': '^29.0.0',
                'jsdom': '^20.0.0'
              },
              optional: {
                'syntax-highlighter': '^3.2.1'
              }
            }
          },
          configuration: {
            server: {
              host: 'localhost',
              ports: {
                http: 3000,
                websocket: 3001,
                debug: 9229
              },
              ssl: {
                enabled: false,
                cert: null,
                key: null
              },
              middleware: [
                { name: 'cors', enabled: true, options: { origin: '*' } },
                { name: 'helmet', enabled: true, options: {} },
                { name: 'compression', enabled: false, options: { level: 6 } }
              ]
            },
            ui: {
              theme: 'dark',
              animations: true,
              shortcuts: {
                'close-window': 'Ctrl+W',
                'new-window': 'Ctrl+N',
                'toggle-fullscreen': 'F11'
              },
              display: {
                defaultWidth: 800,
                defaultHeight: 600,
                minWidth: 300,
                minHeight: 200,
                maxWindows: 20
              }
            }
          }
        }
      };

      const toolResult = await tool.execute({
        asset: complexJson,
        title: 'Complex Nested Configuration',
        options: {
          formatJson: true,
          indentSize: 4,
          showTypes: true,
          collapsible: true,
          maxDepth: 10
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('json');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 900,
        height: 700,
        formatJson: true,
        maxDepth: 10,
        theme: 'dark'
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();
      expect(window.classList.contains('showme-window-json')).toBe(true);

      const content = window.querySelector('.showme-window-content');
      const textContent = content.textContent;
      
      // Verify deeply nested content is accessible
      expect(textContent).toContain('ShowMe Module');
      expect(textContent).toContain('git');
      expect(textContent).toContain('contributors');
      expect(textContent).toContain('Alice');
      expect(textContent).toContain('dependencies');
      expect(textContent).toContain('middleware');
      expect(textContent).toContain('shortcuts');
    });
  });

  describe('JSON array workflow', () => {
    test('should handle JSON arrays with complex objects', async () => {
      const arrayData = [
        {
          id: 'user-001',
          profile: {
            name: 'Sarah Connor',
            email: 'sarah.connor@example.com',
            role: 'admin',
            permissions: ['read', 'write', 'delete', 'admin'],
            preferences: {
              theme: 'dark',
              language: 'en',
              timezone: 'UTC-8'
            },
            activity: {
              lastLogin: '2024-01-15T10:30:00Z',
              loginCount: 147,
              isActive: true
            }
          }
        },
        {
          id: 'user-002',
          profile: {
            name: 'John Doe',
            email: 'john.doe@example.com',
            role: 'user',
            permissions: ['read', 'write'],
            preferences: {
              theme: 'light',
              language: 'en',
              timezone: 'UTC-5'
            },
            activity: {
              lastLogin: '2024-01-14T15:45:00Z',
              loginCount: 23,
              isActive: false
            }
          }
        },
        {
          id: 'user-003',
          profile: {
            name: 'Maria Garcia',
            email: 'maria.garcia@example.com',
            role: 'moderator',
            permissions: ['read', 'write', 'moderate'],
            preferences: {
              theme: 'auto',
              language: 'es',
              timezone: 'UTC+1'
            },
            activity: {
              lastLogin: '2024-01-15T08:20:00Z',
              loginCount: 89,
              isActive: true
            }
          }
        }
      ];

      const toolResult = await tool.execute({
        asset: arrayData,
        title: 'User Profiles Array',
        options: {
          formatJson: true,
          showArrayIndices: true,
          collapsible: true,
          highlightChanges: false
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('json');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 1000,
        height: 800,
        showArrayIndices: true,
        collapsible: true
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      const content = window.querySelector('.showme-window-content');
      const textContent = content.textContent;

      // Verify array content
      expect(textContent).toContain('Sarah Connor');
      expect(textContent).toContain('John Doe');
      expect(textContent).toContain('Maria Garcia');
      expect(textContent).toContain('permissions');
      expect(textContent).toContain('preferences');
      expect(textContent).toContain('activity');

      // Check for array indices if supported
      const arrayIndices = content.querySelectorAll('.json-array-index, .json-index');
      if (arrayIndices.length > 0) {
        expect(arrayIndices.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('JSON with various data types workflow', () => {
    test('should handle JSON with all JavaScript data types', async () => {
      const mixedTypeJson = {
        // Primitive types
        stringValue: 'Hello, World!',
        numberInteger: 42,
        numberFloat: 3.14159,
        numberNegative: -100,
        numberScientific: 1.23e-4,
        booleanTrue: true,
        booleanFalse: false,
        nullValue: null,
        
        // Array types
        emptyArray: [],
        numberArray: [1, 2, 3, 4, 5],
        stringArray: ['apple', 'banana', 'cherry'],
        mixedArray: [1, 'two', true, null, { nested: 'object' }],
        
        // Object types
        emptyObject: {},
        simpleObject: { key: 'value' },
        nestedObject: {
          level1: {
            level2: {
              level3: {
                deepValue: 'found'
              }
            }
          }
        },
        
        // Special cases
        unicodeString: '🚀 Unicode characters: αβγ 中文 العربية',
        longString: 'This is a very long string that should test how the JSON viewer handles text wrapping and display of lengthy content without breaking the layout.',
        jsonString: '{"embedded": "json string"}',
        dateString: new Date().toISOString(),
        
        // Edge cases
        largeNumber: 9007199254740991, // MAX_SAFE_INTEGER
        verySmallNumber: Number.MIN_VALUE,
        specialFloats: {
          infinity: 'Cannot represent Infinity in JSON',
          negativeInfinity: 'Cannot represent -Infinity in JSON',
          notANumber: 'Cannot represent NaN in JSON'
        },
        
        // Complex nested structure
        complexNested: {
          users: [
            { id: 1, active: true, metadata: { created: '2024-01-01', tags: ['admin', 'power-user'] } },
            { id: 2, active: false, metadata: { created: '2024-01-02', tags: ['user'] } }
          ],
          settings: {
            global: { debug: true, version: '1.0.0' },
            features: {
              experimental: ['feature-a', 'feature-b'],
              stable: { count: 5, list: ['stable-1', 'stable-2'] }
            }
          }
        }
      };

      const toolResult = await tool.execute({
        asset: mixedTypeJson,
        title: 'Mixed Data Types JSON',
        options: {
          formatJson: true,
          showTypes: true,
          indentSize: 2,
          collapsible: true,
          highlightTypes: true
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('json');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 1000,
        height: 900,
        showTypes: true,
        highlightTypes: true
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      const content = window.querySelector('.showme-window-content');
      const textContent = content.textContent;

      // Verify all data types are displayed
      expect(textContent).toContain('Hello, World!');
      expect(textContent).toContain('42');
      expect(textContent).toContain('3.14159');
      expect(textContent).toContain('true');
      expect(textContent).toContain('false');
      expect(textContent).toContain('null');
      expect(textContent).toContain('🚀 Unicode');
      expect(textContent).toContain('complexNested');

      // Check for type highlighting if implemented
      const typeElements = content.querySelectorAll('.json-string, .json-number, .json-boolean, .json-null');
      if (typeElements.length > 0) {
        console.log(`✅ Type highlighting found - ${typeElements.length} typed elements`);
      }
    });
  });

  describe('JSON workflow with custom options', () => {
    test('should handle JSON with advanced display options', async () => {
      const configJson = {
        theme: {
          name: 'Custom Theme',
          colors: {
            primary: '#007acc',
            secondary: '#ff6b35',
            background: '#1e1e1e',
            foreground: '#ffffff'
          },
          fonts: {
            main: 'Monaco, monospace',
            size: 14,
            lineHeight: 1.5
          }
        },
        editor: {
          tabSize: 2,
          wordWrap: true,
          lineNumbers: true,
          minimap: false,
          folding: true
        }
      };

      const toolResult = await tool.execute({
        asset: configJson,
        title: 'Theme Configuration',
        options: {
          formatJson: true,
          indentSize: 4,
          showTypes: true,
          collapsible: true,
          theme: 'monokai',
          fontSize: 16,
          wordWrap: false,
          lineNumbers: true,
          readOnly: false
        }
      });

      expect(toolResult.success).toBe(true);

      await clientActor.displayAsset(toolResult.assetId, {
        width: 700,
        height: 500,
        theme: 'monokai',
        fontSize: 16,
        wordWrap: false,
        lineNumbers: true
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      // Verify options applied to window manager
      const windowInfo = displayManager.windows.get(displayManager.getWindowIdForAsset(toolResult.assetId));
      if (windowInfo) {
        expect(windowInfo.options.theme).toBe('monokai');
        expect(windowInfo.options.fontSize).toBe(16);
        expect(windowInfo.options.wordWrap).toBe(false);
      }
    });
  });

  describe('JSON workflow error scenarios', () => {
    test('should handle circular reference JSON gracefully', async () => {
      // Create object with circular reference
      const circularObj = { name: 'circular' };
      circularObj.self = circularObj;

      const toolResult = await tool.execute({
        asset: circularObj,
        title: 'Circular Reference Test'
      });

      // Should either succeed with stringified version or fail gracefully
      if (toolResult.success) {
        expect(toolResult.detected_type).toBe('json');
        
        await clientActor.displayAsset(toolResult.assetId);
        await new Promise(resolve => setTimeout(resolve, 500));

        const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
        expect(window).toBeTruthy();
      } else {
        expect(toolResult.error).toContain('circular');
      }
    });

    test('should handle very large JSON objects', async () => {
      // Generate large JSON object
      const largeJson = {
        metadata: { size: 'large', generated: true },
        data: {}
      };

      // Add many properties
      for (let i = 0; i < 1000; i++) {
        largeJson.data[`item_${i}`] = {
          id: i,
          value: `value_${i}`,
          active: i % 2 === 0,
          nested: {
            level1: { level2: { level3: `deep_value_${i}` } }
          }
        };
      }

      const toolResult = await tool.execute({
        asset: largeJson,
        title: 'Large JSON Object Test',
        options: {
          maxDepth: 3,
          truncateAfter: 500
        }
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.detected_type).toBe('json');

      await clientActor.displayAsset(toolResult.assetId, {
        width: 800,
        height: 600,
        virtualScrolling: true
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      const content = window.querySelector('.showme-window-content');
      expect(content).toBeTruthy();
    });

    test('should handle malformed JSON strings', async () => {
      const malformedJson = '{"key": "value", "missing": }';

      const toolResult = await tool.execute({
        asset: malformedJson,
        hint: 'json',
        title: 'Malformed JSON Test'
      });

      // Should either parse as text or show JSON error
      expect(toolResult.success).toBe(true);
      
      await clientActor.displayAsset(toolResult.assetId);
      await new Promise(resolve => setTimeout(resolve, 500));

      const window = document.querySelector(`[data-asset-id="${toolResult.assetId}"]`);
      expect(window).toBeTruthy();

      // Should display as text or show error
      const content = window.querySelector('.showme-window-content');
      const fallback = content.querySelector('.text-viewer, .json-error, .error-message');
      expect(fallback).toBeTruthy();
    });
  });

  describe('JSON workflow performance', () => {
    test('should handle multiple JSON displays efficiently', async () => {
      const jsonObjects = [
        { type: 'config', data: { debug: true, port: 3000 } },
        { type: 'users', data: [{ id: 1, name: 'User 1' }, { id: 2, name: 'User 2' }] },
        { type: 'stats', data: { views: 1000, clicks: 150, conversion: 0.15 } }
      ];

      const startTime = Date.now();
      const toolResults = [];

      // Execute all JSON objects
      for (const obj of jsonObjects) {
        const result = await tool.execute({
          asset: obj,
          title: `JSON ${obj.type}`,
          options: { formatJson: true }
        });
        expect(result.success).toBe(true);
        toolResults.push(result);
      }

      // Display all JSON objects
      for (let i = 0; i < toolResults.length; i++) {
        await clientActor.displayAsset(toolResults[i].assetId, {
          width: 400,
          height: 300,
          x: i * 420,
          y: 50
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all windows created
      const windows = document.querySelectorAll('.showme-window-json');
      expect(windows.length).toBe(3);

      // Performance check
      expect(totalTime).toBeLessThan(4000);

      // Verify each JSON object displayed
      for (const result of toolResults) {
        const window = document.querySelector(`[data-asset-id="${result.assetId}"]`);
        expect(window).toBeTruthy();
      }
    });
  });
});