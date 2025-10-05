/**
 * Evaluation metrics for binary classification
 * Replacements for scikit-learn metrics functions
 */

/**
 * Calculate accuracy score
 * @param {Array<number>} yTrue - True labels (0 or 1)
 * @param {Array<number>} yPred - Predicted labels (0 or 1)
 * @returns {number} Accuracy score (0-1)
 */
export function accuracyScore(yTrue, yPred) {
  if (!yTrue || !yPred || yTrue.length === 0) {
    throw new Error('yTrue and yPred must be non-empty arrays');
  }

  if (yTrue.length !== yPred.length) {
    throw new Error('yTrue and yPred must have the same length');
  }

  const correct = yTrue.filter((val, i) => val === yPred[i]).length;
  return correct / yTrue.length;
}

/**
 * Calculate confusion matrix
 * @param {Array<number>} yTrue - True labels (0 or 1)
 * @param {Array<number>} yPred - Predicted labels (0 or 1)
 * @returns {Array<Array<number>>} [[TN, FP], [FN, TP]]
 */
export function confusionMatrix(yTrue, yPred) {
  if (!yTrue || !yPred || yTrue.length === 0) {
    throw new Error('yTrue and yPred must be non-empty arrays');
  }

  if (yTrue.length !== yPred.length) {
    throw new Error('yTrue and yPred must have the same length');
  }

  let tp = 0; // True Positives
  let tn = 0; // True Negatives
  let fp = 0; // False Positives
  let fn = 0; // False Negatives

  for (let i = 0; i < yTrue.length; i++) {
    if (yTrue[i] === 1 && yPred[i] === 1) tp++;
    else if (yTrue[i] === 0 && yPred[i] === 0) tn++;
    else if (yTrue[i] === 0 && yPred[i] === 1) fp++;
    else if (yTrue[i] === 1 && yPred[i] === 0) fn++;
  }

  return [[tn, fp], [fn, tp]];
}

/**
 * Calculate precision score
 * @param {Array<number>} yTrue - True labels (0 or 1)
 * @param {Array<number>} yPred - Predicted labels (0 or 1)
 * @returns {number} Precision score (0-1)
 */
export function precisionScore(yTrue, yPred) {
  const cm = confusionMatrix(yTrue, yPred);
  const tp = cm[1][1];
  const fp = cm[0][1];

  if (tp + fp === 0) {
    return 0; // No positive predictions
  }

  return tp / (tp + fp);
}

/**
 * Calculate recall score
 * @param {Array<number>} yTrue - True labels (0 or 1)
 * @param {Array<number>} yPred - Predicted labels (0 or 1)
 * @returns {number} Recall score (0-1)
 */
export function recallScore(yTrue, yPred) {
  const cm = confusionMatrix(yTrue, yPred);
  const tp = cm[1][1];
  const fn = cm[1][0];

  if (tp + fn === 0) {
    return 0; // No actual positives
  }

  return tp / (tp + fn);
}

/**
 * Calculate F1 score
 * @param {number} precision - Precision score
 * @param {number} recall - Recall score
 * @returns {number} F1 score (0-1)
 */
export function f1Score(precision, recall) {
  if (precision + recall === 0) {
    return 0;
  }

  return 2 * (precision * recall) / (precision + recall);
}
