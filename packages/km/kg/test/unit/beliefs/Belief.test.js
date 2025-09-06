import { Belief } from '../../../src/beliefs/Belief.js';
import '../../../src/serialization/ObjectExtensions.js'; // Enable getId() method

describe('Belief', () => {
  let agent, subject, object, belief;

  beforeEach(() => {
    // Create test objects
    agent = { name: 'Agent Smith', type: 'AI' };
    subject = { name: 'John', age: 30 };
    object = { name: 'Jane', age: 28 };
    
    // Create basic belief
    belief = new Belief(agent, subject, 'knows', object);
  });

  describe('Basic Belief Creation', () => {
    test('should create belief with required parameters', () => {
      expect(belief.agent).toBe(agent);
      expect(belief.subject).toBe(subject);
      expect(belief.predicate).toBe('knows');
      expect(belief.object).toBe(object);
    });

    test('should set default confidence to 1.0', () => {
      expect(belief.confidence).toBe(1.0);
    });

    test('should generate timestamp automatically', () => {
      expect(belief.timestamp).toBeDefined();
      expect(typeof belief.timestamp).toBe('string');
      expect(new Date(belief.timestamp)).toBeInstanceOf(Date);
    });

    test('should not have source by default', () => {
      expect(belief.source).toBeUndefined();
    });

    test('should create belief with custom data', () => {
      const data = {
        confidence: 0.8,
        source: 'observation',
        timestamp: '2023-01-15T10:30:00Z'
      };
      
      const customBelief = new Belief(agent, subject, 'likes', object, data);
      
      expect(customBelief.confidence).toBe(0.8);
      expect(customBelief.source).toBe('observation');
      expect(customBelief.timestamp).toBe('2023-01-15T10:30:00Z');
    });
  });

  describe('Agent Belief Tracking', () => {
    test('should track which agent holds the belief', () => {
      const agent1 = { name: 'Agent A', id: 'agent_a' };
      const agent2 = { name: 'Agent B', id: 'agent_b' };
      
      const belief1 = new Belief(agent1, subject, 'knows', object);
      const belief2 = new Belief(agent2, subject, 'knows', object);
      
      expect(belief1.agent).toBe(agent1);
      expect(belief2.agent).toBe(agent2);
      expect(belief1.agent).not.toBe(belief2.agent);
    });

    test('should handle different agent types', () => {
      const humanAgent = { name: 'Human User', type: 'human' };
      const aiAgent = { name: 'AI Assistant', type: 'ai' };
      const systemAgent = { name: 'System Monitor', type: 'system' };
      
      const humanBelief = new Belief(humanAgent, subject, 'trusts', object);
      const aiBelief = new Belief(aiAgent, subject, 'analyzes', object);
      const systemBelief = new Belief(systemAgent, subject, 'monitors', object);
      
      expect(humanBelief.agent.type).toBe('human');
      expect(aiBelief.agent.type).toBe('ai');
      expect(systemBelief.agent.type).toBe('system');
    });
  });

  describe('Subject/Predicate/Object Handling', () => {
    test('should handle object subjects and objects', () => {
      const person1 = { name: 'Alice', profession: 'Engineer' };
      const person2 = { name: 'Bob', profession: 'Designer' };
      
      const belief = new Belief(agent, person1, 'collaborates_with', person2);
      
      expect(belief.subject).toBe(person1);
      expect(belief.object).toBe(person2);
    });

    test('should handle string subjects and objects', () => {
      const belief = new Belief(agent, 'weather', 'is', 'sunny');
      
      expect(belief.subject).toBe('weather');
      expect(belief.object).toBe('sunny');
    });

    test('should handle mixed object and string types', () => {
      const person = { name: 'Charlie', age: 25 };
      const belief = new Belief(agent, person, 'age_is', 25);
      
      expect(belief.subject).toBe(person);
      expect(belief.object).toBe(25);
    });

    test('should handle various predicate types', () => {
      const predicates = [
        'knows',
        'likes',
        'works_with',
        'lives_in',
        'owns',
        'believes_in',
        'is_related_to',
        'has_skill'
      ];
      
      predicates.forEach(predicate => {
        const belief = new Belief(agent, subject, predicate, object);
        expect(belief.predicate).toBe(predicate);
      });
    });
  });

  describe('Confidence Scoring', () => {
    test('should handle confidence values from 0 to 1', () => {
      const confidenceValues = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
      
      confidenceValues.forEach(confidence => {
        const belief = new Belief(agent, subject, 'knows', object, { confidence });
        expect(belief.confidence).toBe(confidence);
      });
    });

    test('should handle confidence value of 0', () => {
      const belief = new Belief(agent, subject, 'knows', object, { confidence: 0 });
      expect(belief.confidence).toBe(0);
    });

    test('should handle high precision confidence values', () => {
      const belief = new Belief(agent, subject, 'knows', object, { confidence: 0.8765432 });
      expect(belief.confidence).toBe(0.8765432);
    });

    test('should allow confidence values outside 0-1 range', () => {
      // Some systems might use different scales
      const belief1 = new Belief(agent, subject, 'knows', object, { confidence: 1.5 });
      const belief2 = new Belief(agent, subject, 'knows', object, { confidence: -0.2 });
      
      expect(belief1.confidence).toBe(1.5);
      expect(belief2.confidence).toBe(-0.2);
    });
  });

  describe('Source Tracking', () => {
    test('should track belief sources', () => {
      const sources = [
        'direct_observation',
        'user_input',
        'inference',
        'external_api',
        'database_query',
        'machine_learning_model',
        'expert_system',
        'sensor_data'
      ];
      
      sources.forEach(source => {
        const belief = new Belief(agent, subject, 'knows', object, { source });
        expect(belief.source).toBe(source);
      });
    });

    test('should handle complex source information', () => {
      const complexSource = {
        type: 'api_call',
        endpoint: 'https://api.example.com/users',
        timestamp: '2023-01-15T10:30:00Z',
        reliability: 0.95
      };
      
      const belief = new Belief(agent, subject, 'knows', object, { source: complexSource });
      expect(belief.source).toEqual(complexSource);
    });

    test('should handle null and undefined sources', () => {
      const belief1 = new Belief(agent, subject, 'knows', object, { source: null });
      const belief2 = new Belief(agent, subject, 'knows', object, { source: undefined });
      
      expect(belief1.source).toBeNull();
      expect(belief2.source).toBeUndefined();
    });
  });

  describe('Timestamp Management', () => {
    test('should generate ISO timestamp by default', () => {
      const belief = new Belief(agent, subject, 'knows', object);
      
      expect(belief.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should accept custom timestamps', () => {
      const customTimestamp = '2020-06-15T14:30:00Z';
      const belief = new Belief(agent, subject, 'knows', object, { timestamp: customTimestamp });
      
      expect(belief.timestamp).toBe(customTimestamp);
    });

    test('should handle various timestamp formats', () => {
      const timestamps = [
        '2023-01-15T10:30:00Z',
        '2023-01-15T10:30:00.123Z',
        '2023-01-15T10:30:00+05:30',
        '2023-01-15 10:30:00',
        '1642248600000' // Unix timestamp as string
      ];
      
      timestamps.forEach(timestamp => {
        const belief = new Belief(agent, subject, 'knows', object, { timestamp });
        expect(belief.timestamp).toBe(timestamp);
      });
    });

    test('should generate different timestamps for beliefs created at different times', async () => {
      const belief1 = new Belief(agent, subject, 'knows', object);
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 2));
      
      const belief2 = new Belief(agent, subject, 'knows', object);
      
      expect(belief1.timestamp).not.toBe(belief2.timestamp);
    });
  });

  describe('Triple Generation', () => {
    test('should generate basic belief triples', () => {
      const triples = belief.toTriples();
      const beliefId = belief.getId();
      
      expect(triples).toContainEqual([agent.getId(), 'kg:believes', beliefId]);
      expect(triples).toContainEqual([beliefId, 'rdf:type', 'kg:Belief']);
      expect(triples).toContainEqual([beliefId, 'kg:subject', subject.getId()]);
      expect(triples).toContainEqual([beliefId, 'kg:predicate', 'knows']);
      expect(triples).toContainEqual([beliefId, 'kg:object', object.getId()]);
      expect(triples).toContainEqual([beliefId, 'kg:confidence', 1.0]);
      expect(triples).toContainEqual([beliefId, 'kg:timestamp', belief.timestamp]);
    });

    test('should handle string subjects and objects in triples', () => {
      const stringBelief = new Belief(agent, 'weather', 'is', 'sunny');
      const triples = stringBelief.toTriples();
      const beliefId = stringBelief.getId();
      
      expect(triples).toContainEqual([beliefId, 'kg:subject', 'weather']);
      expect(triples).toContainEqual([beliefId, 'kg:object', 'sunny']);
    });

    test('should include source in triples when provided', () => {
      const beliefWithSource = new Belief(agent, subject, 'knows', object, { source: 'observation' });
      const triples = beliefWithSource.toTriples();
      const beliefId = beliefWithSource.getId();
      
      expect(triples).toContainEqual([beliefId, 'kg:source', 'observation']);
    });

    test('should not include source in triples when not provided', () => {
      const triples = belief.toTriples();
      const beliefId = belief.getId();
      
      const hasSource = triples.some(t => t[0] === beliefId && t[1] === 'kg:source');
      expect(hasSource).toBe(false);
    });

    test('should include all metadata when fully specified', () => {
      const data = {
        confidence: 0.85,
        source: 'expert_analysis',
        timestamp: '2023-01-15T10:30:00Z'
      };
      
      const fullBelief = new Belief(agent, subject, 'trusts', object, data);
      const triples = fullBelief.toTriples();
      const beliefId = fullBelief.getId();
      
      expect(triples).toContainEqual([agent.getId(), 'kg:believes', beliefId]);
      expect(triples).toContainEqual([beliefId, 'rdf:type', 'kg:Belief']);
      expect(triples).toContainEqual([beliefId, 'kg:subject', subject.getId()]);
      expect(triples).toContainEqual([beliefId, 'kg:predicate', 'trusts']);
      expect(triples).toContainEqual([beliefId, 'kg:object', object.getId()]);
      expect(triples).toContainEqual([beliefId, 'kg:confidence', 0.85]);
      expect(triples).toContainEqual([beliefId, 'kg:source', 'expert_analysis']);
      expect(triples).toContainEqual([beliefId, 'kg:timestamp', '2023-01-15T10:30:00Z']);
    });
  });

  describe('ID Generation', () => {
    test('should generate unique IDs for different beliefs', () => {
      const belief1 = new Belief(agent, subject, 'knows', object);
      const belief2 = new Belief(agent, subject, 'likes', object);
      
      expect(belief1.getId()).not.toBe(belief2.getId());
    });

    test('should maintain consistent ID across multiple calls', () => {
      const id1 = belief.getId();
      const id2 = belief.getId();
      
      expect(id1).toBe(id2);
    });

    test('should allow manual ID setting', () => {
      const customId = 'custom_belief_123';
      belief.setId(customId);
      
      expect(belief.getId()).toBe(customId);
    });
  });

  describe('Real-world Belief Scenarios', () => {
    test('should handle AI agent beliefs about user preferences', () => {
      const aiAgent = { name: 'Assistant', type: 'ai' };
      const user = { name: 'Alice', id: 'user_123' };
      
      const belief = new Belief(aiAgent, user, 'prefers', 'coffee', {
        confidence: 0.8,
        source: 'conversation_analysis',
        timestamp: '2023-01-15T09:00:00Z'
      });
      
      const triples = belief.toTriples();
      const beliefId = belief.getId();
      
      expect(triples).toContainEqual([aiAgent.getId(), 'kg:believes', beliefId]);
      expect(triples).toContainEqual([beliefId, 'kg:subject', user.getId()]);
      expect(triples).toContainEqual([beliefId, 'kg:predicate', 'prefers']);
      expect(triples).toContainEqual([beliefId, 'kg:object', 'coffee']);
      expect(triples).toContainEqual([beliefId, 'kg:confidence', 0.8]);
      expect(triples).toContainEqual([beliefId, 'kg:source', 'conversation_analysis']);
    });

    test('should handle system beliefs about user behavior', () => {
      const systemAgent = { name: 'Analytics System', type: 'system' };
      const user = { name: 'Bob', id: 'user_456' };
      
      const belief = new Belief(systemAgent, user, 'visits_frequently', 'homepage', {
        confidence: 0.95,
        source: 'web_analytics',
        timestamp: '2023-01-15T12:00:00Z'
      });
      
      expect(belief.agent.type).toBe('system');
      expect(belief.confidence).toBe(0.95);
      expect(belief.source).toBe('web_analytics');
    });

    test('should handle human beliefs about relationships', () => {
      const humanAgent = { name: 'Observer', type: 'human' };
      const person1 = { name: 'Charlie', id: 'person_1' };
      const person2 = { name: 'Diana', id: 'person_2' };
      
      const belief = new Belief(humanAgent, person1, 'is_friends_with', person2, {
        confidence: 1.0,
        source: 'direct_observation',
        timestamp: '2023-01-15T15:30:00Z'
      });
      
      expect(belief.agent.type).toBe('human');
      expect(belief.predicate).toBe('is_friends_with');
      expect(belief.confidence).toBe(1.0);
    });

    test('should handle uncertain beliefs with low confidence', () => {
      const agent = { name: 'Uncertain Agent', type: 'ai' };
      const entity = { name: 'Unknown Person', id: 'unknown_1' };
      
      const belief = new Belief(agent, entity, 'might_be', 'engineer', {
        confidence: 0.3,
        source: 'incomplete_data',
        timestamp: '2023-01-15T16:00:00Z'
      });
      
      expect(belief.confidence).toBe(0.3);
      expect(belief.source).toBe('incomplete_data');
      expect(belief.predicate).toBe('might_be');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined in subject/object positions', () => {
      const belief1 = new Belief(agent, null, 'knows', object);
      const belief2 = new Belief(agent, subject, 'knows', null);
      
      expect(belief1.subject).toBeNull();
      expect(belief2.object).toBeNull();
    });

    test('should handle empty string predicates', () => {
      const belief = new Belief(agent, subject, '', object);
      expect(belief.predicate).toBe('');
    });

    test('should handle special characters in predicates', () => {
      const specialPredicates = [
        'knows@work',
        'likes_very_much',
        'is-related-to',
        'believes_in_100%',
        'café_owner'
      ];
      
      specialPredicates.forEach(predicate => {
        const belief = new Belief(agent, subject, predicate, object);
        expect(belief.predicate).toBe(predicate);
      });
    });

    test('should handle very long predicate names', () => {
      const longPredicate = 'has_a_very_long_and_complex_relationship_that_requires_detailed_explanation'.repeat(3);
      const belief = new Belief(agent, subject, longPredicate, object);
      
      expect(belief.predicate).toBe(longPredicate);
    });

    test('should handle complex nested objects', () => {
      const complexSubject = {
        name: 'Complex Entity',
        properties: {
          nested: {
            value: 'deep'
          }
        },
        array: [1, 2, 3]
      };
      
      const belief = new Belief(agent, complexSubject, 'has_property', 'complexity');
      
      expect(belief.subject).toBe(complexSubject);
      expect(belief.subject.properties.nested.value).toBe('deep');
    });
  });

  describe('Performance', () => {
    test('should handle belief creation efficiently', () => {
      const startTime = performance.now();
      
      // Create 100 beliefs
      for (let i = 0; i < 100; i++) {
        new Belief(agent, subject, `predicate_${i}`, object, {
          confidence: i / 100,
          source: `source_${i}`,
          timestamp: new Date().toISOString()
        });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    test('should handle triple generation efficiently', () => {
      const startTime = performance.now();
      
      // Generate triples for 100 beliefs
      for (let i = 0; i < 100; i++) {
        const belief = new Belief(agent, subject, `predicate_${i}`, object, {
          confidence: i / 100,
          source: `source_${i}`
        });
        belief.toTriples();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Triple Structure Validation', () => {
    test('should generate well-formed triples', () => {
      const triples = belief.toTriples();
      
      // All triples should be arrays of length 3
      triples.forEach(triple => {
        expect(Array.isArray(triple)).toBe(true);
        expect(triple).toHaveLength(3);
        expect(typeof triple[0]).toBe('string'); // subject
        expect(typeof triple[1]).toBe('string'); // predicate
        // object can be string or number
      });
    });

    test('should include agent belief relationship', () => {
      const triples = belief.toTriples();
      const beliefId = belief.getId();
      
      // Should include the agent believes relationship
      expect(triples).toContainEqual([agent.getId(), 'kg:believes', beliefId]);
    });

    test('should include type information', () => {
      const triples = belief.toTriples();
      const beliefId = belief.getId();
      
      // Should include rdf:type
      expect(triples).toContainEqual([beliefId, 'rdf:type', 'kg:Belief']);
    });
  });
});
