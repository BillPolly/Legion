/**
 * EntityTypeCategorizer - Categorize noun synsets into entity types
 *
 * Categorizes WordNet noun synsets into coarse entity types using:
 * - Strategy 1: lexicalFile analysis (primary)
 * - Strategy 2: Definition keyword analysis (fallback)
 * - Fallback: THING (every noun is categorizable)
 */

export class EntityTypeCategorizer {
  /**
   * Create a new EntityTypeCategorizer
   */
  constructor() {
    // Mapping from lexicalFile values to entity type categories
    this.lexicalFileMapping = {
      // PERSON - Humans, groups of people
      'noun.person': 'PERSON',

      // LOCATION - Places, geographic entities
      'noun.location': 'LOCATION',

      // ORGANIZATION - Companies, institutions, groups
      'noun.group': 'ORGANIZATION',

      // ARTIFACT - Man-made objects
      'noun.artifact': 'ARTIFACT',

      // EVENT - Occurrences, happenings
      'noun.event': 'EVENT',

      // TIME - Temporal expressions
      'noun.time': 'TIME',

      // QUANTITY - Measurements, amounts
      'noun.quantity': 'QUANTITY',

      // ABSTRACT - Ideas, concepts
      'noun.cognition': 'ABSTRACT',
      'noun.communication': 'ABSTRACT',

      // PHYSICAL_OBJECT - Natural physical things
      'noun.object': 'PHYSICAL_OBJECT',
      'noun.substance': 'PHYSICAL_OBJECT'
    };

    // Definition keywords for fallback categorization
    // Maps keywords to entity type categories
    this.definitionKeywords = {
      'PERSON': ['person', 'human', 'individual', 'people', 'man', 'woman', 'child'],
      'LOCATION': ['place', 'location', 'area', 'region', 'site', 'spot'],
      'ORGANIZATION': ['organization', 'company', 'institution', 'corporation', 'agency', 'firm'],
      'ARTIFACT': ['artifact', 'device', 'tool', 'instrument', 'machine'],
      'EVENT': ['event', 'happening', 'occurrence', 'incident'],
      'TIME': ['time', 'period', 'moment', 'duration', 'era', 'age'],
      'QUANTITY': ['quantity', 'amount', 'measure', 'number'],
      'ABSTRACT': ['concept', 'idea', 'thought', 'notion', 'theory'],
      'PHYSICAL_OBJECT': ['object', 'thing', 'substance', 'material', 'matter']
    };
  }

  /**
   * Categorize a noun synset into an entity type
   *
   * @param {Object} synset - Synset object from MongoDB with pos, lexicalFile, definition
   * @returns {string} Entity type category (PERSON, LOCATION, ORGANIZATION, ARTIFACT, EVENT, TIME, QUANTITY, ABSTRACT, PHYSICAL_OBJECT, or THING)
   */
  categorizeEntityType(synset) {
    // Strategy 1: Lexical file analysis (primary method)
    if (synset.lexicalFile && this.lexicalFileMapping[synset.lexicalFile]) {
      return this.lexicalFileMapping[synset.lexicalFile];
    }

    // Strategy 2: Definition keyword analysis (fallback for unknown lexical files)
    if (synset.definition) {
      const lowerDef = synset.definition.toLowerCase();

      // Check each category's keywords
      for (const [category, keywords] of Object.entries(this.definitionKeywords)) {
        for (const keyword of keywords) {
          if (lowerDef.includes(keyword)) {
            return category;
          }
        }
      }
    }

    // Fallback: Every noun is a THING
    return 'THING';
  }
}
