/**
 * Unit tests for ConversationContext - Multi-turn conversation management
 *
 * Tests conversation state tracking, entity salience, and context retrieval
 */

import { ConversationContext } from '../../src/context/ConversationContext.js';

describe('ConversationContext', () => {
  describe('Constructor', () => {
    test('should create empty context', () => {
      const context = new ConversationContext();

      expect(context.getTurns()).toHaveLength(0);
      expect(context.getPreviousQuestion()).toBe(null);
      expect(context.getConversationHistory()).toEqual([]);
    });

    test('should accept initial options', () => {
      const context = new ConversationContext({ maxTurns: 5 });

      expect(context.maxTurns).toBe(5);
    });
  });

  describe('addTurn()', () => {
    test('should add a conversation turn', () => {
      const context = new ConversationContext();

      context.addTurn({
        question: 'Which countries border Germany?',
        canonicalQuestion: {
          text: 'which countries border Germany?',
          entities: [
            { span: [24, 31], value: 'Germany', type: 'PLACE', canonical: ':Germany' }
          ],
          dates: [],
          units: [],
          wh_role: 'which',
          lang: 'en'
        },
        query: { find: ['?x'], where: [['?x', ':type', ':Country']] },
        results: [
          { name: 'France', id: 2 },
          { name: 'Poland', id: 3 }
        ]
      });

      expect(context.getTurns()).toHaveLength(1);
      expect(context.getPreviousQuestion()).toBe('Which countries border Germany?');
    });

    test('should track multiple turns in order', () => {
      const context = new ConversationContext();

      context.addTurn({
        question: 'Which countries border Germany?',
        canonicalQuestion: { text: 'which countries border Germany?', entities: [], dates: [], units: [], wh_role: 'which', lang: 'en' },
        query: {},
        results: []
      });

      context.addTurn({
        question: 'What about France?',
        canonicalQuestion: { text: 'which countries border France?', entities: [], dates: [], units: [], wh_role: 'which', lang: 'en' },
        query: {},
        results: []
      });

      expect(context.getTurns()).toHaveLength(2);
      expect(context.getPreviousQuestion()).toBe('What about France?');
    });

    test('should respect maxTurns limit', () => {
      const context = new ConversationContext({ maxTurns: 3 });

      context.addTurn({ question: 'Q1', canonicalQuestion: { text: 'Q1', entities: [], dates: [], units: [], wh_role: 'what', lang: 'en' }, query: {}, results: [] });
      context.addTurn({ question: 'Q2', canonicalQuestion: { text: 'Q2', entities: [], dates: [], units: [], wh_role: 'what', lang: 'en' }, query: {}, results: [] });
      context.addTurn({ question: 'Q3', canonicalQuestion: { text: 'Q3', entities: [], dates: [], units: [], wh_role: 'what', lang: 'en' }, query: {}, results: [] });
      context.addTurn({ question: 'Q4', canonicalQuestion: { text: 'Q4', entities: [], dates: [], units: [], wh_role: 'what', lang: 'en' }, query: {}, results: [] });

      expect(context.getTurns()).toHaveLength(3);
      expect(context.getTurns()[0].question).toBe('Q2'); // Q1 dropped
    });
  });

  describe('Entity Tracking', () => {
    test('should extract entities from canonical question', () => {
      const context = new ConversationContext();

      context.addTurn({
        question: 'Which countries border Germany?',
        canonicalQuestion: {
          text: 'which countries border Germany?',
          entities: [
            { span: [24, 31], value: 'Germany', type: 'PLACE', canonical: ':Germany' }
          ],
          dates: [],
          units: [],
          wh_role: 'which',
          lang: 'en'
        },
        query: {},
        results: []
      });

      const entities = context.getRecentEntities();
      expect(entities).toHaveLength(1);
      expect(entities[0]).toEqual({
        value: 'Germany',
        canonical: ':Germany',
        type: 'PLACE',
        turnIndex: 0
      });
    });

    test('should extract entities from results', () => {
      const context = new ConversationContext();

      context.addTurn({
        question: 'Which countries border Germany?',
        canonicalQuestion: {
          text: 'which countries border Germany?',
          entities: [],
          dates: [],
          units: [],
          wh_role: 'which',
          lang: 'en'
        },
        query: {},
        results: [
          { name: 'France', id: 2, type: 'Country' },
          { name: 'Poland', id: 3, type: 'Country' }
        ]
      });

      const entities = context.getRecentEntities();
      expect(entities.length).toBeGreaterThan(0);
      expect(entities.some(e => e.value === 'France')).toBe(true);
    });

    test('should rank entities by recency (most recent first)', () => {
      const context = new ConversationContext();

      context.addTurn({
        question: 'Q1',
        canonicalQuestion: {
          text: 'Q1',
          entities: [
            { span: [0, 7], value: 'Germany', type: 'PLACE', canonical: ':Germany' }
          ],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        },
        query: {},
        results: []
      });

      context.addTurn({
        question: 'Q2',
        canonicalQuestion: {
          text: 'Q2',
          entities: [
            { span: [0, 6], value: 'France', type: 'PLACE', canonical: ':France' }
          ],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        },
        query: {},
        results: []
      });

      const entities = context.getRecentEntities(2);
      expect(entities[0].value).toBe('France'); // Most recent
      expect(entities[1].value).toBe('Germany');
    });

    test('should limit entities by count parameter', () => {
      const context = new ConversationContext();

      context.addTurn({
        question: 'Q1',
        canonicalQuestion: {
          text: 'Q1',
          entities: [
            { span: [0, 7], value: 'Germany', type: 'PLACE', canonical: ':Germany' },
            { span: [8, 14], value: 'France', type: 'PLACE', canonical: ':France' },
            { span: [15, 20], value: 'Spain', type: 'PLACE', canonical: ':Spain' }
          ],
          dates: [],
          units: [],
          wh_role: 'what',
          lang: 'en'
        },
        query: {},
        results: []
      });

      const entities = context.getRecentEntities(2);
      expect(entities).toHaveLength(2);
    });
  });

  describe('getMostSalientEntity()', () => {
    test('should return most recent entity', () => {
      const context = new ConversationContext();

      context.addTurn({
        question: 'Which countries border Germany?',
        canonicalQuestion: {
          text: 'which countries border Germany?',
          entities: [
            { span: [24, 31], value: 'Germany', type: 'PLACE', canonical: ':Germany' }
          ],
          dates: [],
          units: [],
          wh_role: 'which',
          lang: 'en'
        },
        query: {},
        results: []
      });

      const salient = context.getMostSalientEntity();
      expect(salient.value).toBe('Germany');
      expect(salient.canonical).toBe(':Germany');
    });

    test('should return null if no entities', () => {
      const context = new ConversationContext();

      expect(context.getMostSalientEntity()).toBe(null);
    });
  });

  describe('getConversationHistory()', () => {
    test('should return array of questions', () => {
      const context = new ConversationContext();

      context.addTurn({ question: 'Q1', canonicalQuestion: { text: 'Q1', entities: [], dates: [], units: [], wh_role: 'what', lang: 'en' }, query: {}, results: [] });
      context.addTurn({ question: 'Q2', canonicalQuestion: { text: 'Q2', entities: [], dates: [], units: [], wh_role: 'what', lang: 'en' }, query: {}, results: [] });
      context.addTurn({ question: 'Q3', canonicalQuestion: { text: 'Q3', entities: [], dates: [], units: [], wh_role: 'what', lang: 'en' }, query: {}, results: [] });

      const history = context.getConversationHistory();
      expect(history).toEqual(['Q1', 'Q2', 'Q3']);
    });

    test('should return empty array if no turns', () => {
      const context = new ConversationContext();

      expect(context.getConversationHistory()).toEqual([]);
    });
  });

  describe('Serialization', () => {
    test('should serialize to JSON', () => {
      const context = new ConversationContext();

      context.addTurn({
        question: 'Which countries border Germany?',
        canonicalQuestion: {
          text: 'which countries border Germany?',
          entities: [
            { span: [24, 31], value: 'Germany', type: 'PLACE', canonical: ':Germany' }
          ],
          dates: [],
          units: [],
          wh_role: 'which',
          lang: 'en'
        },
        query: { find: ['?x'] },
        results: [{ name: 'France' }]
      });

      const json = context.serialize();
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed.turns).toHaveLength(1);
      expect(parsed.turns[0].question).toBe('Which countries border Germany?');
    });

    test('should deserialize from JSON', () => {
      const original = new ConversationContext();

      original.addTurn({
        question: 'Which countries border Germany?',
        canonicalQuestion: {
          text: 'which countries border Germany?',
          entities: [
            { span: [24, 31], value: 'Germany', type: 'PLACE', canonical: ':Germany' }
          ],
          dates: [],
          units: [],
          wh_role: 'which',
          lang: 'en'
        },
        query: { find: ['?x'] },
        results: [{ name: 'France' }]
      });

      const json = original.serialize();
      const restored = ConversationContext.deserialize(json);

      expect(restored.getTurns()).toHaveLength(1);
      expect(restored.getPreviousQuestion()).toBe('Which countries border Germany?');
      // Should have 2 entities: Germany from canonical question + France from results
      expect(restored.getRecentEntities()).toHaveLength(2);
      expect(restored.getRecentEntities()[0].value).toBe('France'); // Most recent (from results)
      expect(restored.getRecentEntities()[1].value).toBe('Germany'); // From question
    });
  });

  describe('clear()', () => {
    test('should clear all turns', () => {
      const context = new ConversationContext();

      context.addTurn({ question: 'Q1', canonicalQuestion: { text: 'Q1', entities: [], dates: [], units: [], wh_role: 'what', lang: 'en' }, query: {}, results: [] });
      context.addTurn({ question: 'Q2', canonicalQuestion: { text: 'Q2', entities: [], dates: [], units: [], wh_role: 'what', lang: 'en' }, query: {}, results: [] });

      expect(context.getTurns()).toHaveLength(2);

      context.clear();

      expect(context.getTurns()).toHaveLength(0);
      expect(context.getPreviousQuestion()).toBe(null);
      expect(context.getConversationHistory()).toEqual([]);
    });
  });
});
