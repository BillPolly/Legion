/**
 * Relationship Processor
 * Processes WordNet semantic relationships (hypernyms, meronyms, etc.)
 * Now uses Handle-based architecture with TripleStoreDataSource
 */

import { idGenerator } from '../utils/idGenerator.js';
import { WordNetAccess } from '../wordnet/WordNetAccess.js';

export class RelationshipProcessor {
  constructor(dataSource, config) {
    this.dataSource = dataSource;
    this.config = config;
    this.wordnet = new WordNetAccess();
    this.stats = {
      isARelations: 0,
      partOfRelations: 0,
      hasPartRelations: 0,
      similarityRelations: 0,
      antonymRelations: 0
    };
  }

  async processAllRelationships() {
    console.log('Processing WordNet semantic relationships...');

    // Get all concept nodes
    const tripleStore = this.dataSource.tripleStore;
    const conceptQuery = await tripleStore.findTriples(null, 'rdf:type', 'kg:Concept');
    const concepts = conceptQuery.map((triple) => triple.subject);

    console.log(`Found ${concepts.length} concepts to process for relationships`);

    let processedCount = 0;
    const batchSize = this.config.loading.batchSize;

    // Process concepts in batches
    for (let i = 0; i < concepts.length; i += batchSize) {
      const batch = concepts.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (conceptId) => {
        try {
          const offset = await this.getOffsetFromConceptId(conceptId);
          const pos = await this.getPosFromConceptId(conceptId);

          if (offset && pos) {
            await this.processSynsetRelationships(offset, pos, conceptId);
          }
        } catch (error) {
          console.warn(`Error processing relationships for ${conceptId}: ${error.message}`);
        }
      }));

      processedCount += batch.length;
      if (processedCount % this.config.loading.logInterval === 0) {
        console.log(`  Processed ${processedCount}/${concepts.length} concepts for relationships`);
      }
    }

    const totalRelationships = Object.values(this.stats).reduce((sum, count) => sum + count, 0);
    console.log(`Total relationships processed: ${totalRelationships}`);
    console.log('Relationship breakdown:', this.stats);

    return totalRelationships;
  }

  async processSynsetRelationships(offset, pos, conceptId) {
    try {
      const synsetData = await this.wordnet.getSynset(offset, pos);
      const triples = [];

      // Process hypernyms (IS-A relationships)
      if (synsetData.hypernyms && synsetData.hypernyms.length > 0) {
        for (const hypernym of synsetData.hypernyms) {
          const hypernymId = this.generateConceptId({
            synsetOffset: hypernym.synsetOffset,
            pos: hypernym.pos
          });

          const relTriples = this.createIsARelationship(conceptId, hypernymId);
          triples.push(...relTriples);
          this.stats.isARelations++;
        }
      }

      // Process meronyms (PART-OF relationships)
      if (synsetData.partMeronyms && synsetData.partMeronyms.length > 0) {
        for (const meronym of synsetData.partMeronyms) {
          const meronymId = this.generateConceptId({
            synsetOffset: meronym.synsetOffset,
            pos: meronym.pos
          });

          const relTriples = this.createPartOfRelationship(conceptId, meronymId);
          triples.push(...relTriples);
          this.stats.partOfRelations++;
        }
      }

      // Process holonyms (HAS-PART relationships)
      if (synsetData.partHolonyms && synsetData.partHolonyms.length > 0) {
        for (const holonym of synsetData.partHolonyms) {
          const holonymId = this.generateConceptId({
            synsetOffset: holonym.synsetOffset,
            pos: holonym.pos
          });

          const relTriples = this.createHasPartRelationship(conceptId, holonymId);
          triples.push(...relTriples);
          this.stats.hasPartRelations++;
        }
      }

      // Process similarity relationships (for adjectives)
      if (synsetData.similarTo && synsetData.similarTo.length > 0) {
        for (const similar of synsetData.similarTo) {
          const similarId = this.generateConceptId({
            synsetOffset: similar.synsetOffset,
            pos: similar.pos
          });

          const relTriples = this.createSimilarityRelationship(conceptId, similarId);
          triples.push(...relTriples);
          this.stats.similarityRelations++;
        }
      }

      // Store relationship triples using triple store
      if (triples.length > 0) {
        const tripleStore = this.dataSource.tripleStore;
        for (const triple of triples) {
          await tripleStore.addTriple(triple);
        }
      }

    } catch (error) {
      console.warn(`Failed to process relationships for ${offset}.${pos}: ${error.message}`);
    }
  }

  createIsARelationship(subjectId, objectId) {
    const relId = idGenerator.generateRelationshipId(subjectId, objectId, 'isa');

    return [
      { subject: subjectId, predicate: relId, object: objectId },
      { subject: relId, predicate: 'rdf:type', object: 'kg:IsA' },
      { subject: relId, predicate: 'kg:relationSource', object: 'wordnet' },
      { subject: relId, predicate: 'kg:hierarchyLevel', object: 'foundational' },
      { subject: relId, predicate: 'kg:created', object: new Date().toISOString() }
    ];
  }

  createPartOfRelationship(partId, wholeId) {
    const relId = idGenerator.generateRelationshipId(partId, wholeId, 'partof');

    return [
      { subject: partId, predicate: relId, object: wholeId },
      { subject: relId, predicate: 'rdf:type', object: 'kg:PartOf' },
      { subject: relId, predicate: 'kg:relationSource', object: 'wordnet' },
      { subject: relId, predicate: 'kg:hierarchyLevel', object: 'foundational' },
      { subject: relId, predicate: 'kg:created', object: new Date().toISOString() }
    ];
  }

  createHasPartRelationship(wholeId, partId) {
    const relId = idGenerator.generateRelationshipId(wholeId, partId, 'haspart');

    return [
      { subject: wholeId, predicate: relId, object: partId },
      { subject: relId, predicate: 'rdf:type', object: 'kg:HasPart' },
      { subject: relId, predicate: 'kg:relationSource', object: 'wordnet' },
      { subject: relId, predicate: 'kg:hierarchyLevel', object: 'foundational' },
      { subject: relId, predicate: 'kg:created', object: new Date().toISOString() }
    ];
  }

  createSimilarityRelationship(conceptId1, conceptId2) {
    const relId = idGenerator.generateRelationshipId(conceptId1, conceptId2, 'similar');

    return [
      { subject: conceptId1, predicate: relId, object: conceptId2 },
      { subject: relId, predicate: 'rdf:type', object: 'kg:SimilarTo' },
      { subject: relId, predicate: 'kg:relationSource', object: 'wordnet' },
      { subject: relId, predicate: 'kg:hierarchyLevel', object: 'foundational' },
      { subject: relId, predicate: 'kg:created', object: new Date().toISOString() }
    ];
  }

  generateConceptId(synsetData) {
    return idGenerator.generateId(`wn_concept_${synsetData.synsetOffset}_${synsetData.pos}`);
  }

  async getOffsetFromConceptId(conceptId) {
    const tripleStore = this.dataSource.tripleStore;
    const offsetTriples = await tripleStore.findTriples(conceptId, 'kg:wordnetOffset', null);
    return offsetTriples.length > 0 ? offsetTriples[0].object : null;
  }

  async getPosFromConceptId(conceptId) {
    const tripleStore = this.dataSource.tripleStore;
    const posTriples = await tripleStore.findTriples(conceptId, 'kg:partOfSpeech', null);
    return posTriples.length > 0 ? posTriples[0].object : null;
  }

  getStats() {
    return { ...this.stats };
  }
}