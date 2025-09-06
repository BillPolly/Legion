import { NLPSystem, TextPreprocessor, OntologyExtractor, TripleGenerator, MockLLMClient } from '../src/index.js';

describe('NLP System - Basic Integration', () => {
  test('should pass basic sanity check', () => {
    expect(1 + 1).toBe(2);
  });

  test('should create NLPSystem instance', () => {
    const nlpSystem = new NLPSystem();
    expect(nlpSystem).toBeInstanceOf(NLPSystem);
    expect(nlpSystem.getStatus().version).toBe('1.0.0-phase1');
  });

  test('should process simple text', async () => {
    const nlpSystem = new NLPSystem();
    const result = await nlpSystem.processText('Pump P101 is part of System S300.');
    
    expect(result.success).toBe(true);
    expect(result.schema.domain).toBe('industrial');
    expect(result.extractions.entities).toBeGreaterThan(0);
    expect(result.triples.count).toBeGreaterThan(0);
  });
});
