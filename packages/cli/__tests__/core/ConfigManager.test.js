import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConfigManager } from '../../src/core/ConfigManager.js';

describe('ConfigManager', () => {
  let configManager;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  describe('applyPreset', () => {
    beforeEach(() => {
      configManager.config = {
        presets: {
          debug: {
            verbose: true,
            output: 'json'
          },
          production: {
            verbose: false,
            color: false
          }
        }
      };
    });

    it('should apply preset configuration to empty options', () => {
      const options = { verbose: false }; // Default false value
      configManager.applyPreset('debug', options);
      
      expect(options.verbose).toBe(true);
      expect(options.output).toBe('json');
    });

    it('should apply preset output when not set', () => {
      const options = {};
      configManager.applyPreset('debug', options);
      
      expect(options.output).toBe('json');
    });

    it('should throw error for unknown preset', () => {
      const options = {};
      
      expect(() => configManager.applyPreset('unknown', options)).toThrow('Unknown preset: unknown');
    });

    it('should apply preset resources', () => {
      configManager.config.presets.debug.resources = {
        apiKey: 'debug-key'
      };
      
      const options = {};
      configManager.applyPreset('debug', options);
      
      expect(configManager.config.resources).toEqual({
        apiKey: 'debug-key'
      });
    });
  });

  describe('getModuleConfig', () => {
    it('should return module-specific config', () => {
      configManager.config = {
        modules: {
          calculator: {
            precision: 10,
            mode: 'scientific'
          }
        }
      };
      
      const moduleConfig = configManager.getModuleConfig('calculator');
      
      expect(moduleConfig).toEqual({
        precision: 10,
        mode: 'scientific'
      });
    });

    it('should return empty object for unknown module', () => {
      configManager.config = {};
      
      const moduleConfig = configManager.getModuleConfig('unknown');
      
      expect(moduleConfig).toEqual({});
    });
  });

  describe('getConfig', () => {
    it('should return the full configuration', () => {
      const config = { verbose: true, output: 'json' };
      configManager.config = config;
      
      expect(configManager.getConfig()).toEqual(config);
    });
  });

  describe('setSearchPath', () => {
    it('should set the config search path', () => {
      configManager.setSearchPath('/custom/path');
      
      expect(configManager.configSearchPath).toBe('/custom/path');
    });
  });

});