/**
 * Unit tests for InstructionGenerator
 */

import { InstructionGenerator } from '../../src/InstructionGenerator.js';

describe('InstructionGenerator', () => {
  test('should generate JSON instructions', () => {
    const schema = {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task description' },
        score: { type: 'number', minimum: 0, maximum: 10 }
      },
      required: ['task']
    };
    
    const example = { task: 'Test task', score: 8.5 };
    const instructions = InstructionGenerator.generateInstructions(schema, example);
    
    expect(instructions).toContain('JSON');
    expect(instructions).toContain('task');
    expect(instructions).toContain('EXAMPLE OUTPUT');
    expect(instructions).toContain('Test task');
  });

  test('should generate XML instructions', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } }
    };
    
    const instructions = InstructionGenerator.generateInstructions(schema, {}, { format: 'xml' });
    expect(instructions).toContain('XML');
  });

  test('should include validation rules', () => {
    const schema = {
      type: 'object',
      properties: {
        score: { type: 'number', minimum: 0, maximum: 10 }
      },
      required: ['score']
    };
    
    const instructions = InstructionGenerator.generateInstructions(schema, {});
    expect(instructions).toContain('VALIDATION REQUIREMENTS');
    expect(instructions).toContain('Required fields');
  });
});