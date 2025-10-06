/**
 * Integration Test: ConvFinQA Conversation Evaluation
 *
 * Tests the complete conversation pipeline:
 * 1. Build ontology from text
 * 2. Create KG instances from table
 * 3. Execute multi-turn conversation with program execution
 * 4. Compare answers to ground truth
 */

import { ConvFinQAEvaluator } from '../../src/ConvFinQAEvaluator.js';
import { ConversationManager } from '../../src/ConversationManager.js';
import { ProgramExecutor } from '../../src/ProgramExecutor.js';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs';
import path from 'path';

describe('ConvFinQA Evaluation Pipeline', () => {
  let resourceManager;
  let llmClient;
  let mroData;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    // Load MRO dataset
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const dataPath = path.join(__dirname, '../../data/MRO_2007_page134_data.json');
    mroData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  }, 60000);

  describe('ProgramExecutor', () => {
    let executor;

    beforeEach(() => {
      executor = new ProgramExecutor();
    });

    test('should execute single-step programs', () => {
      expect(executor.execute('60.94')).toBe(60.94);
      expect(executor.execute('subtract(60.94, 25.14)')).toBeCloseTo(35.8, 2);
      expect(executor.execute('divide(100, 4)')).toBe(25);
    });

    test('should execute multi-step programs with variable references', () => {
      const result = executor.execute('subtract(60.94, 25.14), divide(#0, 25.14)');
      expect(result).toBeCloseTo(1.42403, 5);
    });

    test('should handle ConvFinQA program format', () => {
      // From the actual dataset
      const program = 'subtract(60.94, 25.14), divide(#0, 25.14)';
      const result = executor.execute(program);

      expect(result).toBeCloseTo(1.42403, 4); // Expected: 142.4%
    });

    test('should support add and multiply operations', () => {
      expect(executor.execute('add(30, 36)')).toBe(66);
      expect(executor.execute('multiply(5, 10)')).toBe(50);
    });
  });

  describe('ConversationManager', () => {
    let manager;

    beforeEach(() => {
      manager = new ConversationManager();
    });

    test('should track conversation history', () => {
      manager.addTurn('What was the exercise price in 2007?', 60.94);
      manager.addTurn('And in 2005?', 25.14);

      const history = manager.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].answer).toBe(60.94);
      expect(history[1].answer).toBe(25.14);
    });

    test('should resolve pronoun references', () => {
      manager.addTurn('What was the exercise price in 2007?', 60.94);

      const resolved = manager.resolveReferences('and what was it in 2005?');

      expect(resolved).toContain('exercise price');
    });

    test('should extract entities from questions', () => {
      const entities = manager.extractEntities(
        'What was the weighted average exercise price per share in 2007?'
      );

      expect(entities).toContain('exercise price');
      expect(entities).toContain('2007');
    });

    test('should generate conversation context', () => {
      manager.addTurn('What was the exercise price in 2007?', 60.94);
      manager.addTurn('And in 2005?', 25.14);

      const context = manager.getConversationContext();

      expect(context).toContain('Q1:');
      expect(context).toContain('A1: 60.94');
      expect(context).toContain('Q2:');
      expect(context).toContain('A2: 25.14');
    });
  });

  describe('ConvFinQAEvaluator - Full Pipeline', () => {
    let evaluator;
    let tripleStore;
    let semanticSearch;

    beforeEach(async () => {
      tripleStore = new SimpleTripleStore();
      semanticSearch = await SemanticSearchProvider.create(resourceManager);

      evaluator = new ConvFinQAEvaluator({
        tripleStore,
        semanticSearch,
        llmClient
      });
    });

    test('should initialize ontology and KG from ConvFinQA data', async () => {
      const dataEntry = mroData[0];
      const result = await evaluator.initialize(dataEntry);

      expect(result.ontology.success).toBe(true);
      expect(result.instances.success).toBe(true);
      expect(result.instances.instancesCreated).toBe(18); // 3 years × 6 properties

      // Verify StockOption class was created
      const stockOption = await tripleStore.query('kg:StockOption', 'rdf:type', 'owl:Class');
      expect(stockOption).toHaveLength(1);

      // Verify instances were created
      const instances = await tripleStore.query(null, 'rdf:type', 'kg:StockOption');
      const mroInstances = instances.filter(([uri]) => uri.includes('MRO_StockOption'));
      expect(mroInstances).toHaveLength(3);

      console.log('✅ Ontology + KG initialized successfully');
    }, 60000);

    test('should evaluate full conversation sequence', async () => {
      const dataEntry = mroData[0];

      // Initialize ontology and KG
      await evaluator.initialize(dataEntry);

      // Evaluate the conversation
      const results = await evaluator.evaluateConversation(dataEntry);

      // Check results
      expect(results.total).toBe(5); // 5 turns in this conversation
      expect(results.correct).toBeGreaterThan(0);
      expect(results.accuracy).toBeGreaterThan(0);

      // Verify specific answers
      const turn1 = results.answers[0]; // "what was the weighted average exercise price per share in 2007?"
      expect(turn1.answer).toBeCloseTo(60.94, 2);
      expect(turn1.correct).toBe(true);

      const turn2 = results.answers[1]; // "and what was it in 2005?"
      expect(turn2.answer).toBeCloseTo(25.14, 2);
      expect(turn2.correct).toBe(true);

      const turn3 = results.answers[2]; // "what was, then, the change over the years?"
      expect(turn3.answer).toBeCloseTo(35.8, 2);
      expect(turn3.correct).toBe(true);

      const turn5 = results.answers[4]; // Final percentage calculation
      expect(turn5.answer).toBeCloseTo(1.42403, 4);
      expect(turn5.correct).toBe(true);

      // Generate and log summary
      const summary = evaluator.generateSummary(results);
      console.log('\n' + summary);

      expect(results.errors).toHaveLength(0);
      console.log(`\n✅ Conversation evaluation: ${results.correct}/${results.total} correct (${(results.accuracy * 100).toFixed(1)}% accuracy)`);
    }, 60000);

    test('should handle conversation with context resolution', async () => {
      const dataEntry = mroData[0];

      await evaluator.initialize(dataEntry);

      const manager = evaluator.conversationManager;
      const executor = evaluator.programExecutor;

      // Simulate conversation turns
      const turns = [
        { question: 'What was the exercise price in 2007?', program: '60.94' },
        { question: 'And in 2005?', program: '25.14' },
        { question: 'What was the change?', program: 'subtract(60.94, 25.14)' },
        { question: 'What percentage is that?', program: 'subtract(60.94, 25.14), divide(#0, 25.14)' }
      ];

      for (const turn of turns) {
        const resolvedQuestion = manager.resolveReferences(turn.question);
        const answer = executor.execute(turn.program);

        manager.addTurn(turn.question, answer, {
          program: turn.program,
          entities: manager.extractEntities(turn.question)
        });

        expect(answer).toBeDefined();
        expect(typeof answer).toBe('number');
      }

      const context = manager.getContext();
      expect(context.turnCount).toBe(4);
      expect(context.lastCalculation).toBeTruthy();

      console.log('✅ Context resolution working correctly');
    }, 60000);
  });
});
