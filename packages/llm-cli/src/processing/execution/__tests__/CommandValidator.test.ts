import { CommandValidator } from '../validator/CommandValidator';
import { DefaultCommandValidator } from '../validator/DefaultCommandValidator';
import { CommandDefinition } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { Intent } from '../../../processing/intent/types';

describe('CommandValidator', () => {
  let validator: CommandValidator;
  let session: SessionState;

  beforeEach(() => {
    validator = new DefaultCommandValidator();
    session = {
      sessionId: 'test',
      state: new Map([['isAdmin', false]]),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };
  });

  describe('validateIntent', () => {
    it('should validate intent with all required parameters', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Search command',
        parameters: [{
          name: 'query',
          type: 'string',
          required: true,
          description: 'Search query'
        }]
      };

      const intent: Intent = {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.9,
        rawQuery: 'search test'
      };

      const result = validator.validateIntent(intent, command, session);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validatedParameters.query).toBe('test');
    });

    it('should detect missing required parameters', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Search command',
        parameters: [{
          name: 'query',
          type: 'string',
          required: true,
          description: 'Search query'
        }]
      };

      const intent: Intent = {
        command: 'search',
        parameters: {},
        confidence: 0.9,
        rawQuery: 'search'
      };

      const result = validator.validateIntent(intent, command, session);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: query');
    });

    it('should apply default values for optional parameters', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Search command',
        parameters: [
          {
            name: 'query',
            type: 'string',
            required: true,
            description: 'Search query'
          },
          {
            name: 'limit',
            type: 'number',
            required: false,
            default: 10,
            description: 'Result limit'
          }
        ]
      };

      const intent: Intent = {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.9,
        rawQuery: 'search test'
      };

      const result = validator.validateIntent(intent, command, session);
      
      expect(result.isValid).toBe(true);
      expect(result.validatedParameters.query).toBe('test');
      expect(result.validatedParameters.limit).toBe(10);
    });

    it('should validate parameter types', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Search command',
        parameters: [{
          name: 'limit',
          type: 'number',
          required: true,
          description: 'Result limit'
        }]
      };

      const intent: Intent = {
        command: 'search',
        parameters: { limit: 'not a number' },
        confidence: 0.9,
        rawQuery: 'search'
      };

      const result = validator.validateIntent(intent, command, session);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Parameter limit must be of type number');
    });

    it('should validate enum parameters', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Filter command',
        parameters: [{
          name: 'type',
          type: 'enum',
          required: true,
          enum: ['document', 'image', 'video'],
          description: 'Filter type'
        }]
      };

      const intent: Intent = {
        command: 'filter',
        parameters: { type: 'audio' },
        confidence: 0.9,
        rawQuery: 'filter audio'
      };

      const result = validator.validateIntent(intent, command, session);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Parameter type must be one of: document, image, video');
    });

    it('should run custom validators', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Search command',
        parameters: [{
          name: 'query',
          type: 'string',
          required: true,
          description: 'Search query',
          validator: (value) => value.length >= 3,
          validationError: 'Query must be at least 3 characters'
        }]
      };

      const intent: Intent = {
        command: 'search',
        parameters: { query: 'ab' },
        confidence: 0.9,
        rawQuery: 'search ab'
      };

      const result = validator.validateIntent(intent, command, session);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Query must be at least 3 characters');
    });

    it('should validate array parameters', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Multi-search command',
        parameters: [{
          name: 'queries',
          type: 'array',
          required: true,
          description: 'Multiple queries',
          items: { type: 'string' }
        }]
      };

      const intent: Intent = {
        command: 'multisearch',
        parameters: { queries: ['query1', 'query2'] },
        confidence: 0.9,
        rawQuery: 'search multiple'
      };

      const result = validator.validateIntent(intent, command, session);
      
      expect(result.isValid).toBe(true);
      expect(result.validatedParameters.queries).toEqual(['query1', 'query2']);
    });

    it('should validate object parameters', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Config command',
        parameters: [{
          name: 'settings',
          type: 'object',
          required: true,
          description: 'Configuration settings'
        }]
      };

      const intent: Intent = {
        command: 'config',
        parameters: { settings: { theme: 'dark', autoSave: true } },
        confidence: 0.9,
        rawQuery: 'configure settings'
      };

      const result = validator.validateIntent(intent, command, session);
      
      expect(result.isValid).toBe(true);
      expect(result.validatedParameters.settings).toEqual({ theme: 'dark', autoSave: true });
    });
  });

  describe('checkRequirements', () => {
    it('should pass when no requirements defined', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Simple command'
      };

      const result = validator.checkRequirements(command, session);
      
      expect(result.canExecute).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should check required state keys', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Admin command',
        requirements: {
          requiredState: ['isAdmin'],
          errorMessage: 'Admin access required'
        }
      };

      const result = validator.checkRequirements(command, session);
      
      expect(result.canExecute).toBe(false);
      expect(result.errors).toContain('Admin access required');
    });

    it('should pass when required state keys exist', () => {
      session.state.set('isAdmin', true);
      
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Admin command',
        requirements: {
          requiredState: ['isAdmin']
        }
      };

      const result = validator.checkRequirements(command, session);
      
      expect(result.canExecute).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should run custom requirement checker', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Time-based command',
        requirements: {
          customChecker: (session) => {
            const hour = new Date().getHours();
            return hour >= 9 && hour <= 17; // Business hours only
          },
          errorMessage: 'Command only available during business hours (9 AM - 5 PM)'
        }
      };

      // Mock current time to be outside business hours
      const mockDate = new Date();
      mockDate.setHours(20); // 8 PM
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const result = validator.checkRequirements(command, session);
      
      expect(result.canExecute).toBe(false);
      expect(result.errors).toContain('Command only available during business hours (9 AM - 5 PM)');

      jest.restoreAllMocks();
    });

    it('should combine multiple requirement checks', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Complex command',
        requirements: {
          requiredState: ['isAdmin', 'hasPermission'],
          customChecker: () => false,
          errorMessage: 'Multiple requirements failed'
        }
      };

      const result = validator.checkRequirements(command, session);
      
      expect(result.canExecute).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('coerceParameterType', () => {
    it('should coerce string to number', () => {
      const coerced = validator.coerceParameterType('42', 'number');
      expect(coerced).toBe(42);
    });

    it('should coerce string to boolean', () => {
      expect(validator.coerceParameterType('true', 'boolean')).toBe(true);
      expect(validator.coerceParameterType('false', 'boolean')).toBe(false);
      expect(validator.coerceParameterType('yes', 'boolean')).toBe(true);
      expect(validator.coerceParameterType('no', 'boolean')).toBe(false);
    });

    it('should handle array coercion', () => {
      const result = validator.coerceParameterType('item1,item2,item3', 'array');
      expect(result).toEqual(['item1', 'item2', 'item3']);
    });

    it('should handle object coercion from JSON string', () => {
      const jsonString = '{"key": "value", "number": 42}';
      const result = validator.coerceParameterType(jsonString, 'object');
      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('should return original value for string type', () => {
      const result = validator.coerceParameterType('test', 'string');
      expect(result).toBe('test');
    });

    it('should return original value if coercion fails', () => {
      const result = validator.coerceParameterType('invalid', 'number');
      expect(result).toBe('invalid');
    });
  });

  describe('validateParameterType', () => {
    it('should validate string type', () => {
      expect(validator.validateParameterType('hello', 'string')).toBe(true);
      expect(validator.validateParameterType(123, 'string')).toBe(false);
    });

    it('should validate number type', () => {
      expect(validator.validateParameterType(42, 'number')).toBe(true);
      expect(validator.validateParameterType('42', 'number')).toBe(false);
      expect(validator.validateParameterType(NaN, 'number')).toBe(false);
    });

    it('should validate boolean type', () => {
      expect(validator.validateParameterType(true, 'boolean')).toBe(true);
      expect(validator.validateParameterType(false, 'boolean')).toBe(true);
      expect(validator.validateParameterType('true', 'boolean')).toBe(false);
    });

    it('should validate array type', () => {
      expect(validator.validateParameterType([], 'array')).toBe(true);
      expect(validator.validateParameterType([1, 2, 3], 'array')).toBe(true);
      expect(validator.validateParameterType('not array', 'array')).toBe(false);
    });

    it('should validate object type', () => {
      expect(validator.validateParameterType({}, 'object')).toBe(true);
      expect(validator.validateParameterType({ key: 'value' }, 'object')).toBe(true);
      expect(validator.validateParameterType([], 'object')).toBe(false);
      expect(validator.validateParameterType(null, 'object')).toBe(false);
    });

    it('should validate enum type', () => {
      expect(validator.validateParameterType('value', 'enum')).toBe(true);
    });
  });
});