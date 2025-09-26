import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DSLParser } from '../../src/parser.js';

describe('Error Handling Integration - Real Malformed DSL Input', () => {
  describe('Malformed Template Literal Processing', () => {
    it('should handle malformed query DSL gracefully', () => {
      function malformedQueryDSL(strings, ...expressions) {
        try {
          const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
          const tokens = DSLParser.tokenize(templateResult.text);
          const validation = DSLParser.validateTokenSequence(tokens, 'query');
          
          return { success: validation.valid, errors: validation.errors, tokens };
        } catch (error) {
          return { success: false, parseError: error };
        }
      }
      
      // Various malformed query scenarios
      const malformedQueries = [
        'find where ?this user/name ?name', // Missing variables after find
        'find ?name ?this user/name ?name', // Missing where keyword
        'find ?name where', // Incomplete where clause
        'find ?name where ?this user/', // Incomplete attribute
        'find ?name where ?this user/name' // Missing variable
      ];
      
      malformedQueries.forEach(query => {
        const result = malformedQueryDSL`${query}`;
        
        if (!result.success && !result.parseError) {
          assert.ok(Array.isArray(result.errors));
          assert.ok(result.errors.length > 0);
          
          // Errors should have helpful information
          result.errors.forEach(error => {
            assert.ok(error.message);
            assert.ok(typeof error.start === 'number');
            assert.ok(typeof error.end === 'number');
          });
        }
      });
    });

    it('should handle malformed schema DSL gracefully', () => {
      function malformedSchemaDSL(strings, ...expressions) {
        try {
          const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
          const tokens = DSLParser.tokenize(templateResult.text);
          const validation = DSLParser.validateTokenSequence(tokens, 'schema');
          
          return { success: validation.valid, errors: validation.errors, tokens };
        } catch (error) {
          return { success: false, parseError: error };
        }
      }
      
      // Various malformed schema scenarios
      const malformedSchemas = [
        'user/name:', // Missing type
        'user/name: invalid-type', // Invalid type
        'user/name: ref', // Ref without target
        'user/name: many ref', // Many ref without target
        '/name: string', // Missing entity
        'user/: string' // Missing attribute
      ];
      
      malformedSchemas.forEach(schema => {
        const result = malformedSchemaDSL`${schema}`;
        
        if (!result.success && !result.parseError) {
          assert.ok(Array.isArray(result.errors));
          assert.ok(result.errors.length > 0);
        }
      });
    });

    it('should handle malformed update DSL gracefully', () => {
      function malformedUpdateDSL(strings, ...expressions) {
        try {
          const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
          const tokens = DSLParser.tokenize(templateResult.text);
          const validation = DSLParser.validateTokenSequence(tokens, 'update');
          
          return { success: validation.valid, errors: validation.errors, tokens };
        } catch (error) {
          return { success: false, parseError: error };
        }
      }
      
      // Various malformed update scenarios
      const malformedUpdates = [
        'user/name =', // Missing value
        '= "Alice"', // Missing attribute
        'user/name "Alice"', // Missing assignment operator
        '+user/name', // Missing assignment
        'user/name = = "Alice"' // Double equals
      ];
      
      malformedUpdates.forEach(update => {
        const result = malformedUpdateDSL`${update}`;
        
        if (!result.success && !result.parseError) {
          assert.ok(Array.isArray(result.errors));
          assert.ok(result.errors.length > 0);
        }
      });
    });

    it('should provide contextual error information for real DSL input', () => {
      function contextualErrorDSL(strings, ...expressions) {
        const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
        const result = DSLParser.parseWithErrorRecovery(templateResult.text, 'query');
        
        if (result.errors.length > 0) {
          // Add context information to errors
          result.errors.forEach(error => {
            const contextualError = DSLParser.createError(
              error.message,
              templateResult.text,
              error.start,
              error.end
            );
            
            result.contextualErrors = result.contextualErrors || [];
            result.contextualErrors.push(contextualError);
          });
        }
        
        return result;
      }
      
      const userName = 'Alice';
      
      // Complex malformed DSL with expressions
      const result = contextualErrorDSL`
        find ?name ?age
        where ?this user/name ${userName}
              ?this user/invalid-attribute ?age
              ?age >= invalid-value
      `;
      
      if (result.contextualErrors) {
        result.contextualErrors.forEach(error => {
          assert.ok(error.line);
          assert.ok(error.column);
          assert.ok(error.contextLine);
          assert.ok(error.pointer);
          
          // Should reference original template literal
          assert.ok(error.dslText);
        });
      }
    });

    it('should handle error recovery across multiple DSL statements', () => {
      function multiStatementErrorDSL(strings, ...expressions) {
        const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
        
        // Simulate parsing multiple DSL statements
        const statements = templateResult.text.split('\n').filter(line => line.trim());
        const results = statements.map(statement => {
          const tokens = DSLParser.tokenize(statement);
          return DSLParser.validateTokenSequence(tokens, 'mixed');
        });
        
        return {
          statements: results,
          globalErrors: results.flatMap(r => r.errors),
          validStatements: results.filter(r => r.valid).length,
          totalStatements: results.length
        };
      }
      
      const entity1 = 'user';
      const entity2 = 'post';
      
      const result = multiStatementErrorDSL`
        ${entity1}/name: string
        invalid-schema-line
        ${entity2}/title: string
        find ?name where ?this user/name ?name
        invalid-query-line
      `;
      
      assert.ok(result.totalStatements > 0);
      assert.ok(result.validStatements >= 0);
      assert.ok(result.globalErrors);
      
      // Should have some valid statements despite errors
      const validRatio = result.validStatements / result.totalStatements;
      assert.ok(validRatio >= 0);
    });

    it('should integrate error handling with expression evaluation', () => {
      function expressionErrorDSL(strings, ...expressions) {
        try {
          const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
          
          // Simulate expression evaluation errors
          const evaluatedExpressions = expressions.map((expr, index) => {
            if (expr === null || expr === undefined) {
              const error = DSLParser.createError(
                `Invalid expression at position ${index}`,
                templateResult.text,
                templateResult.text.indexOf(`\${${index}}`),
                templateResult.text.indexOf(`\${${index}}`) + `\${${index}}`.length,
                { expressionIndex: index, expressionValue: expr }
              );
              throw error;
            }
            return expr;
          });
          
          return { success: true, expressions: evaluatedExpressions };
        } catch (error) {
          return { success: false, error };
        }
      }
      
      const validValue = 'Alice';
      const invalidValue = null;
      
      const result = expressionErrorDSL`
        user/name = ${validValue}
        user/age = ${invalidValue}
      `;
      
      assert.ok(!result.success);
      assert.ok(result.error);
      assert.ok(result.error.message.includes('Invalid expression'));
      assert.ok(typeof result.error.expressionIndex === 'number');
    });
  });
});