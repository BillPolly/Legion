/**
 * Integration Tests for ShowMeModule
 * 
 * Tests the complete module integration with real asset handling
 * NO MOCKS - Tests actual module functionality end-to-end
 */

// Skip these tests in jsdom environment as they require Node.js modules
const describeNode = typeof process !== 'undefined' && process.versions && process.versions.node
  ? describe
  : describe.skip;

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ShowMeModule } from '../../src/ShowMeModule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describeNode('ShowMeModule Integration', () => {
  let module;
  let testAssetsDir;
  let server;

  beforeAll(async () => {
    // Import ShowMeServer for real integration testing
    const { ShowMeServer } = await import('../../src/server/ShowMeServer.js');
    
    // Start a real server instance for integration tests (NO MOCKS)
    server = new ShowMeServer({ 
      port: 3799, // Use different port for tests
      skipLegionPackages: true // Skip package discovery for faster tests
    });
    await server.initialize();
    await server.start();
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Create module with server port configured
    module = new ShowMeModule({ serverPort: 3799 });
    testAssetsDir = path.join(__dirname, '../assets');
    
    // Ensure test assets directory exists (created by AssetDetection.test.js)
    try {
      await fs.access(testAssetsDir);
    } catch {
      await fs.mkdir(testAssetsDir, { recursive: true });
      await createTestAssets();
    }
  }, 30000); // 30 second timeout for server startup

  afterAll(async () => {
    // Clean up the real server
    if (server) {
      try {
        await server.stop();
      } catch (error) {
        console.error('Error stopping server:', error.message);
      }
    }
  }, 10000); // Give 10 seconds for cleanup

  async function createTestAssets() {
    // Create minimal test assets for module integration testing
    const testData = {
      'test.json': JSON.stringify({ name: 'Test Module', version: '1.0.0' }),
      'data.csv': 'id,name,value\n1,Test,100\n2,Demo,200',
      'script.js': 'console.log("Hello from ShowMe module test");',
      'test.txt': 'This is a test text file for module integration.'
    };

    for (const [filename, content] of Object.entries(testData)) {
      await fs.writeFile(path.join(testAssetsDir, filename), content);
    }
  }

  describe('module interface compliance', () => {
    test('should expose all required Legion module methods', () => {
      expect(typeof module.getName).toBe('function');
      expect(typeof module.getVersion).toBe('function');
      expect(typeof module.getDescription).toBe('function');
      expect(typeof module.getTools).toBe('function');
    });

    test('should return consistent module metadata', () => {
      expect(module.getName()).toBe('ShowMe');
      expect(module.getVersion()).toMatch(/^\d+\.\d+\.\d+$/);
      expect(module.getDescription()).toContain('Generic asset display module');
    });

    test('should provide properly structured tools', () => {
      const tools = module.getTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('execute');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('outputSchema');
        expect(typeof tool.execute).toBe('function');
      });
    });
  });

  describe('end-to-end tool execution', () => {
    test('should handle real JSON file from filesystem', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const jsonPath = path.join(testAssetsDir, 'test.json');
      const jsonContent = await fs.readFile(jsonPath, 'utf8');
      const jsonObject = JSON.parse(jsonContent);
      
      // Test with file path
      const result1 = await showAssetTool.execute({ asset: jsonPath });
      expect(result1.success).toBe(true);
      expect(result1.detected_type).toBe('json');
      expect(result1.window_id).toMatch(/^showme_\d+_[a-z0-9]+$/);
      
      // Test with file content
      const result2 = await showAssetTool.execute({ asset: jsonContent });
      expect(result2.success).toBe(true);
      expect(result2.detected_type).toBe('json');
      
      // Test with parsed object
      const result3 = await showAssetTool.execute({ asset: jsonObject });
      expect(result3.success).toBe(true);
      expect(result3.detected_type).toBe('json');
    });

    test('should handle real CSV data from filesystem', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const csvPath = path.join(testAssetsDir, 'data.csv');
      const csvContent = await fs.readFile(csvPath, 'utf8');
      
      const result = await showAssetTool.execute({ asset: csvContent });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('data');
      expect(result.title).toBe('Data Table');
      expect(result.window_id).toBeTruthy();
    });

    test('should handle real JavaScript code from filesystem', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const jsPath = path.join(testAssetsDir, 'script.js');
      const jsContent = await fs.readFile(jsPath, 'utf8');
      
      // Test with file path
      const result1 = await showAssetTool.execute({ asset: jsPath });
      expect(result1.success).toBe(true);
      expect(result1.detected_type).toBe('code');
      expect(result1.title).toBe('Code: script.js');
      
      // Test with file content
      const result2 = await showAssetTool.execute({ asset: jsContent });
      expect(result2.success).toBe(true);
      expect(result2.detected_type).toBe('code');
    });

    test('should handle real text file from filesystem', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const textPath = path.join(testAssetsDir, 'test.txt');
      const textContent = await fs.readFile(textPath, 'utf8');
      
      const result = await showAssetTool.execute({ asset: textContent });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('text');
      expect(result.title).toBe('Text Viewer');
    });
  });

  describe('complex integration scenarios', () => {
    test('should handle mixed asset types in sequence', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const assets = [
        { key: 'value' }, // JSON object
        'https://example.com', // URL
        '<div>HTML content</div>', // HTML
        [{ id: 1, name: 'Table' }], // Tabular data
        'Plain text content' // Text
      ];
      
      const results = [];
      for (const asset of assets) {
        const result = await showAssetTool.execute({ asset });
        results.push(result);
      }
      
      // All executions should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // Should detect different types correctly
      expect(results[0].detected_type).toBe('json');
      expect(results[1].detected_type).toBe('web');
      expect(results[2].detected_type).toBe('web');
      expect(results[3].detected_type).toBe('data');
      expect(results[4].detected_type).toBe('text');
      
      // All should have unique window IDs
      const windowIds = results.map(r => r.window_id);
      const uniqueIds = new Set(windowIds);
      expect(uniqueIds.size).toBe(windowIds.length);
    });

    test('should handle hint override scenarios correctly', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const jsonObject = { data: [1, 2, 3] };
      
      // Test valid hint override
      const result1 = await showAssetTool.execute({
        asset: jsonObject,
        hint: 'text'
      });
      
      expect(result1.success).toBe(true);
      expect(result1.detected_type).toBe('text');
      
      // Test invalid hint (should fallback to auto-detection)
      const result2 = await showAssetTool.execute({
        asset: jsonObject,
        hint: 'image'
      });
      
      expect(result2.success).toBe(true);
      expect(result2.detected_type).toBe('json'); // Should ignore invalid hint
    });

    test('should handle custom titles and options', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const result = await showAssetTool.execute({
        asset: { test: 'data' },
        title: 'Custom Integration Test Window',
        options: {
          width: 800,
          height: 600,
          resizable: true
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.title).toBe('Custom Integration Test Window');
      expect(result.detected_type).toBe('json');
      expect(result.window_id).toBeTruthy();
    });
  });

  describe('error handling and edge cases', () => {
    test('should handle invalid tool parameters gracefully', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      // Test missing asset parameter
      const result1 = await showAssetTool.execute({});
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('Missing required parameter');
      
      // Test null asset
      const result2 = await showAssetTool.execute({ asset: null });
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Missing required parameter');
    });

    test('should handle very large assets without crashing', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      // Create large data structure
      const largeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: `Item ${i}`,
        value: Math.random(),
        nested: { deep: { value: i * 2 } }
      }));
      
      const result = await showAssetTool.execute({ asset: largeArray });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('data');
    });

    test('should handle special characters and unicode', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const unicodeData = {
        emoji: '🎉🚀✨',
        chinese: '你好世界',
        arabic: 'مرحبا بالعالم',
        special: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?'
      };
      
      const result = await showAssetTool.execute({ asset: unicodeData });
      
      expect(result.success).toBe(true);
      expect(result.detected_type).toBe('json');
    });
  });

  describe('performance and reliability', () => {
    test('should handle rapid sequential executions', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(showAssetTool.execute({
          asset: { id: i, data: `Test ${i}` },
          title: `Window ${i}`
        }));
      }
      
      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results.every(r => r.success)).toBe(true);
      
      // All should have unique window IDs
      const windowIds = results.map(r => r.window_id);
      const uniqueIds = new Set(windowIds);
      expect(uniqueIds.size).toBe(windowIds.length);
    });

    test('should be stateless across multiple invocations', async () => {
      const tools = module.getTools();
      const showAssetTool = tools.find(tool => tool.name === 'show_asset');
      
      // First execution
      const result1 = await showAssetTool.execute({
        asset: { test: 'first' }
      });
      
      // Second execution should not be affected by first
      const result2 = await showAssetTool.execute({
        asset: 'completely different content'
      });
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.window_id).not.toBe(result2.window_id);
      expect(result1.detected_type).toBe('json');
      expect(result2.detected_type).toBe('text');
    });
  });
});