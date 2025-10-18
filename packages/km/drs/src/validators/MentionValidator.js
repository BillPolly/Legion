/**
 * MentionValidator - Validates extracted mentions
 */

export class MentionValidator {
  /**
   * @param {string} text - Original text
   * @param {string[]} sentences - Array of sentences
   */
  constructor(text, sentences) {
    this.text = text;
    this.sentences = sentences;
  }

  /**
   * Validate an array of mentions
   * @param {Mention[]} mentions - Array of mentions to validate
   * @returns {{isValid: boolean, errors: Array<{path: string, message: string}>}}
   */
  validate(mentions) {
    const errors = [];

    for (let i = 0; i < mentions.length; i++) {
      const mention = mentions[i];
      const path = `mentions[${i}]`;

      // Validate span
      this.validateSpan(mention, path, errors);

      // Validate type
      this.validateType(mention, path, errors);

      // Validate sentence ID
      this.validateSentenceId(mention, path, errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate span properties
   */
  validateSpan(mention, path, errors) {
    const { span, text } = mention;

    // Check start >= 0
    if (span.start < 0) {
      errors.push({
        path: `${path}.span.start`,
        message: 'start must be >= 0'
      });
    }

    // Check end > start
    if (span.end <= span.start) {
      errors.push({
        path: `${path}.span`,
        message: 'end must be > start'
      });
    }

    // Check end within text bounds
    if (span.end > this.text.length) {
      errors.push({
        path: `${path}.span.end`,
        message: `end must be within text bounds (0-${this.text.length})`
      });
    }

    // Check text matches actual substring
    if (span.start >= 0 && span.end <= this.text.length && span.end > span.start) {
      const actualText = this.text.substring(span.start, span.end);
      if (text !== actualText) {
        errors.push({
          path: `${path}.text`,
          message: `text "${text}" does not match actual substring "${actualText}" at span ${span.start}-${span.end}`
        });
      }
    }
  }

  /**
   * Validate entity type (should be a WordNet synset object)
   */
  validateType(mention, path, errors) {
    const { coarseType } = mention;

    // Validate coarseType is an object
    if (typeof coarseType !== 'object' || coarseType === null) {
      errors.push({
        path: `${path}.coarseType`,
        message: `coarseType must be a WordNet synset object, got ${typeof coarseType}`
      });
      return;
    }

    // Validate it has expected synset structure (label or synonyms)
    if (!coarseType.label && !coarseType.synonyms) {
      errors.push({
        path: `${path}.coarseType`,
        message: `coarseType must have 'label' or 'synonyms' property (WordNet synset structure)`
      });
    }
  }

  /**
   * Validate sentence ID
   */
  validateSentenceId(mention, path, errors) {
    const { sentenceId } = mention;

    if (sentenceId < 0 || sentenceId >= this.sentences.length) {
      errors.push({
        path: `${path}.sentenceId`,
        message: `sentenceId ${sentenceId} must be valid (0-${this.sentences.length - 1})`
      });
    }
  }
}
