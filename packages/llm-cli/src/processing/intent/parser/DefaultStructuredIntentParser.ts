import { StructuredIntentParser, JsonSchema, SchemaValidationResult } from './StructuredIntentParser';
import { Intent, StructuredIntentResponse } from '../types';
import { LLMCLIConfig, CommandDefinition, CommandParameter } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { DefaultCommandFormatter } from '../../../prompt/formatter/DefaultCommandFormatter';

export class DefaultStructuredIntentParser implements StructuredIntentParser {
  private commandFormatter = new DefaultCommandFormatter();

  generateJsonSchema(command?: CommandDefinition): JsonSchema {
    const parameterSchema = this.generateParameterSchema(command);
    
    return {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The matched command name or "unknown" if no match'
        },
        parameters: parameterSchema,
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence score from 0 to 1'
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation of the decision'
        },
        alternatives: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              command: { type: 'string' },
              parameters: { type: 'object' },
              confidence: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['command', 'parameters', 'confidence']
          },
          description: 'Alternative interpretations'
        }
      },
      required: ['command', 'parameters', 'confidence']
    };
  }

  buildStructuredPrompt(input: string, config: LLMCLIConfig, session: SessionState): string {
    const parts: string[] = [];
    
    // System instructions
    parts.push('You are an intent recognition system. Analyze user input and return structured JSON.');
    parts.push('');
    
    // Available commands
    parts.push('AVAILABLE COMMANDS:');
    const commandsText = this.commandFormatter.formatRegistry(config.commands, session);
    parts.push(commandsText);
    parts.push('');
    
    // JSON schema
    parts.push('RESPONSE SCHEMA:');
    const schema = this.generateJsonSchema();
    parts.push('Return a JSON object matching this schema:');
    parts.push(JSON.stringify(schema, null, 2));
    parts.push('');
    
    // Example
    parts.push('Example response:');
    parts.push(JSON.stringify({
      command: 'search',
      parameters: { query: 'AI papers', limit: 10 },
      confidence: 0.9,
      reasoning: 'User wants to search for AI papers with default limit'
    }, null, 2));
    parts.push('');
    
    // User input
    parts.push(`USER INPUT: ${input}`);
    
    return parts.join('\n');
  }

  parseStructuredResponse(response: any, rawQuery: string): Intent {
    try {
      // Validate required fields
      if (!response || typeof response !== 'object') {
        return this.createUnknownIntent(rawQuery);
      }
      
      const command = response.command || 'unknown';
      const parameters = response.parameters || {};
      const confidence = this.clampConfidence(response.confidence);
      
      // If missing required fields, reduce confidence
      if (!response.command || response.parameters === undefined) {
        return {
          command: 'unknown',
          parameters: {},
          confidence: Math.min(0.3, confidence),
          rawQuery
        };
      }
      
      const intent: Intent = {
        command,
        parameters,
        confidence,
        rawQuery,
        reasoning: response.reasoning
      };
      
      // Parse alternatives if provided
      if (response.alternatives && Array.isArray(response.alternatives)) {
        intent.alternatives = response.alternatives.map((alt: any) => ({
          command: alt.command || 'unknown',
          parameters: alt.parameters || {},
          confidence: this.clampConfidence(alt.confidence),
          reasoning: alt.reasoning
        }));
      }
      
      return intent;
    } catch (error) {
      console.error('Error parsing structured response:', error);
      return this.createUnknownIntent(rawQuery);
    }
  }

  validateSchema(schema: JsonSchema): SchemaValidationResult {
    const errors: string[] = [];
    
    // Check basic structure
    if (schema.type !== 'object') {
      errors.push('Schema must be of type object');
    }
    
    if (!schema.properties) {
      errors.push('Schema must have properties');
      return { isValid: false, errors };
    }
    
    // Check required properties
    const requiredProps = ['command', 'parameters', 'confidence'];
    for (const prop of requiredProps) {
      if (!schema.properties[prop]) {
        errors.push(`Schema must include ${prop} property`);
      }
    }
    
    // Validate specific property types
    if (schema.properties.command && schema.properties.command.type !== 'string') {
      errors.push('Command property must be of type string');
    }
    
    if (schema.properties.parameters && schema.properties.parameters.type !== 'object') {
      errors.push('Parameters property must be of type object');
    }
    
    if (schema.properties.confidence) {
      const confProp = schema.properties.confidence;
      if (confProp.type !== 'number') {
        errors.push('Confidence property must be of type number');
      }
      if (confProp.minimum !== 0 || confProp.maximum !== 1) {
        errors.push('Confidence property must have range 0-1');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  getFallbackPrompt(input: string, config: LLMCLIConfig, session: SessionState): string {
    const parts: string[] = [];
    
    // System instructions
    parts.push('Analyze the user input and return JSON with command intent.');
    parts.push('');
    
    // Available commands
    parts.push('AVAILABLE COMMANDS:');
    const commandsText = this.commandFormatter.formatRegistry(config.commands, session);
    parts.push(commandsText);
    parts.push('');
    
    // Format requirements
    parts.push('Return response in JSON format with these fields:');
    parts.push('- command: matched command name or "unknown"');
    parts.push('- parameters: object with extracted parameters');
    parts.push('- confidence: number between 0 and 1');
    parts.push('- reasoning: brief explanation');
    parts.push('');
    
    // Example
    parts.push('Example: {"command": "search", "parameters": {"query": "test"}, "confidence": 0.8, "reasoning": "User wants to search"}');
    parts.push('');
    
    // User input
    parts.push(`USER INPUT: ${input}`);
    
    return parts.join('\n');
  }

  extractJsonFromText(text: string): any | null {
    try {
      // Simple approach: find balanced braces
      let braceCount = 0;
      let start = -1;
      
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
          if (braceCount === 0) {
            start = i;
          }
          braceCount++;
        } else if (text[i] === '}') {
          braceCount--;
          if (braceCount === 0 && start !== -1) {
            const jsonStr = text.substring(start, i + 1);
            try {
              const parsed = JSON.parse(jsonStr);
              // Validate it looks like an intent response
              if (parsed && typeof parsed === 'object' && 
                  ('command' in parsed || 'parameters' in parsed || 'confidence' in parsed)) {
                return parsed;
              }
            } catch (error) {
              // Continue searching
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting JSON from text:', error);
      return null;
    }
  }

  private generateParameterSchema(command?: CommandDefinition): JsonSchema {
    if (!command?.parameters) {
      return {
        type: 'object',
        properties: {},
        required: []
      };
    }
    
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    command.parameters.forEach(param => {
      properties[param.name] = this.getParameterSchema(param);
      
      if (param.required) {
        required.push(param.name);
      }
    });
    
    return {
      type: 'object',
      properties,
      required
    };
  }

  private getParameterSchema(param: CommandParameter): any {
    const schema: any = {
      description: param.description
    };
    
    switch (param.type) {
      case 'string':
        schema.type = 'string';
        if (param.pattern) {
          schema.pattern = param.pattern;
        }
        break;
      case 'number':
        schema.type = 'number';
        break;
      case 'boolean':
        schema.type = 'boolean';
        break;
      case 'array':
        schema.type = 'array';
        if (param.items) {
          schema.items = { type: param.items.type };
        }
        break;
      case 'object':
        schema.type = 'object';
        break;
      case 'enum':
        schema.type = 'string';
        if (param.enum) {
          schema.enum = param.enum;
        }
        break;
      default:
        schema.type = 'string';
    }
    
    if (!param.required && param.default !== undefined) {
      schema.default = param.default;
    }
    
    if (param.examples) {
      schema.examples = param.examples;
    }
    
    return schema;
  }

  private clampConfidence(confidence: any): number {
    if (typeof confidence !== 'number' || isNaN(confidence)) {
      return 0.1;
    }
    return Math.max(0, Math.min(1, confidence));
  }

  private createUnknownIntent(rawQuery: string): Intent {
    return {
      command: 'unknown',
      parameters: {},
      confidence: 0.1,
      rawQuery
    };
  }
}