import {
  accuracyScore,
  confusionMatrix,
  precisionScore,
  recallScore,
  f1Score
} from '../../src/utils/evaluation-metrics.js';

describe('Evaluation Metrics', () => {
  describe('accuracyScore', () => {
    test('should calculate perfect accuracy', () => {
      const yTrue = [1, 1, 0, 0];
      const yPred = [1, 1, 0, 0];
      expect(accuracyScore(yTrue, yPred)).toBe(1.0);
    });

    test('should calculate 50% accuracy', () => {
      const yTrue = [1, 1, 0, 0];
      const yPred = [1, 0, 1, 0];
      expect(accuracyScore(yTrue, yPred)).toBe(0.5);
    });

    test('should calculate zero accuracy', () => {
      const yTrue = [1, 1, 0, 0];
      const yPred = [0, 0, 1, 1];
      expect(accuracyScore(yTrue, yPred)).toBe(0);
    });

    test('should handle empty arrays', () => {
      expect(() => accuracyScore([], [])).toThrow();
    });

    test('should handle mismatched array lengths', () => {
      expect(() => accuracyScore([1, 0], [1])).toThrow();
    });
  });

  describe('confusionMatrix', () => {
    test('should calculate confusion matrix correctly', () => {
      const yTrue = [1, 1, 0, 0];
      const yPred = [1, 0, 0, 1];
      const cm = confusionMatrix(yTrue, yPred);

      // [[TN, FP], [FN, TP]]
      expect(cm).toEqual([[1, 1], [1, 1]]);
    });

    test('should handle all correct predictions', () => {
      const yTrue = [1, 1, 0, 0];
      const yPred = [1, 1, 0, 0];
      const cm = confusionMatrix(yTrue, yPred);

      expect(cm).toEqual([[2, 0], [0, 2]]);
    });

    test('should handle all incorrect predictions', () => {
      const yTrue = [1, 1, 0, 0];
      const yPred = [0, 0, 1, 1];
      const cm = confusionMatrix(yTrue, yPred);

      expect(cm).toEqual([[0, 2], [2, 0]]);
    });

    test('should handle edge case with only positives', () => {
      const yTrue = [1, 1, 1, 1];
      const yPred = [1, 1, 0, 0];
      const cm = confusionMatrix(yTrue, yPred);

      expect(cm).toEqual([[0, 0], [2, 2]]);
    });

    test('should handle edge case with only negatives', () => {
      const yTrue = [0, 0, 0, 0];
      const yPred = [0, 0, 1, 1];
      const cm = confusionMatrix(yTrue, yPred);

      expect(cm).toEqual([[2, 2], [0, 0]]);
    });
  });

  describe('precisionScore', () => {
    test('should calculate perfect precision', () => {
      const yTrue = [1, 1, 0, 0];
      const yPred = [1, 1, 0, 0];
      expect(precisionScore(yTrue, yPred)).toBe(1.0);
    });

    test('should calculate 50% precision', () => {
      const yTrue = [1, 1, 0, 0];
      const yPred = [1, 0, 1, 0];
      // TP=1, FP=1 => 1/(1+1) = 0.5
      expect(precisionScore(yTrue, yPred)).toBe(0.5);
    });

    test('should handle no positive predictions', () => {
      const yTrue = [1, 1, 0, 0];
      const yPred = [0, 0, 0, 0];
      // TP=0, FP=0 => 0/0 = 0 (by convention)
      expect(precisionScore(yTrue, yPred)).toBe(0);
    });

    test('should handle all false positives', () => {
      const yTrue = [0, 0, 0, 0];
      const yPred = [1, 1, 1, 1];
      // TP=0, FP=4 => 0/4 = 0
      expect(precisionScore(yTrue, yPred)).toBe(0);
    });
  });

  describe('recallScore', () => {
    test('should calculate perfect recall', () => {
      const yTrue = [1, 1, 0, 0];
      const yPred = [1, 1, 0, 0];
      expect(recallScore(yTrue, yPred)).toBe(1.0);
    });

    test('should calculate 50% recall', () => {
      const yTrue = [1, 1, 0, 0];
      const yPred = [1, 0, 0, 0];
      // TP=1, FN=1 => 1/(1+1) = 0.5
      expect(recallScore(yTrue, yPred)).toBe(0.5);
    });

    test('should handle no actual positives', () => {
      const yTrue = [0, 0, 0, 0];
      const yPred = [1, 1, 1, 1];
      // TP=0, FN=0 => 0/0 = 0 (by convention)
      expect(recallScore(yTrue, yPred)).toBe(0);
    });

    test('should handle zero recall', () => {
      const yTrue = [1, 1, 1, 1];
      const yPred = [0, 0, 0, 0];
      // TP=0, FN=4 => 0/4 = 0
      expect(recallScore(yTrue, yPred)).toBe(0);
    });
  });

  describe('f1Score', () => {
    test('should calculate perfect F1', () => {
      const precision = 1.0;
      const recall = 1.0;
      expect(f1Score(precision, recall)).toBe(1.0);
    });

    test('should calculate F1 with different precision and recall', () => {
      const precision = 0.8;
      const recall = 0.6;
      // F1 = 2 * (0.8 * 0.6) / (0.8 + 0.6) = 2 * 0.48 / 1.4 ≈ 0.686
      const f1 = f1Score(precision, recall);
      expect(f1).toBeCloseTo(0.686, 3);
    });

    test('should handle zero precision and recall', () => {
      const precision = 0;
      const recall = 0;
      // 0/0 = 0 by convention
      expect(f1Score(precision, recall)).toBe(0);
    });

    test('should handle zero precision', () => {
      const precision = 0;
      const recall = 1.0;
      expect(f1Score(precision, recall)).toBe(0);
    });

    test('should handle zero recall', () => {
      const precision = 1.0;
      const recall = 0;
      expect(f1Score(precision, recall)).toBe(0);
    });
  });
});
