#!/usr/bin/env node
/**
 * Full Knowledge Graph Report Demo
 *
 * This script demonstrates the complete workflow:
 * 1. Build ontology from text
 * 2. Create entity instances
 * 3. Generate markdown report
 */

import { ResourceManager } from '@legion/resource-manager';
import { MongoTripleStore } from '../src/stores/MongoTripleStore.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyBuilder } from '../src/OntologyBuilder.js';
import { HierarchyTraversalService } from '../src/services/HierarchyTraversalService.js';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { KnowledgeGraphStore } from '../../entity-store/src/KnowledgeGraphStore.js';
import { EntityDeduplicator } from '../../entity-store/src/EntityDeduplicator.js';
import { ProvenanceTracker } from '../../entity-store/src/ProvenanceTracker.js';
import { OntologyInstanceExtractor } from '../../entity-store/src/OntologyInstanceExtractor.js';
import { MarkdownReporter } from '../src/reporters/MarkdownReporter.js';
import { writeFile } from 'fs/promises';

async function demo() {
  console.log('\n🚀 FULL KNOWLEDGE GRAPH REPORT DEMO\n');
  console.log('='.repeat(70));

  // Plumbing domain text
  const plumbingText = `
The water heater heats incoming cold water to 140 degrees Fahrenheit.
Before heating begins, the inlet temperature must be between 40 and 60 degrees Fahrenheit.
After the heating process completes, the outlet temperature reaches 140 degrees Fahrenheit.
The pressure regulator reduces street water pressure from 80 PSI to 50 PSI.
Annual maintenance inspections check for leaks and proper water pressure.
The expansion tank prevents pressure buildup in the hot water system.
  `.trim();

  console.log('\n📝 Input Text:\n');
  console.log(plumbingText);
  console.log('\n' + '='.repeat(70));

  // Setup
  console.log('\n⚙️  Step 1: Setting up services...\n');

  const resourceManager = await ResourceManager.getInstance();
  const llmClient = await resourceManager.get('llmClient');

  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  const tripleStore = new MongoTripleStore({
    connectionString: uri,
    database: 'plumbing-demo',
    collection: 'ontology_triples'
  });
  await tripleStore.connect();

  const semanticSearch = await SemanticSearchProvider.create(resourceManager);
  await semanticSearch.connect();

  const hierarchyTraversal = new HierarchyTraversalService(tripleStore);

  const ontologyBuilder = new OntologyBuilder({
    tripleStore,
    semanticSearch,
    llmClient
  });

  const knowledgeGraphStore = new KnowledgeGraphStore({
    connectionString: uri,
    database: 'plumbing-demo',
    collection: 'knowledge_graph',
    hierarchyTraversal
  });
  await knowledgeGraphStore.connect();

  const entityDeduplicator = new EntityDeduplicator(knowledgeGraphStore, semanticSearch);
  const provenanceTracker = new ProvenanceTracker(knowledgeGraphStore);

  const instanceExtractor = new OntologyInstanceExtractor({
    knowledgeGraphStore,
    semanticSearch,
    entityDeduplicator,
    provenanceTracker,
    deduplicationThreshold: 0.85
  });

  console.log('✅ Services initialized');

  // Build ontology
  console.log('\n⚙️  Step 2: Building ontology from text...\n');

  const result = await ontologyBuilder.processText(plumbingText, {
    domain: 'plumbing'
  });

  console.log(`✅ Ontology built:`);
  console.log(`   - Classes: ${result.ontologyStats.classes}`);
  console.log(`   - Relationships: ${result.ontologyStats.relationships}`);
  console.log(`   - Sentences processed: ${result.sentences.length}`);

  // Create entity instances
  console.log('\n⚙️  Step 3: Creating entity instances...\n');

  try {
    await semanticSearch.createCollection('knowledge-entities');
  } catch (e) {}

  // Water heater instance
  await instanceExtractor.extractInstances({
    extractions: {
      entityDetails: [
        {
          type: 'kg:WaterHeater',
          text: 'Water Heater WH-101',
          label: 'Water Heater WH-101',
          confidence: 0.95,
          properties: { capacity: 50, unit: 'gallons', manufacturer: 'Rheem' }
        },
        {
          type: 'kg:PressureRegulator',
          text: 'Pressure Regulator PR-200',
          label: 'Pressure Regulator PR-200',
          confidence: 0.93,
          properties: { maxPressure: 80, minPressure: 50, unit: 'PSI' }
        },
        {
          type: 'kg:ExpansionTank',
          text: 'Expansion Tank ET-50',
          label: 'Expansion Tank ET-50',
          confidence: 0.91,
          properties: { capacity: 5, unit: 'gallons' }
        }
      ],
      relationshipDetails: []
    }
  }, 'sent_1');

  // Temperature states
  await instanceExtractor.extractInstances({
    extractions: {
      entityDetails: [
        {
          type: 'kg:InletTemperature',
          text: 'Inlet 50°F',
          label: 'Inlet Temperature 50°F',
          confidence: 0.92,
          properties: { value: 50, unit: 'F', location: 'inlet' }
        },
        {
          type: 'kg:OutletTemperature',
          text: 'Outlet 140°F',
          label: 'Outlet Temperature 140°F',
          confidence: 0.92,
          properties: { value: 140, unit: 'F', location: 'outlet' }
        }
      ],
      relationshipDetails: []
    }
  }, 'sent_2');

  // Heating process
  await instanceExtractor.extractInstances({
    extractions: {
      entityDetails: [
        {
          type: 'kg:HeatingProcess',
          text: 'Water Heating',
          label: 'Water Heating Process',
          confidence: 0.94,
          properties: { targetTemp: 140, energySource: 'electric' }
        }
      ],
      relationshipDetails: []
    }
  }, 'sent_3');

  // Pressure regulation process
  await instanceExtractor.extractInstances({
    extractions: {
      entityDetails: [
        {
          type: 'kg:PressureRegulation',
          text: 'Pressure Regulation',
          label: 'Pressure Regulation Process',
          confidence: 0.90,
          properties: { fromPressure: 80, toPressure: 50 }
        }
      ],
      relationshipDetails: []
    }
  }, 'sent_4');

  // Maintenance task
  await instanceExtractor.extractInstances({
    extractions: {
      entityDetails: [
        {
          type: 'kg:MaintenanceInspection',
          text: 'Annual Inspection',
          label: 'Annual Maintenance Inspection',
          confidence: 0.88,
          properties: { frequency: 'annual', checklist: ['leaks', 'pressure'] }
        }
      ],
      relationshipDetails: []
    }
  }, 'sent_5');

  console.log('✅ Entity instances created');

  // Link process relationships
  console.log('\n⚙️  Step 4: Creating process relationships...\n');

  const entities = await knowledgeGraphStore.findEntities({});
  const heatingProcess = entities.find(e => e.ontologyType === 'kg:HeatingProcess');
  const inletTemp = entities.find(e => e.ontologyType === 'kg:InletTemperature');
  const outletTemp = entities.find(e => e.ontologyType === 'kg:OutletTemperature');
  const waterHeater = entities.find(e => e.ontologyType === 'kg:WaterHeater');
  const pressureProcess = entities.find(e => e.ontologyType === 'kg:PressureRegulation');
  const pressureRegulator = entities.find(e => e.ontologyType === 'kg:PressureRegulator');

  if (heatingProcess && inletTemp) {
    await knowledgeGraphStore.insertRelationship({
      ontologyType: 'kg:requiresPrecondition',
      label: 'requires precondition',
      from: heatingProcess._id,
      to: inletTemp._id,
      attributes: {},
      provenance: { mentionedIn: ['sent_2'], confidence: 0.9, extractionMethod: 'llm' }
    });
  }

  if (heatingProcess && outletTemp) {
    await knowledgeGraphStore.insertRelationship({
      ontologyType: 'kg:producesPostcondition',
      label: 'produces postcondition',
      from: heatingProcess._id,
      to: outletTemp._id,
      attributes: {},
      provenance: { mentionedIn: ['sent_3'], confidence: 0.9, extractionMethod: 'llm' }
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

  if (pressureProcess && pressureRegulator) {
    await knowledgeGraphStore.insertRelationship({
      ontologyType: 'kg:hasParticipant',
      label: 'has participant',
      from: pressureProcess._id,
      to: pressureRegulator._id,
      attributes: {},
      provenance: { mentionedIn: ['sent_4'], confidence: 0.88, extractionMethod: 'llm' }
    });
  }

  console.log('✅ Process relationships created');

  // Generate report
  console.log('\n⚙️  Step 5: Generating markdown report...\n');

  const reporter = new MarkdownReporter(
    tripleStore,
    knowledgeGraphStore,
    hierarchyTraversal
  );

  const report = await reporter.generateReport({
    title: 'Plumbing System Knowledge Graph',
    domain: 'Plumbing & HVAC',
    sourceText: plumbingText,
    includeBootstrap: true,
    includeInstances: true,
    includeProcessDetails: true
  });

  // Save report
  const outputPath = 'plumbing-knowledge-graph-report.md';
  await writeFile(outputPath, report, 'utf-8');

  console.log(`✅ Report generated and saved to: ${outputPath}`);
  console.log(`\nReport Statistics:`);
  console.log(`  - Length: ${report.length} characters`);
  console.log(`  - Lines: ${report.split('\n').length}`);

  // Show summary
  const summary = await reporter.generateSummary();
  console.log(`\n${summary}`);

  // Show database stats
  console.log('\n📊 Database Statistics:\n');
  const tripleStats = await tripleStore.getStatistics();
  const kgStats = await knowledgeGraphStore.getStatistics();

  console.log('Ontology Schema (RDF):');
  console.log(`  - Total Triples: ${tripleStats.totalTriples}`);
  console.log(`  - Classes: ${tripleStats.classes}`);
  console.log(`  - Datatype Properties: ${tripleStats.datatypeProperties}`);
  console.log(`  - Object Properties: ${tripleStats.objectProperties}`);

  console.log('\nEntity Instances (MongoDB):');
  console.log(`  - Total Items: ${kgStats.total}`);
  console.log(`  - Entities: ${kgStats.totalEntities}`);
  console.log(`  - Relationships: ${kgStats.totalRelationships}`);

  console.log('\nInstance Breakdown:');
  Object.entries(kgStats.byType || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

  console.log('\n' + '='.repeat(70));
  console.log('\n✨ DEMO COMPLETE!\n');
  console.log(`📄 View your report at: ${outputPath}\n`);

  // Cleanup
  await semanticSearch.disconnect();
  await knowledgeGraphStore.disconnect();
  await tripleStore.disconnect();
  await mongoServer.stop();
}

demo().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
