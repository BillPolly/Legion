import { StructuredIntentParser } from '../parser/StructuredIntentParser';
import { DefaultStructuredIntentParser } from '../parser/DefaultStructuredIntentParser';
import { LLMCLIConfig, CommandRegistry } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { Intent } from '../types';

describe('StructuredIntentParser', () => {
  let parser: StructuredIntentParser;
  let config: LLMCLIConfig;
  let session: SessionState;

  beforeEach(() => {
    parser = new DefaultStructuredIntentParser();
    
    config = {
      llmProvider: {} as any,
      commands: {
        search: {
          handler: async () => ({ success: true }),
          description: 'Search for documents',
          parameters: [{
            name: 'query',
            type: 'string',
            required: true,
            description: 'Search query'
          }, {
            name: 'limit',
            type: 'number',
            required: false,
            default: 10,
            description: 'Result limit'
          }]
        },
        filter: {
          handler: async () => ({ success: true }),
          description: 'Filter results',
          parameters: [{
            name: 'type',
            type: 'enum',
            required: true,
            enum: ['document', 'image', 'video'],
            description: 'Filter type'
          }]
        }
      } as CommandRegistry
    };

    session = {
      sessionId: 'test',
      state: new Map(),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };
  });

  describe('generateJsonSchema', () => {
    it('should generate schema for simple command', () => {
      const schema = parser.generateJsonSchema(config.commands.search);
      
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('command');
      expect(schema.properties).toHaveProperty('parameters');
      expect(schema.properties).toHaveProperty('confidence');
      expect(schema.required).toContain('command');
      expect(schema.required).toContain('parameters');
      expect(schema.required).toContain('confidence');
    });

    it('should include parameter schema', () => {
      const schema = parser.generateJsonSchema(config.commands.search);
      
      const paramSchema = schema.properties.parameters as any;
      expect(paramSchema.type).toBe('object');
      expect(paramSchema.properties).toHaveProperty('query');
      expect(paramSchema.properties).toHaveProperty('limit');
      expect(paramSchema.required).toContain('query');
      expect(paramSchema.required).not.toContain('limit');
    });

    it('should handle enum parameters', () => {
      const schema = parser.generateJsonSchema(config.commands.filter);
      
      const paramSchema = schema.properties.parameters as any;
      const typeSchema = paramSchema.properties.type;
      expect(typeSchema.type).toBe('string');
      expect(typeSchema.enum).toEqual(['document', 'image', 'video']);
    });

    it('should handle commands without parameters', () => {
      const command = {
        handler: async () => ({ success: true }),
        description: 'Simple command'
      };
      
      const schema = parser.generateJsonSchema(command);
      const paramSchema = schema.properties.parameters as any;
      expect(paramSchema.type).toBe('object');
      expect(paramSchema.properties).toEqual({});
    });
  });

  describe('buildStructuredPrompt', () => {
    it('should build prompt with schema information', () => {
      const prompt = parser.buildStructuredPrompt('search for AI papers', config, session);
      
      expect(prompt).toContain('search for AI papers');
      expect(prompt).toContain('RESPONSE SCHEMA');
      expect(prompt).toContain('command');
      expect(prompt).toContain('parameters');
      expect(prompt).toContain('confidence');
    });

    it('should include available commands', () => {
      const prompt = parser.buildStructuredPrompt('find documents', config, session);
      
      expect(prompt).toContain('search');
      expect(prompt).toContain('filter');
      expect(prompt).toContain('Search for documents');
      expect(prompt).toContain('Filter results');
    });

    it('should include examples', () => {
      const prompt = parser.buildStructuredPrompt('search test', config, session);
      
      expect(prompt).toContain('Example response');
      expect(prompt).toContain('"command": "search"');
      expect(prompt).toContain('"parameters"');
      expect(prompt).toContain('"confidence"');
    });
  });

  describe('parseStructuredResponse', () => {
    it('should parse valid structured response', () => {
      const response = {
        command: 'search',
        parameters: { query: 'AI papers', limit: 5 },
        confidence: 0.9,
        reasoning: 'User wants to search for AI papers'
      };

      const intent = parser.parseStructuredResponse(response, 'search for AI papers');
      
      expect(intent.command).toBe('search');
      expect(intent.parameters.query).toBe('AI papers');
      expect(intent.parameters.limit).toBe(5);
      expect(intent.confidence).toBe(0.9);
      expect(intent.rawQuery).toBe('search for AI papers');
      expect(intent.reasoning).toBe('User wants to search for AI papers');
    });

    it('should handle missing optional fields', () => {
      const response = {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.8
      };

      const intent = parser.parseStructuredResponse(response, 'test query');
      
      expect(intent.command).toBe('search');
      expect(intent.parameters.query).toBe('test');
      expect(intent.confidence).toBe(0.8);
      expect(intent.reasoning).toBeUndefined();
    });

    it('should validate confidence range', () => {
      const response = {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 1.5 // Invalid - too high
      };

      const intent = parser.parseStructuredResponse(response, 'test');
      
      expect(intent.confidence).toBe(1.0); // Clamped to max
    });

    it('should handle malformed response', () => {
      const response = {
        // Missing required fields
        confidence: 0.5
      };

      const intent = parser.parseStructuredResponse(response, 'test');
      
      expect(intent.command).toBe('unknown');
      expect(intent.parameters).toEqual({});
      expect(intent.confidence).toBeLessThan(0.5);
    });

    it('should handle alternatives', () => {
      const response = {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.7,
        alternatives: [
          {
            command: 'filter',
            parameters: { type: 'document' },
            confidence: 0.5
          }
        ]
      };

      const intent = parser.parseStructuredResponse(response, 'test');
      
      expect(intent.alternatives).toHaveLength(1);
      expect(intent.alternatives![0].command).toBe('filter');
      expect(intent.alternatives![0].confidence).toBe(0.5);
    });
  });

  describe('validateSchema', () => {
    it('should validate correct schema structure', () => {
      const schema = {
        type: 'object',
        properties: {
          command: { type: 'string' },
          parameters: { type: 'object' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['command', 'parameters', 'confidence']
      };

      const result = parser.validateSchema(schema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required properties', () => {
      const schema = {
        type: 'object',
        properties: {
          command: { type: 'string' }
          // Missing parameters and confidence
        },
        required: ['command']
      };

      const result = parser.validateSchema(schema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Schema must include parameters property');
      expect(result.errors).toContain('Schema must include confidence property');
    });

    it('should validate parameter schema', () => {
      const schema = {
        type: 'object',
        properties: {
          command: { type: 'string' },
          parameters: { type: 'string' }, // Should be object
          confidence: { type: 'number' }
        },
        required: ['command', 'parameters', 'confidence']
      };

      const result = parser.validateSchema(schema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Parameters property must be of type object');
    });
  });

  describe('getFallbackPrompt', () => {
    it('should create fallback prompt for non-structured providers', () => {
      const prompt = parser.getFallbackPrompt('search for data', config, session);
      
      expect(prompt).toContain('search for data');
      expect(prompt).toContain('JSON format');
      expect(prompt).toContain('command');
      expect(prompt).toContain('parameters');
      expect(prompt).toContain('confidence');
    });

    it('should include structured format example', () => {
      const prompt = parser.getFallbackPrompt('test', config, session);
      
      expect(prompt).toContain('{"command":');
      expect(prompt).toContain('"parameters":');
      expect(prompt).toContain('"confidence":');
    });
  });

  describe('extractJsonFromText', () => {
    it('should extract valid JSON from text', () => {
      const text = 'Here is the result: {"command": "search", "parameters": {"query": "test"}, "confidence": 0.8}';
      
      const json = parser.extractJsonFromText(text);
      
      expect(json).toEqual({
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.8
      });
    });

    it('should handle text without JSON', () => {
      const text = 'This is just plain text without any JSON';
      
      const json = parser.extractJsonFromText(text);
      
      expect(json).toBeNull();
    });

    it('should extract first valid JSON object', () => {
      const text = 'Invalid: {broken json} Valid: {"command": "test", "parameters": {}, "confidence": 0.5} More text';
      
      const json = parser.extractJsonFromText(text);
      
      expect(json).toEqual({
        command: 'test',
        parameters: {},
        confidence: 0.5
      });
    });

    it('should handle nested objects', () => {
      const text = '{"command": "search", "parameters": {"query": "test", "options": {"limit": 10}}, "confidence": 0.9}';
      
      const json = parser.extractJsonFromText(text);
      
      expect(json).not.toBeNull();
      expect(json!.parameters.options.limit).toBe(10);
    });
  });
});