/**
 * Test the fixed instruction generator to verify proper format conversion
 */

import { InstructionGenerator } from '../../src/InstructionGenerator.js';

describe('Fixed InstructionGenerator', () => {
  const testSchema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      score: { type: 'number', minimum: 1, maximum: 10 },
      tags: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 3
      }
    },
    required: ['title']
  };

  const testData = {
    title: "Test Document",
    score: 8,
    tags: ["example", "test", "demo"]
  };

  test('should generate JSON instructions with JSON example', () => {
    const instructions = InstructionGenerator.generateInstructions(testSchema, testData, { format: 'json' });
    
    console.log('JSON Instructions:');
    console.log(instructions);
    
    expect(instructions).toContain('JSON');
    expect(instructions).toContain('EXAMPLE OUTPUT:');
    expect(instructions).toContain('"title": "Test Document"');
    expect(instructions).toContain('"score": 8');
    expect(instructions).toContain('"tags": [');
  });

  test('should generate XML instructions with XML example', () => {
    const instructions = InstructionGenerator.generateInstructions(testSchema, testData, { format: 'xml' });
    
    console.log('\nXML Instructions:');
    console.log(instructions);
    
    expect(instructions).toContain('XML');
    expect(instructions).toContain('<response>');
    expect(instructions).toContain('<title>Test Document</title>');
    expect(instructions).toContain('<score>8</score>');
    expect(instructions).toContain('<item>example</item>');
    expect(instructions).not.toContain('"title":'); // Should NOT contain JSON!
  });

  test('should generate delimited instructions with delimited example', () => {
    const instructions = InstructionGenerator.generateInstructions(testSchema, testData, { format: 'delimited' });
    
    console.log('\nDelimited Instructions:');
    console.log(instructions);
    
    expect(instructions).toContain('delimited sections');
    expect(instructions).toContain('---TITLE---');
    expect(instructions).toContain('Test Document');
    expect(instructions).toContain('---SCORE---');
    expect(instructions).toContain('8');
    expect(instructions).not.toContain('"title":'); // Should NOT contain JSON!
  });

  test('should generate YAML instructions with YAML example', () => {
    const instructions = InstructionGenerator.generateInstructions(testSchema, testData, { format: 'yaml' });
    
    console.log('\nYAML Instructions:');
    console.log(instructions);
    
    expect(instructions).toContain('YAML');
    expect(instructions).toContain('title: Test Document');
    expect(instructions).toContain('score: 8');
    expect(instructions).toContain('tags:');
    expect(instructions).toContain('  - example');
    expect(instructions).not.toContain('"title":'); // Should NOT contain JSON!
  });

  test('should generate tagged instructions with tagged example', () => {
    const instructions = InstructionGenerator.generateInstructions(testSchema, testData, { format: 'tagged' });
    
    console.log('\nTagged Instructions:');
    console.log(instructions);
    
    expect(instructions).toContain('XML-style tags');
    expect(instructions).toContain('<TITLE>Test Document</TITLE>');
    expect(instructions).toContain('<SCORE>8</SCORE>');
    expect(instructions).toContain('<TAGS>example</TAGS>');
    expect(instructions).not.toContain('"title":'); // Should NOT contain JSON!
  });

  test('should generate markdown instructions with markdown example', () => {
    const instructions = InstructionGenerator.generateInstructions(testSchema, testData, { format: 'markdown' });
    
    console.log('\nMarkdown Instructions:');
    console.log(instructions);
    
    expect(instructions).toContain('markdown');
    expect(instructions).toContain('## Title');
    expect(instructions).toContain('Test Document');
    expect(instructions).toContain('## Score');
    expect(instructions).toContain('- example');
    expect(instructions).not.toContain('"title":'); // Should NOT contain JSON!
  });
});