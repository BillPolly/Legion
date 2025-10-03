/**
 * End-to-End Plumbing Domain Test
 *
 * Demonstrates the full upper-level ontology system with realistic plumbing text:
 * 1. Bootstrap upper-level ontology (PhysicalEntity, State, Process, Task)
 * 2. Build domain ontology from plumbing descriptions
 * 3. Extract entity instances from text
 * 4. Store in knowledge graph with MongoDB
 * 5. Query by category (physical entities, states, processes, tasks)
 * 6. Query process preconditions and postconditions
 * 7. Demonstrate full knowledge graph capabilities
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyBuilder } from '../../src/OntologyBuilder.js';
import { HierarchyTraversalService } from '../../src/services/HierarchyTraversalService.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { KnowledgeGraphStore } from '../../../entity-store/src/KnowledgeGraphStore.js';
import { EntityDeduplicator } from '../../../entity-store/src/EntityDeduplicator.js';
import { ProvenanceTracker } from '../../../entity-store/src/ProvenanceTracker.js';
import { OntologyInstanceExtractor } from '../../../entity-store/src/OntologyInstanceExtractor.js';

describe('Plumbing Domain E2E Test', () => {
  let resourceManager;
  let tripleStore;
  let semanticSearch;
  let llmClient;
  let ontologyBuilder;
  let hierarchyTraversal;
  let mongoServer;
  let knowledgeGraphStore;
  let entityDeduplicator;
  let provenanceTracker;
  let instanceExtractor;

  // Realistic plumbing text covering physical entities, states, processes, and tasks
  const plumbingText = `
The residential plumbing system consists of a water heater, pressure regulator, and main shutoff valve.
The water heater heats incoming cold water to 140 degrees Fahrenheit.
Before heating begins, the inlet temperature must be between 40 and 60 degrees Fahrenheit.
After the heating process completes, the outlet temperature reaches 140 degrees Fahrenheit.
The pressure regulator reduces the street water pressure from 80 PSI to a safe 50 PSI for household use.
High pressure can damage pipes and fixtures, so the regulator maintains constant downstream pressure.
The main shutoff valve controls water flow to the entire house and should be located near the water meter.
PEX tubing connects the water heater to fixtures throughout the building.
Copper pipes are also used for hot water distribution in older installations.
The drain system uses PVC pipes to carry wastewater from sinks and toilets to the sewer line.
A P-trap beneath each sink prevents sewer gases from entering the living space by maintaining a water seal.
The water seal in the P-trap must remain filled to block odors effectively.
Annual maintenance inspections check for leaks, corrosion, and proper water pressure.
During maintenance, technicians test the temperature-pressure relief valve on the water heater.
Drain cleaning removes buildup from pipes and restores proper flow.
The temperature-pressure relief valve opens automatically if pressure exceeds 150 PSI or temperature exceeds 210 degrees Fahrenheit.
`.trim();

  beforeAll(async () => {
    console.log('\n🔧 PLUMBING DOMAIN E2E TEST - Setup\n');

    // Initialize ResourceManager
    resourceManager = await ResourceManager.getInstance();

    // Create LLM client
    llmClient = await resourceManager.get('llmClient');

    // Create triple store for ontology
    tripleStore = new SimpleTripleStore();

    // Create semantic search
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();

    // Create hierarchy traversal
    hierarchyTraversal = new HierarchyTraversalService(tripleStore);

    // Create OntologyBuilder
    ontologyBuilder = new OntologyBuilder({
      tripleStore,
      semanticSearch,
      llmClient
    });

    // Start in-memory MongoDB for entity storage
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    // Create knowledge graph store with hierarchy traversal
    knowledgeGraphStore = new KnowledgeGraphStore({
      connectionString: uri,
      database: 'plumbing-kg',
      collection: 'knowledge_graph',
      hierarchyTraversal
    });
    await knowledgeGraphStore.connect();

    // Create support services for entity extraction
    entityDeduplicator = new EntityDeduplicator(knowledgeGraphStore, semanticSearch);
    provenanceTracker = new ProvenanceTracker(knowledgeGraphStore);

    // Create instance extractor
    instanceExtractor = new OntologyInstanceExtractor({
      knowledgeGraphStore,
      semanticSearch,
      entityDeduplicator,
      provenanceTracker,
      deduplicationThreshold: 0.85
    });
  }, 60000);

  afterAll(async () => {
    if (semanticSearch) {
      await semanticSearch.disconnect();
    }
    if (knowledgeGraphStore) {
      await knowledgeGraphStore.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  test('Phase 1: Build ontology from plumbing text', async () => {
    console.log('\n📚 Phase 1: Building Ontology from Plumbing Text\n');

    const result = await ontologyBuilder.processText(plumbingText, {
      domain: 'plumbing'
    });

    expect(result.success).toBe(true);
    expect(result.sentences.length).toBeGreaterThan(10);

    console.log(`✅ Processed ${result.sentences.length} sentences`);
    console.log(`📊 Ontology: ${result.ontologyStats.classes} classes, ${result.ontologyStats.properties} properties, ${result.ontologyStats.relationships} relationships`);

    // Verify bootstrap categories exist
    const continuant = await tripleStore.query('kg:Continuant', 'rdf:type', 'owl:Class');
    expect(continuant.length).toBe(1);

    const occurrent = await tripleStore.query('kg:Occurrent', 'rdf:type', 'owl:Class');
    expect(occurrent.length).toBe(1);

    console.log('✅ Bootstrap upper-level ontology loaded');
  }, 180000);

  test('Phase 2: Verify category hierarchy', async () => {
    console.log('\n🔍 Phase 2: Verifying Category Hierarchy\n');

    // Check PhysicalEntity descendants
    const physicalEntities = [];
    const allClasses = await tripleStore.query(null, 'rdf:type', 'owl:Class');

    for (const [classURI] of allClasses) {
      if (classURI.startsWith('kg:') && classURI !== 'kg:Continuant' && classURI !== 'kg:Occurrent') {
        const ancestors = await hierarchyTraversal.getAncestors(classURI);
        if (ancestors.includes('kg:PhysicalEntity')) {
          const labels = await tripleStore.query(classURI, 'rdfs:label', null);
          physicalEntities.push({
            uri: classURI,
            label: labels[0]?.[2]?.replace(/"/g, '') || classURI
          });
        }
      }
    }

    console.log(`\n🔧 Physical Entities (${physicalEntities.length}):`);
    physicalEntities.forEach(e => console.log(`  - ${e.label} (${e.uri})`));

    expect(physicalEntities.length).toBeGreaterThan(0);

    // Check Process descendants
    const processes = [];
    for (const [classURI] of allClasses) {
      if (classURI.startsWith('kg:') && classURI !== 'kg:Continuant' && classURI !== 'kg:Occurrent') {
        const ancestors = await hierarchyTraversal.getAncestors(classURI);
        if (ancestors.includes('kg:Process')) {
          const labels = await tripleStore.query(classURI, 'rdfs:label', null);
          processes.push({
            uri: classURI,
            label: labels[0]?.[2]?.replace(/"/g, '') || classURI
          });
        }
      }
    }

    console.log(`\n⚙️  Processes (${processes.length}):`);
    processes.forEach(p => console.log(`  - ${p.label} (${p.uri})`));

    expect(processes.length).toBeGreaterThan(0);

    // Check State descendants
    const states = [];
    for (const [classURI] of allClasses) {
      if (classURI.startsWith('kg:') && classURI !== 'kg:Continuant' && classURI !== 'kg:Occurrent') {
        const ancestors = await hierarchyTraversal.getAncestors(classURI);
        if (ancestors.includes('kg:State')) {
          const labels = await tripleStore.query(classURI, 'rdfs:label', null);
          states.push({
            uri: classURI,
            label: labels[0]?.[2]?.replace(/"/g, '') || classURI
          });
        }
      }
    }

    console.log(`\n📊 States (${states.length}):`);
    states.forEach(s => console.log(`  - ${s.label} (${s.uri})`));

    // Check Task descendants
    const tasks = [];
    for (const [classURI] of allClasses) {
      if (classURI.startsWith('kg:') && classURI !== 'kg:Continuant' && classURI !== 'kg:Occurrent') {
        const ancestors = await hierarchyTraversal.getAncestors(classURI);
        if (ancestors.includes('kg:Task')) {
          const labels = await tripleStore.query(classURI, 'rdfs:label', null);
          tasks.push({
            uri: classURI,
            label: labels[0]?.[2]?.replace(/"/g, '') || classURI
          });
        }
      }
    }

    console.log(`\n✅ Tasks (${tasks.length}):`);
    tasks.forEach(t => console.log(`  - ${t.label} (${t.uri})`));
  }, 30000);

  test('Phase 3: Extract entity instances from specific sentences', async () => {
    console.log('\n🏗️  Phase 3: Extracting Entity Instances\n');

    // Simulate NLP extraction for specific entities
    const waterHeaterExtraction = {
      extractions: {
        entityDetails: [
          {
            type: 'kg:WaterHeater',
            text: 'Water Heater WH-101',
            label: 'Water Heater WH-101',
            confidence: 0.95,
            properties: {
              capacity: 50,
              unit: 'gallons'
            }
          }
        ],
        relationshipDetails: []
      }
    };

    const result1 = await instanceExtractor.extractInstances(
      waterHeaterExtraction,
      'sentence_wh_1',
      { enableDeduplication: true }
    );

    expect(result1.entities.length).toBe(1);
    expect(result1.entities[0].action).toBe('created');
    expect(result1.statistics.entitiesCreated).toBe(1);

    const waterHeaterId = result1.entities[0].mongoId;

    console.log(`✅ Created Water Heater: ${waterHeaterId}`);

    // Extract temperature states
    const temperatureExtraction = {
      extractions: {
        entityDetails: [
          {
            type: 'kg:Temperature',
            text: 'Inlet Temperature 50°F',
            label: 'Inlet Temperature 50°F',
            confidence: 0.92,
            properties: {
              value: 50,
              unit: 'Fahrenheit',
              location: 'inlet'
            }
          },
          {
            type: 'kg:Temperature',
            text: 'Outlet Temperature 140°F',
            label: 'Outlet Temperature 140°F',
            confidence: 0.92,
            properties: {
              value: 140,
              unit: 'Fahrenheit',
              location: 'outlet'
            }
          }
        ],
        relationshipDetails: []
      }
    };

    const result2 = await instanceExtractor.extractInstances(
      temperatureExtraction,
      'sentence_temp_1',
      { enableDeduplication: true }
    );

    expect(result2.entities.length).toBe(2);
    expect(result2.statistics.entitiesCreated).toBe(2);

    const inletTempId = result2.entities[0].mongoId;
    const outletTempId = result2.entities[1].mongoId;

    console.log(`✅ Created Inlet Temperature: ${inletTempId}`);
    console.log(`✅ Created Outlet Temperature: ${outletTempId}`);

    // Extract heating process
    const heatingProcessExtraction = {
      extractions: {
        entityDetails: [
          {
            type: 'kg:Heating',
            text: 'Water Heating Process',
            label: 'Water Heating Process',
            confidence: 0.94,
            properties: {
              targetTemperature: 140,
              unit: 'Fahrenheit'
            }
          }
        ],
        relationshipDetails: []
      }
    };

    const result3 = await instanceExtractor.extractInstances(
      heatingProcessExtraction,
      'sentence_heating_1',
      { enableDeduplication: true }
    );

    expect(result3.entities.length).toBe(1);
    expect(result3.statistics.entitiesCreated).toBe(1);

    const heatingProcessId = result3.entities[0].mongoId;

    console.log(`✅ Created Heating Process: ${heatingProcessId}`);

    // Link process to states via relationships
    await knowledgeGraphStore.insertRelationship({
      ontologyType: 'kg:requiresPrecondition',
      label: 'requires precondition',
      from: heatingProcessId,
      to: inletTempId,
      attributes: {},
      provenance: {
        mentionedIn: ['sentence_heating_1'],
        confidence: 0.9,
        extractionMethod: 'llm'
      }
    });

    await knowledgeGraphStore.insertRelationship({
      ontologyType: 'kg:producesPostcondition',
      label: 'produces postcondition',
      from: heatingProcessId,
      to: outletTempId,
      attributes: {},
      provenance: {
        mentionedIn: ['sentence_heating_1'],
        confidence: 0.9,
        extractionMethod: 'llm'
      }
    });

    await knowledgeGraphStore.insertRelationship({
      ontologyType: 'kg:transforms',
      label: 'transforms',
      from: heatingProcessId,
      to: waterHeaterId,
      attributes: {},
      provenance: {
        mentionedIn: ['sentence_heating_1'],
        confidence: 0.9,
        extractionMethod: 'llm'
      }
    });

    console.log('✅ Linked heating process to preconditions, postconditions, and transformed entities');

    // Store IDs for later tests
    this.waterHeaterId = waterHeaterId;
    this.inletTempId = inletTempId;
    this.outletTempId = outletTempId;
    this.heatingProcessId = heatingProcessId;
  }, 60000);

  test('Phase 4: Query entities by category', async () => {
    console.log('\n🔎 Phase 4: Querying by Category\n');

    // Query PhysicalEntity instances
    const physicalEntities = await knowledgeGraphStore.findPhysicalEntities();
    console.log(`\n🔧 Physical Entity Instances (${physicalEntities.length}):`);
    physicalEntities.forEach(e => {
      const category = e.ontologyType;
      console.log(`  - ${e.label} (${category})`);
    });

    expect(physicalEntities.length).toBeGreaterThan(0);

    // Query State instances
    const states = await knowledgeGraphStore.findStates();
    console.log(`\n📊 State Instances (${states.length}):`);
    states.forEach(s => {
      console.log(`  - ${s.label} (${s.ontologyType})`);
      console.log(`    Properties: ${JSON.stringify(s.attributes)}`);
    });

    expect(states.length).toBeGreaterThan(0);

    // Query Process instances
    const processes = await knowledgeGraphStore.findProcesses();
    console.log(`\n⚙️  Process Instances (${processes.length}):`);
    processes.forEach(p => {
      console.log(`  - ${p.label} (${p.ontologyType})`);
    });

    expect(processes.length).toBeGreaterThan(0);

    // Query Task instances (if any)
    const tasks = await knowledgeGraphStore.findTasks();
    console.log(`\n✅ Task Instances (${tasks.length}):`);
    tasks.forEach(t => {
      console.log(`  - ${t.label} (${t.ontologyType})`);
    });
  }, 30000);

  test('Phase 5: Query process preconditions and postconditions', async () => {
    console.log('\n🔗 Phase 5: Process Preconditions & Postconditions\n');

    const heatingProcessId = this.heatingProcessId;

    if (!heatingProcessId) {
      console.log('⚠️  Heating process not found, skipping');
      return;
    }

    // Get preconditions
    const preconditions = await knowledgeGraphStore.findProcessPreconditions(heatingProcessId);
    console.log(`\n📥 Preconditions for Heating Process (${preconditions.length}):`);
    preconditions.forEach(p => {
      console.log(`  - ${p.label}`);
      console.log(`    Type: ${p.ontologyType}`);
      console.log(`    Properties: ${JSON.stringify(p.attributes)}`);
    });

    expect(preconditions.length).toBeGreaterThan(0);

    // Get postconditions
    const postconditions = await knowledgeGraphStore.findProcessPostconditions(heatingProcessId);
    console.log(`\n📤 Postconditions for Heating Process (${postconditions.length}):`);
    postconditions.forEach(p => {
      console.log(`  - ${p.label}`);
      console.log(`    Type: ${p.ontologyType}`);
      console.log(`    Properties: ${JSON.stringify(p.attributes)}`);
    });

    expect(postconditions.length).toBeGreaterThan(0);

    // Get transformed entities
    const transformed = await knowledgeGraphStore.findProcessTransforms(heatingProcessId);
    console.log(`\n🔄 Entities Transformed by Heating Process (${transformed.length}):`);
    transformed.forEach(t => {
      console.log(`  - ${t.label} (${t.ontologyType})`);
    });

    expect(transformed.length).toBeGreaterThan(0);
  }, 30000);

  test('Phase 6: Demonstrate category inference', async () => {
    console.log('\n🧠 Phase 6: Category Inference\n');

    // Infer categories for various ontology types
    const testTypes = [
      'kg:WaterHeater',
      'kg:PressureRegulator',
      'kg:Heating',
      'kg:Temperature',
      'kg:Pressure',
      'kg:Maintenance'
    ];

    for (const ontologyType of testTypes) {
      // Check if type exists in ontology first
      const classExists = await tripleStore.query(ontologyType, 'rdf:type', 'owl:Class');
      if (classExists.length > 0) {
        const category = await knowledgeGraphStore.inferCategory(ontologyType);
        const labels = await tripleStore.query(ontologyType, 'rdfs:label', null);
        const label = labels[0]?.[2]?.replace(/"/g, '') || ontologyType;

        console.log(`  ${label} (${ontologyType})`);
        console.log(`    → Category: ${category || 'uncategorized'}`);
      }
    }
  }, 30000);

  test('Phase 7: Demonstrate provenance tracking', async () => {
    console.log('\n📜 Phase 7: Provenance Tracking\n');

    const waterHeaterId = this.waterHeaterId;

    if (!waterHeaterId) {
      console.log('⚠️  Water heater not found, skipping');
      return;
    }

    // Get provenance for water heater
    const provenanceChain = await provenanceTracker.getProvenanceChain(waterHeaterId);

    console.log(`\nProvenance for: ${provenanceChain.label}`);
    console.log(`  Type: ${provenanceChain.ontologyType}`);
    console.log(`  Category: ${provenanceChain.graphType}`);
    console.log(`  Mentioned in: ${provenanceChain.provenance.mentionedIn.join(', ')}`);
    console.log(`  Confidence: ${provenanceChain.provenance.confidence}`);
    console.log(`  Extraction method: ${provenanceChain.provenance.extractionMethod}`);
    console.log(`  Created: ${provenanceChain.createdAt.toISOString()}`);

    expect(provenanceChain).toBeDefined();
    expect(provenanceChain.provenance.mentionedIn.length).toBeGreaterThan(0);
  }, 30000);

  test('Phase 8: Knowledge graph statistics', async () => {
    console.log('\n📊 Phase 8: Knowledge Graph Statistics\n');

    const stats = await knowledgeGraphStore.getStatistics();

    console.log(`\nKnowledge Graph Statistics:`);
    console.log(`  Total Entities: ${stats.totalEntities}`);
    console.log(`  Total Relationships: ${stats.totalRelationships}`);
    console.log(`  Total Graph Items: ${stats.total}`);
    console.log(`\nBreakdown by Type:`);

    Object.entries(stats.byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    expect(stats.totalEntities).toBeGreaterThan(0);
    expect(stats.total).toBe(stats.totalEntities + stats.totalRelationships);

    // Ontology statistics
    const ontologyClasses = await ontologyBuilder.countClasses();
    const ontologyProps = await ontologyBuilder.countProperties();
    const ontologyRels = await ontologyBuilder.countRelationships();

    console.log(`\nOntology Statistics:`);
    console.log(`  Classes: ${ontologyClasses}`);
    console.log(`  Properties: ${ontologyProps}`);
    console.log(`  Relationships: ${ontologyRels}`);

    expect(ontologyClasses).toBeGreaterThan(6); // At least bootstrap + domain classes
  }, 30000);
});
