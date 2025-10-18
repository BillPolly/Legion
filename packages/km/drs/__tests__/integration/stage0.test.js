/**
 * Integration tests for Stage 0: Discourse Memory Initialization
 */
import { Stage0_MemoryInit } from '../../src/stages/Stage0_MemoryInit.js';

describe('Stage 0: Discourse Memory Initialization (Integration)', () => {
  let stage;

  beforeEach(() => {
    stage = new Stage0_MemoryInit();
  });

  test('should initialize discourse memory from simple text', () => {
    const text = 'The cat sat on the mat.';
    const memory = stage.process(text);

    expect(memory.text).toBe(text);
    expect(memory.sentences).toHaveLength(1);
    expect(memory.sentences[0]).toBe('The cat sat on the mat.');

    // Verify empty arrays
    expect(memory.mentions).toEqual([]);
    expect(memory.entities).toEqual([]);
    expect(memory.events).toEqual([]);
    expect(memory.unaryFacts).toEqual([]);
    expect(memory.binaryFacts).toEqual([]);
  });

  test('should handle multi-sentence discourse', () => {
    const text = 'Alice met Bob. They talked for hours. Then they went home.';
    const memory = stage.process(text);

    expect(memory.text).toBe(text);
    expect(memory.sentences).toHaveLength(3);
    expect(memory.sentences[0]).toBe('Alice met Bob.');
    expect(memory.sentences[1]).toBe('They talked for hours.');
    expect(memory.sentences[2]).toBe('Then they went home.');
  });

  test('should handle complex discourse with questions and exclamations', () => {
    const text = 'Who are you? I am Alice! Nice to meet you.';
    const memory = stage.process(text);

    expect(memory.sentences).toHaveLength(3);
    expect(memory.sentences[0]).toBe('Who are you?');
    expect(memory.sentences[1]).toBe('I am Alice!');
    expect(memory.sentences[2]).toBe('Nice to meet you.');
  });

  test('should handle empty text gracefully', () => {
    const text = '';
    const memory = stage.process(text);

    expect(memory.text).toBe('');
    expect(memory.sentences).toEqual([]);
  });

  test('should handle text with multiple spaces and newlines', () => {
    const text = 'First sentence.  Second sentence.\nThird sentence.';
    const memory = stage.process(text);

    expect(memory.text).toBe(text);
    expect(memory.sentences).toHaveLength(3);
  });

  test('should preserve original text exactly', () => {
    const text = 'Test with   multiple   spaces.  And  irregular spacing.';
    const memory = stage.process(text);

    // Original text preserved as-is
    expect(memory.text).toBe(text);

    // Sentences are normalized but text is not
    expect(memory.sentences).toHaveLength(2);
  });

  test('should handle longer realistic discourse', () => {
    const text = 'Every student read a book. Some students enjoyed it. Others did not. The teacher was pleased.';
    const memory = stage.process(text);

    expect(memory.text).toBe(text);
    expect(memory.sentences).toHaveLength(4);
    expect(memory.sentences[0]).toBe('Every student read a book.');
    expect(memory.sentences[1]).toBe('Some students enjoyed it.');
    expect(memory.sentences[2]).toBe('Others did not.');
    expect(memory.sentences[3]).toBe('The teacher was pleased.');
  });

  test('should be deterministic - same input produces same output', () => {
    const text = 'Alice reads. Bob writes.';

    const memory1 = stage.process(text);
    const memory2 = stage.process(text);

    expect(memory1.text).toBe(memory2.text);
    expect(memory1.sentences).toEqual(memory2.sentences);
    expect(memory1.mentions).toEqual(memory2.mentions);
    expect(memory1.entities).toEqual(memory2.entities);
  });

  test('should initialize all arrays as empty', () => {
    const text = 'Test sentence.';
    const memory = stage.process(text);

    // All arrays should be empty after Stage 0
    expect(Array.isArray(memory.mentions)).toBe(true);
    expect(memory.mentions.length).toBe(0);

    expect(Array.isArray(memory.entities)).toBe(true);
    expect(memory.entities.length).toBe(0);

    expect(Array.isArray(memory.events)).toBe(true);
    expect(memory.events.length).toBe(0);

    expect(Array.isArray(memory.unaryFacts)).toBe(true);
    expect(memory.unaryFacts.length).toBe(0);

    expect(Array.isArray(memory.binaryFacts)).toBe(true);
    expect(memory.binaryFacts.length).toBe(0);
  });
});
