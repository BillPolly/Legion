/**
 * Hierarchy Builder
 * Builds foundational ontology hierarchy and validates structure
 * Now uses Handle-based architecture with TripleStoreDataSource
 */

import { idGenerator } from '../utils/idGenerator.js';

export class HierarchyBuilder {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async buildFoundationalHierarchy() {
    console.log('Building foundational ontology hierarchy...');

    // Create fundamental root concepts
    await this.createRootConcepts();

    // Organize WordNet concepts under foundational structure  
    await this.organizeConceptsByRole();

    // Validate hierarchy
    const validation = await this.validateHierarchy();
    console.log('Hierarchy validation:', validation);

    return validation;
  }

  async createRootConcepts() {
    const rootTriples = [
      // Top-level foundational concept
      { subject: 'kg:FoundationalConcept', predicate: 'rdf:type', object: 'kg:Concept' },
      { subject: 'kg:FoundationalConcept', predicate: 'kg:conceptType', object: 'kg:RootConcept' },
      { subject: 'kg:FoundationalConcept', predicate: 'kg:definition', object: 'Root of all foundational concepts' },
      { subject: 'kg:FoundationalConcept', predicate: 'kg:hierarchyLevel', object: 'root' },

      // Primary ontological categories
      { subject: 'kg:Entity', predicate: 'rdf:type', object: 'kg:Concept' },
      { subject: 'kg:Entity', predicate: 'kg:conceptType', object: 'kg:FoundationalCategory' },
      { subject: 'kg:Entity', predicate: 'kg:definition', object: 'Root concept for all entities and objects' },
      { subject: 'kg:Entity', predicate: 'kg:foundationalRole', object: 'entity' },

      { subject: 'kg:Process', predicate: 'rdf:type', object: 'kg:Concept' },
      { subject: 'kg:Process', predicate: 'kg:conceptType', object: 'kg:FoundationalCategory' },
      { subject: 'kg:Process', predicate: 'kg:definition', object: 'Root concept for all processes and transformations' },
      { subject: 'kg:Process', predicate: 'kg:foundationalRole', object: 'process' },

      { subject: 'kg:Property', predicate: 'rdf:type', object: 'kg:Concept' },
      { subject: 'kg:Property', predicate: 'kg:conceptType', object: 'kg:FoundationalCategory' },
      { subject: 'kg:Property', predicate: 'kg:definition', object: 'Root concept for all properties and attributes' },
      { subject: 'kg:Property', predicate: 'kg:foundationalRole', object: 'property' },

      { subject: 'kg:Relation', predicate: 'rdf:type', object: 'kg:Concept' },
      { subject: 'kg:Relation', predicate: 'kg:conceptType', object: 'kg:FoundationalCategory' },
      { subject: 'kg:Relation', predicate: 'kg:definition', object: 'Root concept for all relations' },
      { subject: 'kg:Relation', predicate: 'kg:foundationalRole', object: 'relation' }
    ];

    // Create hierarchy relationships
    const hierarchyTriples = [
      { subject: 'kg:Entity', predicate: idGenerator.generateRelationshipId('kg:Entity', 'kg:FoundationalConcept', 'isa'), object: 'kg:FoundationalConcept' },
      { subject: 'kg:Process', predicate: idGenerator.generateRelationshipId('kg:Process', 'kg:FoundationalConcept', 'isa'), object: 'kg:FoundationalConcept' },
      { subject: 'kg:Property', predicate: idGenerator.generateRelationshipId('kg:Property', 'kg:FoundationalConcept', 'isa'), object: 'kg:FoundationalConcept' },
      { subject: 'kg:Relation', predicate: idGenerator.generateRelationshipId('kg:Relation', 'kg:FoundationalConcept', 'isa'), object: 'kg:FoundationalConcept' }
    ];

    // Add relationship metadata
    for (const hier of hierarchyTriples) {
      rootTriples.push(hier);
      rootTriples.push({ subject: hier.predicate, predicate: 'rdf:type', object: 'kg:IsA' });
      rootTriples.push({ subject: hier.predicate, predicate: 'kg:relationSource', object: 'foundational_hierarchy' });
      rootTriples.push({ subject: hier.predicate, predicate: 'kg:hierarchyLevel', object: 'root' });
    }

    // Store all root triples using the triple store
    const tripleStore = this.dataSource.tripleStore;
    for (const triple of rootTriples) {
      await tripleStore.addTriple(triple);
    }
    
    console.log('Created foundational root concepts');
  }

  async organizeConceptsByRole() {
    const posToCategory = {
      'n': 'kg:Entity',
      'v': 'kg:Process', 
      'a': 'kg:Property',
      's': 'kg:Property',
      'r': 'kg:Property'
    };

    const tripleStore = this.dataSource.tripleStore;

    for (const [pos, categoryId] of Object.entries(posToCategory)) {
      console.log(`Linking ${pos} concepts to ${categoryId}...`);

      const conceptsQuery = await tripleStore.findTriples(null, 'kg:partOfSpeech', pos);
      const concepts = conceptsQuery.map((triple) => triple.subject);

      const linkTriples = [];
      for (const conceptId of concepts) {
        const relId = idGenerator.generateRelationshipId(conceptId, categoryId, 'isa');
        linkTriples.push(
          { subject: conceptId, predicate: relId, object: categoryId },
          { subject: relId, predicate: 'rdf:type', object: 'kg:IsA' },
          { subject: relId, predicate: 'kg:relationSource', object: 'foundational_hierarchy' },
          { subject: relId, predicate: 'kg:hierarchyLevel', object: 'category' }
        );
      }

      if (linkTriples.length > 0) {
        for (const triple of linkTriples) {
          await tripleStore.addTriple(triple);
        }
      }

      console.log(`Linked ${concepts.length} ${pos} concepts to ${categoryId}`);
    }
  }

  async validateHierarchy() {
    const stats = await this.calculateHierarchyStats();
    const cycles = await this.detectSimpleCycles();
    
    return {
      ...stats,
      cyclesFound: cycles.length,
      isValid: cycles.length === 0
    };
  }

  async calculateHierarchyStats() {
    const tripleStore = this.dataSource.tripleStore;
    
    const allConcepts = await tripleStore.findTriples(null, 'rdf:type', 'kg:Concept');
    const isARelations = await tripleStore.findTriples(null, 'rdf:type', 'kg:IsA');
    const words = await tripleStore.findTriples(null, 'rdf:type', 'kg:Word');

    return {
      totalConcepts: allConcepts.length,
      totalIsARelations: isARelations.length,
      totalWords: words.length,
      avgChildrenPerConcept: allConcepts.length > 0 ? (isARelations.length / allConcepts.length).toFixed(2) : 0
    };
  }

  async detectSimpleCycles() {
    const tripleStore = this.dataSource.tripleStore;
    
    // Simple cycle detection for IS-A relationships
    const isAQuery = await tripleStore.findTriples(null, 'rdf:type', 'kg:IsA');
    const relationships = [];
    
    for (const triple of isAQuery) {
      const relId = triple.subject;
      const subjectQuery = await tripleStore.findTriples(null, relId, null);
      if (subjectQuery.length > 0) {
        const subject = subjectQuery[0].subject;
        const object = subjectQuery[0].object;
        relationships.push([subject, object]);
      }
    }

    // Build graph and detect cycles using DFS
    const graph = new Map();
    for (const [from, to] of relationships) {
      if (!graph.has(from)) graph.set(from, []);
      graph.get(from).push(to);
    }

    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (node) => {
      if (!visited.has(node)) {
        visited.add(node);
        recursionStack.add(node);

        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && hasCycle(neighbor)) {
            return true;
          } else if (recursionStack.has(neighbor)) {
            cycles.push([node, neighbor]);
            return true;
          }
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        hasCycle(node);
      }
    }

    return cycles;
  }
}