/**
 * Test the EXACT scenario the user is experiencing
 * User types "-1" in place of "-" in the live editor
 */

import { CNLParser } from '../../src/cnl/CNLParser.js';
import { CNLTranspiler } from '../../src/cnl/CNLTranspiler.js';
import { ComponentCompiler } from '../../src/compiler/ComponentCompiler.js';

describe('EXACT User Scenario - Typing -1 in button label', () => {
  let parser;
  let transpiler;
  let compiler;

  beforeEach(() => {
    parser = new CNLParser();
    transpiler = new CNLTranspiler();
    compiler = new ComponentCompiler();
  });

  test('EXACT SCENARIO: User changes "-" to "-1" in live editor', () => {
    // This is the EXACT CNL from the live editor after user types "-1"
    // Note: NO EXTRA INDENTATION for the buttons after "containing:"
    const cnlAfterTypingMinus1 = `Define Counter with state:
  A container with class "counter" containing:
    A heading showing the count
  A button labeled "+1" that increments the count on click
  A button labeled "-1" that decrements the count on click
  A button labeled "Reset" that sets the count to 0 on click`;

    console.log('Testing EXACT user scenario...');
    console.log('CNL after user types "-1":');
    console.log(cnlAfterTypingMinus1);
    console.log('\n');

    // Parse the CNL
    const ast = parser.parse(cnlAfterTypingMinus1);
    
    console.log('AST body length:', ast.body.length);
    console.log('First element type:', ast.body[0]?.type);
    console.log('First element tag:', ast.body[0]?.tag);
    
    // The buttons should be children of the container, NOT siblings
    expect(ast.body.length).toBe(1); // Only the container
    expect(ast.body[0].children).toBeDefined();
    expect(ast.body[0].children.length).toBe(4); // heading + 3 buttons
    
    // Transpile to JSON Component Definition
    const componentDef = transpiler.transpile(ast);
    console.log('\nGenerated Component Definition:');
    console.log(JSON.stringify(componentDef, null, 2));
    
    // Check the structure
    expect(componentDef.name).toBe('Counter');
    expect(componentDef.entity).toBe('state');
    expect(componentDef.structure).toBeDefined();
    expect(componentDef.bindings).toBeDefined();
    expect(componentDef.events).toBeDefined();
    
    // Should have correct structure with buttons as children
    const structureKeys = Object.keys(componentDef.structure);
    const rootElement = componentDef.structure.root;
    expect(rootElement).toBeDefined();
    expect(rootElement.element).toBe('div');
    expect(rootElement.class).toBe('counter');
    
    // Check that buttons are children of root
    const buttonElements = structureKeys.filter(key => 
      key !== 'root' && componentDef.structure[key].element === 'button'
    );
    expect(buttonElements.length).toBe(3); // 3 buttons
    
    // All buttons should have root as parent
    buttonElements.forEach(buttonKey => {
      expect(componentDef.structure[buttonKey].parent).toMatch(/^root/);
    });
    
    console.log('\n✅ Test passed - correct JSON structure!');
  });

  test('REPRODUCE THE BUG: What happens when buttons are parsed as siblings', () => {
    // Manually create an AST that represents what was happening BEFORE the fix
    const buggyAST = {
      type: 'Component',
      name: 'Counter',
      parameter: 'state',
      body: [
        // Container as first element
        {
          type: 'element',
          tag: 'div',
          className: 'counter',
          children: [
            {
              type: 'element',
              tag: 'h2',
              binding: 'count'
            }
          ]
        },
        // Buttons as siblings (THIS IS THE BUG!)
        {
          type: 'element',
          tag: 'button',
          text: '"+1"',
          event: {
            type: 'click',
            action: { type: 'increment', target: 'count' }
          }
        },
        {
          type: 'element',
          tag: 'button',
          text: '"-1"',
          event: {
            type: 'click',
            action: { type: 'decrement', target: 'count' }
          }
        },
        {
          type: 'element',
          tag: 'button',
          text: '"Reset"',
          event: {
            type: 'click',
            action: { type: 'set', target: 'count', value: 0 }
          }
        }
      ]
    };

    console.log('\nReproducing the bug - buttons as siblings...');
    
    // Transpile the buggy AST to JSON
    const buggyComponentDef = transpiler.transpile(buggyAST);
    console.log('Buggy Component Definition with siblings:');
    console.log(JSON.stringify(buggyComponentDef, null, 2));
    
    // With multiple top-level elements, we should have multiple root siblings
    const structureKeys = Object.keys(buggyComponentDef.structure);
    const rootSiblings = structureKeys.filter(key => 
      !buggyComponentDef.structure[key].parent
    );
    
    console.log('\nNumber of root siblings:', rootSiblings.length);
    
    // This WILL have multiple root elements (the bug)
    expect(rootSiblings.length).toBeGreaterThan(1);
    
    console.log('\n✅ Successfully reproduced the bug structure!');
  });

  test('SIMULATE: User typing character by character', () => {
    const cnlSteps = [
      // Step 1: Original with just "-"
      `Define Counter with state:
  A container with class "counter" containing:
    A heading showing the count
  A button labeled "+1" that increments the count on click
  A button labeled "-" that decrements the count on click
  A button labeled "Reset" that sets the count to 0 on click`,
      
      // Step 2: User types "1" to make "-1"
      `Define Counter with state:
  A container with class "counter" containing:
    A heading showing the count
  A button labeled "+1" that increments the count on click
  A button labeled "-1" that decrements the count on click
  A button labeled "Reset" that sets the count to 0 on click`
    ];

    cnlSteps.forEach((cnl, index) => {
      console.log(`\nStep ${index + 1}: ${index === 0 ? 'Original' : 'After typing "1"'}`);
      
      const ast = parser.parse(cnl);
      const componentDef = transpiler.transpile(ast);
      
      // Both should produce valid JSON component definitions
      expect(componentDef).toBeDefined();
      expect(componentDef.name).toBe('Counter');
      expect(componentDef.entity).toBe('state');
      expect(componentDef.structure).toBeDefined();
      
      // Check that buttons are children of root
      const structureKeys = Object.keys(componentDef.structure);
      const buttonElements = structureKeys.filter(key => 
        componentDef.structure[key].element === 'button'
      );
      expect(buttonElements.length).toBe(3); // 3 buttons
      
      // All buttons should have a parent (not be root elements)
      buttonElements.forEach(buttonKey => {
        expect(componentDef.structure[buttonKey].parent).toBeDefined();
      });
      
      console.log('✅ Valid JSON structure');
    });
  });
});