/**
 * Unit tests for PromptEvaluator
 * Evaluates the quality and effectiveness of prompts and responses
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PromptEvaluator } from '../../src/PromptEvaluator.js';
import { ResourceManager } from '@legion/resource-manager';

describe('PromptEvaluator', () => {
  let evaluator;
  let resourceManager;

  beforeEach(async () => {
    resourceManager = await ResourceManager.getInstance();
    evaluator = new PromptEvaluator(resourceManager);
    await evaluator.initialize();
  });

  afterEach(async () => {
    if (evaluator) {
      await evaluator.cleanup();
    }
  });

  describe('Initialization', () => {
    it('should require ResourceManager', () => {
      expect(() => new PromptEvaluator()).toThrow('ResourceManager is required');
    });

    it('should initialize with evaluation metrics', async () => {
      expect(evaluator.metrics).toBeDefined();
      expect(evaluator.initialized).toBe(true);
    });
  });

  describe('Response Quality Evaluation', () => {
    it('should evaluate response relevance', async () => {
      const prompt = 'What is the capital of France?';
      const response = 'The capital of France is Paris.';
      
      const evaluation = await evaluator.evaluateRelevance(prompt, response);
      
      expect(evaluation.score).toBeGreaterThan(0.8);
      expect(evaluation.relevant).toBe(true);
      expect(evaluation.reasoning).toBeDefined();
    });

    it('should detect irrelevant responses', async () => {
      const prompt = 'What is the capital of France?';
      const response = 'I like pizza.';
      
      const evaluation = await evaluator.evaluateRelevance(prompt, response);
      
      expect(evaluation.score).toBeLessThan(0.3);
      expect(evaluation.relevant).toBe(false);
    });

    it('should evaluate response completeness', async () => {
      const prompt = 'Explain the water cycle in detail.';
      const completeResponse = 'The water cycle consists of evaporation, condensation, precipitation, and collection.';
      const incompleteResponse = 'Water evaporates.';
      
      const completeEval = await evaluator.evaluateCompleteness(prompt, completeResponse);
      const incompleteEval = await evaluator.evaluateCompleteness(prompt, incompleteResponse);
      
      expect(completeEval.score).toBeGreaterThan(incompleteEval.score);
      expect(completeEval.complete).toBe(true);
      expect(incompleteEval.complete).toBe(false);
    });

    it('should evaluate response accuracy', async () => {
      const prompt = 'What is 2 + 2?';
      const correctResponse = '2 + 2 equals 4.';
      const incorrectResponse = '2 + 2 equals 5.';
      
      const correctEval = await evaluator.evaluateAccuracy(prompt, correctResponse);
      const incorrectEval = await evaluator.evaluateAccuracy(prompt, incorrectResponse);
      
      expect(correctEval.accurate).toBe(true);
      expect(incorrectEval.accurate).toBe(false);
    });
  });

  describe('Prompt Quality Evaluation', () => {
    it('should evaluate prompt clarity', async () => {
      const clearPrompt = 'List three benefits of regular exercise.';
      const unclearPrompt = 'Tell me about the thing that people do.';
      
      const clearEval = await evaluator.evaluateClarity(clearPrompt);
      const unclearEval = await evaluator.evaluateClarity(unclearPrompt);
      
      expect(clearEval.score).toBeGreaterThan(unclearEval.score);
      expect(clearEval.clear).toBe(true);
      expect(unclearEval.suggestions).toBeDefined();
    });

    it('should evaluate prompt specificity', async () => {
      const specificPrompt = 'Write a 100-word summary of World War II focusing on key battles.';
      const vaguePrompt = 'Tell me about history.';
      
      const specificEval = await evaluator.evaluateSpecificity(specificPrompt);
      const vagueEval = await evaluator.evaluateSpecificity(vaguePrompt);
      
      expect(specificEval.score).toBeGreaterThan(vagueEval.score);
      expect(specificEval.specific).toBe(true);
    });

    it('should detect ambiguous prompts', async () => {
      const ambiguousPrompt = 'What is it?';
      const clearPrompt = 'What is machine learning?';
      
      const ambiguousEval = await evaluator.detectAmbiguity(ambiguousPrompt);
      const clearEval = await evaluator.detectAmbiguity(clearPrompt);
      
      expect(ambiguousEval.ambiguous).toBe(true);
      expect(ambiguousEval.issues).toContain('unclear referent');
      expect(clearEval.ambiguous).toBe(false);
    });
  });

  describe('Tone and Style Evaluation', () => {
    it('should evaluate tone consistency', async () => {
      const prompt = 'Be professional and formal.';
      const formalResponse = 'I would be delighted to assist you with your inquiry.';
      const casualResponse = 'Hey, sure thing! What\'s up?';
      
      const formalEval = await evaluator.evaluateTone(prompt, formalResponse, 'formal');
      const casualEval = await evaluator.evaluateTone(prompt, casualResponse, 'formal');
      
      expect(formalEval.consistent).toBe(true);
      expect(casualEval.consistent).toBe(false);
    });

    it('should detect sentiment', async () => {
      const positiveText = 'This is absolutely wonderful! I love it!';
      const negativeText = 'This is terrible and disappointing.';
      const neutralText = 'The meeting is at 3 PM.';
      
      const positive = await evaluator.detectSentiment(positiveText);
      const negative = await evaluator.detectSentiment(negativeText);
      const neutral = await evaluator.detectSentiment(neutralText);
      
      expect(positive.sentiment).toBe('positive');
      expect(negative.sentiment).toBe('negative');
      expect(neutral.sentiment).toBe('neutral');
    });
  });

  describe('Safety and Compliance', () => {
    it('should detect potentially harmful content', async () => {
      const safeResponse = 'Here is information about healthy cooking.';
      const unsafeResponse = 'Here is how to make explosives...';  // Example only
      
      const safeEval = await evaluator.evaluateSafety(safeResponse);
      const unsafeEval = await evaluator.evaluateSafety(unsafeResponse);
      
      expect(safeEval.safe).toBe(true);
      expect(unsafeEval.safe).toBe(false);
      expect(unsafeEval.concerns).toContain('potentially harmful');
    });

    it('should check for bias', async () => {
      const unbiasedText = 'All people deserve equal opportunities.';
      const biasedText = 'Only certain groups are good at math.';  // Example of bias
      
      const unbiasedEval = await evaluator.checkBias(unbiasedText);
      const biasedEval = await evaluator.checkBias(biasedText);
      
      expect(unbiasedEval.biasDetected).toBe(false);
      expect(biasedEval.biasDetected).toBe(true);
      expect(biasedEval.biasTypes).toBeDefined();
    });
  });

  describe('Coherence and Structure', () => {
    it('should evaluate logical coherence', async () => {
      const coherentText = 'First, we prepare ingredients. Next, we cook them. Finally, we serve the dish.';
      const incoherentText = 'Finally we serve. First we eat. Then we cook maybe.';
      
      const coherentEval = await evaluator.evaluateCoherence(coherentText);
      const incoherentEval = await evaluator.evaluateCoherence(incoherentText);
      
      expect(coherentEval.score).toBeGreaterThan(incoherentEval.score);
      expect(coherentEval.coherent).toBe(true);
    });

    it('should evaluate response structure', async () => {
      const structuredResponse = `
        1. Introduction: Brief overview
        2. Main Points: Key arguments
        3. Conclusion: Summary
      `;
      const unstructuredResponse = 'Just some random thoughts thrown together without any order.';
      
      const structuredEval = await evaluator.evaluateStructure(structuredResponse);
      const unstructuredEval = await evaluator.evaluateStructure(unstructuredResponse);
      
      expect(structuredEval.wellStructured).toBe(true);
      expect(unstructuredEval.wellStructured).toBe(false);
    });
  });

  describe('Comparative Evaluation', () => {
    it('should compare multiple responses', async () => {
      const prompt = 'Explain photosynthesis.';
      const responses = [
        'Plants make food from sunlight.',
        'Photosynthesis is the process by which plants convert light energy into chemical energy.',
        'Green stuff happens in leaves.'
      ];
      
      const comparison = await evaluator.compareResponses(prompt, responses);
      
      expect(comparison.rankings).toHaveLength(3);
      expect(comparison.best).toBe(1);  // Index of best response
      expect(comparison.scores).toBeDefined();
    }, 30000);

    it('should identify best prompt from alternatives', async () => {
      const prompts = [
        'Do the thing.',
        'Please analyze the provided data and generate insights.',
        'Can you help with analysis of the data to find patterns?'
      ];
      
      const evaluation = await evaluator.selectBestPrompt(prompts, {
        criteria: ['clarity', 'specificity', 'politeness']
      });
      
      expect(evaluation.bestIndex).toBeGreaterThan(0);
      expect(evaluation.scores).toBeDefined();
      expect(evaluation.reasoning).toBeDefined();
    });
  });

  describe('Metrics and Scoring', () => {
    it('should calculate composite quality score', async () => {
      const prompt = 'Summarize this article in 3 bullet points.';
      const response = `
        • Main point about the topic
        • Supporting evidence discussed
        • Conclusion and implications
      `;
      
      const score = await evaluator.calculateQualityScore(prompt, response, {
        weights: {
          relevance: 0.3,
          completeness: 0.3,
          clarity: 0.2,
          structure: 0.2
        }
      });
      
      expect(score.overall).toBeGreaterThan(0);
      expect(score.overall).toBeLessThanOrEqual(1);
      expect(score.breakdown).toBeDefined();
    });

    it('should track evaluation metrics over time', async () => {
      const prompt = 'Test prompt';
      const response = 'Test response';
      
      // Perform multiple evaluations
      await evaluator.evaluateRelevance(prompt, response);
      await evaluator.evaluateClarity(prompt);
      await evaluator.evaluateCompleteness(prompt, response);
      
      const metrics = await evaluator.getMetrics();
      
      expect(metrics.totalEvaluations).toBeGreaterThan(0);
      expect(metrics.averageScores).toBeDefined();
      expect(metrics.evaluationTypes).toContain('relevance');
    });
  });

  describe('Custom Evaluation Criteria', () => {
    it('should evaluate against custom criteria', async () => {
      const customCriteria = {
        name: 'technical_accuracy',
        description: 'Response should use correct technical terminology',
        checkFunction: (response) => {
          const technicalTerms = ['algorithm', 'function', 'variable'];
          return technicalTerms.some(term => response.toLowerCase().includes(term));
        }
      };
      
      const response = 'The algorithm uses a recursive function with local variables.';
      const evaluation = await evaluator.evaluateCustom(response, customCriteria);
      
      expect(evaluation.passed).toBe(true);
      expect(evaluation.criteriaName).toBe('technical_accuracy');
    });

    it('should support regex-based criteria', async () => {
      const regexCriteria = {
        pattern: /\b\d{3}-\d{3}-\d{4}\b/,  // Phone number pattern
        name: 'phone_number_format'
      };
      
      const validResponse = 'Call us at 555-123-4567.';
      const invalidResponse = 'Call us at 5551234567.';
      
      const validEval = await evaluator.evaluatePattern(validResponse, regexCriteria);
      const invalidEval = await evaluator.evaluatePattern(invalidResponse, regexCriteria);
      
      expect(validEval.matches).toBe(true);
      expect(invalidEval.matches).toBe(false);
    });
  });

  describe('Feedback Generation', () => {
    it('should generate improvement suggestions', async () => {
      const weakPrompt = 'Tell me stuff.';
      
      const feedback = await evaluator.generateFeedback(weakPrompt);
      
      expect(feedback.suggestions).toBeDefined();
      expect(feedback.suggestions.length).toBeGreaterThan(0);
      expect(feedback.improvedVersion).toBeDefined();
      expect(feedback.improvements).toContain('specificity');
    });

    it('should provide actionable recommendations', async () => {
      const evaluation = {
        relevance: 0.6,
        clarity: 0.4,
        completeness: 0.7
      };
      
      const recommendations = await evaluator.generateRecommendations(evaluation);
      
      expect(recommendations.priority).toBe('clarity');  // Lowest score
      expect(recommendations.actions).toBeDefined();
      expect(recommendations.actions.length).toBeGreaterThan(0);
    });
  });
});