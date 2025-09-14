/**
 * Test CNL Parser indentation handling
 * Reproduces the exact error from the live editor
 */

import { CNLParser } from '../../src/cnl/CNLParser.js';
import { CNLTranspiler } from '../../src/cnl/CNLTranspiler.js';
import { ComponentCompiler } from '../../src/compiler/ComponentCompiler.js';

describe('CNL Parser - Indentation Handling', () => {
  let parser;
  let transpiler;
  let compiler;

  beforeEach(() => {
    parser = new CNLParser();
    transpiler = new CNLTranspiler();
    compiler = new ComponentCompiler();
  });

  describe('Button indentation issues', () => {
    test('should handle buttons with no indentation after containing:', () => {
      // This is the exact problem from the live editor
      const cnl = `Define Counter with state:
  A container with class "counter" containing:
    A heading showing the count
  A button labeled "+1" that increments the count on click
  A button labeled "-1" that decrements the count on click
  A button labeled "Reset" that sets the count to 0 on click`;

      const ast = parser.parse(cnl);
      
      // With the fix: buttons are now parsed as children of container
      expect(ast.body.length).toBe(1); // Just the container!
      expect(ast.body[0].children.length).toBe(4); // Heading + 3 buttons as children
      
      // This should generate valid JSON component definition now
      const componentDef = transpiler.transpile(ast);
      
      // Verify the JSON structure is correct
      expect(componentDef.name).toBe('Counter');
      expect(componentDef.entity).toBe('state');
      expect(componentDef.structure).toBeDefined();
      
      // All buttons should be children of root
      const structureKeys = Object.keys(componentDef.structure);
      const buttonElements = structureKeys.filter(key => 
        componentDef.structure[key].element === 'button'
      );
      expect(buttonElements.length).toBe(3);
      buttonElements.forEach(buttonKey => {
        expect(componentDef.structure[buttonKey].parent).toBeDefined();
      });
    });

    test('should work correctly with proper indentation', () => {
      const cnl = `Define Counter with state:
  A container with class "counter" containing:
    A heading showing the count
    A button labeled "+1" that increments the count on click
    A button labeled "-1" that decrements the count on click
    A button labeled "Reset" that sets the count to 0 on click`;

      const ast = parser.parse(cnl);
      
      // With proper indentation, buttons are children of container
      expect(ast.body.length).toBe(1); // Just the container
      expect(ast.body[0].children.length).toBe(4); // Heading + 3 buttons
      
      const componentDef = transpiler.transpile(ast);
      
      // Verify correct JSON structure
      expect(componentDef.name).toBe('Counter');
      expect(componentDef.entity).toBe('state');
      
      // All buttons should be children of root
      const structureKeys = Object.keys(componentDef.structure);
      const buttonElements = structureKeys.filter(key => 
        componentDef.structure[key].element === 'button'
      );
      expect(buttonElements.length).toBe(3);
      buttonElements.forEach(buttonKey => {
        expect(componentDef.structure[buttonKey].parent).toBeDefined();
      });
    });

    test('should no longer produce error with -1 label after fix', () => {
      // Exact CNL that used to cause the error when user types "-1"
      const cnl = `Define Counter with state:
  A container with class "counter" containing:
    A heading showing the count
  A button labeled "+1" that increments the count on click
  A button labeled "-1" that decrements the count on click
  A button labeled "Reset" that sets the count to 0 on click`;

      const ast = parser.parse(cnl);
      const componentDef = transpiler.transpile(ast);
      
      // This should produce a valid JSON structure
      expect(componentDef).toBeDefined();
      expect(componentDef.name).toBe('Counter');
      expect(componentDef.structure).toBeDefined();
      
      // Verify buttons are children, not siblings
      const structureKeys = Object.keys(componentDef.structure);
      const rootElements = structureKeys.filter(key => 
        !componentDef.structure[key].parent
      );
      expect(rootElements.length).toBe(1); // Only one root element
    });

    test('should handle mixed indentation gracefully', () => {
      const cnl = `Define Counter with state:
  A container with class "counter" containing:
    A heading showing the count
  A button labeled "+1" that increments the count on click
    A button labeled "-1" that decrements the count on click
  A button labeled "Reset" that sets the count to 0 on click`;

      const ast = parser.parse(cnl);
      
      // With fix: all are children of container regardless of mixed indentation
      expect(ast.body.length).toBe(1);
      expect(ast.body[0].children.length).toBe(4); // All buttons are children
    });

    test('should work when all elements are at same indent level', () => {
      const cnl = `Define Counter with state:
  A container with class "counter" containing:
  A heading showing the count
  A button labeled "+1" that increments the count on click
  A button labeled "-1" that decrements the count on click
  A button labeled "Reset" that sets the count to 0 on click`;

      const ast = parser.parse(cnl);
      
      // With fix: all at same level are treated as children when "containing:" is used
      expect(ast.body.length).toBe(1); // Just the container
      expect(ast.body[0].children.length).toBe(4); // All elements as children
    });
  });

  describe('Containing pattern special handling', () => {
    test('should recognize "containing:" as requiring children', () => {
      const cnl = `Define Test with data:
  A container containing:
  An item`;

      const ast = parser.parse(cnl);
      
      // Item should be child of container even without indentation
      // This is the fix we need!
      expect(ast.body.length).toBe(1);
      expect(ast.body[0].children).toBeDefined();
    });

    test('should handle "containing:" with line break', () => {
      const cnl = `Define Test with data:
  A container containing:
    An item
  Another element`;

      const ast = parser.parse(cnl);
      
      // With fix: both are children since "Another element" is at same indent as container
      expect(ast.body.length).toBe(1);
      expect(ast.body[0].children.length).toBe(2); // Both are children
    });
  });
});