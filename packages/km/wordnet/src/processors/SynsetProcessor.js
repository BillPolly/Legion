/**
 * Synset Processor
 * Converts WordNet synsets into Knowledge Graph concepts and word nodes
 * Now uses Handle-based architecture with TripleStoreDataSource
 */

import { idGenerator } from '../utils/idGenerator.js';
import { WordNetAccess } from '../wordnet/WordNetAccess.js';

export class SynsetProcessor {
  constructor(dataSource, config) {
    this.dataSource = dataSource;
    this.config = config;
    this.wordnet = new WordNetAccess();
    this.wordNodeCache = new Map(); // Track existing word nodes for polysemy
    this.stats = {
      conceptsCreated: 0,
      wordsCreated: 0,
      wordsLinked: 0,
      relationshipsCreated: 0
    };
  }

  async processSynset(synsetInfo) {
    try {
      const synsetData = await this.wordnet.getSynset(synsetInfo.offset, synsetInfo.pos);
      return await this.convertSynsetToConcept(synsetData);
    } catch (error) {
      console.warn(`Failed to process synset ${synsetInfo.offset}.${synsetInfo.pos}: ${error.message}`);
      return null;
    }
  }

  async convertSynsetToConcept(synsetData) {
    const conceptId = this.generateConceptId(synsetData);
    const triples = [];

    // 1. CREATE CONCEPT NODE (represents the abstract meaning)
    triples.push({ subject: conceptId, predicate: 'rdf:type', object: 'kg:Concept' });
    triples.push({ subject: conceptId, predicate: 'kg:conceptType', object: 'wordnet:Synset' });
    triples.push({ subject: conceptId, predicate: 'kg:wordnetOffset', object: synsetData.synsetOffset });
    triples.push({ subject: conceptId, predicate: 'kg:partOfSpeech', object: synsetData.pos });
    
    if (synsetData.gloss) {
      triples.push({ subject: conceptId, predicate: 'kg:definition', object: synsetData.gloss });
    }

    // Foundational ontology classification
    const ontologyRole = this.classifyOntologyRole(synsetData.pos);
    triples.push({ subject: conceptId, predicate: 'kg:foundationalRole', object: ontologyRole });

    // Lexical metadata
    if (synsetData.lexName) {
      triples.push({ subject: conceptId, predicate: 'kg:lexicalFile', object: synsetData.lexName });
    }

    triples.push({ subject: conceptId, predicate: 'kg:created', object: new Date().toISOString() });

    // 2. CREATE/LINK WORD NODES (represents textual forms)
    const wordResults = [];
    if (synsetData.synonyms && synsetData.synonyms.length > 0) {
      for (const word of synsetData.synonyms) {
        try {
          const wordResult = await this.createOrLinkWordNode(word, conceptId);
          triples.push(...wordResult.triples);
          wordResults.push(wordResult);
        } catch (error) {
          console.warn(`Failed to process word "${word}": ${error.message}`);
        }
      }
    }

    // Store all triples using the triple store
    const tripleStore = this.dataSource.tripleStore;
    let addedCount = 0;
    
    for (const triple of triples) {
      await tripleStore.addTriple(triple);
      addedCount++;
    }
    
    // Update statistics
    this.stats.conceptsCreated++;
    this.stats.relationshipsCreated += wordResults.length * 2; // HasLabel + Expresses
    this.stats.wordsCreated += wordResults.filter(r => r.isNewWord).length;
    this.stats.wordsLinked += wordResults.length;

    return {
      conceptId: conceptId,
      wordNodes: wordResults.map(r => r.wordId),
      triplesAdded: addedCount,
      wordCount: wordResults.length
    };
  }

  async createOrLinkWordNode(word, conceptId) {
    const wordId = this.generateWordId(word);
    const triples = [];
    let isNewWord = false;

    // Check if word node already exists (for polysemy support)
    const tripleStore = this.dataSource.tripleStore;
    const existingWord = await tripleStore.findTriples(wordId, 'rdf:type', 'kg:Word');

    if (existingWord.length === 0) {
      // CREATE NEW WORD NODE
      isNewWord = true;
      triples.push({ subject: wordId, predicate: 'rdf:type', object: 'kg:Word' });
      triples.push({ subject: wordId, predicate: 'kg:wordText', object: word });
      triples.push({ subject: wordId, predicate: 'kg:language', object: 'en' });
      triples.push({ subject: wordId, predicate: 'kg:wordSource', object: 'wordnet' });
      triples.push({ subject: wordId, predicate: 'kg:created', object: new Date().toISOString() });

      // Normalized form for matching
      const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      triples.push({ subject: wordId, predicate: 'kg:normalizedForm', object: normalized });

      // Cache the word node
      this.wordNodeCache.set(wordId, { word, conceptIds: new Set([conceptId]) });
    } else {
      // UPDATE CACHE for existing word
      if (this.wordNodeCache.has(wordId)) {
        this.wordNodeCache.get(wordId).conceptIds.add(conceptId);
      } else {
        this.wordNodeCache.set(wordId, { word, conceptIds: new Set([conceptId]) });
      }
    }

    // CREATE BIDIRECTIONAL CONCEPT-WORD RELATIONSHIPS
    const hasLabelRelId = this.generateRelationshipId(conceptId, wordId, 'hasLabel');
    triples.push({ subject: conceptId, predicate: hasLabelRelId, object: wordId });
    triples.push({ subject: hasLabelRelId, predicate: 'rdf:type', object: 'kg:HasLabel' });
    triples.push({ subject: hasLabelRelId, predicate: 'kg:relationSource', object: 'wordnet' });
    triples.push({ subject: hasLabelRelId, predicate: 'kg:created', object: new Date().toISOString() });

    const expressesRelId = this.generateRelationshipId(wordId, conceptId, 'expresses');
    triples.push({ subject: wordId, predicate: expressesRelId, object: conceptId });
    triples.push({ subject: expressesRelId, predicate: 'rdf:type', object: 'kg:Expresses' });
    triples.push({ subject: expressesRelId, predicate: 'kg:relationSource', object: 'wordnet' });
    triples.push({ subject: expressesRelId, predicate: 'kg:created', object: new Date().toISOString() });

    // Track sense number for polysemy
    const cachedWord = this.wordNodeCache.get(wordId);
    const senseNumber = cachedWord ? cachedWord.conceptIds.size : 1;
    triples.push({ subject: expressesRelId, predicate: 'kg:senseNumber', object: senseNumber });

    return {
      wordId: wordId,
      triples: triples,
      isNewWord: isNewWord,
      senseNumber: senseNumber
    };
  }

  classifyOntologyRole(pos) {
    const roleMapping = {
      'n': 'kg:Entity',        // Nouns represent entities/states
      'v': 'kg:Process',       // Verbs represent processes/transformations  
      'a': 'kg:Property',      // Adjectives represent properties
      's': 'kg:Property',      // Satellite adjectives
      'r': 'kg:Modifier'       // Adverbs represent modifiers
    };
    return roleMapping[pos] || 'kg:Concept';
  }

  generateConceptId(synsetData) {
    return idGenerator.generateId(`wn_concept_${synsetData.synsetOffset}_${synsetData.pos}`);
  }

  generateWordId(word) {
    const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return idGenerator.generateId(`wn_word_${normalized}_en`);
  }

  generateRelationshipId(sourceId, targetId, relationType) {
    return idGenerator.generateRelationshipId(sourceId, targetId, relationType);
  }

  getStats() {
    return { ...this.stats };
  }
}