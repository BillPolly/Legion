import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PatternQuery } from '../../../src/query/types/PatternQuery.js';
import { LogicalQuery } from '../../../src/query/types/LogicalQuery.js';
import { AggregationQuery } from '../../../src/query/types/AggregationQuery.js';
import { SequentialQuery } from '../../../src/query/types/SequentialQuery.js';
import { TriplePattern } from '../../../src/query/core/TriplePattern.js';
import { QueryVariable } from '../../../src/query/core/QueryVariable.js';
import { QueryBuilder } from '../../../src/core/QueryBuilder.js';
import { KGEngine } from '../../../src/core/KGEngine.js';

describe('Phase 11.2: Query Builder Integration', () => {
  let kg;
  let builder;
  
  beforeEach(() => {
    kg = new KGEngine();
    builder = new QueryBuilder(kg);
    
    // Add test data for query building
    const testTriples = [
      ['person:alice', 'rdf:type', 'Person'],
      ['person:alice', 'name', 'Alice Johnson'],
      ['person:alice', 'age', 30],
      ['person:bob', 'rdf:type', 'Person'],
      ['person:bob', 'name', 'Bob Smith'],
      ['person:bob', 'age', 25],
      ['project:alpha', 'rdf:type', 'Project'],
      ['project:alpha', 'name', 'Alpha Initiative']
    ];
    
    for (const [subject, predicate, object] of testTriples) {
      kg.addTriple(subject, predicate, object);
    }
  });
  
  afterEach(async () => {
    if (kg && typeof kg.clear === 'function') {
      await kg.clear();
    }
    kg = null;
    builder = null;
  });
  
  test('Step 11.2.1: Test fluent query building interface', async () => {
    // Test basic fluent pattern building
    const query1 = builder
      .pattern('?person', 'rdf:type', 'Person')
      .pattern('?person', 'name', '?name')
      .build();
    
    expect(query1).toBeInstanceOf(PatternQuery);
    expect(query1.patterns.length).toBe(2);
    
    // Test fluent building with constraints
    const query2 = builder
      .reset()
      .pattern('?person', 'rdf:type', 'Person')
      .pattern('?person', 'age', '?age')
      .where('age', '>', 28)
      .build();
    
    expect(query2).toBeInstanceOf(PatternQuery);
    expect(query2.patterns.length).toBe(2);
    
    // Test fluent building with logical operations
    const subQuery1 = builder
      .reset()
      .pattern('?person', 'age', '?age')
      .where('age', '<', 28)
      .build();
    
    const subQuery2 = builder
      .reset()
      .pattern('?person', 'age', '?age')
      .where('age', '>', 32)
      .build();
    
    const query3 = builder
      .reset()
      .or(subQuery1, subQuery2)
      .build();
    
    expect(query3).toBeInstanceOf(LogicalQuery);
    expect(query3.operator).toBe('OR');
    
    // Test fluent building with aggregation
    const query4 = builder
      .reset()
      .pattern('?person', 'rdf:type', 'Person')
      .pattern('?person', 'age', '?age')
      .aggregate('COUNT')
      .build();
    
    expect(query4).toBeInstanceOf(AggregationQuery);
    expect(query4.aggregationType).toBe('COUNT');
    
    // Test method chaining reset
    const query5 = builder
      .reset()
      .pattern('?project', 'rdf:type', 'Project')
      .pattern('?project', 'name', '?name')
      .build();
    
    expect(query5).toBeInstanceOf(PatternQuery);
    expect(query5.patterns.length).toBe(2);
  });
  
  test('Step 11.2.2: Test query builder validation and error handling', async () => {
    // Test validation of empty queries
    expect(() => {
      builder.build();
    }).toThrow('Cannot build empty query');
    
    // Test validation of invalid patterns
    expect(() => {
      builder.pattern(null, 'rdf:type', 'Person');
    }).toThrow('Pattern subject cannot be null');
    
    expect(() => {
      builder.pattern('?person', null, 'Person');
    }).toThrow('Pattern predicate cannot be null');
    
    expect(() => {
      builder.pattern('?person', 'rdf:type', null);
    }).toThrow('Pattern object cannot be null');
    
    // Test validation of invalid constraints
    expect(() => {
      builder
        .pattern('?person', 'age', '?age')
        .where('nonexistent', '>', 25);
    }).toThrow('Variable nonexistent not found in query patterns');
    
    expect(() => {
      builder
        .reset()
        .pattern('?person', 'age', '?age')
        .where('age', 'invalid_operator', 25);
    }).toThrow('Invalid constraint operator: invalid_operator');
    
    // Test validation of logical operations
    expect(() => {
      builder.reset().and();
    }).toThrow('Logical operations require at least one operand');
    
    expect(() => {
      builder.reset().or(null);
    }).toThrow('Logical operands cannot be null');
    
    // Test validation of aggregation
    expect(() => {
      builder
        .reset()
        .pattern('?person', 'age', '?age')
        .aggregate('INVALID_TYPE');
    }).toThrow('Invalid aggregation type: INVALID_TYPE');
    
    // Test error recovery
    try {
      builder.pattern(null, 'rdf:type', 'Person');
    } catch (error) {
      // Builder should still be usable after error
      const query = builder
        .reset()
        .pattern('?person', 'rdf:type', 'Person')
        .build();
      
      expect(query).toBeInstanceOf(PatternQuery);
    }
  });
  
  test('Step 11.2.3: Test query builder optimization hints', async () => {
    // Test optimization hint for selective constraints
    const query1 = builder
      .pattern('?person', 'rdf:type', 'Person')
      .pattern('?person', 'age', '?age')
      .optimize('selectivity')
      .where('age', '>', 30)
      .build();
    
    expect(query1).toBeInstanceOf(PatternQuery);
    expect(query1.optimizationHints).toContain('selectivity');
    
    // Test optimization hint for caching
    const query2 = builder
      .reset()
      .pattern('?person', 'rdf:type', 'Person')
      .pattern('?person', 'name', '?name')
      .optimize('cache')
      .build();
    
    expect(query2).toBeInstanceOf(PatternQuery);
    expect(query2.optimizationHints).toContain('cache');
    
    // Test optimization hint for indexing
    const query3 = builder
      .reset()
      .pattern('?person', 'rdf:type', 'Person')
      .pattern('?person', 'department', '?dept')
      .optimize('index', 'department')
      .build();
    
    expect(query3).toBeInstanceOf(PatternQuery);
    expect(query3.optimizationHints).toContain('index');
    expect(query3.indexHints).toContain('department');
    
    // Test optimization hint validation
    expect(() => {
      builder
        .reset()
        .pattern('?person', 'rdf:type', 'Person')
        .optimize('invalid_hint');
    }).toThrow('Invalid optimization hint: invalid_hint');
    
    // Test optimization recommendations
    const recommendations = builder
      .reset()
      .pattern('?person', 'rdf:type', 'Person')
      .pattern('?person', 'age', '?age')
      .getOptimizationRecommendations();
    
    expect(Array.isArray(recommendations)).toBe(true);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations).toContain('Consider adding constraints to improve selectivity');
  });
  
  test('Step 11.2.4: Test query builder serialization support', async () => {
    // Test serialization of simple pattern query
    const query1 = builder
      .pattern('?person', 'rdf:type', 'Person')
      .pattern('?person', 'name', '?name')
      .build();
    
    const serialized1 = builder.serialize(query1);
    expect(typeof serialized1).toBe('string');
    
    const deserialized1 = builder.deserialize(serialized1);
    expect(deserialized1).toBeInstanceOf(PatternQuery);
    expect(deserialized1.patterns.length).toBe(2);
    
    // Test serialization with optimization hints
    const query2 = builder
      .reset()
      .pattern('?person', 'rdf:type', 'Person')
      .optimize('cache')
      .optimize('selectivity')
      .build();
    
    const serialized2 = builder.serialize(query2);
    const deserialized2 = builder.deserialize(serialized2);
    
    expect(deserialized2.optimizationHints).toContain('cache');
    expect(deserialized2.optimizationHints).toContain('selectivity');
    
    // Test serialization error handling
    expect(() => {
      builder.serialize(null);
    }).toThrow('Cannot serialize null query');
    
    expect(() => {
      builder.deserialize('invalid_json');
    }).toThrow('Invalid serialized query format');
  });
  
  test('Step 11.2.5: Test query builder extensibility', async () => {
    // Test custom pattern builders
    builder.addPatternBuilder('person', (name) => {
      return builder
        .pattern('?person', 'rdf:type', 'Person')
        .pattern('?person', 'name', name || '?name');
    });
    
    const query1 = builder
      .reset()
      .person('Alice Johnson')
      .build();
    
    expect(query1).toBeInstanceOf(PatternQuery);
    
    // Test custom constraint builders
    builder.addConstraintBuilder('ageRange', (min, max) => {
      return builder
        .where('age', '>=', min)
        .where('age', '<=', max);
    });
    
    const query2 = builder
      .reset()
      .pattern('?person', 'rdf:type', 'Person')
      .pattern('?person', 'age', '?age')
      .ageRange(25, 35)
      .build();
    
    expect(query2).toBeInstanceOf(PatternQuery);
    
    // Test custom aggregation builders
    builder.addAggregationBuilder('averageAge', () => {
      return builder
        .pattern('?person', 'rdf:type', 'Person')
        .pattern('?person', 'age', '?age')
        .aggregate('AVG', 'age');
    });
    
    const query3 = builder
      .reset()
      .averageAge()
      .build();
    
    expect(query3).toBeInstanceOf(AggregationQuery);
    
    // Test plugin system
    const customPlugin = {
      name: 'ProjectPlugin',
      patterns: {
        project: (name) => builder
          .pattern('?project', 'rdf:type', 'Project')
          .pattern('?project', 'name', name || '?name')
      },
      constraints: {
        budgetRange: (min, max) => builder
          .where('budget', '>=', min)
          .where('budget', '<=', max)
      }
    };
    
    builder.addPlugin(customPlugin);
    
    const query4 = builder
      .reset()
      .project()
      .build();
    
    expect(query4).toBeInstanceOf(PatternQuery);
    
    // Test extension validation
    expect(() => {
      builder.addPatternBuilder('', () => {});
    }).toThrow('Pattern builder name cannot be empty');
    
    expect(() => {
      builder.addPatternBuilder('test', null);
    }).toThrow('Pattern builder function cannot be null');
    
    // Test extension conflicts
    expect(() => {
      builder.addPatternBuilder('pattern', () => {}); // Built-in method
    }).toThrow('Cannot override built-in method: pattern');
  });
});
