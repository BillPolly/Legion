/**
 * Component Editor Tab Integration Test
 * Tests DSL/CNL/JSON tabs parsing and conversion
 */

import { describe, test, expect } from '@jest/globals';
import { CNLParser } from '../../src/cnl/CNLParser.js';
import { DSLParser } from '../../src/cnl/DSLParser.js';

describe('Component Editor Tab Integration', () => {

  test('should parse CNL with methods', async () => {
    const cnl = `
Define Counter with state:
  With methods:
    When increment is called:
      Set state count to state count + 1
    When decrement is called:
      Set state count to state count - 1
  A container with class "counter" containing:
    A heading showing the count
    A button labeled "+" that calls increment on click
    A button labeled "-" that calls decrement on click
    `;

    const parser = new CNLParser();
    const ast = parser.parse(cnl);

    expect(ast.type).toBe('Component');
    expect(ast.name).toBe('Counter');
    expect(ast.body.length).toBeGreaterThanOrEqual(2);

    const methodsNode = ast.body.find(node => node.type === 'methods');
    expect(methodsNode).toBeTruthy();
    expect(methodsNode.methods.length).toBe(2);
  });

  test('should convert CNL to JSON format', async () => {
    const cnl = `
Define Counter with state:
  With methods:
    When increment is called:
      Increment state count
  A container with class "counter" containing:
    A heading showing the count
    `;

    const parser = new CNLParser();
    const json = parser.parse(cnl, { toJSON: true });

    expect(json.name).toBe('Counter');
    expect(json.entity).toBe('state');
    expect(json.methods).toBeDefined();
    expect(json.methods.increment).toBeDefined();
    expect(json.methods.increment).toContain('state count = state count + 1');
  });

  test('should convert DSL to AST format', async () => {
    const dsl = `
      Counter :: state =>
        div.counter [
          h2 { state.count }
          button @click="state.count = state.count + 1" { "+" }
        ]
    `;

    const parser = new DSLParser();
    const ast = parser.parse(dsl);

    expect(ast.type).toBe('Component');
    expect(ast.name).toBe('Counter');
    expect(ast.parameter).toBe('state');
  });
});
