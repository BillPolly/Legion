# Gellish CNL Integration Design Document

## Executive Summary

This document outlines the integration of Gellish Controlled Natural Language (CNL) with the existing JavaScript Knowledge Graph system. Gellish is a **fact expression and query language** that allows users to state knowledge and ask questions in structured English, which then gets processed using the existing KG system.

**What Gellish IS:**
- A controlled natural language for expressing facts and queries
- A standardized vocabulary of ~650 relation types
- A way to say "Pump P101 is part of System S200" instead of writing code
- A way to ask "What is part of System S200?" instead of writing query patterns
- A bridge between domain experts and knowledge graphs

**What Gellish is NOT:**
- A replacement for the existing KG query system (it builds on top of it)
- A reasoning engine (it uses the existing KG reasoning)
- A new storage system (it uses existing KG storage)

## Core Gellish Concepts

### Gellish Expression Structure

Every Gellish expression follows the pattern:
```
[Left Object] [Relation Type] [Right Object]
```

Examples:
- "Pump P101 **is part of** System S200"
- "John Smith **works for** Acme Corporation"
- "Tank T205 **contains** Water"
- "Motor M301 **is manufactured by** Siemens"

### Gellish Query Structure

Gellish queries use question words with the same relation structure:
```
[Question Word] [Relation Type] [Object]?
[Object] [Relation Type] [Question Word]?
```

Examples:
- "**What** is part of System S200?"
- "**Which pumps** are manufactured by Siemens?"
- "System S200 **contains what**?"
- "**What** contains Water?"

### Standard Gellish Relations

Gellish defines ~650 standard relation types, each with a unique ID (UID):

| UID  | Relation Phrase | Inverse Phrase | Example |
|------|----------------|----------------|---------|
| 1225 | is a specialization of | is a generalization of | "CentrifugalPump is a specialization of Pump" |
| 1230 | is part of | consists of | "Impeller is part of Pump" |
| 1331 | contains | is contained in | "Tank contains Water" |
| 1456 | is connected to | is connected to | "Pipe is connected to Tank" |
| 1267 | is manufactured by | manufactures | "Pump is manufactured by Acme" |

### Entity Recognition

Gellish expressions contain three types of entities:
1. **Individual Objects**: Specific instances (Pump P101, John Smith)
2. **Concept Types**: Classes of things (Pump, Person, System)
3. **Relation Types**: The standardized relationships (is part of, contains)

## Architecture Design

### Simple Integration Approach

```
┌─────────────────────────────────────┐
│         Gellish CNL Layer           │
├─────────────────────────────────────┤
│ • GellishParser                     │
│ • GellishQueryParser                │
│ • GellishDictionary                 │
│ • GellishGenerator                  │
│ • EntityRecognizer                  │
│ • GellishValidator                  │
│ • GellishSystem                     │
└─────────────────────────────────────┘
                    │
                    ▼ (converts to triples/patterns)
┌─────────────────────────────────────┐
│    Existing KG Infrastructure       │
├─────────────────────────────────────┤
│ • KGEngine (stores triples)         │
│ • Query System (finds facts)        │
│ • Storage Providers                 │
│ • RDF Export                        │
└─────────────────────────────────────┘
```

## Core Components Implementation

### 1. GellishDictionary
**Purpose**: Manage the standard Gellish vocabulary

**Implementation Details**:
```javascript
class GellishDictionary {
  constructor() {
    this.relations = new Map([
      [1230, { 
        phrase: "is part of", 
        inverse: "consists of",
        synonyms: ["is a part of", "belongs to"],
        domain: "compositional"
      }],
      [1331, { 
        phrase: "contains", 
        inverse: "is contained in",
        synonyms: ["holds", "includes"],
        domain: "compositional"
      }],
      // ... 650+ standard relations
    ]);
    this.phraseToUid = new Map();
    this.buildPhraseIndex();
  }
  
  findRelation(phrase) {
    // "is part of" → { uid: 1230, phrase: "is part of", inverse: "consists of" }
    const normalized = this.normalizePhrase(phrase);
    return this.phraseToUid.get(normalized);
  }
  
  getRelationByUid(uid) {
    return this.relations.get(uid);
  }
  
  normalizePhrase(phrase) {
    return phrase.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  
  buildPhraseIndex() {
    for (const [uid, relation] of this.relations) {
      this.phraseToUid.set(this.normalizePhrase(relation.phrase), uid);
      this.phraseToUid.set(this.normalizePhrase(relation.inverse), uid);
      if (relation.synonyms) {
        relation.synonyms.forEach(synonym => {
          this.phraseToUid.set(this.normalizePhrase(synonym), uid);
        });
      }
    }
  }
}
```

### 2. EntityRecognizer
**Purpose**: Identify entities in Gellish text

**Implementation Details**:
```javascript
class EntityRecognizer {
  constructor(dictionary) {
    this.dictionary = dictionary;
    this.entityPatterns = [
      /^[A-Z][a-zA-Z0-9\s]*[A-Z0-9][0-9]+$/, // "Pump P101", "System S200"
      /^[A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+$/, // "John Smith"
      /^[A-Z][a-zA-Z]+$/ // "Water", "Siemens"
    ];
  }
  
  recognize(text) {
    // "Pump P101 is part of System S200"
    const tokens = this.tokenize(text);
    const result = {
      leftObject: null,
      relation: null,
      rightObject: null
    };
    
    // Find relation phrase in tokens
    const relationMatch = this.findRelationPhrase(tokens);
    if (relationMatch) {
      result.relation = relationMatch;
      result.leftObject = this.extractEntity(tokens.slice(0, relationMatch.startIndex));
      result.rightObject = this.extractEntity(tokens.slice(relationMatch.endIndex));
    }
    
    return result;
  }
  
  recognizeQuery(query) {
    // "What is part of System S200?"
    const tokens = this.tokenize(query);
    const result = {
      questionWord: null,
      relation: null,
      object: null
    };
    
    // Detect question words
    const questionWords = ['what', 'which', 'who', 'how many'];
    const firstToken = tokens[0].toLowerCase();
    
    if (questionWords.includes(firstToken)) {
      result.questionWord = { text: tokens[0], type: 'variable' };
      
      // Find relation phrase after question word
      const relationMatch = this.findRelationPhrase(tokens.slice(1));
      if (relationMatch) {
        result.relation = relationMatch;
        result.object = this.extractEntity(tokens.slice(relationMatch.endIndex + 1));
      }
    }
    
    return result;
  }
  
  tokenize(text) {
    return text.split(/\s+/).filter(token => token.length > 0);
  }
  
  findRelationPhrase(tokens) {
    // Try to match relation phrases of different lengths
    for (let length = 1; length <= 5; length++) {
      for (let i = 0; i <= tokens.length - length; i++) {
        const phrase = tokens.slice(i, i + length).join(' ');
        const uid = this.dictionary.findRelation(phrase);
        if (uid) {
          return {
            text: phrase,
            uid: uid,
            startIndex: i,
            endIndex: i + length
          };
        }
      }
    }
    return null;
  }
  
  extractEntity(tokens) {
    if (tokens.length === 0) return null;
    
    const text = tokens.join(' ');
    const type = this.classifyEntity(text);
    
    return {
      text: text,
      type: type,
      id: this.generateEntityId(text)
    };
  }
  
  classifyEntity(text) {
    if (this.entityPatterns[0].test(text)) return 'individual'; // "Pump P101"
    if (this.entityPatterns[1].test(text)) return 'person'; // "John Smith"
    return 'concept'; // "Water", "Siemens"
  }
  
  generateEntityId(text) {
    return text.toLowerCase().replace(/\s+/g, '_');
  }
}
```

### 3. GellishParser
**Purpose**: Convert Gellish expressions to KG triples

**Implementation Details**:
```javascript
class GellishParser {
  constructor(dictionary, entityRecognizer) {
    this.dictionary = dictionary;
    this.entityRecognizer = entityRecognizer;
  }
  
  parse(expression) {
    // "Pump P101 is part of System S200"
    const recognized = this.entityRecognizer.recognize(expression);
    
    if (!recognized.leftObject || !recognized.relation || !recognized.rightObject) {
      throw new Error(`Could not parse expression: ${expression}`);
    }
    
    const subject = recognized.leftObject.id;
    const predicate = `gellish:${recognized.relation.uid}`;
    const object = recognized.rightObject.id;
    
    return [subject, predicate, object];
  }
  
  parseMultiple(expressions) {
    return expressions.map(expr => this.parse(expr));
  }
}
```

### 4. GellishQueryParser
**Purpose**: Convert Gellish queries to KG query patterns

**Implementation Details**:
```javascript
class GellishQueryParser {
  constructor(dictionary, entityRecognizer) {
    this.dictionary = dictionary;
    this.entityRecognizer = entityRecognizer;
  }
  
  parseQuery(query) {
    // "What is part of System S200?"
    const recognized = this.entityRecognizer.recognizeQuery(query);
    
    if (!recognized.relation) {
      throw new Error(`Could not parse query: ${query}`);
    }
    
    const predicate = `gellish:${recognized.relation.uid}`;
    
    if (recognized.questionWord && recognized.object) {
      // "What is part of System S200?" → [null, "gellish:1230", "system_s200"]
      return [null, predicate, recognized.object.id];
    }
    
    // Handle other query patterns
    throw new Error(`Unsupported query pattern: ${query}`);
  }
  
  parseTypeFilteredQuery(query) {
    // "Which pumps are manufactured by Siemens?"
    // Returns a more complex query structure for type filtering
    const tokens = query.toLowerCase().split(/\s+/);
    
    if (tokens[0] === 'which' && tokens.length > 1) {
      const entityType = tokens[1]; // "pumps"
      const restOfQuery = tokens.slice(2).join(' '); // "are manufactured by Siemens"
      
      const basePattern = this.parseQuery(`What ${restOfQuery}`);
      
      return {
        type: 'type-filtered',
        basePattern: basePattern,
        entityType: entityType.slice(0, -1), // Remove 's' → "pump"
        originalQuery: query
      };
    }
    
    throw new Error(`Could not parse type-filtered query: ${query}`);
  }
}
```

### 5. GellishGenerator
**Purpose**: Convert KG triples back to Gellish expressions

**Implementation Details**:
```javascript
class GellishGenerator {
  constructor(dictionary) {
    this.dictionary = dictionary;
  }
  
  generate(subject, predicate, object) {
    // ["pump_p101", "gellish:1230", "system_s200"]
    // Returns: "Pump P101 is part of System S200"
    
    const uid = this.extractUidFromPredicate(predicate);
    const relation = this.dictionary.getRelationByUid(uid);
    
    if (!relation) {
      throw new Error(`Unknown relation UID: ${uid}`);
    }
    
    const subjectText = this.formatEntityName(subject);
    const objectText = this.formatEntityName(object);
    
    return `${subjectText} ${relation.phrase} ${objectText}`;
  }
  
  generateQueryResults(results, originalQuery) {
    // Format query results back to natural language
    // "What is part of System S200?" → ["Pump P101", "Valve V205", "Tank T205"]
    
    if (results.length === 0) {
      return "No results found.";
    }
    
    if (results.length === 1) {
      return this.formatEntityName(results[0][0]);
    }
    
    const entities = results.map(result => this.formatEntityName(result[0]));
    return entities.join(', ');
  }
  
  extractUidFromPredicate(predicate) {
    // "gellish:1230" → 1230
    const match = predicate.match(/gellish:(\d+)/);
    return match ? parseInt(match[1]) : null;
  }
  
  formatEntityName(entityId) {
    // "pump_p101" → "Pump P101"
    // "john_smith" → "John Smith"
    return entityId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
```

### 6. GellishValidator
**Purpose**: Validate expressions against vocabulary

**Implementation Details**:
```javascript
class GellishValidator {
  constructor(dictionary) {
    this.dictionary = dictionary;
  }
  
  validate(expression) {
    try {
      const tokens = expression.split(/\s+/);
      
      // Check for minimum length
      if (tokens.length < 3) {
        return {
          valid: false,
          error: "Expression too short. Expected format: 'Object relation Object'"
        };
      }
      
      // Try to find a relation phrase
      const relationFound = this.findAnyRelationPhrase(tokens);
      if (!relationFound) {
        return {
          valid: false,
          error: "No valid Gellish relation found in expression",
          suggestions: this.suggestSimilarRelations(expression)
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
  
  findAnyRelationPhrase(tokens) {
    for (let length = 1; length <= 5; length++) {
      for (let i = 0; i <= tokens.length - length; i++) {
        const phrase = tokens.slice(i, i + length).join(' ');
        if (this.dictionary.findRelation(phrase)) {
          return phrase;
        }
      }
    }
    return null;
  }
  
  suggestSimilarRelations(expression) {
    // Simple suggestion logic - could be enhanced
    const commonRelations = [
      "is part of", "contains", "is connected to", 
      "is manufactured by", "is a specialization of"
    ];
    
    return commonRelations.slice(0, 3);
  }
}
```

### 7. GellishSystem
**Purpose**: Main interface integrating all components

**Implementation Details**:
```javascript
class GellishSystem {
  constructor(kgEngine) {
    this.kg = kgEngine;
    this.dictionary = new GellishDictionary();
    this.entityRecognizer = new EntityRecognizer(this.dictionary);
    this.parser = new GellishParser(this.dictionary, this.entityRecognizer);
    this.queryParser = new GellishQueryParser(this.dictionary, this.entityRecognizer);
    this.generator = new GellishGenerator(this.dictionary);
    this.validator = new GellishValidator(this.dictionary);
  }
  
  assert(expression) {
    // Express facts in natural language
    const validation = this.validator.validate(expression);
    if (!validation.valid) {
      throw new Error(`Invalid expression: ${validation.error}`);
    }
    
    const triple = this.parser.parse(expression);
    this.kg.addTriple(triple[0], triple[1], triple[2]);
    
    return true;
  }
  
  query(query) {
    // Query using natural language
    try {
      // Try simple query first
      const pattern = this.queryParser.parseQuery(query);
      const results = this.kg.queryPattern(pattern);
      return this.generator.generateQueryResults(results, query);
      
    } catch (error) {
      // Try type-filtered query
      try {
        const typeQuery = this.queryParser.parseTypeFilteredQuery(query);
        const results = this.executeTypeFilteredQuery(typeQuery);
        return this.generator.generateQueryResults(results, query);
        
      } catch (typeError) {
        throw new Error(`Could not parse query: ${query}`);
      }
    }
  }
  
  executeTypeFilteredQuery(typeQuery) {
    // "Which pumps are manufactured by Siemens?"
    // Uses existing PatternQuery + LogicalQuery composition
    
    const { PatternQuery, LogicalQuery } = require('../query');
    
    const baseResults = this.kg.queryPattern(typeQuery.basePattern);
    const typePattern = [null, "rdf:type", typeQuery.entityType];
    const typeResults = this.kg.queryPattern(typePattern);
    
    // Find intersection
    const baseEntities = new Set(baseResults.map(r => r[0]));
    const typeEntities = new Set(typeResults.map(r => r[0]));
    
    const intersection = [...baseEntities].filter(entity => typeEntities.has(entity));
    return intersection.map(entity => [entity, null, null]);
  }
  
  generateTriples(expressions) {
    // Batch processing
    return expressions.map(expr => this.parser.parse(expr));
  }
  
  getVocabularyStats() {
    return {
      totalRelations: this.dictionary.relations.size,
      domains: [...new Set([...this.dictionary.relations.values()].map(r => r.domain))]
    };
  }
}
```

## Integration with Existing KG System

### Storage Integration
```javascript
// Gellish expression: "Pump P101 is part of System S200"
// Becomes KG triples:
kg.addTriple("pump_p101", "gellish:1230", "system_s200");
kg.addTriple("pump_p101", "rdf:type", "Pump");
kg.addTriple("system_s200", "rdf:type", "System");
```

### Query Integration
```javascript
// Gellish query: "What is part of System S200?"
// Translates to existing KG query:
const pattern = gellishQueryParser.parse("What is part of System S200?");
const results = kg.queryPattern(pattern);
// Results formatted back to natural language
const answer = gellishGenerator.generateQueryResults(results, originalQuery);
```

### Advanced Query Integration
```javascript
// Complex Gellish query: "Which pumps are manufactured by Siemens?"
// Uses existing PatternQuery with LogicalQuery composition:
const typeQuery = new PatternQuery().pattern(null, "rdf:type", "Pump");
const manufacturerQuery = new PatternQuery().pattern(null, "gellish:1267", "siemens");
const combinedQuery = new LogicalQuery().operator("AND")
  .leftOperand(typeQuery).rightOperand(manufacturerQuery);
const results = combinedQuery.execute(kg);
```

## Testing Strategy

### Unit Test Structure
```javascript
// GellishDictionary.test.js
describe('GellishDictionary', () => {
  test('should find relation by phrase', () => {
    const dict = new GellishDictionary();
    const uid = dict.findRelation("is part of");
    expect(uid).toBe(1230);
  });
  
  test('should handle synonyms', () => {
    const dict = new GellishDictionary();
    const uid = dict.findRelation("belongs to");
    expect(uid).toBe(1230);
  });
});

// GellishParser.test.js
describe('GellishParser', () => {
  test('should parse basic part-of expression', () => {
    const parser = new GellishParser(dictionary, entityRecognizer);
    const result = parser.parse("Pump P101 is part of System S200");
    expect(result).toEqual(["pump_p101", "gellish:1230", "system_s200"]);
  });
});
```

### Integration Test Structure
```javascript
// BasicIntegration.test.js
describe('Gellish KG Integration', () => {
  test('should store and retrieve facts', () => {
    const gellish = new GellishSystem(kg);
    
    gellish.assert("Pump P101 is part of System S200");
    const result = gellish.query("What is part of System S200?");
    
    expect(result).toContain("Pump P101");
  });
});
```

## Example Usage

### Basic Fact Entry and Querying
```javascript
const gellish = new GellishSystem(kg);

// Express facts in natural language
gellish.assert("Pump P101 is part of System S200");
gellish.assert("Tank T205 contains Water");
gellish.assert("Motor M301 is manufactured by Siemens");

// Query using natural language
const parts = gellish.query("What is part of System S200?");
// Returns: "Pump P101"

const containers = gellish.query("What contains Water?");
// Returns: "Tank T205"

const siemensProducts = gellish.query("What is manufactured by Siemens?");
// Returns: "Motor M301"
```

### Advanced Querying
```javascript
// Type-filtered queries
const pumps = gellish.query("Which pumps are part of System S200?");
// Uses existing type filtering with PatternQuery

// Hierarchical queries
const allPumpTypes = gellish.query("What are all types of Pump?");
// Uses existing TraversalQuery for hierarchy traversal

// Aggregation queries
const partCount = gellish.query("How many parts does System S200 have?");
// Uses existing AggregationQuery

// Multi-step queries
const complexQuery = gellish.query("What pumps are in systems that contain Water?");
// Uses existing SequentialQuery composition
```

This focused approach leverages the existing KG infrastructure while adding the specific value of Gellish CNL - allowing domain experts to express knowledge and ask questions in structured English rather than writing code or learning complex query syntax. The query capabilities build directly on the existing sophisticated query system, providing natural language access to all existing query features.
