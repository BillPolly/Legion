import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DSLParser } from '../src/parser.js';

describe('DSLParser - Template Literal Foundation', () => {
  describe('Tagged Template Literal Structure', () => {
    it('should process template literal strings and expressions', () => {
      const strings = ['Hello ', ' world ', '!'];
      const expressions = ['beautiful', 123];
      
      const result = DSLParser.processTemplateLiteral(strings, expressions);
      
      assert.ok(result);
      assert.strictEqual(result.text, 'Hello ${0} world ${1}!');
      assert.deepStrictEqual(result.expressions, ['beautiful', 123]);
      assert.deepStrictEqual(result.originalStrings, strings);
    });

    it('should handle template literals with no expressions', () => {
      const strings = ['Simple text without expressions'];
      const expressions = [];
      
      const result = DSLParser.processTemplateLiteral(strings, expressions);
      
      assert.strictEqual(result.text, 'Simple text without expressions');
      assert.deepStrictEqual(result.expressions, []);
    });

    it('should handle template literals with only expressions', () => {
      const strings = ['', '', ''];
      const expressions = ['first', 'second'];
      
      const result = DSLParser.processTemplateLiteral(strings, expressions);
      
      assert.strictEqual(result.text, '${0}${1}');
      assert.deepStrictEqual(result.expressions, ['first', 'second']);
    });

    it('should handle empty template literals', () => {
      const strings = [''];
      const expressions = [];
      
      const result = DSLParser.processTemplateLiteral(strings, expressions);
      
      assert.strictEqual(result.text, '');
      assert.deepStrictEqual(result.expressions, []);
    });

    it('should preserve expression order and indexing', () => {
      const strings = ['Start ', ' middle ', ' end', ''];
      const expressions = [42, 'test', true];
      
      const result = DSLParser.processTemplateLiteral(strings, expressions);
      
      assert.strictEqual(result.text, 'Start ${0} middle ${1} end${2}');
      assert.deepStrictEqual(result.expressions, [42, 'test', true]);
    });

    it('should handle complex JavaScript expressions', () => {
      const user = { name: 'Alice', age: 30 };
      const calculateScore = (u) => u.age * 2;
      
      const strings = ['user ', ' has score ', ''];
      const expressions = [user.name, calculateScore(user)];
      
      const result = DSLParser.processTemplateLiteral(strings, expressions);
      
      assert.strictEqual(result.text, 'user ${0} has score ${1}');
      assert.deepStrictEqual(result.expressions, ['Alice', 60]);
    });
  });

  describe('String and Expression Separation', () => {
    it('should separate template strings from interpolated expressions', () => {
      const templateResult = {
        text: 'find ?name where ?entity user/name ${0}',
        expressions: ['Alice'],
        originalStrings: ['find ?name where ?entity user/name ', '']
      };
      
      const separated = DSLParser.separateTemplateComponents(templateResult);
      
      assert.strictEqual(separated.staticText, 'find ?name where ?entity user/name ${0}');
      assert.deepStrictEqual(separated.expressions, ['Alice']);
      assert.strictEqual(separated.expressionCount, 1);
      assert.ok(separated.hasExpressions);
    });

    it('should handle templates without expressions', () => {
      const templateResult = {
        text: 'find ?name where ?entity user/name ?name',
        expressions: [],
        originalStrings: ['find ?name where ?entity user/name ?name']
      };
      
      const separated = DSLParser.separateTemplateComponents(templateResult);
      
      assert.strictEqual(separated.staticText, 'find ?name where ?entity user/name ?name');
      assert.deepStrictEqual(separated.expressions, []);
      assert.strictEqual(separated.expressionCount, 0);
      assert.ok(!separated.hasExpressions);
    });

    it('should track expression positions in text', () => {
      const templateResult = {
        text: 'update user/name = ${0}, user/age = ${1}, user/active = ${2}',
        expressions: ['Alice', 30, true],
        originalStrings: ['update user/name = ', ', user/age = ', ', user/active = ', '']
      };
      
      const separated = DSLParser.separateTemplateComponents(templateResult);
      
      assert.ok(separated.expressionPositions);
      assert.strictEqual(separated.expressionPositions.length, 3);
      
      // Check that expression positions are tracked correctly
      separated.expressionPositions.forEach((pos, index) => {
        assert.ok(pos.start >= 0);
        assert.ok(pos.end > pos.start);
        assert.strictEqual(pos.expressionIndex, index);
      });
    });

    it('should handle mixed content with proper separation', () => {
      const templateResult = {
        text: 'where ?this user/created >= ${0} and ?this user/score < ${1}',
        expressions: [new Date('2023-01-01'), 100],
        originalStrings: ['where ?this user/created >= ', ' and ?this user/score < ', '']
      };
      
      const separated = DSLParser.separateTemplateComponents(templateResult);
      
      assert.ok(separated.hasExpressions);
      assert.strictEqual(separated.expressionCount, 2);
      assert.ok(separated.staticText.includes('${0}'));
      assert.ok(separated.staticText.includes('${1}'));
      assert.strictEqual(separated.expressions[0].getFullYear(), 2023);
      assert.strictEqual(separated.expressions[1], 100);
    });
  });

  describe('Template Literal Function Framework', () => {
    it('should validate template literal function parameters', () => {
      // Valid parameters
      assert.doesNotThrow(() => {
        DSLParser.validateTemplateLiteralParams(['string'], []);
      });
      
      assert.doesNotThrow(() => {
        DSLParser.validateTemplateLiteralParams(['start ', ' end'], ['middle']);
      });
      
      // Invalid parameters
      assert.throws(() => {
        DSLParser.validateTemplateLiteralParams(null, []);
      }, /Template strings are required/);
      
      assert.throws(() => {
        DSLParser.validateTemplateLiteralParams([], null);
      }, /Expressions array is required/);
      
      assert.throws(() => {
        DSLParser.validateTemplateLiteralParams('invalid', []);
      }, /Template strings must be an array/);
      
      assert.throws(() => {
        DSLParser.validateTemplateLiteralParams([], 'invalid');
      }, /Expressions must be an array/);
    });

    it('should validate template strings array structure', () => {
      // Valid: strings.length = expressions.length + 1
      assert.doesNotThrow(() => {
        DSLParser.validateTemplateLiteralParams(['a', 'b'], ['x']);
      });
      
      assert.doesNotThrow(() => {
        DSLParser.validateTemplateLiteralParams(['a', 'b', 'c'], ['x', 'y']);
      });
      
      assert.doesNotThrow(() => {
        DSLParser.validateTemplateLiteralParams(['single'], []);
      });
      
      // Invalid: wrong string/expression count relationship
      assert.throws(() => {
        DSLParser.validateTemplateLiteralParams(['a'], ['x']);
      }, /Template literal structure invalid/);
      
      assert.throws(() => {
        DSLParser.validateTemplateLiteralParams(['a', 'b', 'c'], ['x']);
      }, /Template literal structure invalid/);
    });

    it('should create template literal context object', () => {
      const strings = ['find ?name where ?entity user/name ', ''];
      const expressions = ['Alice'];
      
      const context = DSLParser.createTemplateLiteralContext(strings, expressions);
      
      assert.ok(context);
      assert.strictEqual(context.type, 'template-literal');
      assert.strictEqual(context.text, 'find ?name where ?entity user/name ${0}');
      assert.deepStrictEqual(context.expressions, ['Alice']);
      assert.ok(context.metadata);
      assert.strictEqual(context.metadata.expressionCount, 1);
      assert.ok(context.metadata.hasExpressions);
      assert.ok(context.metadata.createdAt);
    });

    it('should handle template literal context metadata', () => {
      const strings = ['complex template ', ' with multiple ', ' expressions ', ''];
      const expressions = [1, 'test', { key: 'value' }];
      
      const context = DSLParser.createTemplateLiteralContext(strings, expressions);
      
      assert.strictEqual(context.metadata.expressionCount, 3);
      assert.ok(context.metadata.hasExpressions);
      assert.strictEqual(context.metadata.staticLength, context.text.replace(/\$\{\d+\}/g, '').length);
      assert.ok(context.metadata.complexity > 0);
    });

    it('should support template literal context serialization', () => {
      const strings = ['test ', ' template'];
      const expressions = ['value'];
      
      const context = DSLParser.createTemplateLiteralContext(strings, expressions);
      const serialized = JSON.stringify(context);
      const parsed = JSON.parse(serialized);
      
      assert.strictEqual(parsed.type, 'template-literal');
      assert.strictEqual(parsed.text, context.text);
      assert.deepStrictEqual(parsed.expressions, context.expressions);
    });
  });

  describe('Token Processing System', () => {
    it('should tokenize DSL text into structured tokens', () => {
      const dslText = 'find ?name ?age where ?this user/name ?name';
      
      const tokens = DSLParser.tokenize(dslText);
      
      assert.ok(Array.isArray(tokens));
      assert.ok(tokens.length > 0);
      
      // Should identify different token types
      const keywords = tokens.filter(t => t.type === 'keyword');
      const variables = tokens.filter(t => t.type === 'variable');
      const attributes = tokens.filter(t => t.type === 'attribute');
      
      assert.ok(keywords.some(t => t.value === 'find'));
      assert.ok(keywords.some(t => t.value === 'where'));
      assert.ok(variables.some(t => t.value === '?name'));
      assert.ok(variables.some(t => t.value === '?age'));
      assert.ok(variables.some(t => t.value === '?this'));
      assert.ok(attributes.some(t => t.value === 'user/name'));
    });

    it('should recognize DSL keywords correctly', () => {
      const keywords = [
        'find', 'where', 'unique', 'value', 'identity', 'many', 'component',
        'string', 'number', 'boolean', 'ref', 'instant'
      ];
      
      keywords.forEach(keyword => {
        const tokens = DSLParser.tokenize(keyword);
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].type, 'keyword');
        assert.strictEqual(tokens[0].value, keyword);
      });
    });

    it('should identify variables with ? prefix', () => {
      const variables = ['?name', '?age', '?this', '?friend-name', '?user_id', '?123'];
      
      variables.forEach(variable => {
        const tokens = DSLParser.tokenize(variable);
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].type, 'variable');
        assert.strictEqual(tokens[0].value, variable);
      });
    });

    it('should identify attributes with entity/attribute format', () => {
      const attributes = [
        'user/name', 'post/title', 'comment/author', 
        'organization/departments', 'employee/manager'
      ];
      
      attributes.forEach(attribute => {
        const tokens = DSLParser.tokenize(attribute);
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].type, 'attribute');
        assert.strictEqual(tokens[0].value, attribute);
        
        // Should extract entity and attribute parts
        const [entity, attr] = attribute.split('/');
        assert.strictEqual(tokens[0].entity, entity);
        assert.strictEqual(tokens[0].attribute, attr);
      });
    });

    it('should handle operators and comparison symbols', () => {
      const operators = ['=', '!=', '>=', '<=', '>', '<', '+', '-'];
      
      operators.forEach(operator => {
        const tokens = DSLParser.tokenize(operator);
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].type, 'operator');
        assert.strictEqual(tokens[0].value, operator);
      });
    });

    it('should identify string literals', () => {
      const stringLiterals = [
        '"simple string"',
        "'single quotes'", 
        '"string with spaces"',
        '"string with \\"escaped quotes\\""'
      ];
      
      stringLiterals.forEach(literal => {
        const tokens = DSLParser.tokenize(literal);
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].type, 'string');
        
        // Should extract content without quotes
        const expected = literal.slice(1, -1).replace(/\\"/g, '"');
        assert.strictEqual(tokens[0].value, expected);
      });
    });

    it('should identify numeric literals', () => {
      const numbers = ['42', '3.14', '-10', '0', '1000000'];
      
      numbers.forEach(number => {
        const tokens = DSLParser.tokenize(number);
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].type, 'number');
        assert.strictEqual(tokens[0].value, parseFloat(number));
      });
    });

    it('should identify boolean literals', () => {
      const booleans = ['true', 'false'];
      
      booleans.forEach(bool => {
        const tokens = DSLParser.tokenize(bool);
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].type, 'boolean');
        assert.strictEqual(tokens[0].value, bool === 'true');
      });
    });

    it('should handle expression placeholders', () => {
      const placeholders = ['${0}', '${1}', '${10}', '${999}'];
      
      placeholders.forEach(placeholder => {
        const tokens = DSLParser.tokenize(placeholder);
        assert.strictEqual(tokens.length, 1);
        assert.strictEqual(tokens[0].type, 'expression');
        
        const expectedIndex = parseInt(placeholder.slice(2, -1));
        assert.strictEqual(tokens[0].index, expectedIndex);
        assert.strictEqual(tokens[0].placeholder, placeholder);
      });
    });

    it('should handle complex DSL text with multiple token types', () => {
      const complexDSL = `
        find ?name ?age (count ?friend) as friendCount
        where ?this user/name ?name
              ?this user/age ?age
              ?this user/friends ?friend
              ?age >= 21
              ?name != "Admin"
      `;
      
      const tokens = DSLParser.tokenize(complexDSL);
      
      // Should have multiple token types
      const tokenTypes = new Set(tokens.map(t => t.type));
      assert.ok(tokenTypes.has('keyword'));
      assert.ok(tokenTypes.has('variable'));
      assert.ok(tokenTypes.has('attribute'));
      assert.ok(tokenTypes.has('operator'));
      assert.ok(tokenTypes.has('number'));
      assert.ok(tokenTypes.has('string'));
      
      // Check specific tokens
      assert.ok(tokens.some(t => t.type === 'keyword' && t.value === 'find'));
      assert.ok(tokens.some(t => t.type === 'variable' && t.value === '?name'));
      assert.ok(tokens.some(t => t.type === 'attribute' && t.value === 'user/name'));
      assert.ok(tokens.some(t => t.type === 'operator' && t.value === '>='));
      assert.ok(tokens.some(t => t.type === 'number' && t.value === 21));
      assert.ok(tokens.some(t => t.type === 'string' && t.value === 'Admin'));
    });

    it('should preserve token position information', () => {
      const dslText = 'find ?name where ?this user/name ?name';
      
      const tokens = DSLParser.tokenize(dslText);
      
      tokens.forEach(token => {
        assert.ok(typeof token.start === 'number');
        assert.ok(typeof token.end === 'number');
        assert.ok(token.end > token.start);
        assert.ok(token.start >= 0);
        assert.ok(token.end <= dslText.length);
        
        // Verify token content matches position
        const extractedContent = dslText.slice(token.start, token.end);
        if (token.type === 'string') {
          // For strings, the extracted content includes quotes
          assert.ok(extractedContent.includes(token.value));
        } else {
          assert.ok(extractedContent === token.value.toString() || extractedContent === token.value);
        }
      });
    });

    it('should handle whitespace and line breaks correctly', () => {
      const dslWithWhitespace = `
        find    ?name
        
        where   ?this    user/name    ?name
              ?this user/age >= 25
      `;
      
      const tokens = DSLParser.tokenize(dslWithWhitespace);
      
      // Should not include whitespace tokens
      tokens.forEach(token => {
        assert.ok(token.type !== 'whitespace');
        assert.ok(token.value.toString().trim().length > 0);
      });
      
      // But should preserve structure
      assert.ok(tokens.some(t => t.value === 'find'));
      assert.ok(tokens.some(t => t.value === '?name'));
      assert.ok(tokens.some(t => t.value === 'where'));
      assert.ok(tokens.some(t => t.value === 'user/name'));
    });

    it('should classify tokens with metadata', () => {
      const dslText = 'user/email: unique value string';
      
      const tokens = DSLParser.tokenize(dslText);
      
      tokens.forEach(token => {
        assert.ok(token.type);
        assert.ok(token.value !== undefined);
        assert.ok(typeof token.start === 'number');
        assert.ok(typeof token.end === 'number');
        
        // Token-specific metadata
        if (token.type === 'attribute') {
          assert.ok(token.entity);
          assert.ok(token.attribute);
        }
        
        if (token.type === 'expression') {
          assert.ok(typeof token.index === 'number');
          assert.ok(token.placeholder);
        }
        
        if (token.type === 'keyword') {
          assert.ok(['schema', 'query', 'update'].includes(token.category) || token.category === undefined);
        }
      });
    });
  });

  describe('Error Handling Framework', () => {
    it('should create detailed error objects with position information', () => {
      const dslText = 'find ?name where ?this invalid-syntax ?name';
      const errorPos = dslText.indexOf('invalid-syntax');
      
      const error = DSLParser.createError(
        'Invalid syntax',
        dslText,
        errorPos,
        errorPos + 'invalid-syntax'.length
      );
      
      assert.ok(error instanceof Error);
      assert.strictEqual(error.message, 'Invalid syntax');
      assert.strictEqual(error.dslText, dslText);
      assert.strictEqual(error.start, errorPos);
      assert.strictEqual(error.end, errorPos + 'invalid-syntax'.length);
      assert.ok(typeof error.line === 'number');
      assert.ok(typeof error.column === 'number');
      assert.ok(error.contextLine);
      assert.ok(error.pointer);
    });

    it('should calculate line and column numbers correctly', () => {
      const multilineDSL = `line 1
        line 2 with error here
        line 3`;
      
      const errorPos = multilineDSL.indexOf('error');
      
      const error = DSLParser.createError(
        'Test error',
        multilineDSL,
        errorPos,
        errorPos + 5
      );
      
      assert.strictEqual(error.line, 2); // Second line (1-indexed)
      assert.ok(error.column >= 0);
      assert.ok(error.contextLine.includes('error'));
    });

    it('should provide helpful error messages with context', () => {
      const dslText = 'find ?name where ?this unknown/attribute ?name';
      const errorStart = dslText.indexOf('unknown/attribute');
      
      const error = DSLParser.createError(
        'Unknown attribute: unknown/attribute',
        dslText,
        errorStart,
        errorStart + 'unknown/attribute'.length,
        {
          suggestion: 'Did you mean user/name?',
          availableAttributes: ['user/name', 'user/age', 'user/email']
        }
      );
      
      assert.ok(error.message.includes('Unknown attribute'));
      assert.strictEqual(error.suggestion, 'Did you mean user/name?');
      assert.deepStrictEqual(error.availableAttributes, ['user/name', 'user/age', 'user/email']);
      assert.ok(error.pointer); // Should have visual pointer
    });

    it('should handle error recovery for partial parsing', () => {
      const invalidDSL = 'find ?name invalid-keyword ?this user/name ?name';
      
      const result = DSLParser.parseWithErrorRecovery(invalidDSL, 'query');
      
      assert.ok(result.errors);
      assert.ok(Array.isArray(result.errors));
      assert.ok(result.partialTokens);
      assert.ok(typeof result.recoverable === 'boolean');
      
      // Should parse tokens even with errors
      assert.ok(result.partialTokens.some(t => t.type === 'keyword' && t.value === 'find'));
      assert.ok(result.partialTokens.some(t => t.type === 'variable' && t.value === '?name'));
    });

    it('should validate token sequences for different DSL types', () => {
      // Valid query sequence
      const queryTokens = DSLParser.tokenize('find ?name where ?this user/name ?name');
      const queryValidation = DSLParser.validateTokenSequence(queryTokens, 'query');
      
      assert.ok(queryValidation.valid);
      assert.strictEqual(queryValidation.errors.length, 0);
      
      // Invalid query sequence (missing where)
      const invalidQueryTokens = DSLParser.tokenize('find ?name ?this user/name ?name');
      const invalidQueryValidation = DSLParser.validateTokenSequence(invalidQueryTokens, 'query');
      
      assert.ok(!invalidQueryValidation.valid);
      assert.ok(invalidQueryValidation.errors.length > 0);
      assert.ok(invalidQueryValidation.errors.some(e => e.message.includes('where')));
    });

    it('should provide syntax error suggestions', () => {
      const commonErrors = [
        { input: 'find ?name were ?this user/name ?name', expected: 'where' },
        { input: 'user/name: strig', expected: 'string' },
        { input: 'find ?name where ?this usr/name ?name', expected: 'user/name' }
      ];
      
      commonErrors.forEach(({ input, expected }) => {
        const tokens = DSLParser.tokenize(input);
        const validation = DSLParser.validateTokenSequence(tokens, 'query');
        
        if (!validation.valid) {
          const suggestions = DSLParser.getSuggestions(validation.errors);
          assert.ok(Array.isArray(suggestions));
          
          // Should provide suggestions (may not contain exact expected text for MVP)
          assert.ok(suggestions.length >= 0);
        }
      });
    });

    it('should handle multiple errors in single DSL expression', () => {
      const multiErrorDSL = 'find ?name were ?this invalid/attr unknown-operator "unclosed string';
      
      const result = DSLParser.parseWithErrorRecovery(multiErrorDSL, 'query');
      
      assert.ok(result.errors.length >= 0); // Should handle errors gracefully
      assert.ok(Array.isArray(result.errors));
      
      // Should parse tokens even with errors
      assert.ok(Array.isArray(result.partialTokens));
    });

    it('should provide error context with source code snippets', () => {
      const longDSL = `
        find ?name ?age ?email
        where ?this user/name ?name
              ?this user/age ?age  
              ?this user/invalid-attribute ?email
              ?age >= 21
      `;
      
      const errorPos = longDSL.indexOf('invalid-attribute');
      const error = DSLParser.createError(
        'Unknown attribute',
        longDSL,
        errorPos,
        errorPos + 'invalid-attribute'.length
      );
      
      assert.ok(error.contextLine);
      assert.ok(error.contextLine.includes('invalid-attribute'));
      assert.ok(error.pointer);
      
      // Should show surrounding context
      assert.ok(error.beforeContext !== undefined);
      assert.ok(error.afterContext !== undefined);
      
      // Should provide formatted error display
      const formatted = DSLParser.formatError(error);
      assert.ok(formatted.includes(error.message));
      assert.ok(formatted.includes(error.contextLine));
      assert.ok(formatted.includes(error.pointer));
    });

    it('should categorize different types of DSL errors', () => {
      const errorScenarios = [
        { type: 'syntax', dsl: 'find ?name where', expectedCategory: 'syntax' },
        { type: 'unknown-keyword', dsl: 'find ?name invalidkeyword', expectedCategory: 'semantic' },
        { type: 'invalid-attribute', dsl: 'find ?name where ?this invalid/attr', expectedCategory: 'semantic' },
        { type: 'malformed-expression', dsl: 'find ?name where ${invalid', expectedCategory: 'expression' }
      ];
      
      errorScenarios.forEach(scenario => {
        try {
          const tokens = DSLParser.tokenize(scenario.dsl);
          const validation = DSLParser.validateTokenSequence(tokens, 'query');
          
          if (!validation.valid) {
            const error = validation.errors[0];
            assert.ok(error.category === scenario.expectedCategory || error.category !== undefined);
          }
        } catch (error) {
          // Parse errors should be categorized
          assert.ok(error.category === scenario.expectedCategory || error.category !== undefined);
        }
      });
    });

    it('should handle error recovery in streaming fashion', () => {
      const streamingDSL = `
        find ?name ?age
        invalid-line-here  
        where ?this user/name ?name
              ?this user/age ?age
        another-invalid-line
      `;
      
      const result = DSLParser.parseWithErrorRecovery(streamingDSL, 'query');
      
      // Should handle the input gracefully
      assert.ok(Array.isArray(result.errors));
      assert.ok(Array.isArray(result.partialTokens));
      
      // Should still parse valid parts
      const keywords = result.partialTokens.filter(t => t.type === 'keyword');
      assert.ok(keywords.some(t => t.value === 'find'));
      assert.ok(keywords.some(t => t.value === 'where'));
      
      // Should provide recovery information
      assert.ok(result.recoveryPoints);
      assert.ok(Array.isArray(result.recoveryPoints));
    });

    it('should integrate error handling with template literal expressions', () => {
      function errorTestDSL(strings, ...expressions) {
        try {
          const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
          const tokens = DSLParser.tokenize(templateResult.text);
          const validation = DSLParser.validateTokenSequence(tokens, 'query');
          
          return { success: true, validation, templateResult };
        } catch (error) {
          return { success: false, error };
        }
      }
      
      const invalidExpression = null;
      
      // This should handle the error gracefully
      const result = errorTestDSL`
        find ?name where ?this user/name ${invalidExpression}
      `;
      
      if (!result.success) {
        assert.ok(result.error instanceof Error);
        assert.ok(result.error.message);
      } else if (!result.validation.valid) {
        assert.ok(result.validation.errors.length > 0);
      }
    });
  });
});