import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Package Integration Tests', () => {
  describe('Package Exports', () => {
    test('can import all main exports from package', async () => {
      // Test importing from the main package entry point
      const packageExports = await import('../../src/index.js');
      
      // Verify main exports are available
      expect(packageExports.PictureAnalysisModule).toBeDefined();
      expect(typeof packageExports.PictureAnalysisModule).toBe('function');
      
      expect(packageExports.PictureAnalysisTool).toBeDefined();
      expect(typeof packageExports.PictureAnalysisTool).toBe('function');
      
      // Verify utility exports
      expect(packageExports.resolveFilePath).toBeDefined();
      expect(packageExports.validateImageFormat).toBeDefined();
      expect(packageExports.validateFileSize).toBeDefined();
      expect(packageExports.encodeImageAsBase64).toBeDefined();
      expect(packageExports.getImageMetadata).toBeDefined();
      
      expect(packageExports.InputSchema).toBeDefined();
      
      // Verify package info
      expect(packageExports.PACKAGE_NAME).toBe('picture-analysis');
      expect(packageExports.PACKAGE_VERSION).toBe('1.0.0');
      expect(packageExports.getPackageInfo).toBeDefined();
      
      const packageInfo = packageExports.getPackageInfo();
      expect(packageInfo.name).toBe('picture-analysis');
      expect(packageInfo.version).toBe('1.0.0');
      expect(packageInfo.ready).toBe(true);
      expect(packageInfo.description).toContain('AI-powered image analysis');
    });

    test('can import specific exports individually', async () => {
      // Test destructured imports
      const { PictureAnalysisModule, PictureAnalysisTool } = await import('../../src/index.js');
      
      expect(PictureAnalysisModule).toBeDefined();
      expect(PictureAnalysisTool).toBeDefined();
      
      // Test utility imports
      const { resolveFilePath, validateImageFormat, InputSchema } = await import('../../src/index.js');
      
      expect(resolveFilePath).toBeDefined();
      expect(validateImageFormat).toBeDefined();
      expect(InputSchema).toBeDefined();
    });

    test('default export points to PictureAnalysisModule', async () => {
      // Test default import should work for the module
      const DefaultExport = (await import('../../src/PictureAnalysisModule.js')).default;
      const { PictureAnalysisModule } = await import('../../src/index.js');
      
      expect(DefaultExport).toBe(PictureAnalysisModule);
    });
  });

  describe('Package.json Configuration', () => {
    test('package.json has correct configuration', () => {
      const packageJsonPath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Verify basic package info
      expect(packageJson.name).toBe('@legion/picture-analysis');
      expect(packageJson.version).toBe('1.0.0');
      expect(packageJson.type).toBe('module');
      
      // Verify main entry point
      expect(packageJson.main).toBe('./src/index.js');
      
      // Verify exports configuration
      expect(packageJson.exports).toBeDefined();
      expect(packageJson.exports['.']).toBe('./src/index.js');
      
      // Verify dependencies
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies['@legion/llm-client']).toBeDefined();
      expect(packageJson.dependencies['@legion/resource-manager']).toBeDefined();
      expect(packageJson.dependencies['@legion/tools-registry']).toBeDefined();
      expect(packageJson.dependencies['zod']).toBeDefined();
      
      // Verify test configuration
      expect(packageJson.scripts.test).toBeDefined();
      expect(packageJson.devDependencies['jest']).toBeDefined();
    });

    test('all dependencies are resolvable', async () => {
      // Test that all dependencies can be imported
      const packageJsonPath = path.join(__dirname, '../../package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      const dependencies = Object.keys(packageJson.dependencies);
      
      for (const dep of dependencies) {
        try {
          await import(dep);
          console.log(`✅ Successfully imported dependency: ${dep}`);
        } catch (error) {
          // Some dependencies might not have default exports, that's ok
          if (error.message.includes('does not provide an export named')) {
            console.log(`✅ Dependency exists but no default export: ${dep}`);
          } else {
            throw new Error(`Failed to import dependency ${dep}: ${error.message}`);
          }
        }
      }
    });
  });

  describe('Module Instantiation', () => {
    test('can create module instance through package import', async () => {
      const { PictureAnalysisModule } = await import('../../src/index.js');
      
      // Create mock ResourceManager
      const resourceManager = {
        _data: new Map(),
        get: function(key) {
          if (key === 'env.ANTHROPIC_API_KEY') {
            return 'test-api-key';
          }
          return this._data.get(key);
        },
        set: function(key, value) {
          this._data.set(key, value);
        }
      };
      
      // Should be able to create module
      const module = await PictureAnalysisModule.create(resourceManager);
      
      expect(module).toBeDefined();
      expect(module.name).toBe('picture-analysis');
      expect(module.listTools()).toContain('analyse_picture');
      
      // Clean up
      await module.cleanup();
    });

    test('tool can be instantiated independently', async () => {
      const { PictureAnalysisTool } = await import('../../src/index.js');
      
      // Create mock LLM client
      const mockLLMClient = {
        sendAndReceiveResponse: () => Promise.resolve('Mock response'),
        provider: { supportsVision: () => true }
      };
      
      const tool = new PictureAnalysisTool({ llmClient: mockLLMClient });
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('analyse_picture');
      expect(tool.description).toContain('Analyze images using AI vision models');
    });
  });

  describe('Utility Function Integration', () => {
    test('utility functions work when imported from package', async () => {
      const { resolveFilePath, validateImageFormat, InputSchema } = await import('../../src/index.js');
      
      // Test file path resolution
      const currentDir = process.cwd();
      const resolved = resolveFilePath('./package.json');
      expect(resolved).toBe(path.join(currentDir, 'package.json'));
      
      // Test format validation
      expect(() => validateImageFormat('test.png')).not.toThrow();
      expect(() => validateImageFormat('test.txt')).toThrow('Unsupported format');
      
      // Test schema validation
      const validInput = {
        file_path: '/path/to/image.png',
        prompt: 'Describe this image'
      };
      
      const validation = InputSchema.validate(validInput);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Legion Framework Compatibility', () => {
    test('module follows Legion framework patterns', async () => {
      const { PictureAnalysisModule } = await import('../../src/index.js');
      
      // Check that it has the required static create method
      expect(typeof PictureAnalysisModule.create).toBe('function');
      expect(PictureAnalysisModule.create.length).toBe(1); // Takes resourceManager parameter
      
      // Check that instances have required methods
      const resourceManager = {
        get: () => 'test-key',
        set: () => {},
        has: () => true
      };
      
      const module = await PictureAnalysisModule.create(resourceManager);
      
      // Module should have Legion-compatible interface
      expect(typeof module.listTools).toBe('function');
      expect(typeof module.getTool).toBe('function');
      expect(typeof module.getTools).toBe('function');
      expect(typeof module.executeTool).toBe('function');
      expect(typeof module.getMetadata).toBe('function');
      expect(typeof module.cleanup).toBe('function');
      
      // Should emit events (EventEmitter)
      expect(typeof module.on).toBe('function');
      expect(typeof module.emit).toBe('function');
      
      await module.cleanup();
    });

    test('tool follows Legion tool patterns', async () => {
      const { PictureAnalysisTool } = await import('../../src/index.js');
      
      const mockLLMClient = {
        sendAndReceiveResponse: () => Promise.resolve('test'),
        provider: { supportsVision: () => true }
      };
      
      const tool = new PictureAnalysisTool({ llmClient: mockLLMClient });
      
      // Tool should have required properties
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.schema || tool.inputSchema).toBeDefined();
      
      // Tool should have required methods
      expect(typeof tool.execute).toBe('function');
      expect(typeof tool.getMetadata).toBe('function');
      
      // Should emit events (EventEmitter)
      expect(typeof tool.on).toBe('function');
      expect(typeof tool.emit).toBe('function');
      
      // Should have progress/error methods
      expect(typeof tool.progress).toBe('function');
      expect(typeof tool.error).toBe('function');
      expect(typeof tool.info).toBe('function');
      expect(typeof tool.warning).toBe('function');
    });
  });

  describe('Cross-Package Import Simulation', () => {
    test('can be imported as if from external package', async () => {
      // Simulate importing from node_modules by using the package name structure
      const packagePath = path.resolve(__dirname, '../../src/index.js');
      
      // Dynamic import should work with file path
      const moduleExports = await import(packagePath);
      
      expect(moduleExports.PictureAnalysisModule).toBeDefined();
      expect(moduleExports.PictureAnalysisTool).toBeDefined();
      
      // Test that we can create a working instance
      const resourceManager = {
        get: (key) => key === 'env.ANTHROPIC_API_KEY' ? 'test' : undefined,
        set: () => {},
        has: () => true
      };
      
      const module = await moduleExports.PictureAnalysisModule.create(resourceManager);
      expect(module.name).toBe('picture-analysis');
      
      await module.cleanup();
    });
  });

  describe('Error Handling in Package Context', () => {
    test('package handles missing dependencies gracefully', async () => {
      const { PictureAnalysisModule } = await import('../../src/index.js');
      
      // ResourceManager without API key
      const resourceManager = {
        get: () => undefined,
        set: () => {},
        has: () => false
      };
      
      // Should fail with clear error message
      await expect(PictureAnalysisModule.create(resourceManager))
        .rejects
        .toThrow('ANTHROPIC_API_KEY environment variable is required');
    });

    test('tool handles missing dependencies gracefully', async () => {
      const { PictureAnalysisTool } = await import('../../src/index.js');
      
      // Should fail with clear error when LLM client is missing
      expect(() => new PictureAnalysisTool({}))
        .toThrow('LLM client is required for PictureAnalysisTool');
    });
  });

  describe('Performance and Resource Management', () => {
    test('package can handle multiple concurrent imports', async () => {
      // Test that multiple concurrent imports work correctly
      const importPromises = Array(5).fill().map(() => 
        import('../../src/index.js')
      );
      
      const results = await Promise.all(importPromises);
      
      // All imports should succeed and return the same exports
      results.forEach(moduleExports => {
        expect(moduleExports.PictureAnalysisModule).toBeDefined();
        expect(moduleExports.PictureAnalysisTool).toBeDefined();
      });
      
      // All should reference the same constructors (ES module singleton)
      expect(results[0].PictureAnalysisModule).toBe(results[1].PictureAnalysisModule);
      expect(results[0].PictureAnalysisTool).toBe(results[1].PictureAnalysisTool);
    });

    test('modules can be created and cleaned up properly', async () => {
      const { PictureAnalysisModule } = await import('../../src/index.js');
      
      const resourceManager = {
        _data: new Map(),
        get: function(key) {
          if (key === 'env.ANTHROPIC_API_KEY') return 'test';
          return this._data.get(key);
        },
        set: function(key, value) {
          this._data.set(key, value);
        }
      };
      
      // Create multiple modules
      const modules = await Promise.all([
        PictureAnalysisModule.create(resourceManager),
        PictureAnalysisModule.create(resourceManager),
        PictureAnalysisModule.create(resourceManager)
      ]);
      
      expect(modules).toHaveLength(3);
      modules.forEach(module => {
        expect(module.name).toBe('picture-analysis');
      });
      
      // Clean up all modules
      await Promise.all(modules.map(module => module.cleanup()));
      
      // Should not throw errors
      expect(true).toBe(true);
    });
  });
});