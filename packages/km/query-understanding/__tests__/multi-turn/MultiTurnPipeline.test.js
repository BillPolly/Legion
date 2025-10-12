/**
 * Unit tests for MultiTurnPipeline - Multi-turn conversation wrapper
 *
 * Tests the multi-turn conversation flow with context injection
 */

import { MultiTurnPipeline } from '../../src/MultiTurnPipeline.js';
import { ConversationContext } from '../../src/context/ConversationContext.js';

// Mock QueryUnderstandingPipeline
class MockQueryUnderstandingPipeline {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.initialized = false;
    this.dataSource = null;
  }

  async initialize() {
    this.initialized = true;
    // Mock dataSource for GraphContextRetriever
    this.dataSource = {
      query: async () => []  // Return empty results by default
    };
  }

  async process(question, context = {}) {
    // Return mock result
    return {
      canonicalQuestion: {
        text: question,
        entities: context.mockEntities || [],
        dates: [],
        units: [],
        wh_role: 'what',
        lang: 'en'
      },
      query: { find: ['?x'] },
      results: context.mockResults || []
    };
  }
}

describe('MultiTurnPipeline', () => {
  let mockResourceManager;

  beforeEach(() => {
    mockResourceManager = {
      get: async (key) => {
        if (key === 'llmClient') {
          return { generate: async () => 'mock' };
        }
        return null;
      }
    };
  });

  describe('Constructor', () => {
    test('should create instance with resource manager', () => {
      const pipeline = new MultiTurnPipeline(mockResourceManager);

      expect(pipeline).toBeInstanceOf(MultiTurnPipeline);
      expect(pipeline.conversationContext).toBeInstanceOf(ConversationContext);
    });

    test('should accept conversation context options', () => {
      const pipeline = new MultiTurnPipeline(mockResourceManager, {
        maxTurns: 5
      });

      expect(pipeline.conversationContext.maxTurns).toBe(5);
    });

    test('should throw if resource manager not provided', () => {
      expect(() => {
        new MultiTurnPipeline();
      }).toThrow('ResourceManager is required');
    });
  });

  describe('initialize()', () => {
    test('should initialize underlying pipeline', async () => {
      const pipeline = new MultiTurnPipeline(mockResourceManager);
      pipeline.pipeline = new MockQueryUnderstandingPipeline(mockResourceManager);

      await pipeline.initialize();

      expect(pipeline.pipeline.initialized).toBe(true);
    });
  });

  describe('ask()', () => {
    test('should process question and update context', async () => {
      const pipeline = new MultiTurnPipeline(mockResourceManager);
      pipeline.pipeline = new MockQueryUnderstandingPipeline(mockResourceManager);
      await pipeline.initialize();

      const result = await pipeline.ask('Which countries border Germany?');

      expect(result.canonicalQuestion).toBeDefined();
      expect(result.query).toBeDefined();
      expect(pipeline.conversationContext.getTurns()).toHaveLength(1);
    });

    test('should inject conversation context into pipeline', async () => {
      const pipeline = new MultiTurnPipeline(mockResourceManager);
      pipeline.pipeline = new MockQueryUnderstandingPipeline(mockResourceManager);
      await pipeline.initialize();

      // First turn
      await pipeline.ask('Which countries border Germany?');

      // Second turn - context should be injected
      let capturedContext = null;
      pipeline.pipeline.process = async (question, context) => {
        capturedContext = context;
        return {
          canonicalQuestion: { text: question, entities: [], dates: [], units: [], wh_role: 'what', lang: 'en' },
          query: {},
          results: []
        };
      };

      await pipeline.ask('What about France?');

      expect(capturedContext).toBeDefined();
      expect(capturedContext.previousQuestion).toBe('Which countries border Germany?');
      expect(capturedContext.conversationHistory).toEqual(['Which countries border Germany?']);
    });

    test('should track entities across turns', async () => {
      const pipeline = new MultiTurnPipeline(mockResourceManager);
      pipeline.pipeline = new MockQueryUnderstandingPipeline(mockResourceManager);
      await pipeline.initialize();

      await pipeline.ask('Which countries border Germany?', {
        mockEntities: [
          { span: [24, 31], value: 'Germany', type: 'PLACE', canonical: ':Germany' }
        ],
        mockResults: [
          { name: 'France', type: 'Country' }
        ]
      });

      const entities = pipeline.getRecentEntities();
      expect(entities.length).toBeGreaterThan(0);
      expect(entities.some(e => e.value === 'Germany')).toBe(true);
    });
  });

  describe('getContext()', () => {
    test('should return conversation context', () => {
      const pipeline = new MultiTurnPipeline(mockResourceManager);

      const context = pipeline.getContext();

      expect(context).toBeInstanceOf(ConversationContext);
    });
  });

  describe('getRecentEntities()', () => {
    test('should delegate to conversation context', async () => {
      const pipeline = new MultiTurnPipeline(mockResourceManager);
      pipeline.pipeline = new MockQueryUnderstandingPipeline(mockResourceManager);
      await pipeline.initialize();

      await pipeline.ask('Which countries border Germany?', {
        mockEntities: [
          { span: [24, 31], value: 'Germany', type: 'PLACE', canonical: ':Germany' }
        ]
      });

      const entities = pipeline.getRecentEntities(5);
      expect(Array.isArray(entities)).toBe(true);
    });
  });

  describe('clear()', () => {
    test('should clear conversation context', async () => {
      const pipeline = new MultiTurnPipeline(mockResourceManager);
      pipeline.pipeline = new MockQueryUnderstandingPipeline(mockResourceManager);
      await pipeline.initialize();

      await pipeline.ask('Q1');
      await pipeline.ask('Q2');

      expect(pipeline.conversationContext.getTurns()).toHaveLength(2);

      pipeline.clear();

      expect(pipeline.conversationContext.getTurns()).toHaveLength(0);
    });
  });

  describe('serialize() / deserialize()', () => {
    test('should serialize conversation state', async () => {
      const pipeline = new MultiTurnPipeline(mockResourceManager);
      pipeline.pipeline = new MockQueryUnderstandingPipeline(mockResourceManager);
      await pipeline.initialize();

      await pipeline.ask('Which countries border Germany?');

      const state = pipeline.serialize();
      expect(typeof state).toBe('string');

      const parsed = JSON.parse(state);
      expect(parsed.turns).toHaveLength(1);
    });

    test('should deserialize conversation state', async () => {
      const pipeline1 = new MultiTurnPipeline(mockResourceManager);
      pipeline1.pipeline = new MockQueryUnderstandingPipeline(mockResourceManager);
      await pipeline1.initialize();

      await pipeline1.ask('Which countries border Germany?');
      const state = pipeline1.serialize();

      const pipeline2 = new MultiTurnPipeline(mockResourceManager);
      pipeline2.deserialize(state);

      expect(pipeline2.conversationContext.getTurns()).toHaveLength(1);
      expect(pipeline2.conversationContext.getPreviousQuestion()).toBe('Which countries border Germany?');
    });
  });
});
