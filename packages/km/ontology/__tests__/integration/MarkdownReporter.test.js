/**
 * MarkdownReporter Integration Test
 *
 * Demonstrates generating formatted markdown reports from MongoDB data.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { MongoTripleStore } from '../../src/stores/MongoTripleStore.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyBuilder } from '../../src/OntologyBuilder.js';
import { HierarchyTraversalService } from '../../src/services/HierarchyTraversalService.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { KnowledgeGraphStore } from '../../../entity-store/src/KnowledgeGraphStore.js';
import { EntityDeduplicator } from '../../../entity-store/src/EntityDeduplicator.js';
import { ProvenanceTracker } from '../../../entity-store/src/ProvenanceTracker.js';
import { OntologyInstanceExtractor } from '../../../entity-store/src/OntologyInstanceExtractor.js';
import { MarkdownReporter } from '../../src/reporters/MarkdownReporter.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';

describe('MarkdownReporter Integration', () => {
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
  let markdownReporter;

  const plumbingText = `The water heater heats incoming cold water to 140 degrees Fahrenheit.`;

  beforeAll(async () => {
    console.log('\n📄 MARKDOWN REPORTER DEMONSTRATION\n');

    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    // Setup MongoDB-backed triple store
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    tripleStore = new MongoTripleStore({
      connectionString: uri,
      database: 'report-demo',
      collection: 'ontology_triples'
    });
    await tripleStore.connect();

    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();

    hierarchyTraversal = new HierarchyTraversalService(tripleStore);

    ontologyBuilder = new OntologyBuilder({
      tripleStore,
      semanticSearch,
      llmClient
    });

    knowledgeGraphStore = new KnowledgeGraphStore({
      connectionString: uri,
      database: 'report-demo',
      collection: 'knowledge_graph',
      hierarchyTraversal
    });
    await knowledgeGraphStore.connect();

    entityDeduplicator = new EntityDeduplicator(knowledgeGraphStore, semanticSearch);
    provenanceTracker = new ProvenanceTracker(knowledgeGraphStore);

    instanceExtractor = new OntologyInstanceExtractor({
      knowledgeGraphStore,
      semanticSearch,
      entityDeduplicator,
      provenanceTracker,
      deduplicationThreshold: 0.85
    });

    markdownReporter = new MarkdownReporter(
      tripleStore,
      knowledgeGraphStore,
      hierarchyTraversal
    );

    // Build ontology
    console.log('Building ontology...');
    await ontologyBuilder.processText(plumbingText, { domain: 'plumbing' });

    // Create entity instances
    console.log('Creating entity instances...');
    try {
      await semanticSearch.createCollection('knowledge-entities');
    } catch (e) {}

    await instanceExtractor.extractInstances({
      extractions: {
        entityDetails: [
          {
            type: 'kg:WaterHeater',
            text: 'Water Heater WH-101',
            label: 'Water Heater WH-101',
            confidence: 0.95,
            properties: { capacity: 50, unit: 'gallons' }
          },
          {
            type: 'kg:InletTemperature',
            text: 'Inlet 50°F',
            label: 'Inlet Temperature 50°F',
            confidence: 0.92,
            properties: { value: 50, unit: 'F' }
          },
          {
            type: 'kg:OutletTemperature',
            text: 'Outlet 140°F',
            label: 'Outlet Temperature 140°F',
            confidence: 0.92,
            properties: { value: 140, unit: 'F' }
          },
          {
            type: 'kg:HeatingProcess',
            text: 'Water Heating',
            label: 'Water Heating Process',
            confidence: 0.94,
            properties: { targetTemp: 140 }
          }
        ],
        relationshipDetails: []
      }
    }, 'sent_1');

    // Link process to states
    const entities = await knowledgeGraphStore.findEntities({});
    const heatingProcess = entities.find(e => e.ontologyType === 'kg:HeatingProcess');
    const inletTemp = entities.find(e => e.ontologyType === 'kg:InletTemperature');
    const outletTemp = entities.find(e => e.ontologyType === 'kg:OutletTemperature');
    const waterHeater = entities.find(e => e.ontologyType === 'kg:WaterHeater');

    if (heatingProcess && inletTemp) {
      await knowledgeGraphStore.insertRelationship({
        ontologyType: 'kg:requiresPrecondition',
        label: 'requires precondition',
        from: heatingProcess._id,
        to: inletTemp._id,
        attributes: {},
        provenance: { mentionedIn: ['sent_1'], confidence: 0.9, extractionMethod: 'llm' }
      });
    }

    if (heatingProcess && outletTemp) {
      await knowledgeGraphStore.insertRelationship({
        ontologyType: 'kg:producesPostcondition',
        label: 'produces postcondition',
        from: heatingProcess._id,
        to: outletTemp._id,
        attributes: {},
        provenance: { mentionedIn: ['sent_1'], confidence: 0.9, extractionMethod: 'llm' }
      });
    }

    if (heatingProcess && waterHeater) {
      await knowledgeGraphStore.insertRelationship({
        ontologyType: 'kg:transforms',
        label: 'transforms',
        from: heatingProcess._id,
        to: waterHeater._id,
        attributes: {},
        provenance: { mentionedIn: ['sent_1'], confidence: 0.9, extractionMethod: 'llm' }
      });
    }

    console.log('✅ Setup complete\n');
  }, 120000);

  afterAll(async () => {
    if (semanticSearch) await semanticSearch.disconnect();
    if (knowledgeGraphStore) await knowledgeGraphStore.disconnect();
    if (tripleStore) await tripleStore.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  test('should generate comprehensive markdown report', async () => {
    console.log('📄 Generating comprehensive report...\n');

    const report = await markdownReporter.generateReport({
      title: 'Plumbing Domain Knowledge Graph',
      domain: 'Plumbing',
      includeBootstrap: true,
      includeInstances: true,
      includeProcessDetails: true
    });

    expect(report).toBeTruthy();
    expect(report).toContain('# Plumbing Domain Knowledge Graph');
    expect(report).toContain('## 📊 Overview');
    expect(report).toContain('## 🏗️  Upper-Level Ontology');
    expect(report).toContain('## 🎯 Domain Ontology');
    expect(report).toContain('## 🔗 Properties & Relationships');
    expect(report).toContain('## 💾 Entity Instances');

    // Check for specific content
    expect(report).toContain('kg:PhysicalEntity');
    expect(report).toContain('kg:Process');
    expect(report).toContain('WaterHeater');
    expect(report).toContain('Water Heater WH-101');

    // Check for relationships (process details may be in relationships section)
    expect(report).toContain('requires precondition');
    expect(report).toContain('produces postcondition');
    expect(report).toContain('transforms');

    // Save report to file
    const outputPath = join(process.cwd(), '__tests__/tmp/plumbing-report.md');
    await writeFile(outputPath, report, 'utf-8');

    console.log(`✅ Report generated and saved to: ${outputPath}`);
    console.log(`\nReport length: ${report.length} characters`);
    console.log(`Report lines: ${report.split('\n').length}`);
  }, 30000);

  test('should generate summary statistics', async () => {
    const summary = await markdownReporter.generateSummary();

    expect(summary).toBeTruthy();
    expect(summary).toContain('## Summary');
    expect(summary).toContain('Ontology Classes:');
    expect(summary).toContain('Entity Instances:');
    expect(summary).toContain('Total RDF Triples:');

    console.log('\n📊 Summary:\n');
    console.log(summary);
  }, 10000);

  test('should handle minimal report without instances', async () => {
    const report = await markdownReporter.generateReport({
      title: 'Ontology Schema Only',
      domain: 'Plumbing',
      includeBootstrap: false,
      includeInstances: false,
      includeProcessDetails: false
    });

    expect(report).toBeTruthy();
    expect(report).toContain('# Ontology Schema Only');
    expect(report).toContain('## 📊 Overview');
    expect(report).toContain('## 🎯 Domain Ontology');
    expect(report).not.toContain('Preconditions:');

    console.log('\n📄 Minimal report generated (schema only)');
  }, 10000);

  test('should generate report with detailed bootstrap information', async () => {
    const report = await markdownReporter.generateReport({
      title: 'Full Knowledge Graph with Bootstrap',
      domain: 'Plumbing',
      includeBootstrap: true,
      includeInstances: true,
      includeProcessDetails: true
    });

    expect(report).toContain('### Bootstrap Categories');
    expect(report).toContain('kg:Continuant');
    expect(report).toContain('kg:Occurrent');
    expect(report).toContain('### Process-State Relationships');
    expect(report).toContain('requiresPrecondition');
    expect(report).toContain('producesPostcondition');

    console.log('\n📄 Full report with bootstrap details generated');
  }, 10000);
});
