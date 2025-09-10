import { PatternTranslator } from '../../src/PatternTranslator.js';

describe('PatternTranslator', () => {
  let translator;

  beforeEach(() => {
    translator = new PatternTranslator();
  });

  describe('Construction and Basic API', () => {
    test('should construct without parameters', () => {
      expect(translator).toBeInstanceOf(PatternTranslator);
    });

    test('should have translate method', () => {
      expect(typeof translator.translate).toBe('function');
    });

    test('should have translatePattern method', () => {
      expect(typeof translator.translatePattern).toBe('function');
    });
  });

  describe('Simple Pattern Translation', () => {
    test('should translate simple subject-predicate-object pattern', () => {
      const pattern = {
        subject: '?person',
        predicate: 'name',
        object: '?name'
      };

      const result = translator.translate(pattern);

      expect(result).toEqual({
        find: ['?person', '?name'],
        where: [
          ['?person', ':name', '?name']
        ]
      });
    });

    test('should translate pattern with specific object value', () => {
      const pattern = {
        subject: '?person',
        predicate: 'age',
        object: 30
      };

      const result = translator.translate(pattern);

      expect(result).toEqual({
        find: ['?person'],
        where: [
          ['?person', ':age', 30]
        ]
      });
    });

    test('should translate pattern with specific subject', () => {
      const pattern = {
        subject: 'alice',
        predicate: 'name',
        object: '?name'
      };

      const result = translator.translate(pattern);

      expect(result).toEqual({
        find: ['?name'],
        where: [
          ['alice', ':name', '?name']
        ]
      });
    });

    test('should handle namespace prefixes in predicates', () => {
      const pattern = {
        subject: '?person',
        predicate: 'person:name',
        object: '?name'
      };

      const result = translator.translate(pattern);

      expect(result).toEqual({
        find: ['?person', '?name'],
        where: [
          ['?person', ':person/name', '?name']
        ]
      });
    });
  });

  describe('Multiple Pattern Translation', () => {
    test('should translate multiple patterns as AND conditions', () => {
      const patterns = [
        {
          subject: '?person',
          predicate: 'name',
          object: '?name'
        },
        {
          subject: '?person',
          predicate: 'age',
          object: '?age'
        }
      ];

      const result = translator.translate(patterns);

      expect(result).toEqual({
        find: ['?person', '?name', '?age'],
        where: [
          ['?person', ':name', '?name'],
          ['?person', ':age', '?age']
        ]
      });
    });

    test('should handle overlapping variables correctly', () => {
      const patterns = [
        {
          subject: '?person',
          predicate: 'name',
          object: 'Alice'
        },
        {
          subject: '?person',
          predicate: 'employer',
          object: '?company'
        },
        {
          subject: '?company',
          predicate: 'name',
          object: '?companyName'
        }
      ];

      const result = translator.translate(patterns);

      expect(result).toEqual({
        find: ['?person', '?company', '?companyName'],
        where: [
          ['?person', ':name', 'Alice'],
          ['?person', ':employer', '?company'],
          ['?company', ':name', '?companyName']
        ]
      });
    });
  });

  describe('Legacy KG Pattern Support', () => {
    test('should translate legacy triple format', () => {
      const legacyPattern = ['?person', 'name', '?name'];

      const result = translator.translatePattern(legacyPattern);

      expect(result).toEqual({
        find: ['?person', '?name'],
        where: [
          ['?person', ':name', '?name']
        ]
      });
    });

    test('should translate multiple legacy triples', () => {
      const legacyPatterns = [
        ['?person', 'name', '?name'],
        ['?person', 'age', '?age']
      ];

      const result = translator.translate(legacyPatterns);

      expect(result).toEqual({
        find: ['?person', '?name', '?age'],
        where: [
          ['?person', ':name', '?name'],
          ['?person', ':age', '?age']
        ]
      });
    });

    test('should handle legacy format with constants', () => {
      const legacyPattern = ['?person', 'name', 'Alice'];

      const result = translator.translatePattern(legacyPattern);

      expect(result).toEqual({
        find: ['?person'],
        where: [
          ['?person', ':name', 'Alice']
        ]
      });
    });
  });

  describe('Variable Detection and Collection', () => {
    test('should extract all unique variables from pattern', () => {
      const patterns = [
        {
          subject: '?person',
          predicate: 'name',
          object: '?name'
        },
        {
          subject: '?person',
          predicate: 'friend',
          object: '?friend'
        },
        {
          subject: '?friend',
          predicate: 'name',
          object: '?friendName'
        }
      ];

      const variables = translator.extractVariables(patterns);
      
      expect(variables.sort()).toEqual(['?person', '?name', '?friend', '?friendName'].sort());
    });

    test('should not duplicate variables in find clause', () => {
      const patterns = [
        {
          subject: '?person',
          predicate: 'name',
          object: '?name'
        },
        {
          subject: '?person',
          predicate: 'age',
          object: 25
        }
      ];

      const result = translator.translate(patterns);

      expect(result.find).toEqual(['?person', '?name']);
    });
  });

  describe('Predicate Processing', () => {
    test('should add colon prefix to simple predicates', () => {
      const pattern = {
        subject: '?x',
        predicate: 'test',
        object: '?y'
      };

      const processed = translator.processPredicate('test');
      expect(processed).toBe(':test');
    });

    test('should convert namespace notation to DataScript format', () => {
      const processed = translator.processPredicate('person:name');
      expect(processed).toBe(':person/name');
    });

    test('should handle already prefixed predicates', () => {
      const processed = translator.processPredicate(':person/name');
      expect(processed).toBe(':person/name');
    });

    test('should handle predicates with multiple namespaces', () => {
      const processed = translator.processPredicate('org:person:name');
      expect(processed).toBe(':org/person:name');
    });
  });

  describe('Complex Query Construction', () => {
    test('should handle patterns with mixed variable and constant types', () => {
      const patterns = [
        {
          subject: '?person',
          predicate: 'type',
          object: 'Employee'
        },
        {
          subject: '?person',
          predicate: 'salary',
          object: '?salary'
        }
      ];

      const result = translator.translate(patterns);

      expect(result).toEqual({
        find: ['?person', '?salary'],
        where: [
          ['?person', ':type', 'Employee'],
          ['?person', ':salary', '?salary']
        ]
      });
    });

    test('should handle numeric and string literals correctly', () => {
      const patterns = [
        {
          subject: '?item',
          predicate: 'price',
          object: 19.99
        },
        {
          subject: '?item',
          predicate: 'category',
          object: 'electronics'
        }
      ];

      const result = translator.translate(patterns);

      expect(result).toEqual({
        find: ['?item'],
        where: [
          ['?item', ':price', 19.99],
          ['?item', ':category', 'electronics']
        ]
      });
    });

    test('should preserve boolean values', () => {
      const pattern = {
        subject: '?user',
        predicate: 'active',
        object: true
      };

      const result = translator.translate(pattern);

      expect(result).toEqual({
        find: ['?user'],
        where: [
          ['?user', ':active', true]
        ]
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty pattern array', () => {
      const result = translator.translate([]);

      expect(result).toEqual({
        find: [],
        where: []
      });
    });

    test('should handle single pattern in array', () => {
      const patterns = [{
        subject: '?x',
        predicate: 'test',
        object: 'value'
      }];

      const result = translator.translate(patterns);

      expect(result).toEqual({
        find: ['?x'],
        where: [
          ['?x', ':test', 'value']
        ]
      });
    });

    test('should throw error for invalid pattern format', () => {
      const invalidPattern = {
        subject: '?x'
        // Missing predicate and object
      };

      expect(() => {
        translator.translate(invalidPattern);
      }).toThrow('Invalid pattern: missing predicate or object');
    });

    test('should handle null and undefined values gracefully', () => {
      expect(() => {
        translator.translate(null);
      }).toThrow('Pattern cannot be null or undefined');

      expect(() => {
        translator.translate(undefined);
      }).toThrow('Pattern cannot be null or undefined');
    });
  });

  describe('Advanced Pattern Features', () => {
    test('should support optional patterns (future extension point)', () => {
      // Test placeholder for future optional pattern support
      const patterns = [
        {
          subject: '?person',
          predicate: 'name',
          object: '?name'
        },
        {
          subject: '?person',
          predicate: 'email',
          object: '?email',
          optional: true
        }
      ];

      // For now, should process all patterns as required
      const result = translator.translate(patterns);

      expect(result.where.length).toBe(2);
      expect(result.find).toContain('?person');
      expect(result.find).toContain('?name');
      expect(result.find).toContain('?email');
    });

    test('should maintain pattern order in where clauses', () => {
      const patterns = [
        {
          subject: '?c',
          predicate: 'name',
          object: '?cname'
        },
        {
          subject: '?a',
          predicate: 'name',
          object: '?aname'
        },
        {
          subject: '?b',
          predicate: 'name',
          object: '?bname'
        }
      ];

      const result = translator.translate(patterns);

      expect(result.where[0]).toEqual(['?c', ':name', '?cname']);
      expect(result.where[1]).toEqual(['?a', ':name', '?aname']);
      expect(result.where[2]).toEqual(['?b', ':name', '?bname']);
    });
  });

  describe('Backward Compatibility', () => {
    test('should handle mixed format input arrays', () => {
      const mixedPatterns = [
        // Object format
        {
          subject: '?person',
          predicate: 'name',
          object: '?name'
        },
        // Array format
        ['?person', 'age', '?age']
      ];

      const result = translator.translate(mixedPatterns);

      expect(result).toEqual({
        find: ['?person', '?name', '?age'],
        where: [
          ['?person', ':name', '?name'],
          ['?person', ':age', '?age']
        ]
      });
    });

    test('should detect and handle different input formats', () => {
      // Test single object
      const objResult = translator.translate({
        subject: '?x',
        predicate: 'test',
        object: '?y'
      });

      expect(objResult.find).toEqual(['?x', '?y']);

      // Test single array
      const arrResult = translator.translate(['?x', 'test', '?y']);

      expect(arrResult.find).toEqual(['?x', '?y']);
    });
  });
});