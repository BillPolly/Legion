/**
 * DiscourseMemory - Shared state passed through all stages
 */
export class DiscourseMemory {
  /**
   * @param {string} text - Original input text
   * @param {string[]} sentences - Sentence-split text
   * @param {Mention[]} mentions - All extracted mentions
   * @param {Entity[]} entities - Canonical entities (after coref)
   * @param {Event[]} events - All events
   * @param {UnaryFact[]} unaryFacts - Property assertions
   * @param {BinaryFact[]} binaryFacts - Binary relations
   */
  constructor(text, sentences, mentions = [], entities = [], events = [], unaryFacts = [], binaryFacts = []) {
    this.text = text;
    this.sentences = sentences;
    this.mentions = mentions;
    this.entities = entities;
    this.events = events;
    this.unaryFacts = unaryFacts;
    this.binaryFacts = binaryFacts;
  }
}
