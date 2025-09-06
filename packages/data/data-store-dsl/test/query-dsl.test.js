import { describe, it } from 'node:test';
import assert from 'node:assert';
import { query } from '../src/query-dsl.js';
import { DSLParser } from '../src/parser.js';

describe('Query DSL - Structure Parser', () => {
  describe('Find Clause Parsing', () => {
    it('should parse simple find clauses', () => {
      const queryText = 'find ?name ?age';
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      
      assert.ok(parsed);
      assert.ok(parsed.find);
      assert.deepStrictEqual(parsed.find, ['?name', '?age']);
      assert.strictEqual(parsed.where, null);
    });

    it('should parse find clauses with aggregations', () => {
      const queryText = 'find ?name (count ?friend) (avg ?score)';
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      
      assert.ok(parsed.find);
      assert.ok(parsed.find.includes('?name'));
      assert.ok(parsed.find.some(item => Array.isArray(item) && item[0] === '(count ?friend)'));
      assert.ok(parsed.find.some(item => Array.isArray(item) && item[0] === '(avg ?score)'));
    });

    it('should handle find clauses with aliases', () => {
      const queryText = 'find ?name as userName, (count ?friend) as friendCount';
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      
      assert.ok(parsed.find);
      assert.ok(parsed.aliases);
      assert.strictEqual(parsed.aliases['?name'], 'userName');
      assert.strictEqual(parsed.aliases['(count ?friend)'], 'friendCount');
    });

    it('should validate find clause syntax', () => {
      const invalidFinds = [
        'find', // No variables
        'find name age', // Missing ? prefix
        'find ?name ?', // Incomplete variable
        'find ?name (invalid-function)' // Invalid function
      ];
      
      invalidFinds.forEach(queryText => {
        assert.throws(() => {
          DSLParser.parseQueryStructure(queryText);
        }, Error, `Should throw for: ${queryText}`);
      });
    });

    it('should extract variables from find clause', () => {
      const queryText = 'find ?name ?age ?email (count ?friend)';
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      const variables = DSLParser.extractVariables(parsed.find);
      
      assert.ok(variables.includes('?name'));
      assert.ok(variables.includes('?age'));
      assert.ok(variables.includes('?email'));
      assert.ok(variables.includes('?friend')); // From aggregation
    });
  });

  describe('Where Clause Parsing', () => {
    it('should parse basic where clauses', () => {
      const queryText = 'find ?name where ?this user/name ?name';
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      
      assert.ok(parsed.where);
      assert.ok(Array.isArray(parsed.where));
      assert.strictEqual(parsed.where.length, 1);
      
      const whereClause = parsed.where[0];
      assert.deepStrictEqual(whereClause, ['?this', 'user/name', '?name']);
    });

    it('should parse multiple where clauses', () => {
      const queryText = `
        find ?name ?age
        where ?this user/name ?name
              ?this user/age ?age
              ?this user/active true
      `;
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      
      assert.ok(parsed.where);
      assert.strictEqual(parsed.where.length, 3);
      
      assert.deepStrictEqual(parsed.where[0], ['?this', 'user/name', '?name']);
      assert.deepStrictEqual(parsed.where[1], ['?this', 'user/age', '?age']);
      assert.deepStrictEqual(parsed.where[2], ['?this', 'user/active', true]);
    });

    it('should handle where clauses with literal values', () => {
      const queryText = `
        find ?name
        where ?this user/name ?name
              ?this user/active true
              ?this user/age 30
              ?this user/department "Engineering"
      `;
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      
      assert.strictEqual(parsed.where.length, 4);
      assert.deepStrictEqual(parsed.where[1], ['?this', 'user/active', true]);
      assert.deepStrictEqual(parsed.where[2], ['?this', 'user/age', 30]);
      assert.deepStrictEqual(parsed.where[3], ['?this', 'user/department', 'Engineering']);
    });

    it('should parse relationship traversal in where clauses', () => {
      const queryText = `
        find ?friend-name ?friend-age
        where ?this user/friends ?friend
              ?friend user/name ?friend-name
              ?friend user/age ?friend-age
      `;
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      
      assert.strictEqual(parsed.where.length, 3);
      assert.deepStrictEqual(parsed.where[0], ['?this', 'user/friends', '?friend']);
      assert.deepStrictEqual(parsed.where[1], ['?friend', 'user/name', '?friend-name']);
      assert.deepStrictEqual(parsed.where[2], ['?friend', 'user/age', '?friend-age']);
    });

    it('should handle missing where clause', () => {
      const queryText = 'find ?name ?age';
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      
      // Simple find without where should be valid for some queries
      assert.ok(parsed.find);
      assert.strictEqual(parsed.where, null);
    });

    it('should validate where clause syntax', () => {
      const invalidWheres = [
        'find ?name where', // Incomplete where
        'find ?name where ?this', // Missing attribute and value
        'find ?name where ?this user/name', // Missing value
        'find ?name where user/name ?name' // Missing entity
      ];
      
      invalidWheres.forEach(queryText => {
        assert.throws(() => {
          DSLParser.parseQueryStructure(queryText);
        }, Error, `Should throw for: ${queryText}`);
      });
    });
  });

  describe('Variable Extraction', () => {
    it('should extract all variables from query', () => {
      const queryText = `
        find ?name ?age ?email
        where ?this user/name ?name
              ?this user/age ?age
              ?this user/profile ?profile
              ?profile profile/email ?email
      `;
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      const allVariables = DSLParser.extractAllVariables(parsed);
      
      assert.ok(allVariables.includes('?name'));
      assert.ok(allVariables.includes('?age'));
      assert.ok(allVariables.includes('?email'));
      assert.ok(allVariables.includes('?this'));
      assert.ok(allVariables.includes('?profile'));
    });

    it('should identify bound vs unbound variables', () => {
      const queryText = `
        find ?name ?age
        where ?this user/name ?name
              ?this user/age ?unbound-age
      `;
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      const analysis = DSLParser.analyzeVariables(parsed);
      
      assert.ok(analysis.bound.includes('?name')); // In find clause
      assert.ok(analysis.unbound.includes('?unbound-age')); // Not in find clause
      assert.ok(analysis.bound.includes('?this')); // Special variable
    });

    it('should track variable usage patterns', () => {
      const queryText = `
        find ?name ?friend-name
        where ?this user/friends ?friend
              ?friend user/name ?friend-name
              ?this user/name ?name
      `;
      
      const parsed = DSLParser.parseQueryStructure(queryText);
      const usage = DSLParser.analyzeVariableUsage(parsed);
      
      assert.ok(usage['?this'] >= 2); // Used multiple times
      assert.ok(usage['?friend'] >= 2); // Used for binding and traversal
      assert.strictEqual(usage['?name'], 2); // Find and where
      assert.strictEqual(usage['?friend-name'], 2); // Find and where
    });
  });

  describe('Query to DataScript Conversion', () => {
    it('should convert simple queries to DataScript format', () => {
      const queryText = 'find ?name where ?this user/name ?name';
      
      const dataScriptQuery = DSLParser.queryToDataScript(queryText);
      
      assert.deepStrictEqual(dataScriptQuery, {
        find: ['?name'],
        where: [['?this', ':user/name', '?name']]
      });
    });

    it('should convert complex queries with multiple clauses', () => {
      const queryText = `
        find ?friend-name ?friend-age
        where ?this user/friends ?friend
              ?friend user/name ?friend-name
              ?friend user/age ?friend-age
              ?friend user/active true
      `;
      
      const dataScriptQuery = DSLParser.queryToDataScript(queryText);
      
      assert.deepStrictEqual(dataScriptQuery.find, ['?friend-name', '?friend-age']);
      assert.strictEqual(dataScriptQuery.where.length, 4);
      
      // Check namespace conversion (user/name -> :user/name)
      assert.ok(dataScriptQuery.where.some(clause => 
        clause[1] === ':user/name'
      ));
      assert.ok(dataScriptQuery.where.some(clause => 
        clause[1] === ':user/age'
      ));
      assert.ok(dataScriptQuery.where.some(clause => 
        clause[1] === ':user/active'
      ));
    });

    it('should handle aggregations in DataScript conversion', () => {
      const queryText = 'find ?name (count ?friend) where ?this user/name ?name';
      
      const dataScriptQuery = DSLParser.queryToDataScript(queryText);
      
      assert.ok(dataScriptQuery.find.includes('?name'));
      assert.ok(dataScriptQuery.find.some(item => 
        Array.isArray(item) && item[0] === '(count ?friend)'
      ));
    });

    it('should preserve ?this variable in conversion', () => {
      const queryText = `
        find ?name ?friend-name
        where ?this user/name ?name
              ?this user/friends ?friend
              ?friend user/name ?friend-name
      `;
      
      const dataScriptQuery = DSLParser.queryToDataScript(queryText);
      
      // ?this should remain as-is (will be bound by EntityProxy)
      assert.ok(dataScriptQuery.where.some(clause => clause[0] === '?this'));
    });

    it('should handle empty where clauses', () => {
      const queryText = 'find ?this';
      
      const dataScriptQuery = DSLParser.queryToDataScript(queryText);
      
      assert.deepStrictEqual(dataScriptQuery, {
        find: ['?this'],
        where: []
      });
    });
  });

  describe('Query Template Literal Function', () => {
    it('should create query tagged template literal function', () => {
      // Test that query function works as tagged template literal
      const userName = 'Alice';
      
      const queryResult = query`
        find ?name ?age
        where ?this user/name ${userName}
              ?this user/age ?age
      `;
      
      assert.ok(queryResult);
      assert.ok(queryResult.find);
      assert.ok(queryResult.where);
      
      // Should be DataScript compatible
      assert.deepStrictEqual(queryResult.find, ['?name', '?age']);
      assert.ok(queryResult.where.some(clause => 
        clause[0] === '?this' && clause[1] === ':user/name'
      ));
    });

    it('should handle expressions in query template literals', () => {
      const minAge = 25;
      const department = 'Engineering';
      
      const queryResult = query`
        find ?name ?age
        where ?this user/name ?name
              ?this user/age ?age
              ?this user/department ${department}
              ?age >= ${minAge}
      `;
      
      assert.ok(queryResult.find);
      assert.ok(queryResult.where);
      
      // Expressions should be properly substituted
      assert.ok(queryResult.where.some(clause => 
        clause[2] === 'Engineering'
      ));
    });

    it('should validate query template literal structure', () => {
      // Valid queries
      assert.doesNotThrow(() => {
        query`find ?name where ?this user/name ?name`;
      });
      
      assert.doesNotThrow(() => {
        query`
          find ?name ?age
          where ?this user/name ?name
                ?this user/age ?age
        `;
      });
      
      // Invalid queries should throw
      assert.throws(() => {
        query`where ?this user/name ?name`; // Missing find
      }, Error);
      
      assert.throws(() => {
        query`find where ?this user/name ?name`; // Missing variables
      }, Error);
    });

    it('should return DataScript-compatible query objects', () => {
      const queryResult = query`
        find ?friend-name
        where ?this user/friends ?friend
              ?friend user/name ?friend-name
      `;
      
      // Should match DataScript query object format
      assert.ok(Array.isArray(queryResult.find));
      assert.ok(Array.isArray(queryResult.where));
      
      queryResult.where.forEach(clause => {
        assert.ok(Array.isArray(clause));
        assert.strictEqual(clause.length, 3);
        
        // Should have namespace conversion
        if (typeof clause[1] === 'string' && clause[1].includes('/')) {
          assert.ok(clause[1].startsWith(':'));
        }
      });
    });

    it('should handle complex query structures', () => {
      const queryResult = query`
        find ?colleague-name ?department-name ?project-count
        where ?this user/department ?dept
              ?dept department/name ?department-name
              ?dept department/employees ?colleague
              ?colleague user/name ?colleague-name
              ?colleague user/projects ?project
              (count ?project) ?project-count
      `;
      
      assert.ok(queryResult.find);
      assert.ok(queryResult.where);
      assert.ok(queryResult.find.includes('?colleague-name'));
      assert.ok(queryResult.find.includes('?department-name'));
      assert.ok(queryResult.find.includes('?project-count'));
      
      // Verify relationship traversal parsing
      assert.ok(queryResult.where.some(clause => 
        clause[0] === '?this' && clause[1] === ':user/department'
      ));
      assert.ok(queryResult.where.some(clause => 
        clause[0] === '?dept' && clause[1] === ':department/employees'
      ));
    });

    it('should handle empty and whitespace in queries', () => {
      const queryWithWhitespace = query`
        
        find    ?name    ?age
        
        where   ?this   user/name   ?name
                ?this   user/age    ?age
        
      `;
      
      assert.deepStrictEqual(queryWithWhitespace.find, ['?name', '?age']);
      assert.strictEqual(queryWithWhitespace.where.length, 2);
    });

    it('should provide query parsing error information', () => {
      const invalidQueries = [
        'find ?name where ?this', // Incomplete where clause
        'find where ?this user/name ?name', // Missing find variables
        'find ?name where ?this invalid-attribute' // Invalid where structure
      ];
      
      invalidQueries.forEach(queryText => {
        assert.throws(() => {
          DSLParser.parseQueryStructure(queryText);
        }, error => {
          // Error should have helpful information
          assert.ok(error.message);
          return true;
        });
      });
    });

    it('should handle query expressions with interpolation', () => {
      const entityAttribute = 'user/name';
      const searchValue = 'Alice';
      
      // This tests expression substitution in query parsing
      const queryText = `find ?name where ?this ${entityAttribute} ${searchValue}`;
      const substituted = DSLParser._substituteExpressions(queryText, [entityAttribute, searchValue]);
      
      assert.ok(substituted.includes('user/name'));
      assert.ok(substituted.includes('Alice'));
      
      const parsed = DSLParser.parseQueryStructure(substituted);
      assert.ok(parsed.where.some(clause => clause[2] === 'Alice'));
    });

    it('should convert namespace format correctly', () => {
      const queryText = `
        find ?name ?email ?age
        where ?this user/name ?name
              ?this user/email ?email
              ?this profile/age ?age
      `;
      
      const dataScriptQuery = DSLParser.queryToDataScript(queryText);
      
      // All attributes should have : prefix
      dataScriptQuery.where.forEach(clause => {
        if (typeof clause[1] === 'string' && clause[1].includes('/')) {
          assert.ok(clause[1].startsWith(':'), `Attribute ${clause[1]} should start with ':'`);
        }
      });
    });

    it('should preserve complex query structure through conversion', () => {
      const complexQuery = query`
        find ?mutual-friend ?mutual-name
        where ?this user/friends ?friend
              ?friend user/friends ?mutual-friend
              ?this user/friends ?mutual-friend
              ?mutual-friend user/name ?mutual-name
              ?mutual-friend != ?this
      `;
      
      assert.ok(complexQuery.find.includes('?mutual-friend'));
      assert.ok(complexQuery.find.includes('?mutual-name'));
      assert.ok(complexQuery.where.length >= 4);
      
      // Should preserve all relationship traversals
      assert.ok(complexQuery.where.some(clause => 
        clause[0] === '?this' && clause[1] === ':user/friends' && clause[2] === '?friend'
      ));
      assert.ok(complexQuery.where.some(clause => 
        clause[0] === '?friend' && clause[1] === ':user/friends' && clause[2] === '?mutual-friend'
      ));
    });
  });
});