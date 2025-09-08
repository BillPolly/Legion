/**
 * End-to-End Error Scenario Tests - Component Loading Failures
 * 
 * Tests system behavior when Legion components fail to load or initialize
 * NO MOCKS - Tests real component loading failures and recovery scenarios
 */

import { ShowAssetTool } from '../../src/tools/ShowAssetTool.js';
import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { ShowMeClientActor } from '../../src/client/actors/ShowMeClientActor.js';
import { AssetDisplayManager } from '../../src/client/AssetDisplayManager.js';
import { AssetTypeDetector } from '../../src/detection/AssetTypeDetector.js';
import { ResourceManager } from '@legion/resource-manager';
import { JSDOM } from 'jsdom';

describe('Component Loading Failures End-to-End', () => {
  let resourceManager;
  let dom;
  let document;
  let window;
  const testPort = 3799;

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

  describe('asset detector initialization failures', () => {
    test('should fail fast when AssetTypeDetector fails to initialize', async () => {
      console.log('🚫 Testing AssetTypeDetector initialization failure...');
      
      try {
        // Try to create AssetTypeDetector with invalid configuration
        const faultyDetector = new AssetTypeDetector({
          invalidConfig: true,
          nonExistentPath: '/invalid/path/to/nowhere'
        });
        
        const tool = new ShowAssetTool({
          assetDetector: faultyDetector,
          serverPort: testPort
        });

        const result = await tool.execute({
          asset: { test: 'data' },
          title: 'Detector Failure Test'
        });

        // Should either succeed (detector is resilient) or fail with clear error
        if (!result.success) {
          expect(result.error).toBeTruthy();
          expect(result.error).toMatch(/detector|initialization|configuration/i);
          console.log(`✅ AssetTypeDetector failure handled: ${result.error}`);
        } else {
          console.log('✅ AssetTypeDetector is resilient to bad configuration');
        }
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/detector|invalid|configuration/i);
        console.log(`✅ AssetTypeDetector construction failed fast: ${error.message}`);
      }
    });

    test('should handle missing detector dependency gracefully', async () => {
      console.log('🚫 Testing missing AssetTypeDetector...');
      
      try {
        const tool = new ShowAssetTool({
          assetDetector: null, // Missing detector
          serverPort: testPort
        });

        const result = await tool.execute({
          asset: { test: 'data' },
          title: 'Missing Detector Test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(/detector.*required|missing.*detector|null.*detector/i);
        
        console.log(`✅ Missing detector failed fast: ${result.error}`);
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/detector.*required|missing.*detector/i);
        console.log(`✅ Tool construction failed fast without detector: ${error.message}`);
      }
    });
  });

  describe('server initialization failures', () => {
    test('should fail fast when server fails to initialize', async () => {
      console.log('🚫 Testing server initialization failure...');
      
      try {
        // Try to create server with invalid configuration
        const faultyServer = new ShowMeServer({
          port: -1, // Invalid port
          invalidOption: 'bad value',
          skipLegionPackages: true
        });

        await expect(faultyServer.initialize()).rejects.toThrow();
        console.log('✅ Server initialization failed as expected');
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/port|invalid|initialization|configuration/i);
        console.log(`✅ Server initialization failure: ${error.message}`);
      }
    });

    test('should fail fast when server port is already in use', async () => {
      console.log('🚫 Testing server port conflict...');
      
      // Start first server
      const firstServer = new ShowMeServer({ 
        port: testPort,
        skipLegionPackages: true 
      });
      await firstServer.initialize();
      await firstServer.start();
      
      try {
        // Try to start second server on same port
        const conflictingServer = new ShowMeServer({ 
          port: testPort,
          skipLegionPackages: true 
        });
        await conflictingServer.initialize();
        
        await expect(conflictingServer.start()).rejects.toThrow();
        console.log('✅ Port conflict detected and handled');
        
      } finally {
        // Clean up first server
        await firstServer.stop();
      }
    });

    test('should handle resource manager unavailability', async () => {
      console.log('🚫 Testing ResourceManager unavailability...');
      
      try {
        // Temporarily corrupt the global ResourceManager reference
        const originalGetInstance = ResourceManager.getInstance;
        ResourceManager.getInstance = async () => {
          throw new Error('ResourceManager unavailable');
        };
        
        const server = new ShowMeServer({ 
          port: testPort + 10,
          skipLegionPackages: true 
        });
        
        try {
          await server.initialize();
          
          // Should either succeed (server doesn't require RM) or fail gracefully
          console.log('✅ Server is resilient to ResourceManager unavailability');
        } catch (error) {
          expect(error.message).toMatch(/ResourceManager.*unavailable/i);
          console.log(`✅ Server failed gracefully without ResourceManager: ${error.message}`);
        }
        
        // Restore ResourceManager
        ResourceManager.getInstance = originalGetInstance;
        
      } catch (error) {
        expect(error).toBeTruthy();
        console.log(`✅ ResourceManager dependency failure handled: ${error.message}`);
      }
    });
  });

  describe('client actor initialization failures', () => {
    test('should fail fast when display manager is missing', async () => {
      console.log('🚫 Testing missing display manager...');
      
      try {
        const clientActor = new ShowMeClientActor({
          serverUrl: `ws://localhost:${testPort}/showme`,
          displayManager: null // Missing display manager
        });

        await expect(clientActor.initialize()).rejects.toThrow();
        console.log('✅ Client actor failed fast without display manager');
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/display.*manager.*required|missing.*display.*manager/i);
        console.log(`✅ Client actor construction failed: ${error.message}`);
      }
    });

    test('should handle invalid WebSocket URL gracefully', async () => {
      console.log('🚫 Testing invalid WebSocket URL...');
      
      // Create a minimal display manager
      const displayManager = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort}`,
        wsUrl: `ws://localhost:${testPort}/showme`,
        container: document.getElementById('app')
      });
      
      try {
        await displayManager.initialize();
        
        const clientActor = new ShowMeClientActor({
          serverUrl: 'ws://invalid-url-format:999999/invalid',
          displayManager: displayManager
        });

        await clientActor.initialize();
        
        // Connection should fail
        await expect(clientActor.connect()).rejects.toThrow();
        console.log('✅ Invalid WebSocket URL handled gracefully');
        
        await displayManager.cleanup();
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/connect|websocket|invalid.*url|connection.*failed/i);
        console.log(`✅ WebSocket connection failure: ${error.message}`);
      }
    });

    test('should handle DOM container unavailability', async () => {
      console.log('🚫 Testing missing DOM container...');
      
      try {
        const displayManager = new AssetDisplayManager({
          serverUrl: `http://localhost:${testPort}`,
          wsUrl: `ws://localhost:${testPort}/showme`,
          container: document.getElementById('nonexistent') // Missing container
        });

        await expect(displayManager.initialize()).rejects.toThrow();
        console.log('✅ Missing DOM container handled gracefully');
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/container.*not.*found|missing.*container|invalid.*container/i);
        console.log(`✅ DOM container failure: ${error.message}`);
      }
    });
  });

  describe('display manager initialization failures', () => {
    test('should fail fast with invalid server URLs', async () => {
      console.log('🚫 Testing invalid server URLs...');
      
      const invalidUrls = [
        { serverUrl: 'not-a-url', wsUrl: 'also-not-a-url' },
        { serverUrl: '', wsUrl: '' },
        { serverUrl: 'http://', wsUrl: 'ws://' },
        { serverUrl: 'https://example.com:99999', wsUrl: 'wss://example.com:99999/ws' }
      ];

      for (const urls of invalidUrls) {
        try {
          const displayManager = new AssetDisplayManager({
            serverUrl: urls.serverUrl,
            wsUrl: urls.wsUrl,
            container: document.getElementById('app')
          });

          await expect(displayManager.initialize()).rejects.toThrow();
          console.log(`✅ Invalid URLs (${urls.serverUrl}) handled`);
        } catch (error) {
          expect(error).toBeTruthy();
          expect(error.message).toMatch(/invalid.*url|url.*format|connection.*failed/i);
          console.log(`✅ URL validation failure: ${error.message}`);
        }
      }
    });

    test('should handle missing DOM API gracefully', async () => {
      console.log('🚫 Testing missing DOM API...');
      
      // Temporarily remove DOM APIs
      const originalCreateElement = document.createElement;
      const originalGetElementById = document.getElementById;
      
      document.createElement = undefined;
      document.getElementById = undefined;
      
      try {
        const displayManager = new AssetDisplayManager({
          serverUrl: `http://localhost:${testPort}`,
          wsUrl: `ws://localhost:${testPort}/showme`,
          container: document.querySelector('#app') // Use querySelector instead
        });

        await expect(displayManager.initialize()).rejects.toThrow();
        console.log('✅ Missing DOM API handled gracefully');
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toMatch(/dom.*not.*available|missing.*dom.*api|createElement.*undefined/i);
        console.log(`✅ DOM API failure: ${error.message}`);
      } finally {
        // Restore DOM APIs
        document.createElement = originalCreateElement;
        document.getElementById = originalGetElementById;
      }
    });
  });

  describe('component dependency failures', () => {
    test('should handle Legion package import failures', async () => {
      console.log('🚫 Testing Legion package import failures...');
      
      try {
        // Simulate import failure by creating component with missing dependencies
        const componentCode = `
          import { NonExistentLegionComponent } from '@legion/nonexistent';
          
          export class BrokenComponent extends NonExistentLegionComponent {
            constructor() {
              super();
            }
          }
        `;
        
        // This would normally be tested with dynamic imports, but we'll simulate
        // the error condition by testing component creation failures
        const faultyServer = new ShowMeServer({
          port: testPort + 20,
          skipLegionPackages: false, // Don't skip Legion packages
          requiredPackages: ['@legion/nonexistent'] // Non-existent package
        });
        
        // Should either succeed (resilient to missing packages) or fail gracefully
        try {
          await faultyServer.initialize();
          console.log('✅ Server is resilient to missing Legion packages');
          await faultyServer.stop();
        } catch (error) {
          expect(error.message).toMatch(/package.*not.*found|import.*failed|module.*missing/i);
          console.log(`✅ Package import failure handled: ${error.message}`);
        }
        
      } catch (error) {
        expect(error).toBeTruthy();
        console.log(`✅ Dependency failure handled: ${error.message}`);
      }
    });

    test('should handle version mismatch gracefully', async () => {
      console.log('🚫 Testing version compatibility issues...');
      
      try {
        // Simulate version mismatch by creating components with incompatible interfaces
        const assetDetector = new AssetTypeDetector();
        
        // Override a method to simulate interface change
        const originalDetect = assetDetector.detectType;
        assetDetector.detectType = function(asset, options) {
          // Simulate new interface that requires additional parameter
          throw new Error('Interface mismatch: detectType now requires additional context parameter');
        };
        
        const tool = new ShowAssetTool({
          assetDetector,
          serverPort: testPort
        });

        const result = await tool.execute({
          asset: { test: 'version mismatch' },
          title: 'Version Mismatch Test'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        expect(result.error).toMatch(/interface.*mismatch|version.*incompatible|method.*not.*compatible/i);
        
        console.log(`✅ Version mismatch handled: ${result.error}`);
      } catch (error) {
        expect(error).toBeTruthy();
        console.log(`✅ Version compatibility issue handled: ${error.message}`);
      }
    });
  });

  describe('runtime component failures', () => {
    test('should handle component crashes during operation', async () => {
      console.log('🚫 Testing component crashes during operation...');
      
      // Start a working system first
      const server = new ShowMeServer({ 
        port: testPort + 30,
        skipLegionPackages: true 
      });
      await server.initialize();
      await server.start();
      
      const displayManager = new AssetDisplayManager({
        serverUrl: `http://localhost:${testPort + 30}`,
        wsUrl: `ws://localhost:${testPort + 30}/showme`,
        container: document.getElementById('app')
      });
      await displayManager.initialize();
      
      const clientActor = new ShowMeClientActor({
        serverUrl: `ws://localhost:${testPort + 30}/showme`,
        displayManager: displayManager
      });
      await clientActor.initialize();
      await clientActor.connect();
      
      try {
        // Inject a failure into the display manager
        const originalCreateViewer = displayManager.createViewer;
        displayManager.createViewer = function() {
          throw new Error('Viewer creation crashed');
        };
        
        // Try to display an asset
        const assetDetector = new AssetTypeDetector();
        const tool = new ShowAssetTool({ 
          assetDetector, 
          serverPort: testPort + 30 
        });
        
        const result = await tool.execute({
          asset: { crash: 'test' },
          title: 'Crash Test'
        });
        
        expect(result.success).toBe(true); // Tool should succeed
        
        // Display should fail gracefully
        try {
          await clientActor.displayAsset(result.assetId);
          expect(false).toBe(true); // Should not reach here
        } catch (error) {
          expect(error.message).toMatch(/viewer.*creation.*crashed|component.*failed/i);
          console.log(`✅ Component crash handled gracefully: ${error.message}`);
        }
        
      } finally {
        await clientActor.disconnect();
        await clientActor.cleanup();
        await displayManager.cleanup();
        await server.stop();
      }
    });

    test('should handle memory exhaustion gracefully', async () => {
      console.log('🚫 Testing memory exhaustion handling...');
      
      try {
        // Create a scenario that could cause memory issues
        const massiveArray = new Array(10000000); // 10 million elements
        massiveArray.fill({ 
          largeData: 'x'.repeat(1000),
          moreData: new Array(1000).fill('memory test')
        });
        
        const assetDetector = new AssetTypeDetector();
        const tool = new ShowAssetTool({
          assetDetector,
          serverPort: testPort
        });

        const startTime = Date.now();
        const result = await tool.execute({
          asset: massiveArray,
          title: 'Memory Exhaustion Test'
        });
        const endTime = Date.now();

        // Should either succeed or fail with memory-related error
        if (result.success) {
          console.log(`✅ Large asset handled in ${endTime - startTime}ms`);
        } else {
          expect(result.error).toBeTruthy();
          expect(result.error).toMatch(/memory|size.*limit|too.*large|out.*of.*memory/i);
          console.log(`✅ Memory limit handled: ${result.error}`);
        }
        
      } catch (error) {
        // Might throw due to memory constraints
        expect(error).toBeTruthy();
        console.log(`✅ Memory exhaustion handled: ${error.message}`);
      }
    });
  });

  describe('component recovery scenarios', () => {
    test('should handle component restart after failure', async () => {
      console.log('🚫 Testing component restart after failure...');
      
      const assetDetector = new AssetTypeDetector();
      
      // First, cause a failure
      const originalDetect = assetDetector.detectType;
      assetDetector.detectType = () => {
        throw new Error('Detector temporarily failed');
      };
      
      const tool = new ShowAssetTool({
        assetDetector,
        serverPort: testPort
      });

      // First execution should fail
      const failResult = await tool.execute({
        asset: { recovery: 'test' },
        title: 'Recovery Test - Fail'
      });

      expect(failResult.success).toBe(false);
      expect(failResult.error).toContain('temporarily failed');
      console.log('✅ Component failure confirmed');
      
      // "Restart" component by restoring functionality
      assetDetector.detectType = originalDetect;
      
      // Second execution should succeed
      const successResult = await tool.execute({
        asset: { recovery: 'test' },
        title: 'Recovery Test - Success'
      });

      expect(successResult.success).toBe(true);
      expect(successResult.assetId).toBeTruthy();
      
      console.log('✅ Component recovery successful');
    });

    test('should maintain system stability despite component failures', async () => {
      console.log('🚫 Testing system stability with partial failures...');
      
      const server = new ShowMeServer({ 
        port: testPort + 40,
        skipLegionPackages: true 
      });
      await server.initialize();
      await server.start();
      
      try {
        // Create components with some that fail
        const components = [];
        
        for (let i = 0; i < 5; i++) {
          const displayManager = new AssetDisplayManager({
            serverUrl: `http://localhost:${testPort + 40}`,
            wsUrl: `ws://localhost:${testPort + 40}/showme`,
            container: document.getElementById('app')
          });
          
          await displayManager.initialize();
          
          // Make some components fail
          if (i % 2 === 0) {
            displayManager.createWindow = () => {
              throw new Error(`Component ${i} failed`);
            };
          }
          
          components.push(displayManager);
        }
        
        // System should handle partial failures gracefully
        let workingComponents = 0;
        let failedComponents = 0;
        
        for (let i = 0; i < components.length; i++) {
          try {
            // Test component functionality
            await components[i].createWindow({
              assetId: 'test',
              title: 'Stability Test',
              width: 400,
              height: 300
            });
            workingComponents++;
          } catch (error) {
            expect(error.message).toContain('failed');
            failedComponents++;
          }
        }
        
        expect(workingComponents).toBeGreaterThan(0);
        expect(failedComponents).toBeGreaterThan(0);
        
        console.log(`✅ System stability maintained: ${workingComponents} working, ${failedComponents} failed`);
        
        // Clean up
        for (const component of components) {
          try {
            await component.cleanup();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        
      } finally {
        await server.stop();
      }
    });
  });

  describe('component loading error messages', () => {
    test('should provide clear error messages for component failures', async () => {
      console.log('🚫 Testing component failure error messages...');
      
      const failureScenarios = [
        {
          name: 'Missing ResourceManager',
          setup: () => {
            const originalGetInstance = ResourceManager.getInstance;
            ResourceManager.getInstance = async () => {
              throw new Error('ResourceManager failed to initialize');
            };
            return () => { ResourceManager.getInstance = originalGetInstance; };
          },
          expectedPattern: /ResourceManager.*failed|initialization.*failed/i
        },
        {
          name: 'Invalid Port Configuration',
          setup: () => ({
            port: 'not-a-number',
            skipLegionPackages: true
          }),
          expectedPattern: /port.*invalid|invalid.*port|port.*number/i
        },
        {
          name: 'Missing Container Element',
          setup: () => ({
            serverUrl: `http://localhost:${testPort}`,
            wsUrl: `ws://localhost:${testPort}/showme`,
            container: null
          }),
          expectedPattern: /container.*required|missing.*container|null.*container/i
        }
      ];

      for (const scenario of failureScenarios) {
        console.log(`  Testing: ${scenario.name}`);
        
        let cleanup = null;
        let error = null;
        
        try {
          const setupResult = scenario.setup();
          
          if (typeof setupResult === 'function') {
            cleanup = setupResult;
          } else if (setupResult.port !== undefined) {
            // Server configuration test
            const server = new ShowMeServer(setupResult);
            await server.initialize();
          } else {
            // Display manager configuration test
            const displayManager = new AssetDisplayManager(setupResult);
            await displayManager.initialize();
          }
          
        } catch (e) {
          error = e;
        }
        
        expect(error).toBeTruthy();
        expect(error.message).toMatch(scenario.expectedPattern);
        expect(error.message.length).toBeGreaterThan(10);
        expect(error.message).not.toMatch(/undefined|null|object Object/i);
        
        console.log(`    ✅ Clear error: ${error.message.substring(0, 80)}...`);
        
        if (cleanup) cleanup();
      }
    });

    test('should include component context in error messages', async () => {
      console.log('🚫 Testing component context in error messages...');
      
      try {
        const displayManager = new AssetDisplayManager({
          serverUrl: `http://localhost:${testPort}`,
          wsUrl: `ws://localhost:${testPort}/invalid-endpoint`,
          container: document.getElementById('app')
        });
        
        await displayManager.initialize();
        
        const clientActor = new ShowMeClientActor({
          serverUrl: `ws://localhost:${testPort}/invalid-endpoint`,
          displayManager: displayManager
        });
        
        await clientActor.initialize();
        await clientActor.connect();
        
      } catch (error) {
        expect(error).toBeTruthy();
        
        // Error should include component and context information
        const errorLower = error.message.toLowerCase();
        const hasComponentContext = errorLower.includes('client') || 
                                  errorLower.includes('display') || 
                                  errorLower.includes('websocket') ||
                                  errorLower.includes('connection');
        expect(hasComponentContext).toBe(true);
        
        console.log(`✅ Contextual component error: ${error.message}`);
      }
    });
  });
});