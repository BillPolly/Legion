/**
 * Hierarchy Builder
 * Builds foundational ontology hierarchy and validates structure
 */

import { idManager } from '@legion/kg';

export class HierarchyBuilder {
  constructor(kgEngine) {
    this.kg = kgEngine;
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
      ['kg:FoundationalConcept', 'rdf:type', 'kg:Concept'],
      ['kg:FoundationalConcept', 'kg:conceptType', 'kg:RootConcept'],
      ['kg:FoundationalConcept', 'kg:definition', 'Root of all foundational concepts'],
      ['kg:FoundationalConcept', 'kg:hierarchyLevel', 'root'],

      // Primary ontological categories
      ['kg:Entity', 'rdf:type', 'kg:Concept'],
      ['kg:Entity', 'kg:conceptType', 'kg:FoundationalCategory'],
      ['kg:Entity', 'kg:definition', 'Root concept for all entities and objects'],
      ['kg:Entity', 'kg:foundationalRole', 'entity'],

      ['kg:Process', 'rdf:type', 'kg:Concept'],
      ['kg:Process', 'kg:conceptType', 'kg:FoundationalCategory'],
      ['kg:Process', 'kg:definition', 'Root concept for all processes and transformations'],
      ['kg:Process', 'kg:foundationalRole', 'process'],

      ['kg:Property', 'rdf:type', 'kg:Concept'],
      ['kg:Property', 'kg:conceptType', 'kg:FoundationalCategory'],
      ['kg:Property', 'kg:definition', 'Root concept for all properties and attributes'],
      ['kg:Property', 'kg:foundationalRole', 'property'],

      ['kg:Relation', 'rdf:type', 'kg:Concept'],
      ['kg:Relation', 'kg:conceptType', 'kg:FoundationalCategory'],
      ['kg:Relation', 'kg:definition', 'Root concept for all relations'],
      ['kg:Relation', 'kg:foundationalRole', 'relation']
    ];

    // Create hierarchy relationships
    const hierarchyTriples = [
      ['kg:Entity', idManager.generateRelationshipId('kg:Entity', 'kg:FoundationalConcept', 'isa'), 'kg:FoundationalConcept'],
      ['kg:Process', idManager.generateRelationshipId('kg:Process', 'kg:FoundationalConcept', 'isa'), 'kg:FoundationalConcept'],
      ['kg:Property', idManager.generateRelationshipId('kg:Property', 'kg:FoundationalConcept', 'isa'), 'kg:FoundationalConcept'],
      ['kg:Relation', idManager.generateRelationshipId('kg:Relation', 'kg:FoundationalConcept', 'isa'), 'kg:FoundationalConcept']
    ];

    // Add relationship metadata
    for (const [subj, rel, obj] of hierarchyTriples) {
      rootTriples.push([subj, rel, obj]);
      rootTriples.push([rel, 'rdf:type', 'kg:IsA']);
      rootTriples.push([rel, 'kg:relationSource', 'foundational_hierarchy']);
      rootTriples.push([rel, 'kg:hierarchyLevel', 'root']);
    }

    await this.kg.addTriples(rootTriples);
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

    for (const [pos, categoryId] of Object.entries(posToCategory)) {
      console.log(`Linking ${pos} concepts to ${categoryId}...`);

      const conceptsQuery = await this.kg.queryAsync(null, 'kg:partOfSpeech', pos);
      const concepts = conceptsQuery.map(([conceptId]) => conceptId);

      const linkTriples = [];
      for (const conceptId of concepts) {
        const relId = idManager.generateRelationshipId(conceptId, categoryId, 'isa');
        linkTriples.push(
          [conceptId, relId, categoryId],
          [relId, 'rdf:type', 'kg:IsA'],
          [relId, 'kg:relationSource', 'foundational_hierarchy'],
          [relId, 'kg:hierarchyLevel', 'category']
        );
      }

      if (linkTriples.length > 0) {
        await this.kg.addTriples(linkTriples);
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
    const allConcepts = await this.kg.queryAsync(null, 'rdf:type', 'kg:Concept');
    const isARelations = await this.kg.queryAsync(null, 'rdf:type', 'kg:IsA');
    const words = await this.kg.queryAsync(null, 'rdf:type', 'kg:Word');

    return {
      totalConcepts: allConcepts.length,
      totalIsARelations: isARelations.length,
      totalWords: words.length,
      avgChildrenPerConcept: allConcepts.length > 0 ? (isARelations.length / allConcepts.length).toFixed(2) : 0
    };
  }

  async detectSimpleCycles() {
    // Simple cycle detection for IS-A relationships
    const isAQuery = await this.kg.queryAsync(null, 'rdf:type', 'kg:IsA');
    const relationships = [];
    
    for (const [relId] of isAQuery) {
      const subjectQuery = await this.kg.queryAsync(null, relId, null);
      if (subjectQuery.length > 0) {
        const [subject, , object] = subjectQuery[0];
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
