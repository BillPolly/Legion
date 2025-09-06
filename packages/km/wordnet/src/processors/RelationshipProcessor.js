/**
 * Relationship Processor
 * Processes WordNet semantic relationships (hypernyms, meronyms, etc.)
 */

import { idManager } from '@legion/kg';
import { WordNetAccess } from '../wordnet/WordNetAccess.js';

export class RelationshipProcessor {
  constructor(kgEngine, config) {
    this.kg = kgEngine;
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
    const conceptQuery = await this.kg.queryAsync(null, 'rdf:type', 'kg:Concept');
    const concepts = conceptQuery.map(([conceptId]) => conceptId);

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

      // Store relationship triples
      if (triples.length > 0) {
        await this.kg.addTriples(triples);
      }

    } catch (error) {
      console.warn(`Failed to process relationships for ${offset}.${pos}: ${error.message}`);
    }
  }

  createIsARelationship(subjectId, objectId) {
    const relId = idManager.generateRelationshipId(subjectId, objectId, 'isa');

    return [
      [subjectId, relId, objectId],
      [relId, 'rdf:type', 'kg:IsA'],
      [relId, 'kg:relationSource', 'wordnet'],
      [relId, 'kg:hierarchyLevel', 'foundational'],
      [relId, 'kg:created', new Date().toISOString()]
    ];
  }

  createPartOfRelationship(partId, wholeId) {
    const relId = idManager.generateRelationshipId(partId, wholeId, 'partof');

    return [
      [partId, relId, wholeId],
      [relId, 'rdf:type', 'kg:PartOf'],
      [relId, 'kg:relationSource', 'wordnet'],
      [relId, 'kg:hierarchyLevel', 'foundational'],
      [relId, 'kg:created', new Date().toISOString()]
    ];
  }

  createHasPartRelationship(wholeId, partId) {
    const relId = idManager.generateRelationshipId(wholeId, partId, 'haspart');

    return [
      [wholeId, relId, partId],
      [relId, 'rdf:type', 'kg:HasPart'],
      [relId, 'kg:relationSource', 'wordnet'],
      [relId, 'kg:hierarchyLevel', 'foundational'],
      [relId, 'kg:created', new Date().toISOString()]
    ];
  }

  createSimilarityRelationship(conceptId1, conceptId2) {
    const relId = idManager.generateRelationshipId(conceptId1, conceptId2, 'similar');

    return [
      [conceptId1, relId, conceptId2],
      [relId, 'rdf:type', 'kg:SimilarTo'],
      [relId, 'kg:relationSource', 'wordnet'],
      [relId, 'kg:hierarchyLevel', 'foundational'],
      [relId, 'kg:created', new Date().toISOString()]
    ];
  }

  generateConceptId(synsetData) {
    return idManager.generateId(`wn_concept_${synsetData.synsetOffset}_${synsetData.pos}`);
  }

  async getOffsetFromConceptId(conceptId) {
    const offsetTriples = await this.kg.queryAsync(conceptId, 'kg:wordnetOffset', null);
    return offsetTriples.length > 0 ? offsetTriples[0][2] : null;
  }

  async getPosFromConceptId(conceptId) {
    const posTriples = await this.kg.queryAsync(conceptId, 'kg:partOfSpeech', null);
    return posTriples.length > 0 ? posTriples[0][2] : null;
  }

  getStats() {
    return { ...this.stats };
  }
}
