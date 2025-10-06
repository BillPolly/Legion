/**
 * FinQA/ConvFinQA Evaluation Logic (converted from Python)
 *
 * Based on: https://github.com/czyssrs/FinQA/blob/master/code/evaluate/evaluate.py
 *
 * This implements the exact evaluation logic used in the FinQA paper.
 */

export class FinQAEvaluator {
  /**
   * Convert string to number (based on FinQA str_to_num)
   *
   * Key logic:
   * - Removes commas
   * - Converts percentages by dividing by 100 (e.g., "1.3%" -> 0.013)
   * - Handles "const_" prefixed numbers
   *
   * @param {string} text - The text to convert
   * @returns {number|null} The converted number or null if invalid
   */
  static strToNum(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    text = text.trim();

    // Handle const_ prefix
    if (text.startsWith('const_')) {
      text = text.substring(6); // Remove "const_"
    }

    // Remove commas
    text = text.replace(/,/g, '');

    // Handle percentage: divide by 100
    if (text.endsWith('%')) {
      text = text.slice(0, -1); // Remove %
      const num = parseFloat(text);
      if (isNaN(num)) {
        return null;
      }
      return num / 100; // Convert percentage to decimal
    }

    // Parse regular number
    const num = parseFloat(text);
    if (isNaN(num)) {
      return null;
    }

    return num;
  }

  /**
   * Round number to specified decimal places (default 5, matching FinQA)
   *
   * @param {number} num - Number to round
   * @param {number} decimals - Decimal places (default 5)
   * @returns {number} Rounded number
   */
  static roundToDecimals(num, decimals = 5) {
    if (typeof num !== 'number' || isNaN(num)) {
      return num;
    }
    const multiplier = Math.pow(10, decimals);
    return Math.round(num * multiplier) / multiplier;
  }

  /**
   * Evaluate answer correctness using FinQA logic
   *
   * @param {string} predictedAnswer - Agent's predicted answer
   * @param {string} goldAnswer - Gold standard answer from dataset
   * @returns {Object} Evaluation result with correct flag and details
   */
  static evaluateAnswer(predictedAnswer, goldAnswer) {
    // Convert both to numbers using FinQA logic
    const predictedNum = this.strToNum(String(predictedAnswer));
    const goldNum = this.strToNum(String(goldAnswer));

    // If either conversion failed, not correct
    if (predictedNum === null || goldNum === null) {
      return {
        correct: false,
        predictedNum,
        goldNum,
        predictedAnswer,
        goldAnswer,
        reason: 'Conversion failed'
      };
    }

    // Round to 5 decimal places (FinQA standard)
    const predictedRounded = this.roundToDecimals(predictedNum, 5);
    const goldRounded = this.roundToDecimals(goldNum, 5);

    // Exact match required
    const correct = predictedRounded === goldRounded;

    return {
      correct,
      predictedNum,
      goldNum,
      predictedRounded,
      goldRounded,
      predictedAnswer,
      goldAnswer,
      reason: correct ? 'Match' : 'No match'
    };
  }

  /**
   * Batch evaluate multiple predictions
   *
   * @param {Array<{predicted: string, gold: string}>} examples
   * @returns {Object} Evaluation metrics
   */
  static evaluateBatch(examples) {
    let correct = 0;
    const results = [];

    for (const example of examples) {
      const result = this.evaluateAnswer(example.predicted, example.gold);
      results.push(result);
      if (result.correct) {
        correct++;
      }
    }

    const accuracy = examples.length > 0 ? (correct / examples.length) * 100 : 0;

    return {
      accuracy,
      correct,
      total: examples.length,
      results
    };
  }
}
