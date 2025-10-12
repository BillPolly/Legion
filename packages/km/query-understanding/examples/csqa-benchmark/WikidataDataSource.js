/**
 * WikidataDataSource - DataSource adapter for preprocessed Wikidata subset
 *
 * Queries local wikidata-subset.json for entities and facts needed by CSQA benchmark.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WikidataDataSource {
  constructor(subsetPath = null) {
    // Load preprocessed Wikidata subset
    const defaultPath = path.join(__dirname, 'wikidata-subset.json');
    const dataPath = subsetPath || defaultPath;

    console.log(`📖 Loading Wikidata subset from: ${path.basename(dataPath)}`);
    this.subset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`   ✓ Loaded ${this.subset.metadata.totalEntities} entities, ${this.subset.metadata.totalFacts} facts`);

    this.cache = {
      entities: new Map(),
      labels: new Map(),
      facts: new Map()
    };
  }

  /**
   * Get entity label from preprocessed subset
   */
  async getEntityLabel(entityId) {
    if (this.cache.labels.has(entityId)) {
      return this.cache.labels.get(entityId);
    }

    const entity = this.subset.entities[entityId];
    const label = entity ? entity.label : entityId;

    this.cache.labels.set(entityId, label);
    return label;
  }

  /**
   * Get all facts about an entity from preprocessed subset
   * Returns: [{predicate: "P106", object: "Q3455803", objectLabel: "director", predicateLabel: "occupation"}, ...]
   */
  async getEntityFacts(entityId) {
    if (this.cache.facts.has(entityId)) {
      return this.cache.facts.get(entityId);
    }

    const entity = this.subset.entities[entityId];
    if (!entity || !entity.facts) {
      return [];
    }

    // Enrich facts with labels
    const facts = entity.facts.map(fact => {
      const predicateLabel = this.subset.properties[fact.predicate] || fact.predicate;
      const objectEntity = this.subset.entities[fact.object];
      const objectLabel = objectEntity ? objectEntity.label : fact.object;

      return {
        predicate: fact.predicate,
        predicateLabel,
        object: fact.object,
        objectLabel
      };
    });

    this.cache.facts.set(entityId, facts);
    return facts;
  }

  /**
   * Query entities that match a predicate-object pattern from preprocessed subset
   * E.g., "Which entities have P106 (occupation) = Q3455803 (director)?"
   */
  async queryByPredicateObject(predicate, objectId) {
    const results = [];

    // Scan all entities for matching facts
    for (const [entityId, entity] of Object.entries(this.subset.entities)) {
      if (!entity.facts) continue;

      for (const fact of entity.facts) {
        if (fact.predicate === predicate && fact.object === objectId) {
          results.push({
            id: entityId,
            label: entity.label
          });
          break; // Found a match for this entity
        }
      }
    }

    return results;
  }

  /**
   * Query entities that match a subject-predicate pattern from preprocessed subset
   * E.g., "What is the P57 (director) of Q10691559 (Taxi 13)?"
   */
  async queryBySubjectPredicate(subjectId, predicate) {
    // If subjectId is a name (not Q-number), try to look it up
    let actualSubjectId = subjectId;
    if (!subjectId.startsWith('Q')) {
      const entityId = await this.findEntityByLabel(subjectId.replace(/_/g, ' '));
      if (entityId) {
        actualSubjectId = entityId;
      } else {
        console.warn(`Could not resolve entity name: ${subjectId}`);
        return [];
      }
    }

    const entity = this.subset.entities[actualSubjectId];
    if (!entity || !entity.facts) {
      return [];
    }

    const results = [];
    for (const fact of entity.facts) {
      if (fact.predicate === predicate) {
        const objectEntity = this.subset.entities[fact.object];
        results.push({
          id: fact.object,
          label: objectEntity ? objectEntity.label : fact.object
        });
      }
    }

    return results;
  }

  /**
   * Find Wikidata entity ID by label (name) in preprocessed subset
   * E.g., "Börje Larsson" → "Q5479433"
   */
  async findEntityByLabel(label) {
    if (this.cache.entities.has(label)) {
      return this.cache.entities.get(label);
    }

    // Scan all entities for matching label
    for (const [entityId, entity] of Object.entries(this.subset.entities)) {
      if (entity.label.toLowerCase() === label.toLowerCase()) {
        this.cache.entities.set(label, entityId);
        return entityId;
      }
    }

    return null;
  }

  /**
   * Main query method - implements DataSource interface
   *
   * Accepts DataScript-style queries:
   * {find: ['?x'], where: [['?x', ':type', ':Country'], ['?x', ':borders', ':Germany']]}
   */
  async query(querySpec) {
    const results = [];

    // For CSQA, we typically get patterns like:
    // [['?x', 'P106', 'Q3455803']] - "which entities have occupation = director?"
    // [['Q5479433', 'P57', '?x']] - "what did Börje Larsson direct?"

    for (const whereClause of querySpec.where) {
      const [subject, predicate, object] = whereClause;

      // Case 1: ?x P O - find subjects with predicate-object
      if (subject === '?x' && !predicate.startsWith('?') && !object.startsWith('?')) {
        const cleanPred = predicate.replace(/^:/, '');
        const cleanObj = object.replace(/^:/, '');

        const entities = await this.queryByPredicateObject(cleanPred, cleanObj);
        for (const entity of entities) {
          results.push({
            '?x': entity.id,
            x: entity.id,
            name: entity.label,
            canonical: entity.id,
            type: cleanObj
          });
        }
      }

      // Case 2: S P ?x - find objects with subject-predicate
      else if (!subject.startsWith('?') && !predicate.startsWith('?') && object === '?x') {
        const cleanSubj = subject.replace(/^:/, '');
        const cleanPred = predicate.replace(/^:/, '');

        const entities = await this.queryBySubjectPredicate(cleanSubj, cleanPred);
        for (const entity of entities) {
          results.push({
            '?x': entity.id,
            x: entity.id,
            name: entity.label,
            canonical: entity.id,
            type: cleanPred
          });
        }
      }
    }

    return results;
  }

  /**
   * Get entity type (for graph context retrieval) from preprocessed subset
   */
  async getEntityType(entityId) {
    const entity = this.subset.entities[entityId];
    if (!entity || !entity.facts) {
      return null;
    }

    // Find P31 (instance of) fact
    const typeFact = entity.facts.find(f => f.predicate === 'P31');
    if (!typeFact) {
      return null;
    }

    const typeEntity = this.subset.entities[typeFact.object];
    return {
      id: typeFact.object,
      label: typeEntity ? typeEntity.label : typeFact.object
    };
  }

  /**
   * Get entity properties (for graph context retrieval)
   */
  async getEntityProperties(entityId) {
    const facts = await this.getEntityFacts(entityId);

    return facts.map(fact => ({
      prop: fact.predicate,
      value: fact.objectLabel
    }));
  }

  /**
   * Get entity neighbors (1-hop relationships for graph context)
   */
  async getEntityNeighbors(entityId) {
    const facts = await this.getEntityFacts(entityId);

    return facts
      .filter(fact => fact.object.startsWith('Q')) // Only entity objects, not literals
      .map(fact => ({
        rel: fact.predicate,
        target: fact.object,
        targetLabel: fact.objectLabel
      }));
  }

  /**
   * Clear cache (useful between test runs)
   */
  clearCache() {
    this.cache.entities.clear();
    this.cache.labels.clear();
    this.cache.facts.clear();
  }
}
