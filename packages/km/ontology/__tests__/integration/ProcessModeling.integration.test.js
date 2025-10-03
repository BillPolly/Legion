/**
 * Integration test for process/state modeling with upper-level ontology
 *
 * Tests the full flow:
 * 1. Bootstrap upper-level ontology
 * 2. Extract entities with category hints (PhysicalEntity, State, Process, Task)
 * 3. Store in knowledge graph
 * 4. Query by category
 * 5. Query process preconditions/postconditions
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyBuilder } from '../../src/OntologyBuilder.js';
import { HierarchyTraversalService } from '../../src/services/HierarchyTraversalService.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { KnowledgeGraphStore } from '../../../entity-store/src/KnowledgeGraphStore.js';

describe('Process/State Modeling Integration', () => {
  let resourceManager;
  let tripleStore;
  let semanticSearch;
  let llmClient;
  let ontologyBuilder;
  let hierarchyTraversal;
  let mongoServer;
  let knowledgeGraphStore;

  beforeAll(async () => {
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
      database: 'test-kg',
      collection: 'knowledge_graph',
      hierarchyTraversal
    });
    await knowledgeGraphStore.connect();
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

  test('should bootstrap upper-level ontology on first processText call', async () => {
    // Process a simple sentence to trigger bootstrap
    const result = await ontologyBuilder.processText(
      'The pump operates.',
      { domain: 'industrial' }
    );

    expect(result.success).toBe(true);

    // Verify bootstrap classes were created
    const continuant = await tripleStore.query('kg:Continuant', 'rdf:type', 'owl:Class');
    expect(continuant.length).toBe(1);

    const occurrent = await tripleStore.query('kg:Occurrent', 'rdf:type', 'owl:Class');
    expect(occurrent.length).toBe(1);

    const physicalEntity = await tripleStore.query('kg:PhysicalEntity', 'rdf:type', 'owl:Class');
    expect(physicalEntity.length).toBe(1);

    const state = await tripleStore.query('kg:State', 'rdf:type', 'owl:Class');
    expect(state.length).toBe(1);

    const process = await tripleStore.query('kg:Process', 'rdf:type', 'owl:Class');
    expect(process.length).toBe(1);

    const task = await tripleStore.query('kg:Task', 'rdf:type', 'owl:Class');
    expect(task.length).toBe(1);
  }, 60000);

  test('should categorize PhysicalEntity correctly', async () => {
    const result = await ontologyBuilder.processText(
      'The centrifugal pump has an impeller.',
      { domain: 'industrial' }
    );

    expect(result.success).toBe(true);

    // Check that Pump was created as subclass of PhysicalEntity
    const pumpClass = await tripleStore.query('kg:CentrifugalPump', 'rdf:type', 'owl:Class');
    expect(pumpClass.length).toBeGreaterThan(0);

    // Get parent
    const pumpParents = await tripleStore.query('kg:CentrifugalPump', 'rdfs:subClassOf', null);
    expect(pumpParents.length).toBeGreaterThan(0);

    // Should be either PhysicalEntity or something that inherits from it
    const ancestors = await hierarchyTraversal.getAncestors('kg:CentrifugalPump');
    expect(ancestors).toContain('kg:PhysicalEntity');
  }, 60000);

  test('should categorize Process correctly', async () => {
    const result = await ontologyBuilder.processText(
      'Heating increases the temperature of the fluid.',
      { domain: 'industrial' }
    );

    expect(result.success).toBe(true);

    // Check that Heating was created
    const heatingClass = await tripleStore.query('kg:Heating', 'rdf:type', 'owl:Class');
    expect(heatingClass.length).toBeGreaterThan(0);

    // Check it's categorized under Process
    const ancestors = await hierarchyTraversal.getAncestors('kg:Heating');
    expect(ancestors).toContain('kg:Process');
  }, 60000);

  test('should categorize State correctly', async () => {
    const result = await ontologyBuilder.processText(
      'The temperature is 150 degrees Fahrenheit.',
      { domain: 'industrial' }
    );

    expect(result.success).toBe(true);

    // Check that Temperature was created
    const tempClass = await tripleStore.query('kg:Temperature', 'rdf:type', 'owl:Class');
    expect(tempClass.length).toBeGreaterThan(0);

    // Check it's categorized under State
    const ancestors = await hierarchyTraversal.getAncestors('kg:Temperature');
    expect(ancestors).toContain('kg:State');
  }, 60000);

  test('should categorize Task correctly', async () => {
    const result = await ontologyBuilder.processText(
      'Maintenance is performed on the equipment regularly.',
      { domain: 'industrial' }
    );

    expect(result.success).toBe(true);

    // Check that Maintenance was created
    const maintenanceClass = await tripleStore.query('kg:Maintenance', 'rdf:type', 'owl:Class');
    expect(maintenanceClass.length).toBeGreaterThan(0);

    // Check it's categorized under Task
    const ancestors = await hierarchyTraversal.getAncestors('kg:Maintenance');
    expect(ancestors).toContain('kg:Task');
  }, 60000);

  test('should support process-state relationships via bootstrap ontology', async () => {
    // Verify bootstrap relationships exist
    const requiresPrecondition = await tripleStore.query('kg:requiresPrecondition', 'rdf:type', 'owl:ObjectProperty');
    expect(requiresPrecondition.length).toBe(1);

    const producesPostcondition = await tripleStore.query('kg:producesPostcondition', 'rdf:type', 'owl:ObjectProperty');
    expect(producesPostcondition.length).toBe(1);

    const transforms = await tripleStore.query('kg:transforms', 'rdf:type', 'owl:ObjectProperty');
    expect(transforms.length).toBe(1);

    // Verify domains and ranges
    const reqPreDomain = await tripleStore.query('kg:requiresPrecondition', 'rdfs:domain', null);
    expect(reqPreDomain[0]?.[2]).toBe('kg:Process');

    const reqPreRange = await tripleStore.query('kg:requiresPrecondition', 'rdfs:range', null);
    expect(reqPreRange[0]?.[2]).toBe('kg:State');
  });

  test('should query entities by category via KnowledgeGraphStore', async () => {
    // Insert some test entities
    const pumpId = await knowledgeGraphStore.insertEntity({
      ontologyType: 'kg:CentrifugalPump',
      label: 'Pump P101',
      attributes: { capacity: 100 },
      provenance: { mentionedIn: ['sentence_1'], confidence: 0.9 }
    });

    const tempId = await knowledgeGraphStore.insertEntity({
      ontologyType: 'kg:Temperature',
      label: 'Temperature T1',
      attributes: { value: 150, unit: 'F' },
      provenance: { mentionedIn: ['sentence_2'], confidence: 0.9 }
    });

    const heatingId = await knowledgeGraphStore.insertEntity({
      ontologyType: 'kg:Heating',
      label: 'Heating Process H1',
      attributes: {},
      provenance: { mentionedIn: ['sentence_3'], confidence: 0.9 }
    });

    const maintenanceId = await knowledgeGraphStore.insertEntity({
      ontologyType: 'kg:Maintenance',
      label: 'Maintenance M1',
      attributes: {},
      provenance: { mentionedIn: ['sentence_4'], confidence: 0.9 }
    });

    // Query by category
    const physicalEntities = await knowledgeGraphStore.findPhysicalEntities();
    expect(physicalEntities.length).toBeGreaterThanOrEqual(1);
    expect(physicalEntities.some(e => e._id.toString() === pumpId.toString())).toBe(true);

    const states = await knowledgeGraphStore.findStates();
    expect(states.length).toBeGreaterThanOrEqual(1);
    expect(states.some(e => e._id.toString() === tempId.toString())).toBe(true);

    const processes = await knowledgeGraphStore.findProcesses();
    expect(processes.length).toBeGreaterThanOrEqual(1);
    expect(processes.some(e => e._id.toString() === heatingId.toString())).toBe(true);

    const tasks = await knowledgeGraphStore.findTasks();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks.some(e => e._id.toString() === maintenanceId.toString())).toBe(true);
  }, 30000);

  test('should support process preconditions and postconditions queries', async () => {
    // Create a process
    const processId = await knowledgeGraphStore.insertEntity({
      ontologyType: 'kg:Heating',
      label: 'Heating Process',
      attributes: {},
      provenance: { mentionedIn: ['sentence_5'], confidence: 0.9 }
    });

    // Create precondition state
    const preconditionId = await knowledgeGraphStore.insertEntity({
      ontologyType: 'kg:Temperature',
      label: 'Initial Temperature 50F',
      attributes: { value: 50, unit: 'F' },
      provenance: { mentionedIn: ['sentence_5'], confidence: 0.9 }
    });

    // Create postcondition state
    const postconditionId = await knowledgeGraphStore.insertEntity({
      ontologyType: 'kg:Temperature',
      label: 'Final Temperature 150F',
      attributes: { value: 150, unit: 'F' },
      provenance: { mentionedIn: ['sentence_5'], confidence: 0.9 }
    });

    // Link process to precondition
    await knowledgeGraphStore.insertRelationship({
      ontologyType: 'kg:requiresPrecondition',
      label: 'requires precondition',
      from: processId,
      to: preconditionId,
      attributes: {},
      provenance: { mentionedIn: ['sentence_5'], confidence: 0.9 }
    });

    // Link process to postcondition
    await knowledgeGraphStore.insertRelationship({
      ontologyType: 'kg:producesPostcondition',
      label: 'produces postcondition',
      from: processId,
      to: postconditionId,
      attributes: {},
      provenance: { mentionedIn: ['sentence_5'], confidence: 0.9 }
    });

    // Query preconditions
    const preconditions = await knowledgeGraphStore.findProcessPreconditions(processId);
    expect(preconditions.length).toBe(1);
    expect(preconditions[0]._id.toString()).toBe(preconditionId.toString());
    expect(preconditions[0].label).toBe('Initial Temperature 50F');

    // Query postconditions
    const postconditions = await knowledgeGraphStore.findProcessPostconditions(processId);
    expect(postconditions.length).toBe(1);
    expect(postconditions[0]._id.toString()).toBe(postconditionId.toString());
    expect(postconditions[0].label).toBe('Final Temperature 150F');
  }, 30000);

  test('should query entities transformed by process', async () => {
    // Create a process
    const processId = await knowledgeGraphStore.insertEntity({
      ontologyType: 'kg:Heating',
      label: 'Heating Process',
      attributes: {},
      provenance: { mentionedIn: ['sentence_6'], confidence: 0.9 }
    });

    // Create physical entity
    const fluidId = await knowledgeGraphStore.insertEntity({
      ontologyType: 'kg:PhysicalEntity',
      label: 'Fluid',
      attributes: {},
      provenance: { mentionedIn: ['sentence_6'], confidence: 0.9 }
    });

    // Link process to entity via transforms
    await knowledgeGraphStore.insertRelationship({
      ontologyType: 'kg:transforms',
      label: 'transforms',
      from: processId,
      to: fluidId,
      attributes: {},
      provenance: { mentionedIn: ['sentence_6'], confidence: 0.9 }
    });

    // Query transformed entities
    const transformed = await knowledgeGraphStore.findProcessTransforms(processId);
    expect(transformed.length).toBe(1);
    expect(transformed[0]._id.toString()).toBe(fluidId.toString());
    expect(transformed[0].label).toBe('Fluid');
  }, 30000);

  test('should infer category for entity ontologyType', async () => {
    const category = await knowledgeGraphStore.inferCategory('kg:CentrifugalPump');
    expect(category).toBe('PhysicalEntity');

    const tempCategory = await knowledgeGraphStore.inferCategory('kg:Temperature');
    expect(tempCategory).toBe('State');

    const heatingCategory = await knowledgeGraphStore.inferCategory('kg:Heating');
    expect(heatingCategory).toBe('Process');

    const maintenanceCategory = await knowledgeGraphStore.inferCategory('kg:Maintenance');
    expect(maintenanceCategory).toBe('Task');
  });

  test('should retrieve comprehensive ontology statistics', async () => {
    const stats = await ontologyBuilder.countClasses();
    expect(stats).toBeGreaterThan(6); // At least the 6 bootstrap classes plus domain classes

    const relationships = await ontologyBuilder.countRelationships();
    expect(relationships).toBeGreaterThan(0);
  });
});
