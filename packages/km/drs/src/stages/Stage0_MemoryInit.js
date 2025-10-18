/**
 * Stage0_MemoryInit - Initialize discourse memory from raw text
 *
 * This is a deterministic stage that:
 * 1. Splits text into sentences
 * 2. Creates DiscourseMemory with empty arrays for mentions, entities, events, facts
 *
 * No LLM calls, no validation needed.
 */

import { SentenceSplitter } from '../utils/SentenceSplitter.js';
import { DiscourseMemory } from '../types/DiscourseMemory.js';

export class Stage0_MemoryInit {
  constructor() {
    this.splitter = new SentenceSplitter();
  }

  /**
   * Process raw text into DiscourseMemory skeleton
   * @param {string} text - Raw input text
   * @returns {DiscourseMemory} - Initialized discourse memory
   */
  process(text) {
    // Split text into sentences
    const sentences = this.splitter.split(text);

    // Create DiscourseMemory with empty arrays
    return new DiscourseMemory(
      text,
      sentences,
      [],  // mentions
      [],  // entities
      [],  // events
      [],  // unaryFacts
      []   // binaryFacts
    );
  }
}
