import { jest } from '@jest/globals';
import CLI from '../src/index.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

describe('Module Loader', () => {
  let cli;

  beforeEach(() => {
    cli = new CLI();
  });

  describe('loadModules method', () => {
    it('should discover modules from @jsenvoy/modules', async () => {
      await cli.loadModules();
      
      expect(cli.modules).toBeDefined();
      expect(cli.modules).toBeInstanceOf(Map);
      expect(cli.modules.size).toBeGreaterThan(0);
    });

    it('should load CalculatorModule', async () => {
      await cli.loadModules();
      
      expect(cli.modules.has('calculator')).toBe(true);
      const calculatorModule = cli.modules.get('calculator');
      expect(calculatorModule).toBeDefined();
      expect(calculatorModule.name).toBe('calculator');
    });

    it('should load FileModule', async () => {
      await cli.loadModules();
      
      expect(cli.modules.has('file')).toBe(true);
      const fileModule = cli.modules.get('file');
      expect(fileModule).toBeDefined();
      expect(fileModule.name).toBe('file');
    });

    it('should extract tools from each module', async () => {
      await cli.loadModules();
      
      const calculatorModule = cli.modules.get('calculator');
      expect(calculatorModule.tools).toBeDefined();
      expect(Array.isArray(calculatorModule.tools)).toBe(true);
      expect(calculatorModule.tools.length).toBeGreaterThan(0);
    });

    it('should create a tools map for quick lookup', async () => {
      await cli.loadModules();
      
      expect(cli.tools).toBeDefined();
      expect(cli.tools).toBeInstanceOf(Map);
      expect(cli.tools.size).toBeGreaterThan(0);
    });

    it('should map tools with module.tool key format', async () => {
      await cli.loadModules();
      
      expect(cli.tools.has('calculator.calculator_evaluate')).toBe(true);
      const tool = cli.tools.get('calculator.calculator_evaluate');
      expect(tool).toBeDefined();
      expect(tool.name).toBe('calculator_evaluate');
    });

    it('should store module class references', async () => {
      await cli.loadModules();
      
      expect(cli.moduleClasses).toBeDefined();
      expect(cli.moduleClasses).toBeInstanceOf(Map);
      expect(cli.moduleClasses.size).toBeGreaterThan(0);
    });

    it('should handle modules that require dependencies', async () => {
      await cli.loadModules();
      
      const fileModuleClass = cli.moduleClasses.get('file');
      expect(fileModuleClass).toBeDefined();
      expect(fileModuleClass.dependencies).toBeDefined();
      expect(Array.isArray(fileModuleClass.dependencies)).toBe(true);
    });
  });

  describe('getModulePath method', () => {
    it('should resolve the correct path to @jsenvoy/tools modules', () => {
      const modulesPath = cli.getModulePath();
      
      expect(modulesPath).toBeDefined();
      expect(modulesPath).toContain('tools');
      expect(modulesPath).toContain('modules');
    });
  });

  describe('discoverModules method', () => {
    it('should find all module files ending with Module.js', async () => {
      const moduleFiles = await cli.discoverModules();
      
      expect(Array.isArray(moduleFiles)).toBe(true);
      expect(moduleFiles.length).toBeGreaterThan(0);
      expect(moduleFiles.every(file => file.endsWith('Module.js'))).toBe(true);
    });
  });
});