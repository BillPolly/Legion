/**
 * SentenceAnnotator Unit Tests
 *
 * Tests sentence annotation logic
 */

import { SentenceAnnotator } from '../../../src/services/SentenceAnnotator.js';

describe('SentenceAnnotator', () => {
  let annotator;

  beforeEach(() => {
    annotator = new SentenceAnnotator();
  });

  describe('constructor', () => {
    test('should initialize without parameters', () => {
      expect(annotator).toBeDefined();
    });
  });

  describe('annotate', () => {
    test('should attach sentence text', () => {
      const sentence = 'The pump operates at 150 psi';
      const types = [];
      const domain = 'industrial';

      const result = annotator.annotate(sentence, types, domain);

      expect(result.text).toBe(sentence);
    });

    test('should attach types array', () => {
      const sentence = 'The pump operates at 150 psi';
      const types = [
        { mention: 'pump', matchedClass: 'kg:Pump', hierarchy: { ancestors: ['kg:Equipment'] } }
      ];
      const domain = 'industrial';

      const result = annotator.annotate(sentence, types, domain);

      expect(result.types).toBe(types);
      expect(result.types).toHaveLength(1);
    });

    test('should attach domain information', () => {
      const sentence = 'The pump operates at 150 psi';
      const types = [];
      const domain = 'industrial';

      const result = annotator.annotate(sentence, types, domain);

      expect(result.domain).toBe(domain);
    });

    test('should handle empty types array', () => {
      const sentence = 'Some text';
      const types = [];
      const domain = 'general';

      const result = annotator.annotate(sentence, types, domain);

      expect(result.text).toBe(sentence);
      expect(result.types).toEqual([]);
      expect(result.domain).toBe(domain);
    });

    test('should handle multiple types with hierarchy context', () => {
      const sentence = 'The pump connects to the tank';
      const types = [
        {
          mention: 'pump',
          matchedClass: 'kg:Pump',
          hierarchy: { ancestors: ['kg:Equipment', 'kg:PhysicalObject'], depth: 2 },
          properties: [{ label: 'operatingPressure', definedIn: 'kg:Pump' }]
        },
        {
          mention: 'tank',
          matchedClass: 'kg:Tank',
          hierarchy: { ancestors: ['kg:Equipment', 'kg:PhysicalObject'], depth: 2 },
          properties: [{ label: 'capacity', definedIn: 'kg:Tank' }]
        }
      ];
      const domain = 'industrial';

      const result = annotator.annotate(sentence, types, domain);

      expect(result.text).toBe(sentence);
      expect(result.types).toHaveLength(2);
      expect(result.types[0].matchedClass).toBe('kg:Pump');
      expect(result.types[1].matchedClass).toBe('kg:Tank');
      expect(result.domain).toBe(domain);
    });

    test('should preserve all type metadata', () => {
      const sentence = 'Test sentence';
      const types = [
        {
          mention: 'test',
          matchedClass: 'kg:Test',
          hierarchy: { ancestors: [], depth: 0 },
          properties: [{ label: 'prop1' }],
          relationships: [{ label: 'rel1' }],
          customField: 'customValue'
        }
      ];
      const domain = 'test';

      const result = annotator.annotate(sentence, types, domain);

      expect(result.types[0]).toEqual(types[0]);
      expect(result.types[0].customField).toBe('customValue');
    });

    test('should use default domain if not provided', () => {
      const sentence = 'Test sentence';
      const types = [];

      const result = annotator.annotate(sentence, types);

      expect(result.domain).toBe('general');
    });
  });
});
