import { describe, it } from 'node:test';
import assert from 'node:assert';
import { update } from '../src/update-dsl.js';
import { DSLParser } from '../src/parser.js';

describe('Update DSL - Assignment Statement Parser', () => {
  describe('Assignment Parsing', () => {
    it('should parse simple assignment statements', () => {
      const updateText = 'user/name = "Alice"';
      
      const parsed = DSLParser.parseUpdateStatement(updateText);
      
      assert.ok(parsed);
      assert.ok(Array.isArray(parsed.assignments));
      assert.strictEqual(parsed.assignments.length, 1);
      
      const assignment = parsed.assignments[0];
      assert.strictEqual(assignment.attribute, 'user/name');
      assert.strictEqual(assignment.operator, '=');
      assert.strictEqual(assignment.value, 'Alice');
      assert.strictEqual(assignment.type, 'assignment');
    });

    it('should parse multiple assignment statements', () => {
      const updateText = `
        user/name = "Alice Smith"
        user/age = 31
        user/active = true
      `;
      
      const parsed = DSLParser.parseUpdateStatement(updateText);
      
      assert.strictEqual(parsed.assignments.length, 3);
      
      const assignments = parsed.assignments;
      assert.strictEqual(assignments[0].attribute, 'user/name');
      assert.strictEqual(assignments[0].value, 'Alice Smith');
      
      assert.strictEqual(assignments[1].attribute, 'user/age');
      assert.strictEqual(assignments[1].value, 31);
      
      assert.strictEqual(assignments[2].attribute, 'user/active');
      assert.strictEqual(assignments[2].value, true);
    });

    it('should handle different value types in assignments', () => {
      const updateText = `
        user/name = "String Value"
        user/age = 42
        user/score = 95.5
        user/active = true
        user/inactive = false
        user/tags = ["tag1", "tag2", "tag3"]
      `;
      
      const parsed = DSLParser.parseUpdateStatement(updateText);
      
      assert.strictEqual(parsed.assignments.length, 6);
      
      const assignments = parsed.assignments;
      assert.strictEqual(assignments[0].value, 'String Value');
      assert.strictEqual(assignments[1].value, 42);
      assert.strictEqual(assignments[2].value, 95.5);
      assert.strictEqual(assignments[3].value, true);
      assert.strictEqual(assignments[4].value, false);
      assert.deepStrictEqual(assignments[5].value, ['tag1', 'tag2', 'tag3']);
    });

    it('should extract attribute and value information', () => {
      const assignments = [
        { text: 'user/name = "Alice"', attr: 'user/name', val: 'Alice' },
        { text: 'post/published = true', attr: 'post/published', val: true },
        { text: 'user/age = 30', attr: 'user/age', val: 30 }
      ];
      
      assignments.forEach(({ text, attr, val }) => {
        const parsed = DSLParser.parseUpdateStatement(text);
        assert.strictEqual(parsed.assignments.length, 1);
        
        const assignment = parsed.assignments[0];
        assert.strictEqual(assignment.attribute, attr);
        assert.strictEqual(assignment.value, val);
      });
    });

    it('should validate assignment statement syntax', () => {
      const invalidAssignments = [
        'user/name =', // Missing value
        '= "Alice"', // Missing attribute  
        'user/name "Alice"', // Missing operator
        'user/name === "Alice"', // Invalid operator
        'user/name = = "Alice"' // Double operator
      ];
      
      invalidAssignments.forEach(text => {
        assert.throws(() => {
          DSLParser.parseUpdateStatement(text);
        }, Error, `Should throw for: ${text}`);
      });
    });

    it('should handle assignment type recognition', () => {
      const typeTests = [
        { text: 'user/name = "Alice"', expectedType: 'string' },
        { text: 'user/age = 30', expectedType: 'number' },
        { text: 'user/active = true', expectedType: 'boolean' },
        { text: 'user/tags = ["a", "b"]', expectedType: 'array' }
      ];
      
      typeTests.forEach(({ text, expectedType }) => {
        const parsed = DSLParser.parseUpdateStatement(text);
        const assignment = parsed.assignments[0];
        
        assert.strictEqual(assignment.valueType, expectedType);
      });
    });

    it('should handle expression placeholders in assignments', () => {
      const updateText = `
        user/name = \${0}
        user/age = \${1}
        user/manager = \${2}
      `;
      
      const parsed = DSLParser.parseUpdateStatement(updateText);
      
      assert.strictEqual(parsed.assignments.length, 3);
      
      parsed.assignments.forEach((assignment, index) => {
        assert.strictEqual(assignment.valueType, 'expression');
        assert.strictEqual(assignment.expressionIndex, index);
      });
    });

    it('should convert assignments to transaction format', () => {
      const updateText = `
        user/name = "Alice Smith"
        user/age = 31
        user/active = true
      `;
      
      const transactionData = DSLParser.updateToTransaction(updateText);
      
      assert.ok(transactionData);
      assert.strictEqual(transactionData[':user/name'], 'Alice Smith');
      assert.strictEqual(transactionData[':user/age'], 31);
      assert.strictEqual(transactionData[':user/active'], true);
    });

    it('should preserve assignment order in parsing', () => {
      const updateText = `
        user/name = "Alice"
        user/email = "alice@example.com"
        user/age = 30
        user/bio = "Software Engineer"
      `;
      
      const parsed = DSLParser.parseUpdateStatement(updateText);
      
      // Assignments should be in order
      const attributes = parsed.assignments.map(a => a.attribute);
      assert.deepStrictEqual(attributes, ['user/name', 'user/email', 'user/age', 'user/bio']);
      
      const values = parsed.assignments.map(a => a.value);
      assert.deepStrictEqual(values, ['Alice', 'alice@example.com', 30, 'Software Engineer']);
    });

    it('should handle assignment parsing errors gracefully', () => {
      const errorTests = [
        { text: 'invalid-format', error: 'format' },
        { text: 'user/name =', error: 'missing value' },
        { text: 'user/name = "unclosed', error: 'unclosed string' }
      ];
      
      errorTests.forEach(({ text, error }) => {
        assert.throws(() => {
          DSLParser.parseUpdateStatement(text);
        }, err => {
          assert.ok(err.message);
          return true; // Just verify error is thrown with message
        });
      });
    });
  });

  describe('Relationship Operations', () => {
    it('should parse relationship addition operations', () => {
      const updateText = '+user/friends = "friend-id"';
      
      const parsed = DSLParser.parseUpdateStatement(updateText);
      
      assert.strictEqual(parsed.assignments.length, 1);
      
      const assignment = parsed.assignments[0];
      assert.strictEqual(assignment.attribute, 'user/friends');
      assert.strictEqual(assignment.operator, '+');
      assert.strictEqual(assignment.value, 'friend-id');
      assert.strictEqual(assignment.type, 'relationship-add');
    });

    it('should parse relationship removal operations', () => {
      const updateText = '-user/friends = "friend-id"';
      
      const parsed = DSLParser.parseUpdateStatement(updateText);
      
      const assignment = parsed.assignments[0];
      assert.strictEqual(assignment.attribute, 'user/friends');
      assert.strictEqual(assignment.operator, '-');
      assert.strictEqual(assignment.value, 'friend-id');
      assert.strictEqual(assignment.type, 'relationship-remove');
    });

    it('should handle mixed assignment and relationship operations', () => {
      const updateText = `
        user/name = "Alice Smith"
        +user/friends = "friend-1"
        +user/tags = "expert"
        -user/oldTags = "beginner"
        user/manager = "manager-id"
      `;
      
      const parsed = DSLParser.parseUpdateStatement(updateText);
      
      assert.strictEqual(parsed.assignments.length, 5);
      
      const types = parsed.assignments.map(a => a.type);
      assert.ok(types.includes('assignment'));
      assert.ok(types.includes('relationship-add'));
      assert.ok(types.includes('relationship-remove'));
      
      const operators = parsed.assignments.map(a => a.operator);
      assert.ok(operators.includes('='));
      assert.ok(operators.includes('+'));
      assert.ok(operators.includes('-'));
    });

    it('should validate relationship operation syntax', () => {
      const invalidRelationships = [
        '+user/friends =', // Missing value
        '+= "friend-id"', // Missing attribute
        'user/friends +', // Wrong operator position
        '++user/friends = "friend-id"' // Double operator
      ];
      
      invalidRelationships.forEach(text => {
        assert.throws(() => {
          DSLParser.parseUpdateStatement(text);
        }, Error, `Should throw for: ${text}`);
      });
    });

    it('should convert relationships to DataScript transactions', () => {
      const updateText = `
        user/name = "Alice"
        +user/friends = "friend-1" 
        -user/oldFriends = "friend-2"
      `;
      
      const transactions = DSLParser.updateToTransactions(updateText);
      
      assert.ok(Array.isArray(transactions));
      
      // Should have both update and relationship transactions
      const updateTx = transactions.find(tx => tx[':user/name']);
      assert.ok(updateTx);
      assert.strictEqual(updateTx[':user/name'], 'Alice');
      
      const addTx = transactions.find(tx => Array.isArray(tx) && tx[0] === '+');
      const removeTx = transactions.find(tx => Array.isArray(tx) && tx[0] === '-');
      
      if (addTx) {
        assert.deepStrictEqual(addTx, ['+', null, ':user/friends', 'friend-1']); // null will be entity ID
      }
      
      if (removeTx) {
        assert.deepStrictEqual(removeTx, ['-', null, ':user/oldFriends', 'friend-2']);
      }
    });
  });

  describe('update Template Literal Function', () => {
    it('should create update tagged template literal function', () => {
      const userName = 'Alice Smith';
      const userAge = 31;
      
      const updateResult = update`
        user/name = ${userName}
        user/age = ${userAge}
        user/active = true
      `;
      
      assert.ok(updateResult);
      assert.ok(typeof updateResult === 'object');
      
      // Should convert to transaction data format
      assert.strictEqual(updateResult[':user/name'], 'Alice Smith');
      assert.strictEqual(updateResult[':user/age'], 31);
      assert.strictEqual(updateResult[':user/active'], true);
    });

    it('should handle expressions in update template literals', () => {
      const currentCount = 5;
      const newTeam = { entityId: 123 };
      const timestamp = new Date();
      
      const updateResult = update`
        user/loginCount = ${currentCount + 1}
        user/team = ${newTeam.entityId}
        user/lastLogin = ${timestamp}
      `;
      
      assert.strictEqual(updateResult[':user/loginCount'], 6);
      assert.strictEqual(updateResult[':user/team'], 123);
      assert.strictEqual(updateResult[':user/lastLogin'], timestamp);
    });

    it('should handle relationship operations in template literals', () => {
      const friend1 = { entityId: 111 };
      const friend2 = { entityId: 222 };
      const oldFriend = { entityId: 333 };
      
      const updateResult = update`
        user/name = "Alice"
        +user/friends = ${friend1.entityId}
        +user/friends = ${friend2.entityId}
        -user/friends = ${oldFriend.entityId}
      `;
      
      // Should return both update data and relationship operations
      assert.ok(updateResult.updateData);
      assert.ok(updateResult.relationships);
      
      assert.strictEqual(updateResult.updateData[':user/name'], 'Alice');
      
      const additions = updateResult.relationships.filter(r => r[0] === '+');
      const removals = updateResult.relationships.filter(r => r[0] === '-');
      
      assert.strictEqual(additions.length, 2);
      assert.strictEqual(removals.length, 1);
    });

    it('should validate update template literal input', () => {
      // Valid updates
      assert.doesNotThrow(() => {
        update`user/name = "Alice"`;
      });
      
      assert.doesNotThrow(() => {
        update`
          user/name = "Alice"
          user/age = 30
          +user/friends = "friend-id"
        `;
      });
      
      // Invalid updates should throw
      assert.throws(() => {
        update`user/name =`; // Missing value
      }, Error);
      
      assert.throws(() => {
        update`= "Alice"`; // Missing attribute
      }, Error);
    });

    it('should convert to data-store compatible format', () => {
      const updateResult = update`
        user/name = "Alice"
        user/age = 30
        user/active = true
      `;
      
      // Should be compatible with EntityProxy.update()
      assert.ok(typeof updateResult === 'object');
      assert.ok(updateResult[':user/name']);
      assert.ok(updateResult[':user/age']);
      assert.ok(updateResult[':user/active']);
      
      // All attributes should have namespace prefix
      Object.keys(updateResult).forEach(key => {
        if (key.includes('/')) {
          assert.ok(key.startsWith(':'));
        }
      });
    });

    it('should handle empty update statements', () => {
      const emptyUpdate = update``;
      
      // Empty update should return empty object
      assert.deepStrictEqual(emptyUpdate, {});
    });

    it('should handle complex update expressions', () => {
      const currentScore = 85;
      const bonusPoints = 10;
      const userRank = 'senior';
      
      const updateResult = update`
        user/score = ${currentScore + bonusPoints}
        user/rank = ${userRank.toUpperCase()}
        user/lastUpdate = ${Date.now()}
      `;
      
      assert.strictEqual(updateResult[':user/score'], 95);
      assert.strictEqual(updateResult[':user/rank'], 'SENIOR');
      assert.ok(typeof updateResult[':user/lastUpdate'] === 'number');
    });

    it('should provide update parsing error information', () => {
      const invalidUpdates = [
        'user/name', // Missing operator and value
        'user/name = = "Alice"', // Double operator
        'invalid-attribute = "value"' // Invalid attribute format
      ];
      
      invalidUpdates.forEach(updateText => {
        assert.throws(() => {
          DSLParser.parseUpdateStatement(updateText);
        }, error => {
          assert.ok(error.message);
          return true;
        });
      });
    });

    it('should handle update expression interpolation', () => {
      const userName = 'Alice';
      const userAge = 30;
      
      // Test expression substitution
      const updateText = `user/name = \${0}, user/age = \${1}`;
      const substituted = DSLParser._substituteExpressions(updateText, [userName, userAge]);
      
      assert.ok(substituted.includes('Alice'));
      assert.ok(substituted.includes('30'));
      
      const parsed = DSLParser.parseUpdateStatement(substituted);
      assert.strictEqual(parsed.assignments[0].value, 'Alice');
      assert.strictEqual(parsed.assignments[1].value, 30);
    });

    it('should convert to DataScript transaction data', () => {
      const updateText = `
        user/name = "Alice Smith"
        user/age = 31
        +user/friends = "friend-123"
        -user/oldTags = "beginner"
      `;
      
      const transactionData = DSLParser.updateToDataStoreFormat(updateText);
      
      assert.ok(transactionData.updateData);
      assert.ok(transactionData.relationships);
      
      // Update data should have namespace prefixes
      assert.strictEqual(transactionData.updateData[':user/name'], 'Alice Smith');
      assert.strictEqual(transactionData.updateData[':user/age'], 31);
      
      // Relationships should be in DataScript transaction format
      const addRelation = transactionData.relationships.find(r => r[0] === '+');
      const removeRelation = transactionData.relationships.find(r => r[0] === '-');
      
      if (addRelation) {
        assert.strictEqual(addRelation[2], ':user/friends');
        assert.strictEqual(addRelation[3], 'friend-123');
      }
      
      if (removeRelation) {
        assert.strictEqual(removeRelation[2], ':user/oldTags');
        assert.strictEqual(removeRelation[3], 'beginner');
      }
    });
  });
});