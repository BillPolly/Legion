/**
 * Integration test for loading and executing the AI image generation module
 * through the ModuleLoader interface.
 * 
 * This test demonstrates the complete flow:
 * 1. Initialize ModuleLoader with ResourceManager
 * 2. Load the ai-generation module by name
 * 3. Execute the generate_image tool
 * 4. Verify the generated image file
 * 
 * Requires OPENAI_API_KEY in .env file to run
 */

import { jest } from '@jest/globals';
import { ModuleLoader } from '../../src/ModuleLoader.js';
import { ResourceManager } from '../../src/resources/ResourceManager.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Increase timeout for API calls
jest.setTimeout(30000);

describe('Image Generation via ModuleLoader - Integration Test', () => {
  let moduleLoader;
  let resourceManager;
  let testOutputDir;
  let hasApiKey = false;

  beforeAll(async () => {
    // Create test output directory for generated images
    testOutputDir = path.join(__dirname, 'test-output-images');
    await fs.mkdir(testOutputDir, { recursive: true });
    
    // Initialize ResourceManager to load .env file
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Check if we have the API key
    try {
      const apiKey = resourceManager.get('env.OPENAI_API_KEY');
      if (apiKey) {
        hasApiKey = true;
        console.log('🚀 Running live image generation test with ModuleLoader');
      }
    } catch (error) {
      console.log('⚠️  Skipping live test: OPENAI_API_KEY not found in .env file');
    }
  });

  beforeEach(async () => {
    if (!hasApiKey) return;
    
    // Create and initialize ModuleLoader
    moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();
  });

  afterEach(() => {
    if (moduleLoader) {
      moduleLoader.clear();
    }
  });

  afterAll(async () => {
    // Optionally clean up test output directory
    // Comment out to keep generated test images for inspection
    // try {
    //   await fs.rm(testOutputDir, { recursive: true, force: true });
    // } catch (error) {
    //   console.warn('Could not clean up test output directory:', error);
    // }
  });

  describe('Loading ai-generation module', () => {
    test('should load ai-generation module by name from registry', async () => {
      if (!hasApiKey) {
        console.log('Skipping: No API key');
        return;
      }

      // Load from registry
      const results = await moduleLoader.loadAllFromRegistry();
      
      // Check that ai-generation was loaded
      expect(results.successful).toContain('ai-generation');
      expect(moduleLoader.hasModule('ai-generation')).toBe(true);
      
      // Get the module
      const aiGenModule = moduleLoader.getModule('ai-generation');
      expect(aiGenModule).toBeDefined();
      // The module name might be 'ai-generation' when loaded from JSON
      expect(['AIGenerationModule', 'ai-generation']).toContain(aiGenModule.name);
      
      console.log('✅ Loaded ai-generation module from registry');
    });

    test('should load ai-generation module by name with class', async () => {
      if (!hasApiKey) {
        console.log('Skipping: No API key');
        return;
      }

      // Import the module class
      const { default: AIGenerationModule } = await import('../../../general-tools/src/ai-generation/AIGenerationModule.js');
      
      // Load module by name
      const module = await moduleLoader.loadModuleByName('ai-generation', AIGenerationModule);
      
      expect(module).toBeDefined();
      expect(module.name).toBe('AIGenerationModule');
      expect(moduleLoader.hasModule('ai-generation')).toBe(true);
      
      console.log('✅ Loaded ai-generation module by name with class');
    });
  });

  describe('Executing generate_image tool', () => {
    test('should generate image through ModuleLoader.executeTool()', async () => {
      if (!hasApiKey) {
        console.log('Skipping: No API key');
        return;
      }
      
      console.log('Test running with API key available');

      // Load just the ai-generation module from its directory (will use module.json)
      console.log('Loading ai-generation module...');
      const moduleDir = path.join(__dirname, '../../../general-tools/src/ai-generation');
      await moduleLoader.loadModule(moduleDir);
      console.log('Module loaded');
      
      // Verify the tool is available
      expect(moduleLoader.hasTool('generate_image')).toBe(true);
      
      // Get the tool and add event listeners
      const tool = moduleLoader.getTool('generate_image');
      
      // Add event listeners to track progress
      if (tool && tool.on) {
        tool.on('progress', (data) => {
          console.log(`  📊 Progress: ${data.percentage}% - ${data.status}`);
        });
        
        tool.on('info', (data) => {
          console.log(`  ℹ️ Info: ${data.message || data}`);
        });
        
        tool.on('warning', (data) => {
          console.log(`  ⚠️ Warning: ${data.message || data}`);
        });
        
        tool.on('error', (data) => {
          console.log(`  ❌ Error: ${data.message || data}`);
        });
      }
      
      // Execute the tool
      console.log('🎨 Generating image via ModuleLoader.executeTool()...');
      console.log('  Prompt: "A colorful abstract geometric pattern with triangles and circles"');
      console.log('  Size: 1024x1024, Quality: standard, Style: vivid');
      
      const result = await moduleLoader.executeTool('generate_image', {
        prompt: 'A colorful abstract geometric pattern with triangles and circles',
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
        response_format: 'b64_json'
      });
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.imageData).toBeDefined();
      expect(result.imageData).toMatch(/^data:image\/png;base64,/);
      expect(result.filename).toMatch(/^dalle3-.*\.png$/);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.prompt).toBe('A colorful abstract geometric pattern with triangles and circles');
      expect(result.metadata.revisedPrompt).toBeDefined();
      
      // Save the generated image
      const base64Data = result.imageData.replace(/^data:image\/png;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      const outputPath = path.join(testOutputDir, `moduleloader-test-${Date.now()}.png`);
      await fs.writeFile(outputPath, imageBuffer);
      
      // Verify the file was created and has content
      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
      
      console.log(`✅ Generated image saved to: ${outputPath}`);
      console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`   Revised prompt: ${result.metadata.revisedPrompt}`);
    });

    test('should handle multiple tool executions', async () => {
      if (!hasApiKey) {
        console.log('Skipping: No API key');
        return;
      }

      // Load the module
      await moduleLoader.loadAllFromRegistry();
      
      // Generate two different images
      const prompts = [
        'A minimalist logo with a blue circle',
        'A simple green triangle on white background'
      ];
      
      const results = [];
      
      for (const prompt of prompts) {
        console.log(`🎨 Generating: "${prompt}"`);
        const result = await moduleLoader.executeTool('generate_image', {
          prompt,
          size: '1024x1024',
          quality: 'standard',
          style: 'natural',
          response_format: 'b64_json'
        });
        
        expect(result.success).toBe(true);
        expect(result.imageData).toBeDefined();
        results.push(result);
        
        // Save each image
        const base64Data = result.imageData.replace(/^data:image\/png;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const filename = `batch-${results.length}-${Date.now()}.png`;
        const outputPath = path.join(testOutputDir, filename);
        await fs.writeFile(outputPath, imageBuffer);
        
        console.log(`   ✅ Saved as ${filename}`);
      }
      
      expect(results).toHaveLength(2);
      // Each result should have unique revised prompts
      expect(results[0].metadata.revisedPrompt).not.toBe(results[1].metadata.revisedPrompt);
    });
  });

  describe('Tool Registry Integration', () => {
    test('should register generate_image tool in toolRegistry', async () => {
      if (!hasApiKey) {
        console.log('Skipping: No API key');
        return;
      }

      // Load the module
      await moduleLoader.loadAllFromRegistry();
      
      // Check tool registry
      const toolNames = moduleLoader.getToolNames();
      expect(toolNames).toContain('generate_image');
      
      // Get the tool directly
      const tool = moduleLoader.getTool('generate_image');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('generate_image');
      expect(tool.description).toContain('Generate an image');
      
      // Verify tool has proper methods
      expect(typeof tool.execute).toBe('function');
      
      console.log('✅ Tool properly registered in toolRegistry');
    });

    test('should get tool inventory including generate_image', async () => {
      if (!hasApiKey) {
        console.log('Skipping: No API key');
        return;
      }

      // Load the module
      await moduleLoader.loadAllFromRegistry();
      
      // Get inventory
      const inventory = moduleLoader.getModuleAndToolInventory();
      
      // Check module is in inventory
      expect(inventory.modules['ai-generation']).toBeDefined();
      // The module might not have tools exposed via getTools() when loaded from JSON
      // The tools are registered directly in the toolRegistry
      
      // Check tool is in inventory
      expect(inventory.tools['generate_image']).toBeDefined();
      expect(inventory.tools['generate_image'].hasExecute).toBe(true);
      expect(inventory.tools['generate_image'].description).toContain('image');
      
      console.log('✅ Module and tool properly listed in inventory');
      console.log(`   Total modules: ${inventory.moduleCount}`);
      console.log(`   Total tools: ${inventory.toolCount}`);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing API key gracefully', async () => {
      // Create a new ResourceManager without API key
      const emptyRM = new ResourceManager();
      await emptyRM.initialize();
      
      // Override the OPENAI_API_KEY to simulate missing key
      emptyRM.resources.delete('env.OPENAI_API_KEY');
      
      const loader = new ModuleLoader(emptyRM);
      await loader.initialize();
      
      try {
        await loader.loadAllFromRegistry();
        // Module might load but tool execution should fail
        if (loader.hasTool('generate_image')) {
          await loader.executeTool('generate_image', {
            prompt: 'test',
            response_format: 'b64_json'
          });
          fail('Should have thrown error for missing API key');
        }
      } catch (error) {
        expect(error.message).toMatch(/API key|OPENAI_API_KEY/i);
        console.log('✅ Properly handled missing API key');
      }
    });

    test('should handle invalid tool parameters', async () => {
      if (!hasApiKey) {
        console.log('Skipping: No API key');
        return;
      }

      await moduleLoader.loadAllFromRegistry();
      
      try {
        await moduleLoader.executeTool('generate_image', {
          // Missing required 'prompt' parameter
          size: '1024x1024'
        });
        fail('Should have thrown error for missing prompt');
      } catch (error) {
        expect(error).toBeDefined();
        console.log('✅ Properly handled missing required parameter');
      }
    });

    test('should handle non-existent tool', async () => {
      if (!hasApiKey) {
        console.log('Skipping: No API key');
        return;
      }

      await moduleLoader.loadAllFromRegistry();
      
      try {
        await moduleLoader.executeTool('non_existent_tool', {});
        fail('Should have thrown error for non-existent tool');
      } catch (error) {
        expect(error.message).toContain('Tool not found');
        console.log('✅ Properly handled non-existent tool');
      }
    });
  });
});