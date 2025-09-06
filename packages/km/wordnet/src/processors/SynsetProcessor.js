/**
 * Synset Processor
 * Converts WordNet synsets into Knowledge Graph concepts and word nodes
 */

import { idManager } from '@legion/kg';
import { WordNetAccess } from '../wordnet/WordNetAccess.js';

export class SynsetProcessor {
  constructor(kgEngine, config) {
    this.kg = kgEngine;
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
    triples.push([conceptId, 'rdf:type', 'kg:Concept']);
    triples.push([conceptId, 'kg:conceptType', 'wordnet:Synset']);
    triples.push([conceptId, 'kg:wordnetOffset', synsetData.synsetOffset]);
    triples.push([conceptId, 'kg:partOfSpeech', synsetData.pos]);
    
    if (synsetData.gloss) {
      triples.push([conceptId, 'kg:definition', synsetData.gloss]);
    }

    // Foundational ontology classification
    const ontologyRole = this.classifyOntologyRole(synsetData.pos);
    triples.push([conceptId, 'kg:foundationalRole', ontologyRole]);

    // Lexical metadata
    if (synsetData.lexName) {
      triples.push([conceptId, 'kg:lexicalFile', synsetData.lexName]);
    }

    triples.push([conceptId, 'kg:created', new Date().toISOString()]);

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

    // Store all triples
    const addedCount = await this.kg.addTriples(triples);
    
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
    const existingWord = await this.kg.queryAsync(wordId, 'rdf:type', 'kg:Word');

    if (existingWord.length === 0) {
      // CREATE NEW WORD NODE
      isNewWord = true;
      triples.push([wordId, 'rdf:type', 'kg:Word']);
      triples.push([wordId, 'kg:wordText', word]);
      triples.push([wordId, 'kg:language', 'en']);
      triples.push([wordId, 'kg:wordSource', 'wordnet']);
      triples.push([wordId, 'kg:created', new Date().toISOString()]);

      // Normalized form for matching
      const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      triples.push([wordId, 'kg:normalizedForm', normalized]);

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
    triples.push([conceptId, hasLabelRelId, wordId]);
    triples.push([hasLabelRelId, 'rdf:type', 'kg:HasLabel']);
    triples.push([hasLabelRelId, 'kg:relationSource', 'wordnet']);
    triples.push([hasLabelRelId, 'kg:created', new Date().toISOString()]);

    const expressesRelId = this.generateRelationshipId(wordId, conceptId, 'expresses');
    triples.push([wordId, expressesRelId, conceptId]);
    triples.push([expressesRelId, 'rdf:type', 'kg:Expresses']);
    triples.push([expressesRelId, 'kg:relationSource', 'wordnet']);
    triples.push([expressesRelId, 'kg:created', new Date().toISOString()]);

    // Track sense number for polysemy
    const cachedWord = this.wordNodeCache.get(wordId);
    const senseNumber = cachedWord ? cachedWord.conceptIds.size : 1;
    triples.push([expressesRelId, 'kg:senseNumber', senseNumber]);

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
    return idManager.generateId(`wn_concept_${synsetData.synsetOffset}_${synsetData.pos}`);
  }

  generateWordId(word) {
    const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return idManager.generateId(`wn_word_${normalized}_en`);
  }

  generateRelationshipId(sourceId, targetId, relationType) {
    return idManager.generateRelationshipId(sourceId, targetId, relationType);
  }

  getStats() {
    return { ...this.stats };
  }
}
