import ConfigValidationService from '../../src/services/ConfigValidationService';

describe('ConfigValidationService', () => {
  let configValidationService;

  beforeEach(() => {
    configValidationService = new ConfigValidationService();
  });

  describe('validateConfig', () => {
    it('should return false for null or non-object configs', () => {
      expect(configValidationService.validateConfig(null)).toBe(false);
      expect(configValidationService.validateConfig('string')).toBe(false);
      expect(configValidationService.validateConfig(123)).toBe(false);
    });

    it('should return true for empty config when no rules are set', () => {
      expect(configValidationService.validateConfig({})).toBe(true);
    });

    it('should validate config according to rules', () => {
      // Add string validation rule
      configValidationService.addValidationRule('name', 
        (value) => typeof value === 'string' && value.length > 0
      );

      // Add number validation rule
      configValidationService.addValidationRule('age', 
        (value) => typeof value === 'number' && value > 0
      );

      const validConfig = { name: 'test', age: 25 };
      const invalidConfig = { name: '', age: -1 };

      expect(configValidationService.validateConfig(validConfig)).toBe(true);
      expect(configValidationService.validateConfig(invalidConfig)).toBe(false);
    });
  });

  describe('addValidationRule', () => {
    it('should successfully add new validation rules', () => {
      let validationCalled = false;
      const validationFn = () => { validationCalled = true; return true; };
      configValidationService.addValidationRule('testKey', validationFn);

      // Validate the rule was added by triggering validation
      configValidationService.validateConfig({ testKey: 'value' });
      expect(validationCalled).toBe(true);
    });

    it('should override existing validation rules', () => {
      let firstCalled = false;
      let secondCalled = false;
      const firstValidationFn = () => { firstCalled = true; return true; };
      const secondValidationFn = () => { secondCalled = true; return true; };

      configValidationService.addValidationRule('testKey', firstValidationFn);
      configValidationService.addValidationRule('testKey', secondValidationFn);

      configValidationService.validateConfig({ testKey: 'value' });
      
      expect(firstCalled).toBe(false);
      expect(secondCalled).toBe(true);
    });
  });
});
