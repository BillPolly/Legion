/**
 * End-to-End Error Path Validation Tests
 * 
 * Comprehensive validation that all error paths fail fast with clear, actionable error messages
 * NO MOCKS - Tests real error conditions and error handling across the complete system
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';

describe('Error Path Validation End-to-End', () => {
  let resourceManager;
  let dom;
  let document;
  let window;
  const testPort = 3800;

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
  }, 15000);

  afterAll(async () => {
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
  });

  describe('tool execution error path validation', () => {
    test('should provide clear error messages for tool parameter validation failures', async () => {
      console.log('🔍 Testing tool parameter validation error messages...');
      
      const assetDetector = new AssetTypeDetector();
      const tool = new ShowAssetTool({ assetDetector, serverPort: testPort });
      
      const invalidInputs = [
        {
          name: 'Missing asset parameter',
          input: { title: 'Test' },
          expectedPatterns: [/asset.*required/i, /missing.*asset/i, /asset.*parameter/i]
        },
        {
          name: 'Null asset',
          input: { asset: null, title: 'Null Test' },
          expectedPatterns: [/null.*asset/i, /invalid.*asset/i, /asset.*cannot.*be.*null/i]
        },
        {
          name: 'Undefined asset',
          input: { asset: undefined, title: 'Undefined Test' },
          expectedPatterns: [/undefined.*asset/i, /invalid.*asset/i, /asset.*not.*defined/i]
        },
        {
          name: 'Empty asset object',
          input: { asset: {}, title: 'Empty Test' },
          expectedPatterns: [/empty.*asset/i, /asset.*has.*no.*content/i, /invalid.*asset.*content/i]
        }
      ];

      for (const testCase of invalidInputs) {
        console.log(`  Testing: ${testCase.name}`);
        
        const result = await tool.execute(testCase.input);
        
        // Must fail
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        
        // Error message must be specific and clear
        expect(result.error).toMatch(/\w+/); // Contains actual words
        expect(result.error.length).toBeGreaterThan(10); // Not just a short error code
        expect(result.error).not.toMatch(/undefined|null.*object|object.*object/i); // No generic JavaScript errors
        
        // Must match at least one expected pattern
        const matchesPattern = testCase.expectedPatterns.some(pattern => 
          pattern.test(result.error)
        );
        expect(matchesPattern).toBe(true);
        
        console.log(`    ✅ Clear error: "${result.error}"`);
        
        // Should fail fast - no assetId or URL on failure
        expect(result.assetId).toBeUndefined();
        expect(result.url).toBeUndefined();
      }
    });

    test('should provide clear error messages for unsupported asset types', async () => {
      console.log('🔍 Testing unsupported asset type error messages...');
      
      const assetDetector = new AssetTypeDetector();
      const tool = new ShowAssetTool({ assetDetector, serverPort: testPort });
      
      const unsupportedAssets = [
        {
          name: 'Function object',
          asset: function testFn() { return 'test'; },
          expectedPatterns: [/function.*not.*supported/i, /cannot.*display.*function/i, /unsupported.*type/i]
        },
        {
          name: 'Symbol primitive',
          asset: Symbol('test'),
          expectedPatterns: [/symbol.*not.*supported/i, /cannot.*serialize.*symbol/i, /unsupported.*type/i]
        },
        {
          name: 'Binary buffer without proper format',
          asset: new ArrayBuffer(100),
          expectedPatterns: [/buffer.*not.*supported/i, /unknown.*binary.*format/i, /unsupported.*type/i]
        }
      ];

      for (const testCase of unsupportedAssets) {
        console.log(`  Testing: ${testCase.name}`);
        
        const result = await tool.execute({
          asset: testCase.asset,
          title: `Unsupported Type: ${testCase.name}`
        });
        
        // Must fail fast
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        
        // Error message validation
        expect(result.error.length).toBeGreaterThan(15);
        expect(result.error).not.toMatch(/error.*error|undefined.*undefined/i);
        
        const matchesPattern = testCase.expectedPatterns.some(pattern => 
          pattern.test(result.error)
        );
        expect(matchesPattern).toBe(true);
        
        console.log(`    ✅ Specific error: "${result.error}"`);
      }
    });
  });

  describe('server connection error path validation', () => {
    test('should provide clear error messages for server connection failures', async () => {
      console.log('🔍 Testing server connection error messages...');
      
      const connectionFailureScenarios = [
        {
          name: 'Server not started',
          serverPort: 9999, // Port where no server is running
          expectedPatterns: [
            /connection.*refused/i, 
            /failed.*to.*connect/i, 
            /server.*not.*available/i,
            /econnrefused/i
          ]
        },
        {
          name: 'Invalid port',
          serverPort: -1,
          expectedPatterns: [
            /invalid.*port/i,
            /port.*out.*of.*range/i,
            /connection.*failed/i
          ]
        },
        {
          name: 'Port out of range',
          serverPort: 99999,
          expectedPatterns: [
            /invalid.*port/i,
            /port.*out.*of.*range/i,
            /connection.*failed/i
          ]
        }
      ];

      for (const scenario of connectionFailureScenarios) {
        console.log(`  Testing: ${scenario.name}`);
        
        const assetDetector = new AssetTypeDetector();
        const tool = new ShowAssetTool({ 
          assetDetector, 
          serverPort: scenario.serverPort 
        });

        const result = await tool.execute({
          asset: { test: 'connection failure' },
          title: `Connection Test: ${scenario.name}`
        });

        // Must fail fast
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        
        // Error message validation
        expect(result.error.length).toBeGreaterThan(10);
        expect(result.error).toMatch(/\w.*\w/); // Contains meaningful words
        
        const matchesPattern = scenario.expectedPatterns.some(pattern => 
          pattern.test(result.error)
        );
        expect(matchesPattern).toBe(true);
        
        console.log(`    ✅ Connection error: "${result.error}"`);
        
        // Should not provide partial success
        expect(result.assetId).toBeUndefined();
        expect(result.url).toBeUndefined();
      }
    });
  });

  describe('component initialization error path validation', () => {
    test('should provide clear error messages for display manager initialization failures', async () => {
      console.log('🔍 Testing display manager initialization error messages...');
      
      const initializationFailures = [
        {
          name: 'Missing container element',
          config: {
            serverUrl: `http://localhost:${testPort}`,
            wsUrl: `ws://localhost:${testPort}/showme`,
            container: null
          },
          expectedPatterns: [
            /container.*required/i,
            /missing.*container/i,
            /container.*not.*found/i,
            /invalid.*container/i
          ]
        },
        {
          name: 'Invalid server URL',
          config: {
            serverUrl: 'not-a-valid-url',
            wsUrl: 'also-not-a-url',
            container: document.createElement('div')
          },
          expectedPatterns: [
            /invalid.*url/i,
            /malformed.*url/i,
            /url.*format.*invalid/i
          ]
        },
        {
          name: 'Missing server URL',
          config: {
            serverUrl: '',
            wsUrl: '',
            container: document.createElement('div')
          },
          expectedPatterns: [
            /server.*url.*required/i,
            /missing.*server.*url/i,
            /url.*cannot.*be.*empty/i
          ]
        }
      ];

      for (const scenario of initializationFailures) {
        console.log(`  Testing: ${scenario.name}`);
        
        try {
          const displayManager = new AssetDisplayManager(scenario.config);
          
          // Try to initialize - should throw or return error
          await expect(displayManager.initialize()).rejects.toThrow();
          
          console.log(`    ✅ ${scenario.name}: Initialization properly rejected`);
        } catch (error) {
          // Verify error message quality
          expect(error).toBeTruthy();
          expect(error.message).toBeTruthy();
          expect(error.message.length).toBeGreaterThan(10);
          
          const matchesPattern = scenario.expectedPatterns.some(pattern => 
            pattern.test(error.message)
          );
          expect(matchesPattern).toBe(true);
          
          console.log(`    ✅ Clear initialization error: "${error.message}"`);
        }
      }
    });

    test('should provide clear error messages for client actor connection failures', async () => {
      console.log('🔍 Testing client actor connection error messages...');
      
      // Create valid display manager first
      const displayManager = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort}`,
        wsUrl: `ws://localhost:${testPort}/showme`,
        container: document.getElementById('app')
      });
      await displayManager.initialize();
      
      const connectionFailures = [
        {
          name: 'Invalid WebSocket URL',
          serverUrl: 'ws://invalid-host:99999/invalid',
          expectedPatterns: [
            /connection.*failed/i,
            /websocket.*error/i,
            /failed.*to.*connect/i,
            /connection.*refused/i
          ]
        },
        {
          name: 'Malformed WebSocket URL',
          serverUrl: 'not-a-websocket-url',
          expectedPatterns: [
            /invalid.*websocket.*url/i,
            /malformed.*url/i,
            /websocket.*url.*invalid/i
          ]
        }
      ];

      for (const scenario of connectionFailures) {
        console.log(`  Testing: ${scenario.name}`);
        
        const clientActor = new ShowMeClientActor({
          serverUrl: scenario.serverUrl,
          displayManager: displayManager
        });

        try {
          await clientActor.initialize();
          await clientActor.connect();
          
          // Should not reach here
          expect(false).toBe(true);
        } catch (error) {
          expect(error).toBeTruthy();
          expect(error.message).toBeTruthy();
          expect(error.message.length).toBeGreaterThan(8);
          
          const matchesPattern = scenario.expectedPatterns.some(pattern => 
            pattern.test(error.message)
          );
          expect(matchesPattern).toBe(true);
          
          console.log(`    ✅ Connection error: "${error.message}"`);
        }
      }
      
      await displayManager.cleanup();
    });
  });

  describe('asset processing error path validation', () => {
    test('should provide clear error messages for corrupted asset data', async () => {
      console.log('🔍 Testing corrupted asset data error messages...');
      
      const assetDetector = new AssetTypeDetector();
      
      // Start a test server
      const server = new ShowMeServer({ 
        port: testPort + 1,
        skipLegionPackages: true 
      });
      await server.initialize();
      await server.start();
      
      try {
        const tool = new ShowAssetTool({ 
          assetDetector, 
          serverPort: testPort + 1 
        });
        
        const corruptedAssets = [
          {
            name: 'Corrupted JSON string',
            asset: '{"incomplete": json object',
            hint: 'json',
            expectedPatterns: [
              /invalid.*json/i,
              /json.*parse.*error/i,
              /malformed.*json/i,
              /syntax.*error/i
            ]
          },
          {
            name: 'Invalid base64 image',
            asset: 'data:image/png;base64,invalid_base64_data!!!',
            hint: 'image',
            expectedPatterns: [
              /invalid.*base64/i,
              /corrupted.*image/i,
              /image.*format.*error/i,
              /invalid.*image.*data/i
            ]
          },
          {
            name: 'Circular reference object',
            asset: (() => {
              const obj = { name: 'circular' };
              obj.self = obj;
              return obj;
            })(),
            expectedPatterns: [
              /circular.*reference/i,
              /cyclic.*structure/i,
              /cannot.*serialize/i,
              /infinite.*recursion/i
            ]
          }
        ];

        for (const testCase of corruptedAssets) {
          console.log(`  Testing: ${testCase.name}`);
          
          const result = await tool.execute({
            asset: testCase.asset,
            hint: testCase.hint,
            title: `Corrupted Data: ${testCase.name}`
          });

          // Must fail fast for corrupted data
          expect(result.success).toBe(false);
          expect(result.error).toBeTruthy();
          
          // Error message validation
          expect(result.error.length).toBeGreaterThan(15);
          expect(result.error).not.toMatch(/error.*occurred|something.*went.*wrong/i);
          
          const matchesPattern = testCase.expectedPatterns.some(pattern => 
            pattern.test(result.error)
          );
          expect(matchesPattern).toBe(true);
          
          console.log(`    ✅ Specific corruption error: "${result.error}"`);
        }
      } finally {
        await server.stop();
      }
    });

    test('should provide clear error messages for size limit violations', async () => {
      console.log('🔍 Testing size limit error messages...');
      
      const assetDetector = new AssetTypeDetector();
      
      // Start test server
      const server = new ShowMeServer({ 
        port: testPort + 2,
        skipLegionPackages: true 
      });
      await server.initialize();
      await server.start();
      
      try {
        const tool = new ShowAssetTool({ 
          assetDetector, 
          serverPort: testPort + 2 
        });
        
        // Create extremely large data
        const hugeArray = new Array(1000000).fill(0).map((_, i) => ({
          id: i,
          data: 'x'.repeat(1000),
          nested: {
            deep: {
              structure: new Array(100).fill('large data chunk')
            }
          }
        }));

        const result = await tool.execute({
          asset: hugeArray,
          title: 'Huge Dataset Test'
        });

        // Should either succeed or fail with clear size error
        if (!result.success) {
          expect(result.error).toBeTruthy();
          expect(result.error).toMatch(
            /too.*large|size.*limit|memory.*limit|exceeds.*limit|file.*too.*big/i
          );
          expect(result.error.length).toBeGreaterThan(20);
          
          console.log(`    ✅ Size limit error: "${result.error}"`);
        } else {
          console.log('    ✅ Large asset handled gracefully');
        }
      } finally {
        await server.stop();
      }
    });
  });

  describe('complete error path integration', () => {
    test('should maintain error message quality across complete failure workflows', async () => {
      console.log('🔍 Testing error consistency across complete failure workflows...');
      
      const errorScenarios = [
        {
          name: 'Complete tool failure workflow',
          setup: async () => {
            const assetDetector = new AssetTypeDetector();
            const tool = new ShowAssetTool({ 
              assetDetector, 
              serverPort: 9998 // Non-existent server
            });
            return { tool };
          },
          execute: async (context) => {
            return await context.tool.execute({
              asset: { test: 'server not available' },
              title: 'Server Failure Test'
            });
          },
          expectedPatterns: [/connection.*failed|server.*not.*available|failed.*to.*connect/i]
        },
        {
          name: 'Complete UI failure workflow',  
          setup: async () => {
            const server = new ShowMeServer({ 
              port: testPort + 3,
              skipLegionPackages: true 
            });
            await server.initialize();
            await server.start();
            
            // Create display manager with invalid container
            const displayManager = new AssetDisplayManager({
              serverUrl: `http://localhost:${testPort + 3}`,
              wsUrl: `ws://localhost:${testPort + 3}/showme`,
              container: null // Invalid container
            });
            
            return { server, displayManager };
          },
          execute: async (context) => {
            try {
              await context.displayManager.initialize();
              return { success: true };
            } catch (error) {
              return { success: false, error: error.message };
            }
          },
          cleanup: async (context) => {
            if (context.server) await context.server.stop();
          },
          expectedPatterns: [/container.*required|missing.*container|invalid.*container/i]
        }
      ];

      for (const scenario of errorScenarios) {
        console.log(`  Testing: ${scenario.name}`);
        
        let context = null;
        try {
          context = await scenario.setup();
          const result = await scenario.execute(context);
          
          // Must fail with clear error
          expect(result.success).toBe(false);
          expect(result.error).toBeTruthy();
          
          // Error message quality standards
          expect(result.error.length).toBeGreaterThan(8);
          expect(result.error).not.toMatch(/undefined|null.*object|error.*error/i);
          expect(result.error).toMatch(/[a-zA-Z]/); // Contains letters, not just symbols
          
          const matchesPattern = scenario.expectedPatterns.some(pattern => 
            pattern.test(result.error)
          );
          expect(matchesPattern).toBe(true);
          
          console.log(`    ✅ Quality error message: "${result.error}"`);
          
        } finally {
          if (scenario.cleanup && context) {
            await scenario.cleanup(context);
          }
        }
      }
    });

    test('should provide actionable error messages with context', async () => {
      console.log('🔍 Testing actionable error messages with context...');
      
      const contextualErrors = [
        {
          name: 'Asset type mismatch with hint',
          setup: () => {
            const assetDetector = new AssetTypeDetector();
            return new ShowAssetTool({ assetDetector, serverPort: testPort });
          },
          input: {
            asset: 'plain text content',
            hint: 'image', // Wrong hint
            title: 'Type Mismatch Test'
          },
          expectedContext: ['image', 'text', 'mismatch', 'hint', 'detected']
        },
        {
          name: 'Invalid image format with specific format info',
          setup: () => {
            const assetDetector = new AssetTypeDetector();
            return new ShowAssetTool({ assetDetector, serverPort: testPort });
          },
          input: {
            asset: 'data:image/unsupported;base64,validbase64data',
            title: 'Unsupported Format Test'
          },
          expectedContext: ['unsupported', 'format', 'image', 'base64']
        }
      ];

      for (const testCase of contextualErrors) {
        console.log(`  Testing: ${testCase.name}`);
        
        const tool = testCase.setup();
        const result = await tool.execute(testCase.input);
        
        if (!result.success) {
          expect(result.error).toBeTruthy();
          
          // Error should include contextual information
          const errorLower = result.error.toLowerCase();
          const contextFound = testCase.expectedContext.filter(context => 
            errorLower.includes(context.toLowerCase())
          );
          
          expect(contextFound.length).toBeGreaterThanOrEqual(2); // At least 2 context terms
          
          console.log(`    ✅ Contextual error with ${contextFound.length} context terms: "${result.error}"`);
          console.log(`      Context found: ${contextFound.join(', ')}`);
        } else {
          console.log(`    ℹ️  ${testCase.name}: Handled gracefully without error`);
        }
      }
    });
  });

  describe('error message format validation', () => {
    test('should ensure all error messages meet quality standards', async () => {
      console.log('🔍 Testing error message format quality standards...');
      
      const qualityStandards = {
        minimumLength: 8,
        maximumLength: 200,
        mustContain: /[a-zA-Z]/,
        mustNotContain: /undefined.*undefined|null.*null|object.*object|error.*error.*error/i,
        shouldBeSpecific: true,
        shouldBeActionable: true
      };

      const errorProducingInputs = [
        { asset: null, title: 'Null Test' },
        { asset: undefined, title: 'Undefined Test' },
        { asset: function() {}, title: 'Function Test' },
        { asset: Symbol('test'), title: 'Symbol Test' },
        { asset: 'data:image/png;base64,invalid!!!', title: 'Invalid Image Test' }
      ];

      const assetDetector = new AssetTypeDetector();
      const tool = new ShowAssetTool({ assetDetector, serverPort: 9999 }); // Non-existent server
      
      for (const input of errorProducingInputs) {
        const result = await tool.execute(input);
        
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        
        // Length standards
        expect(result.error.length).toBeGreaterThanOrEqual(qualityStandards.minimumLength);
        expect(result.error.length).toBeLessThanOrEqual(qualityStandards.maximumLength);
        
        // Content standards
        expect(result.error).toMatch(qualityStandards.mustContain);
        expect(result.error).not.toMatch(qualityStandards.mustNotContain);
        
        // Specificity - error should not be generic
        expect(result.error).not.toMatch(/something.*went.*wrong|an.*error.*occurred|unexpected.*error/i);
        
        console.log(`    ✅ Quality error for ${typeof input.asset}: "${result.error}"`);
      }
    });
  });
});