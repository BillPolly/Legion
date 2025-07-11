import { jest } from '@jest/globals';
import CLI from '../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Configuration System', () => {
  let cli;
  let originalEnv;
  let tempDir;

  beforeAll(async () => {
    // Create temp directory for test config files
    tempDir = path.join(os.tmpdir(), 'jsenvoy-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    cli = new CLI();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
  });

  describe('loadConfiguration method', () => {
    it('should load default configuration', async () => {
      await cli.loadConfiguration();
      
      expect(cli.config).toBeDefined();
      expect(cli.config.verbose).toBe(false);
      expect(cli.config.output).toBe('text');
      expect(cli.config.color).toBe(true);
    });

    it('should load configuration from jsenvoy.json in current directory', async () => {
      const configPath = path.join(tempDir, 'jsenvoy.json');
      const config = {
        verbose: true,
        output: 'json',
        color: false
      };
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      
      cli.configSearchPath = tempDir;
      await cli.loadConfiguration();
      
      expect(cli.config.verbose).toBe(true);
      expect(cli.config.output).toBe('json');
      expect(cli.config.color).toBe(false);
    });

    it('should load configuration from .jsenvoyrc', async () => {
      const configPath = path.join(tempDir, '.jsenvoyrc');
      const config = {
        verbose: true,
        modules: {
          file: {
            basePath: '/custom/path'
          }
        }
      };
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      
      cli.configSearchPath = tempDir;
      await cli.loadConfiguration();
      
      expect(cli.config.verbose).toBe(true);
      expect(cli.config.modules.file.basePath).toBe('/custom/path');
    });

    it('should load configuration from home directory', async () => {
      const homeConfig = path.join(tempDir, '.jsenvoyrc');
      const config = {
        defaultModule: 'calculator'
      };
      
      await fs.writeFile(homeConfig, JSON.stringify(config, null, 2));
      
      // Mock home directory
      cli.getHomeConfigPath = () => homeConfig;
      await cli.loadConfiguration();
      
      expect(cli.config.defaultModule).toBe('calculator');
    });

    it('should load configuration from environment variables', async () => {
      process.env.JSENVOY_VERBOSE = 'true';
      process.env.JSENVOY_OUTPUT = 'json';
      process.env.JSENVOY_COLOR = 'false';
      
      await cli.loadConfiguration();
      
      expect(cli.config.verbose).toBe(true);
      expect(cli.config.output).toBe('json');
      expect(cli.config.color).toBe(false);
    });

    it('should prioritize configurations correctly', async () => {
      // Set up multiple config sources
      const localConfig = path.join(tempDir, 'jsenvoy.json');
      await fs.writeFile(localConfig, JSON.stringify({
        verbose: true,
        output: 'json'
      }));
      
      process.env.JSENVOY_OUTPUT = 'text';
      
      cli.configSearchPath = tempDir;
      await cli.loadConfiguration();
      
      // Environment variable should override file config
      expect(cli.config.verbose).toBe(true); // from file
      expect(cli.config.output).toBe('text'); // from env
    });

    it('should merge configurations deeply', async () => {
      const config1 = {
        modules: {
          file: {
            basePath: '/tmp'
          }
        }
      };
      
      const config2 = {
        modules: {
          file: {
            encoding: 'utf8'
          },
          calculator: {
            precision: 2
          }
        }
      };
      
      await fs.writeFile(path.join(tempDir, '.jsenvoyrc'), JSON.stringify(config1));
      await fs.writeFile(path.join(tempDir, 'jsenvoy.json'), JSON.stringify(config2));
      
      cli.configSearchPath = tempDir;
      await cli.loadConfiguration();
      
      expect(cli.config.modules.file.basePath).toBe('/tmp');
      expect(cli.config.modules.file.encoding).toBe('utf8');
      expect(cli.config.modules.calculator.precision).toBe(2);
    });

    it('should handle invalid JSON gracefully', async () => {
      const configPath = path.join(tempDir, 'jsenvoy.json');
      await fs.writeFile(configPath, 'invalid json');
      
      cli.configSearchPath = tempDir;
      
      // Should not throw, just use defaults
      await cli.loadConfiguration();
      expect(cli.config.verbose).toBe(false);
    });

    it('should override config with command line options', async () => {
      const configPath = path.join(tempDir, 'jsenvoy.json');
      await fs.writeFile(configPath, JSON.stringify({
        verbose: false,
        output: 'json'
      }));
      
      cli.configSearchPath = tempDir;
      cli.options = {
        verbose: true,
        output: 'text'
      };
      
      await cli.loadConfiguration();
      
      // Command line options should take precedence
      expect(cli.config.verbose).toBe(true);
      expect(cli.config.output).toBe('text');
    });
  });

  describe('configuration file search', () => {
    it('should search for config files in correct order', async () => {
      const searchPaths = await cli.getConfigSearchPaths();
      
      expect(Array.isArray(searchPaths)).toBe(true);
      expect(searchPaths.length).toBeGreaterThan(0);
      
      // Should include current directory and home directory
      expect(searchPaths).toContain(process.cwd());
      expect(searchPaths.some(p => p.includes(os.homedir()))).toBe(true);
    });
  });

  describe('getModuleConfig method', () => {
    it('should return module-specific configuration', async () => {
      cli.config = {
        modules: {
          file: {
            basePath: '/custom/path',
            encoding: 'utf16'
          }
        }
      };
      
      const fileConfig = cli.getModuleConfig('file');
      
      expect(fileConfig.basePath).toBe('/custom/path');
      expect(fileConfig.encoding).toBe('utf16');
    });

    it('should return empty object for unconfigured modules', async () => {
      cli.config = { modules: {} };
      
      const config = cli.getModuleConfig('unknown');
      
      expect(config).toEqual({});
    });
  });
});