/**
 * Integration test for full ConvFinQA pipeline
 *
 * Tests the complete architecture:
 * Pipeline → QueryInterpreter → FactQueryExecutor
 */

import { ConvFinQAOrchestrator } from '../ConvFinQAOrchestrator.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ConvFinQA Integration', () => {
  let resourceManager;
  let orchestrator;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  }, 30000);

  beforeEach(() => {
    orchestrator = new ConvFinQAOrchestrator(resourceManager);
  });

  afterEach(async () => {
    if (orchestrator) {
      orchestrator.reset();
    }
  });

  describe('Multi-turn conversation with history', () => {
    test('should handle Turn 1: arithmetic operation on entity', async () => {
      // Document with UPS and S&P 500 performance data (ConvFinQA format)
      const document = {
        table: {
          '12/31/04': {
            'united parcel service inc .': 100,
            's&p 500 index': 100,
            'dow jones transportation average': 100
          },
          '12/31/09': {
            'united parcel service inc .': 75.95,
            's&p 500 index': 102.11,
            'dow jones transportation average': 115.88
          }
        },
        pre_text: 'Performance comparison of United Parcel Service Inc. (UPS), S&P 500 Index, and Dow Jones Transportation Average from 2004 to 2009.',
        post_text: ''
      };

      await orchestrator.initialize(document, 'test-example-1');

      // Turn 1: "what was the change in the performance of the united parcel service inc . from 2004 to 2009?"
      const result1 = await orchestrator.processQuestion(
        'what was the change in the performance of the united parcel service inc . from 2004 to 2009?'
      );

      console.log('Turn 1 Result:', JSON.stringify(result1, null, 2));
      console.log('Turn 1 execParams:', JSON.stringify(orchestrator.getHistory()[0].execParams, null, 2));

      expect(result1.success).toBe(true);
      expect(result1.answer).toBeCloseTo(-24.05, 2);
      expect(result1.type).toBe('computed');
      expect(result1.program).toContain('subtract');
    }, 60000);

    test('should handle Turn 1 + Turn 2: operation on previous result', async () => {
      // Document with UPS and S&P 500 performance data (ConvFinQA format)
      const document = {
        table: {
          '12/31/04': {
            'united parcel service inc .': 100,
            's&p 500 index': 100,
            'dow jones transportation average': 100
          },
          '12/31/09': {
            'united parcel service inc .': 75.95,
            's&p 500 index': 102.11,
            'dow jones transportation average': 115.88
          }
        },
        pre_text: 'Performance comparison of United Parcel Service Inc. (UPS), S&P 500 Index, and Dow Jones Transportation Average from 2004 to 2009.',
        post_text: ''
      };

      await orchestrator.initialize(document, 'test-example-2');

      // Turn 1: "what was the change in the performance of the united parcel service inc . from 2004 to 2009?"
      const result1 = await orchestrator.processQuestion(
        'what was the change in the performance of the united parcel service inc . from 2004 to 2009?'
      );

      console.log('Turn 1 Result:', JSON.stringify(result1, null, 2));

      expect(result1.success).toBe(true);
      expect(result1.answer).toBeCloseTo(-24.05, 2);

      // Turn 2: "and how much does this change represent in relation to that performance in 2004, in percentage?"
      // This should use the previous result (-24.05) and divide by 2004 performance (100)
      const result2 = await orchestrator.processQuestion(
        'and how much does this change represent in relation to that performance in 2004, in percentage?'
      );

      console.log('Turn 2 Result:', JSON.stringify(result2, null, 2));
      console.log('Turn 2 execParams:', JSON.stringify(orchestrator.getHistory()[1].execParams, null, 2));

      expect(result2.success).toBe(true);
      // Ground truth: -24.05%
      // Calculation: (-24.05 / 100) * 100 = -24.05%
      expect(result2.answer).toBeCloseTo(-24.05, 2);
      expect(result2.type).toBe('computed');
    }, 60000);

    test('should handle full 6-turn conversation', async () => {
      // Document with UPS and S&P 500 performance data (ConvFinQA format)
      const document = {
        table: {
          '12/31/04': {
            'united parcel service inc .': 100,
            's&p 500 index': 100,
            'dow jones transportation average': 100
          },
          '12/31/09': {
            'united parcel service inc .': 75.95,
            's&p 500 index': 102.11,
            'dow jones transportation average': 115.88
          }
        },
        pre_text: 'Performance comparison of United Parcel Service Inc. (UPS), S&P 500 Index, and Dow Jones Transportation Average from 2004 to 2009.',
        post_text: ''
      };

      await orchestrator.initialize(document, 'test-example-3');

      const questions = [
        'what was the change in the performance of the united parcel service inc . from 2004 to 2009?',
        'and how much does this change represent in relation to that performance in 2004, in percentage?',
        'what was the performance value of the s&p 500 index in 2009?',
        'what was, then, the change in that performance from 2004 to 2009?',
        'and how much does this change represent in relation to that performance in 2004, in percentage?',
        'what is, then, the difference between the percent representation of the united parcel service inc . and the s&p 500 index?'
      ];

      const groundTruths = [
        -24.05,    // Turn 1: subtract(75.95, 100)
        -24.05,    // Turn 2: (−24.05 / 100) * 100
        102.11,    // Turn 3: lookup
        2.11,      // Turn 4: subtract(102.11, 100)
        2.11,      // Turn 5: (2.11 / 100) * 100
        -26.16     // Turn 6: subtract(-24.05%, 2.11%)
      ];

      const results = await orchestrator.processConversation(questions);

      // Log all results
      results.forEach((result, i) => {
        console.log(`\nTurn ${i + 1}:`);
        console.log('  Question:', questions[i]);
        console.log('  Ground Truth:', groundTruths[i]);
        console.log('  Answer:', result.answer);
        console.log('  Success:', result.success);
        console.log('  Type:', result.type);
        console.log('  Program:', result.program);
        if (result.error) {
          console.log('  Error:', result.error);
        }
        console.log('  execParams:', JSON.stringify(orchestrator.getHistory()[i].execParams, null, 2));
      });

      // Verify each turn
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.answer).toBeCloseTo(groundTruths[i], 2);
      });

      // Calculate accuracy
      const correctCount = results.filter((r, i) => {
        return r.success && Math.abs(r.answer - groundTruths[i]) < 0.01;
      }).length;

      console.log(`\nAccuracy: ${correctCount}/${results.length} (${(correctCount / results.length * 100).toFixed(1)}%)`);

      expect(correctCount).toBe(results.length);
    }, 120000);
  });
});
