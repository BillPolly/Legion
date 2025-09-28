/**
 * Tests for Gellish components: Parser, QueryParser, Generator, Validator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  GellishDictionary, 
  EntityRecognizer,
  GellishParser,
  GellishQueryParser,
  GellishGenerator,
  GellishValidator
} from '../src/index.js';

describe('GellishParser', () => {
  let dictionary;
  let recognizer;
  let parser;
  
  beforeEach(() => {
    dictionary = new GellishDictionary();
    recognizer = new EntityRecognizer(dictionary);
    parser = new GellishParser(dictionary, recognizer);
  });
  
  describe('Construction', () => {
    it('should create parser with dictionary and recognizer', () => {
      expect(parser).toBeDefined();
      expect(parser.dictionary).toBe(dictionary);
      expect(parser.entityRecognizer).toBe(recognizer);
    });
    
    it('should throw error without dictionary', () => {
      expect(() => new GellishParser(null, recognizer)).toThrow('GellishDictionary is required');
    });
    
    it('should throw error without entity recognizer', () => {
      expect(() => new GellishParser(dictionary, null)).toThrow('EntityRecognizer is required');
    });
  });
  
  describe('parse()', () => {
    it('should parse simple assertion', () => {
      const triple = parser.parse('Pump P101 is part of System S200');
      
      expect(triple).toHaveLength(3);
      expect(triple[0]).toBe('pump_p101');
      expect(triple[1]).toBe('gellish:1230');
      expect(triple[2]).toBe('system_s200');
    });
    
    it('should parse manufacturing relation', () => {
      const triple = parser.parse('Pump P101 is manufactured by KSB');
      
      expect(triple[0]).toBe('pump_p101');
      expect(triple[1]).toBe('gellish:1267');
      expect(triple[2]).toBe('ksb');
    });
    
    it('should throw error for empty expression', () => {
      expect(() => parser.parse('')).toThrow('Could not parse expression');
    });
    
    it('should throw error for invalid expression', () => {
      expect(() => parser.parse('not a valid expression')).toThrow('Could not parse expression');
    });
  });
  
  describe('parseMultiple()', () => {
    it('should parse multiple expressions', () => {
      const expressions = [
        'Pump P101 is part of System S200',
        'System S200 is owned by Siemens'
      ];
      
      const triples = parser.parseMultiple(expressions);
      
      expect(triples).toHaveLength(2);
      expect(triples[0][0]).toBe('pump_p101');
      expect(triples[1][0]).toBe('system_s200');
    });
    
    it('should return empty array for empty input', () => {
      expect(parser.parseMultiple([])).toEqual([]);
      expect(parser.parseMultiple(null)).toEqual([]);
    });
  });
  
  describe('parseDetailed()', () => {
    it('should return detailed parse result', () => {
      const result = parser.parseDetailed('Pump P101 is part of System S200');
      
      expect(result.success).toBe(true);
      expect(result.triple).toHaveLength(3);
      expect(result.leftObject.text).toBe('Pump P101');
      expect(result.relation.text).toBe('is part of');
      expect(result.rightObject.text).toBe('System S200');
    });
    
    it('should return error for invalid expression', () => {
      const result = parser.parseDetailed('invalid');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('GellishQueryParser', () => {
  let dictionary;
  let recognizer;
  let queryParser;
  
  beforeEach(() => {
    dictionary = new GellishDictionary();
    recognizer = new EntityRecognizer(dictionary);
    queryParser = new GellishQueryParser(dictionary, recognizer);
  });
  
  describe('Construction', () => {
    it('should create query parser with dictionary and recognizer', () => {
      expect(queryParser).toBeDefined();
      expect(queryParser.dictionary).toBe(dictionary);
      expect(queryParser.entityRecognizer).toBe(recognizer);
    });
  });
  
  describe('parseQuery()', () => {
    it('should parse "What is part of X?" query', () => {
      const pattern = queryParser.parseQuery('What is part of System S200?');
      
      expect(pattern).toHaveLength(3);
      expect(pattern[0]).toBe(null); // Variable
      expect(pattern[1]).toBe('gellish:1230');
      expect(pattern[2]).toBe('system_s200');
    });
    
    it('should handle query without question mark', () => {
      const pattern = queryParser.parseQuery('What is part of System S200');
      
      expect(pattern[0]).toBe(null);
      expect(pattern[1]).toBe('gellish:1230');
      expect(pattern[2]).toBe('system_s200');
    });
    
    it('should throw error for empty query', () => {
      expect(() => queryParser.parseQuery('')).toThrow('Could not parse query');
    });
    
    it('should throw error for invalid query', () => {
      expect(() => queryParser.parseQuery('not a valid query')).toThrow('Could not parse query');
    });
  });
  
  describe('parseTypeFilteredQuery()', () => {
    it('should parse "Which pumps..." query', () => {
      const result = queryParser.parseTypeFilteredQuery('Which pumps are manufactured by KSB?');
      
      expect(result.type).toBe('type-filtered');
      expect(result.entityType).toBe('Pump');
      expect(result.basePattern[0]).toBe(null);
      expect(result.basePattern[1]).toBe('gellish:1267');
    });
    
    it('should throw error for non-"which" query', () => {
      expect(() => queryParser.parseTypeFilteredQuery('What is part of System S200?'))
        .toThrow('Could not parse type-filtered query');
    });
  });
  
  describe('cleanQuery()', () => {
    it('should remove trailing question marks', () => {
      expect(queryParser.cleanQuery('What is this?')).toBe('What is this');
      expect(queryParser.cleanQuery('What is this???')).toBe('What is this');
    });
    
    it('should normalize whitespace', () => {
      expect(queryParser.cleanQuery('What  is   this')).toBe('What is this');
    });
  });
  
  describe('parseDetailed()', () => {
    it('should return detailed parse result for valid query', () => {
      const result = queryParser.parseDetailed('What is part of System S200?');
      
      expect(result.success).toBe(true);
      expect(result.pattern).toHaveLength(3);
      expect(result.questionWord).toBeDefined();
      expect(result.relation).toBeDefined();
    });
    
    it('should return error for invalid query', () => {
      const result = queryParser.parseDetailed('invalid query');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('GellishGenerator', () => {
  let dictionary;
  let generator;
  
  beforeEach(() => {
    dictionary = new GellishDictionary();
    generator = new GellishGenerator(dictionary);
  });
  
  describe('Construction', () => {
    it('should create generator with dictionary', () => {
      expect(generator).toBeDefined();
      expect(generator.dictionary).toBe(dictionary);
    });
    
    it('should throw error without dictionary', () => {
      expect(() => new GellishGenerator(null)).toThrow('GellishDictionary is required');
    });
  });
  
  describe('generate()', () => {
    it('should generate expression from triple', () => {
      const expression = generator.generate('pump_p101', 'gellish:1230', 'system_s200');
      
      expect(expression).toBe('Pump P101 is part of System S200');
    });
    
    it('should generate manufacturing expression', () => {
      const expression = generator.generate('pump_p101', 'gellish:1267', 'kbs');
      
      expect(expression).toBe('Pump P101 is manufactured by Kbs');
    });
    
    it('should throw error for missing parameters', () => {
      expect(() => generator.generate(null, 'gellish:1230', 'system_s200'))
        .toThrow('Subject, predicate, and object are required');
    });
    
    it('should throw error for invalid predicate format', () => {
      expect(() => generator.generate('pump_p101', 'invalid', 'system_s200'))
        .toThrow('Invalid predicate format');
    });
  });
  
  describe('generateFromTriple()', () => {
    it('should generate from triple array', () => {
      const expression = generator.generateFromTriple(['pump_p101', 'gellish:1230', 'system_s200']);
      
      expect(expression).toBe('Pump P101 is part of System S200');
    });
    
    it('should throw error for invalid triple', () => {
      expect(() => generator.generateFromTriple(['pump_p101', 'gellish:1230']))
        .toThrow('Triple must be an array with 3 elements');
    });
  });
  
  describe('generateMultiple()', () => {
    it('should generate multiple expressions', () => {
      const triples = [
        ['pump_p101', 'gellish:1230', 'system_s200'],
        ['system_s200', 'gellish:1200', 'siemens']
      ];
      
      const expressions = generator.generateMultiple(triples);
      
      expect(expressions).toHaveLength(2);
      expect(expressions[0]).toContain('Pump P101');
      expect(expressions[1]).toContain('System S200');
    });
    
    it('should return empty array for empty input', () => {
      expect(generator.generateMultiple([])).toEqual([]);
      expect(generator.generateMultiple(null)).toEqual([]);
    });
  });
  
  describe('formatEntityName()', () => {
    it('should format underscore-separated IDs', () => {
      expect(generator.formatEntityName('pump_p101')).toBe('Pump P101');
      expect(generator.formatEntityName('system_s200')).toBe('System S200');
    });
    
    it('should handle special characters', () => {
      expect(generator.formatEntityName('plant-a')).toBe('Plant-a');
      expect(generator.formatEntityName('unit/5')).toBe('Unit/5');
    });
    
    it('should handle empty or null input', () => {
      expect(generator.formatEntityName('')).toBe('');
      expect(generator.formatEntityName(null)).toBe('');
    });
  });
  
  describe('formatEntityId()', () => {
    it('should format name to ID', () => {
      expect(generator.formatEntityId('Pump P101')).toBe('pump_p101');
      expect(generator.formatEntityId('System S200')).toBe('system_s200');
    });
    
    it('should handle empty input', () => {
      expect(generator.formatEntityId('')).toBe('');
      expect(generator.formatEntityId(null)).toBe('');
    });
  });
});

describe('GellishValidator', () => {
  let dictionary;
  let validator;
  
  beforeEach(() => {
    dictionary = new GellishDictionary();
    validator = new GellishValidator(dictionary);
  });
  
  describe('Construction', () => {
    it('should create validator with dictionary', () => {
      expect(validator).toBeDefined();
      expect(validator.dictionary).toBe(dictionary);
    });
    
    it('should throw error without dictionary', () => {
      expect(() => new GellishValidator(null)).toThrow('GellishDictionary is required');
    });
  });
  
  describe('validate()', () => {
    it('should validate correct expression', () => {
      const result = validator.validate('Pump P101 is part of System S200');
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject empty expression', () => {
      const result = validator.validate('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });
    
    it('should reject too short expression', () => {
      const result = validator.validate('Pump P101');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });
    
    it('should reject expression without valid relation', () => {
      const result = validator.validate('Pump P101 invalid relation System S200');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No valid Gellish relation');
      expect(result.suggestions).toBeDefined();
    });
  });
  
  describe('validateMultiple()', () => {
    it('should validate multiple expressions', () => {
      const expressions = [
        'Pump P101 is part of System S200',
        'invalid expression',
        'System S200 is owned by Siemens'
      ];
      
      const results = validator.validateMultiple(expressions);
      
      expect(results).toHaveLength(3);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[2].valid).toBe(true);
    });
    
    it('should return empty array for empty input', () => {
      expect(validator.validateMultiple([])).toEqual([]);
      expect(validator.validateMultiple(null)).toEqual([]);
    });
  });
  
  describe('validateQuery()', () => {
    it('should validate correct query', () => {
      const result = validator.validateQuery('What is part of System S200?');
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject query without question word', () => {
      const result = validator.validateQuery('Pump P101 is part of System S200');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('question word');
    });
    
    it('should reject query without valid relation', () => {
      const result = validator.validateQuery('What invalid relation System S200?');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No valid Gellish relation');
    });
  });
  
  describe('suggestSimilarRelations()', () => {
    it('should suggest common relations', () => {
      const suggestions = validator.suggestSimilarRelations('invalid');
      
      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('is part of');
    });
  });
});