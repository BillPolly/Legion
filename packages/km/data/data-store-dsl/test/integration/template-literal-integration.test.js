import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DSLParser } from '../../src/parser.js';
import { createDataStore, EntityProxy } from '../../../index.js';

describe('Template Literal Integration - Real JavaScript Processing', () => {
  describe('Actual Template Literal Parsing', () => {
    it('should process real JavaScript tagged template literals', () => {
      // This simulates how tagged template literals actually work
      function testDSL(strings, ...expressions) {
        return DSLParser.processTemplateLiteral(strings, expressions);
      }
      
      const userName = 'Alice';
      const userAge = 30;
      
      // Real template literal call
      const result = testDSL`Hello ${userName}, you are ${userAge} years old`;
      
      assert.strictEqual(result.text, 'Hello ${0}, you are ${1} years old');
      assert.deepStrictEqual(result.expressions, ['Alice', 30]);
      assert.ok(result.originalStrings);
    });

    it('should handle real template literals with complex expressions', () => {
      function queryDSL(strings, ...expressions) {
        return DSLParser.processTemplateLiteral(strings, expressions);
      }
      
      const user = { name: 'Bob', age: 25 };
      const threshold = 21;
      const today = new Date();
      
      const result = queryDSL`
        find ?friend-name ?friend-age
        where ?this user/friends ?friend
              ?friend user/name ${user.name}
              ?friend user/age >= ${threshold}
              ?friend user/lastActive >= ${today}
      `;
      
      assert.ok(result.text.includes('${0}'));
      assert.ok(result.text.includes('${1}'));  
      assert.ok(result.text.includes('${2}'));
      assert.strictEqual(result.expressions[0], 'Bob');
      assert.strictEqual(result.expressions[1], 21);
      assert.ok(result.expressions[2] instanceof Date);
    });

    it('should handle template literals with object and function expressions', () => {
      function updateDSL(strings, ...expressions) {
        return DSLParser.processTemplateLiteral(strings, expressions);
      }
      
      const userProxy = { entityId: 123 };
      const newTeam = { name: 'Engineering', id: 456 };
      const calculateScore = () => 85;
      
      const result = updateDSL`
        user/manager = ${userProxy}
        user/team = ${newTeam.id}
        user/score = ${calculateScore()}
      `;
      
      assert.strictEqual(result.expressions[0], userProxy);
      assert.strictEqual(result.expressions[1], 456);
      assert.strictEqual(result.expressions[2], 85);
    });

    it('should maintain expression evaluation context', () => {
      function schemaDSL(strings, ...expressions) {
        return DSLParser.processTemplateLiteral(strings, expressions);
      }
      
      const entityTypes = ['user', 'post', 'comment'];
      const defaultConstraints = { unique: 'value' };
      
      const result = schemaDSL`
        ${entityTypes[0]}/email: unique value string
        ${entityTypes[1]}/title: string
        ${entityTypes[2]}/content: string
      `;
      
      assert.strictEqual(result.expressions[0], 'user');
      assert.strictEqual(result.expressions[1], 'post');
      assert.strictEqual(result.expressions[2], 'comment');
    });

    it('should handle nested template literal calls', () => {
      function outerDSL(strings, ...expressions) {
        // Process the template literal
        const processed = DSLParser.processTemplateLiteral(strings, expressions);
        
        // Return context for testing
        return {
          processed,
          nestedCall: (innerStrings, ...innerExpressions) => {
            return DSLParser.processTemplateLiteral(innerStrings, innerExpressions);
          }
        };
      }
      
      const userName = 'Charlie';
      const outer = outerDSL`user ${userName} has friends`;
      
      // Nested call
      const friendName = 'David';
      const nested = outer.nestedCall`friend ${friendName} likes posts`;
      
      assert.strictEqual(outer.processed.expressions[0], 'Charlie');
      assert.strictEqual(nested.expressions[0], 'David');
      assert.ok(outer.processed.text.includes('${0}'));
      assert.ok(nested.text.includes('${0}'));
    });
  });

  describe('Template Literal Function Implementation', () => {
    it('should implement tagged template literal function correctly', () => {
      // Create a real tagged template literal function
      function testTaggedFunction(strings, ...expressions) {
        // Validate the structure matches JavaScript's tagged template literal spec
        assert.ok(Array.isArray(strings));
        assert.ok(Array.isArray(expressions));
        assert.strictEqual(strings.length, expressions.length + 1);
        
        // Process with DSL parser
        return DSLParser.processTemplateLiteral(strings, expressions);
      }
      
      // Real usage
      const name = 'Test';
      const age = 25;
      
      const result = testTaggedFunction`name is ${name} and age is ${age}`;
      
      assert.strictEqual(result.text, 'name is ${0} and age is ${1}');
      assert.deepStrictEqual(result.expressions, ['Test', 25]);
    });

    it('should work with real data-store entities and proxies', () => {
      
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      function entityDSL(strings, ...expressions) {
        const result = DSLParser.processTemplateLiteral(strings, expressions);
        
        // Verify we can work with real entities
        expressions.forEach(expr => {
          if (expr instanceof EntityProxy) {
            assert.ok(expr.entityId);
            assert.ok(expr.store);
          }
        });
        
        return result;
      }
      
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const bobProxy = new EntityProxy(bob.entityId, store);
      
      const result = entityDSL`user ${aliceProxy} is friends with ${bobProxy}`;
      
      assert.strictEqual(result.expressions[0], aliceProxy);
      assert.strictEqual(result.expressions[1], bobProxy);
      assert.ok(result.expressions[0] instanceof EntityProxy);
      assert.ok(result.expressions[1] instanceof EntityProxy);
    });

    it('should handle real template literal edge cases', () => {
      function edgeCaseDSL(strings, ...expressions) {
        return DSLParser.processTemplateLiteral(strings, expressions);
      }
      
      // Empty template
      const empty = edgeCaseDSL``;
      assert.strictEqual(empty.text, '');
      assert.strictEqual(empty.expressions.length, 0);
      
      // Only expression
      const name = 'Alice';
      const onlyExpr = edgeCaseDSL`${name}`;
      assert.strictEqual(onlyExpr.text, '${0}');
      assert.strictEqual(onlyExpr.expressions[0], 'Alice');
      
      // Whitespace handling
      const whitespace = edgeCaseDSL`   spaces   ${42}   more spaces   `;
      assert.ok(whitespace.text.includes('   spaces   ${0}   more spaces   '));
      assert.strictEqual(whitespace.expressions[0], 42);
    });

    it('should work with async expressions and promises', async () => {
      function asyncDSL(strings, ...expressions) {
        // Handle promises and async expressions
        const processedExpressions = expressions.map(expr => {
          if (expr instanceof Promise) {
            // For testing, we'll handle synchronously
            // In real implementation, this might need special handling
            return '[Promise]';
          }
          return expr;
        });
        
        return DSLParser.processTemplateLiteral(strings, processedExpressions);
      }
      
      const asyncValue = Promise.resolve('async-result');
      const syncValue = 'sync-result';
      
      const result = asyncDSL`async: ${asyncValue}, sync: ${syncValue}`;
      
      assert.strictEqual(result.expressions[0], '[Promise]');
      assert.strictEqual(result.expressions[1], 'sync-result');
    });

    it('should handle template literals with special characters', () => {
      function specialCharDSL(strings, ...expressions) {
        return DSLParser.processTemplateLiteral(strings, expressions);
      }
      
      const query = 'user/name = "Alice O\'Brien"';
      const content = 'Text with\nnewlines and\ttabs';
      const unicode = '测试 Unicode 🚀';
      
      const result = specialCharDSL`
        Query: ${query}
        Content: ${content}
        Unicode: ${unicode}
      `;
      
      assert.strictEqual(result.expressions[0], query);
      assert.strictEqual(result.expressions[1], content);
      assert.strictEqual(result.expressions[2], unicode);
      assert.ok(result.text.includes('${0}'));
      assert.ok(result.text.includes('${1}'));
      assert.ok(result.text.includes('${2}'));
    });
  });

  describe('Token Processing Integration', () => {
    it('should tokenize complete template literal results', () => {
      function tokenizingDSL(strings, ...expressions) {
        const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
        return DSLParser.tokenize(templateResult.text);
      }
      
      const userName = 'Alice';
      const userAge = 30;
      
      const tokens = tokenizingDSL`
        find ?name ?age  
        where ?this user/name ${userName}
              ?this user/age >= ${userAge}
      `;
      
      // Should have tokens for all parts including expressions
      assert.ok(tokens.some(t => t.type === 'keyword' && t.value === 'find'));
      assert.ok(tokens.some(t => t.type === 'variable' && t.value === '?name'));
      assert.ok(tokens.some(t => t.type === 'attribute' && t.value === 'user/name'));
      assert.ok(tokens.some(t => t.type === 'expression' && t.index === 0));
      assert.ok(tokens.some(t => t.type === 'expression' && t.index === 1));
      assert.ok(tokens.some(t => t.type === 'operator' && t.value === '>='));
    });

    it('should handle tokenization with real data-store expressions', () => {
      function entityTokenizingDSL(strings, ...expressions) {
        const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
        const tokens = DSLParser.tokenize(templateResult.text);
        
        // Return both tokens and expressions for verification
        return { tokens, expressions: templateResult.expressions };
      }
      
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const friendAge = 25;
      
      const result = entityTokenizingDSL`
        update user/manager = ${aliceProxy}
               user/minAge = ${friendAge}
               user/active = true
      `;
      
      // Verify tokenization worked correctly
      assert.ok(result.tokens.some(t => t.type === 'keyword' && t.value === 'update'));
      assert.ok(result.tokens.some(t => t.type === 'attribute' && t.value === 'user/manager'));
      assert.ok(result.tokens.some(t => t.type === 'expression' && t.index === 0));
      assert.ok(result.tokens.some(t => t.type === 'expression' && t.index === 1));
      assert.ok(result.tokens.some(t => t.type === 'boolean' && t.value === true));
      
      // Verify expressions are preserved
      assert.strictEqual(result.expressions[0], aliceProxy);
      assert.strictEqual(result.expressions[1], 25);
    });

    it('should handle complex tokenization scenarios', () => {
      function complexTokenizingDSL(strings, ...expressions) {
        const templateResult = DSLParser.processTemplateLiteral(strings, expressions);
        return {
          templateResult,
          tokens: DSLParser.tokenize(templateResult.text)
        };
      }
      
      const currentDate = new Date();
      const scoreThreshold = 85.5;
      const departments = ['Engineering', 'Design'];
      
      const result = complexTokenizingDSL`
        find ?employee-name ?department ?score ?hire-date
        where ?this company/employees ?employee
              ?employee employee/name ?employee-name
              ?employee employee/department ?department  
              ?employee employee/score >= ${scoreThreshold}
              ?employee employee/hireDate >= ${currentDate}
              ?department in ${departments}
      `;
      
      // Verify complex tokenization
      const tokens = result.tokens;
      
      assert.ok(tokens.some(t => t.type === 'keyword' && t.value === 'find'));
      assert.ok(tokens.some(t => t.type === 'variable' && t.value === '?employee-name'));
      assert.ok(tokens.some(t => t.type === 'attribute' && t.value === 'company/employees'));
      assert.ok(tokens.some(t => t.type === 'operator' && t.value === '>='));
      assert.ok(tokens.some(t => t.type === 'keyword' && t.value === 'in'));
      
      // Should have expression placeholders
      const expressionTokens = tokens.filter(t => t.type === 'expression');
      assert.strictEqual(expressionTokens.length, 3);
      
      // Verify expressions correspond correctly
      assert.strictEqual(result.templateResult.expressions[0], scoreThreshold);
      assert.strictEqual(result.templateResult.expressions[1], currentDate);
      assert.deepStrictEqual(result.templateResult.expressions[2], departments);
    });

    it('should integrate tokenization with template literal context', () => {
      function contextualTokenizingDSL(strings, ...expressions) {
        const context = DSLParser.createTemplateLiteralContext(strings, expressions);
        const tokens = DSLParser.tokenize(context.text);
        
        return {
          context,
          tokens,
          analysis: DSLParser.analyzeTokens(tokens, context)
        };
      }
      
      const entityRef = { entityId: 123 };
      const threshold = 50;
      
      const result = contextualTokenizingDSL`
        user/score >= ${threshold}
        user/manager = ${entityRef}  
      `;
      
      // Verify integration
      assert.ok(result.context.type === 'template-literal');
      assert.ok(Array.isArray(result.tokens));
      assert.ok(result.analysis);
      
      // Analysis should provide useful information
      assert.ok(result.analysis.hasVariables !== undefined);
      assert.ok(result.analysis.hasExpressions !== undefined);
      assert.ok(result.analysis.tokenCount > 0);
      assert.ok(result.analysis.complexity >= 0);
    });
  });
});