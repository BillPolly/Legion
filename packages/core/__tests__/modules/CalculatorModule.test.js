const CalculatorModule = require('../../src/modules/CalculatorModule');
const CalculatorEvaluateTool = require('../../src/tools/calculator/CalculatorEvaluateTool');
const { OpenAIModule } = require('../../src/core');

describe('CalculatorModule', () => {
  let module;

  beforeEach(() => {
    module = new CalculatorModule({});
  });

  describe('static properties', () => {
    it('should have empty dependencies array', () => {
      expect(CalculatorModule.dependencies).toEqual([]);
    });
  });

  describe('constructor', () => {
    it('should extend OpenAIModule', () => {
      expect(module).toBeInstanceOf(OpenAIModule);
    });

    it('should set module name', () => {
      expect(module.name).toBe('calculator');
    });

    it('should create calculator tool', () => {
      expect(module.tools).toHaveLength(1);
      expect(module.tools[0]).toBeInstanceOf(CalculatorEvaluateTool);
    });

    it('should accept empty dependency object', () => {
      const moduleWithEmpty = new CalculatorModule({});
      expect(moduleWithEmpty.name).toBe('calculator');
      expect(moduleWithEmpty.tools).toHaveLength(1);
    });

    it('should ignore any passed dependencies', () => {
      // Even if dependencies are passed, calculator doesn't need them
      const moduleWithDeps = new CalculatorModule({
        someKey: 'someValue',
        anotherKey: 123
      });
      expect(moduleWithDeps.name).toBe('calculator');
      expect(moduleWithDeps.tools).toHaveLength(1);
    });
  });

  describe('getTools()', () => {
    it('should return array with calculator tool', () => {
      const tools = module.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0]).toBeInstanceOf(CalculatorEvaluateTool);
      expect(tools[0].name).toBe('calculator_evaluate');
    });

    it('should return the same tools array reference', () => {
      const tools1 = module.getTools();
      const tools2 = module.getTools();
      expect(tools1).toBe(tools2);
    });
  });

  describe('tool functionality', () => {
    it('should have working calculator tool', async () => {
      const tool = module.tools[0];
      const result = await tool.execute({ expression: '10 + 20' });
      expect(result).toEqual({ result: 30 });
    });

    it('should have correct tool description', () => {
      const tool = module.tools[0];
      const description = tool.getDescription();
      expect(description.function.name).toBe('calculator_evaluate');
      expect(description.function.description).toContain('mathematical expression');
    });
  });

  describe('multiple instances', () => {
    it('should create independent module instances', () => {
      const module1 = new CalculatorModule({});
      const module2 = new CalculatorModule({});
      
      expect(module1).not.toBe(module2);
      expect(module1.tools[0]).not.toBe(module2.tools[0]);
    });

    it('should not share state between instances', () => {
      const module1 = new CalculatorModule({});
      const module2 = new CalculatorModule({});
      
      // Modify one module
      module1.customProperty = 'test';
      
      // Other module should not be affected
      expect(module2.customProperty).toBeUndefined();
    });
  });
});