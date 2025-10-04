/**
 * Test CNL Method Support
 * Verifies that CNL can parse and transpile method definitions
 */

import { CNLParser } from '../../src/cnl/CNLParser.js';
import { CNLTranspiler } from '../../src/cnl/CNLTranspiler.js';

describe('CNL Method Support', () => {
  let parser;
  let transpiler;

  beforeEach(() => {
    parser = new CNLParser();
    transpiler = new CNLTranspiler();
  });

  test('should parse Counter component with methods in CNL', () => {
    const cnl = `Define Counter with state:
  With methods:
    When increment is called:
      Set state count to state count + 1
    When decrement is called:
      Set state count to state count - 1
  A container with class "counter" containing:
    A heading showing the count
    A button labeled "+" that increments the count on click
    A button labeled "-" that decrements the count on click`;

    console.log('Testing Counter with methods...');
    console.log(cnl);
    console.log('\n');

    const ast = parser.parse(cnl);

    console.log('AST body length:', ast.body.length);
    console.log('First node type:', ast.body[0]?.type);

    // Should have methods node first
    expect(ast.body.length).toBeGreaterThanOrEqual(2); // methods + container
    expect(ast.body[0].type).toBe('methods');
    expect(ast.body[0].methods).toBeDefined();
    expect(ast.body[0].methods.length).toBe(2);

    // Check increment method
    const incrementMethod = ast.body[0].methods.find(m => m.name === 'increment');
    expect(incrementMethod).toBeDefined();
    expect(incrementMethod.body).toBeDefined();
    expect(incrementMethod.body.length).toBe(1);
    expect(incrementMethod.body[0].code).toBe('state count = state count + 1');

    // Check decrement method
    const decrementMethod = ast.body[0].methods.find(m => m.name === 'decrement');
    expect(decrementMethod).toBeDefined();
    expect(decrementMethod.body).toBeDefined();
    expect(decrementMethod.body.length).toBe(1);
    expect(decrementMethod.body[0].code).toBe('state count = state count - 1');
  });

  test('should transpile Counter methods to JSON component definition', () => {
    const cnl = `Define Counter with state:
  With methods:
    When increment is called:
      Set state count to state count + 1
    When decrement is called:
      Set state count to state count - 1
  A container with class "counter" containing:
    A heading showing the count
    A button labeled "+" that increments the count on click
    A button labeled "-" that decrements the count on click`;

    const ast = parser.parse(cnl);
    const componentDef = transpiler.transpile(ast);

    console.log('Generated Component Definition:');
    console.log(JSON.stringify(componentDef, null, 2));

    // Check basic structure
    expect(componentDef.name).toBe('Counter');
    expect(componentDef.entity).toBe('state');
    expect(componentDef.methods).toBeDefined();

    // Check methods object
    expect(componentDef.methods.increment).toBeDefined();
    expect(componentDef.methods.decrement).toBeDefined();

    // Verify method content
    expect(componentDef.methods.increment).toContain('state count = state count + 1');
    expect(componentDef.methods.decrement).toContain('state count = state count - 1');
  });

  test('should support multiple method statements', () => {
    const cnl = `Define Calculator with state:
  With methods:
    When calculate is called:
      Set state result to state a + state b
      Set state isCalculated to true
  A container containing:
    A heading showing "Calculator"`;

    const ast = parser.parse(cnl);
    const componentDef = transpiler.transpile(ast);

    expect(componentDef.methods.calculate).toBeDefined();
    expect(componentDef.methods.calculate).toContain('state result = state a + state b');
    expect(componentDef.methods.calculate).toContain('state isCalculated = true');
  });

  test('should support increment statement pattern', () => {
    const cnl = `Define Counter with state:
  With methods:
    When increment is called:
      Increment state count
  A container containing:
    A heading showing the count`;

    const ast = parser.parse(cnl);
    const componentDef = transpiler.transpile(ast);

    expect(componentDef.methods.increment).toBeDefined();
    expect(componentDef.methods.increment).toContain('state count = state count + 1');
  });

  test('should support decrement statement pattern', () => {
    const cnl = `Define Counter with state:
  With methods:
    When decrement is called:
      Decrement state count
  A container containing:
    A heading showing the count`;

    const ast = parser.parse(cnl);
    const componentDef = transpiler.transpile(ast);

    expect(componentDef.methods.decrement).toBeDefined();
    expect(componentDef.methods.decrement).toContain('state count = state count - 1');
  });

  test('should work with mixed methods and elements', () => {
    const cnl = `Define TodoApp with state:
  With methods:
    When addTodo is called:
      Set state todos to state todos + state newTodo
      Set state newTodo to ""
  A container with class "app" containing:
    A heading showing "My Todos"
    A button labeled "Add" that increments the count on click`;

    const ast = parser.parse(cnl);
    const componentDef = transpiler.transpile(ast);

    expect(componentDef.name).toBe('TodoApp');
    expect(componentDef.methods.addTodo).toBeDefined();

    // When methods come first, the first element becomes root_sibling_1 instead of root
    const rootKey = Object.keys(componentDef.structure)[0];
    expect(componentDef.structure[rootKey]).toBeDefined();
    expect(componentDef.structure[rootKey].class).toBe('app');
  });

  test('should handle empty methods block', () => {
    const cnl = `Define Empty with state:
  With methods:
  A container containing:
    A heading showing "Empty"`;

    const ast = parser.parse(cnl);
    const componentDef = transpiler.transpile(ast);

    expect(componentDef.methods).toBeDefined();
    expect(Object.keys(componentDef.methods).length).toBe(0);
  });
});
