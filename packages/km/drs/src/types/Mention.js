/**
 * Mention - A textual reference to an entity (NER span or nominal)
 */
import { Span } from './Span.js';

export class Mention {
  /**
   * @param {string} id - "m1", "m2", ...
   * @param {Span} span - Character offsets
   * @param {string} text - Substring from original text
   * @param {string} head - Head word
   * @param {Object} coarseType - WordNet synset object with label, synonyms, definition, etc.
   * @param {number} sentenceId - Which sentence (0-indexed)
   */
  constructor(id, span, text, head, coarseType, sentenceId) {
    this.id = id;
    this.span = span;
    this.text = text;
    this.head = head;
    this.coarseType = coarseType;
    this.sentenceId = sentenceId;
  }
}
