import { jest } from '@jest/globals';
import CLI from '../src/index.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { ResourceManager } from '@jsenvoy/modules';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ResourceManager Integration', () => {
  let cli;
  let tempDir;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), 'jsenvoy-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    cli = new CLI();
  });

  describe('initializeResourceManager', () => {
    it('should create a ResourceManager instance', async () => {
      await cli.initializeResourceManager();
      
      expect(cli.resourceManager).toBeDefined();
      expect(cli.resourceManager).toBeInstanceOf(ResourceManager);
    });

    it('should register default resources', async () => {
      await cli.initializeResourceManager();
      
      // Check for common default resources
      expect(cli.resourceManager.has('basePath')).toBe(true);
      expect(cli.resourceManager.has('encoding')).toBe(true);
      expect(cli.resourceManager.has('createDirectories')).toBe(true);
      expect(cli.resourceManager.has('permissions')).toBe(true);
    });

    it('should use configuration values for resources', async () => {
      cli.config = {
        resources: {
          basePath: '/custom/path',
          encoding: 'utf16'
        }
      };
      
      await cli.initializeResourceManager();
      
      expect(cli.resourceManager.get('basePath')).toBe('/custom/path');
      expect(cli.resourceManager.get('encoding')).toBe('utf16');
    });

    it('should use module-specific configuration', async () => {
      cli.config = {
        modules: {
          file: {
            basePath: '/file/specific/path',
            encoding: 'ascii'
          }
        }
      };
      
      await cli.initializeResourceManager();
      
      // Module-specific configs should be registered with module prefix
      expect(cli.resourceManager.has('file.basePath')).toBe(true);
      expect(cli.resourceManager.get('file.basePath')).toBe('/file/specific/path');
      expect(cli.resourceManager.has('file.encoding')).toBe(true);
      expect(cli.resourceManager.get('file.encoding')).toBe('ascii');
    });

    it('should register custom resources from config', async () => {
      cli.config = {
        resources: {
          apiKey: 'test-key-123',
          apiEndpoint: 'https://api.example.com'
        }
      };
      
      await cli.initializeResourceManager();
      
      expect(cli.resourceManager.get('apiKey')).toBe('test-key-123');
      expect(cli.resourceManager.get('apiEndpoint')).toBe('https://api.example.com');
    });

    it('should handle environment variable resources', async () => {
      process.env.JSENVOY_API_KEY = 'env-key-456';
      
      cli.config = {
        resources: {
          apiKey: { env: 'JSENVOY_API_KEY' }
        }
      };
      
      await cli.initializeResourceManager();
      
      expect(cli.resourceManager.get('apiKey')).toBe('env-key-456');
      
      delete process.env.JSENVOY_API_KEY;
    });

    it('should provide default value when env var is missing', async () => {
      cli.config = {
        resources: {
          apiKey: { 
            env: 'JSENVOY_MISSING_VAR',
            default: 'default-key'
          }
        }
      };
      
      await cli.initializeResourceManager();
      
      expect(cli.resourceManager.get('apiKey')).toBe('default-key');
    });
  });

  describe('resource registration helpers', () => {
    it('should have registerDefaultResources method', async () => {
      expect(typeof cli.registerDefaultResources).toBe('function');
    });

    it('should have registerConfigResources method', async () => {
      expect(typeof cli.registerConfigResources).toBe('function');
    });

    it('should have registerModuleResources method', async () => {
      expect(typeof cli.registerModuleResources).toBe('function');
    });
  });

  describe('integration with run method', () => {
    it('should initialize ResourceManager during run', async () => {
      // Mock methods to prevent actual execution
      jest.spyOn(cli, 'parseArgs').mockImplementation(() => {
        cli.command = 'help';
      });
      jest.spyOn(cli, 'loadConfiguration').mockResolvedValue();
      jest.spyOn(cli, 'loadModules').mockResolvedValue();
      jest.spyOn(cli, 'executeCommand').mockResolvedValue();
      
      const initSpy = jest.spyOn(cli, 'initializeResourceManager');
      
      await cli.run(['node', 'jsenvoy', 'help']);
      
      expect(initSpy).toHaveBeenCalled();
      expect(cli.resourceManager).toBeDefined();
    });
  });
});