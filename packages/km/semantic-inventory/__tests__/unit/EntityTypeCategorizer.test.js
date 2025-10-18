/**
 * Unit tests for EntityTypeCategorizer
 *
 * Tests categorization of noun synsets into entity types using lexicalFile analysis.
 * Per TDD approach: Write tests first, then implement minimum code to pass.
 */

import { EntityTypeCategorizer } from '../../src/categorization/EntityTypeCategorizer.js';

describe('EntityTypeCategorizer', () => {
  let categorizer;

  beforeAll(() => {
    categorizer = new EntityTypeCategorizer();
  });

  describe('categorizeEntityType - Simple lexicalFile cases', () => {
    test('should categorize noun.person as PERSON', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.person',
        definition: 'a teacher at a university'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('PERSON');
    });

    test('should categorize noun.location as LOCATION', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.location',
        definition: 'a building for meetings'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('LOCATION');
    });

    test('should categorize noun.group as ORGANIZATION', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.group',
        definition: 'a commercial organization'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('ORGANIZATION');
    });

    test('should categorize noun.artifact as ARTIFACT', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.artifact',
        definition: 'a man-made object'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('ARTIFACT');
    });

    test('should categorize noun.event as EVENT', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.event',
        definition: 'an occurrence or happening'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('EVENT');
    });

    test('should categorize noun.time as TIME', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.time',
        definition: 'a temporal measurement'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('TIME');
    });

    test('should categorize noun.quantity as QUANTITY', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.quantity',
        definition: 'a measurement or amount'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('QUANTITY');
    });

    test('should categorize noun.cognition as ABSTRACT', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.cognition',
        definition: 'an idea or concept'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('ABSTRACT');
    });

    test('should categorize noun.communication as ABSTRACT', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.communication',
        definition: 'a message or information'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('ABSTRACT');
    });

    test('should categorize noun.object as PHYSICAL_OBJECT', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.object',
        definition: 'a physical thing'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('PHYSICAL_OBJECT');
    });

    test('should categorize noun.substance as PHYSICAL_OBJECT', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.substance',
        definition: 'a material or substance'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('PHYSICAL_OBJECT');
    });

    test('should use THING as fallback for unknown lexicalFile', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.unknown',
        definition: 'undefined value'
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('THING');
    });
  });

  describe('categorizeEntityType - Definition keyword analysis', () => {
    test('should categorize as PERSON when definition contains "person"', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.unknown',
        definition: 'a person who does something',
        synonyms: ['doer']
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('PERSON');
    });

    test('should categorize as PERSON when definition contains "human"', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.unknown',
        definition: 'a human being that exists',
        synonyms: ['human']
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('PERSON');
    });

    test('should categorize as PERSON when definition contains "individual"', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.unknown',
        definition: 'an individual who works',
        synonyms: ['worker']
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('PERSON');
    });

    test('should categorize as LOCATION when definition contains "place"', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.unknown',
        definition: 'a place for meetings',
        synonyms: ['venue']
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('LOCATION');
    });

    test('should categorize as LOCATION when definition contains "location"', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.unknown',
        definition: 'a location in the city',
        synonyms: ['spot']
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('LOCATION');
    });

    test('should categorize as ORGANIZATION when definition contains "organization"', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.unknown',
        definition: 'an organization that provides services',
        synonyms: ['agency']
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('ORGANIZATION');
    });

    test('should categorize as ORGANIZATION when definition contains "company"', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.unknown',
        definition: 'a company in the technology sector',
        synonyms: ['firm']
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('ORGANIZATION');
    });

    test('should categorize as EVENT when definition contains "event"', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.unknown',
        definition: 'an event that happens annually',
        synonyms: ['occurrence']
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('EVENT');
    });

    test('should categorize as TIME when definition contains "time"', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.unknown',
        definition: 'a period of time in history',
        synonyms: ['era']
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('TIME');
    });

    test('should prioritize lexicalFile over definition keywords', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.person',
        definition: 'a place where people work',  // Has "place" but lexicalFile says PERSON
        synonyms: ['workplace']
      };

      // Lexical file should take precedence
      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('PERSON');
    });

    test('should fall back to THING if no keywords match', () => {
      const synset = {
        pos: 'n',
        lexicalFile: 'noun.unknown',
        definition: 'mysterious and undefined value',
        synonyms: ['mystery']
      };

      const category = categorizer.categorizeEntityType(synset);
      expect(category).toBe('THING');
    });
  });
});
