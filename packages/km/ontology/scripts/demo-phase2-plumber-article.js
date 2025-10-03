#!/usr/bin/env node
/**
 * Phase 2: Adding Real Plumber Article to Existing Ontology
 *
 * This script:
 * 1. Loads the existing plumbing ontology
 * 2. Adds new content from real plumber article
 * 3. Generates updated report with both source texts
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
  console.log('\n🚀 PHASE 2: ADDING REAL PLUMBER ARTICLE\n');
  console.log('='.repeat(70));

  // Original plumbing system text from Phase 1
  const phase1Text = `
The water heater heats incoming cold water to 140 degrees Fahrenheit.
Before heating begins, the inlet temperature must be between 40 and 60 degrees Fahrenheit.
After the heating process completes, the outlet temperature reaches 140 degrees Fahrenheit.
The pressure regulator reduces street water pressure from 80 PSI to 50 PSI.
Annual maintenance inspections check for leaks and proper water pressure.
The expansion tank prevents pressure buildup in the hot water system.
  `.trim();

  // New article content from real plumber work
  const articleUrl = 'https://breakingac.com/news/2024/oct/29/from-repairs-to-replacements-how-plumbing-contractors-make-it-happen/';

  const phase2Text = `
Source: ${articleUrl}

Plumbers perform visual inspections to assess pipe damage.
For minor leaks, plumbers apply epoxy to fix the problem.
Pipe clamps repair small leaks quickly.
For extensive damage, plumbers replace damaged pipe sections.
The repair process requires shutting off the water supply first.
Plumbers drain the pipes before making repairs.
New pipe sections are measured and cut to the correct length.
Pipes are connected using soldering fittings.
After installation, plumbers test for leaks.

A plumber installs toilets by replacing the wax ring.
Sink installation requires connecting water supply lines.
The plumber seals the drain assembly during sink installation.

Plumbers use plungers for drain cleaning.
Hand augers clear stubborn drain blockages.
Camera inspections diagnose drain problems.

Water heater diagnostics check the thermostat.
Plumbers flush water heater tanks to remove sediment.
Tank flushing is part of regular maintenance.
  `.trim();

  console.log('\n📝 Phase 1 Text (Original):');
  console.log(phase1Text);
  console.log('\n' + '='.repeat(70));

  console.log('\n📝 Phase 2 Text (Real Plumber Article):');
  console.log(phase2Text.substring(0, 500) + '...');
  console.log('\n' + '='.repeat(70));

  // Setup
  console.log('\n⚙️  Step 1: Setting up services...\n');

  const resourceManager = await ResourceManager.getInstance();
  const llmClient = await resourceManager.get('llmClient');

  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  const tripleStore = new MongoTripleStore({
    connectionString: uri,
    database: 'plumbing-phase2',
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
    database: 'plumbing-phase2',
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

  // Build ontology from BOTH texts
  console.log('\n⚙️  Step 2: Building ontology from Phase 1 text...\n');

  const result1 = await ontologyBuilder.processText(phase1Text, {
    domain: 'plumbing'
  });

  console.log(`✅ Phase 1 ontology built:`);
  console.log(`   - Classes: ${result1.ontologyStats.classes}`);
  console.log(`   - Relationships: ${result1.ontologyStats.relationships}`);
  console.log(`   - Sentences processed: ${result1.sentences.length}`);

  console.log('\n⚙️  Step 3: Extending ontology with Phase 2 article...\n');

  const result2 = await ontologyBuilder.processText(phase2Text, {
    domain: 'plumbing'
  });

  console.log(`✅ Phase 2 ontology extended:`);
  console.log(`   - Classes: ${result2.ontologyStats.classes}`);
  console.log(`   - Relationships: ${result2.ontologyStats.relationships}`);
  console.log(`   - Sentences processed: ${result2.sentences.length}`);

  // Create entity instances for Phase 1
  console.log('\n⚙️  Step 4: Creating Phase 1 entity instances...\n');

  try {
    await semanticSearch.createCollection('knowledge-entities');
  } catch (e) {}

  // Phase 1 instances (from original demo)
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
  }, 'phase1_sent_1');

  console.log('✅ Phase 1 entity instances created');

  // Create entity instances for Phase 2 (plumber tasks)
  console.log('\n⚙️  Step 5: Creating Phase 2 entity instances (plumber tasks)...\n');

  // Tasks for pipe repair
  await instanceExtractor.extractInstances({
    extractions: {
      entityDetails: [
        {
          type: 'kg:Task',
          text: 'Visual Inspection',
          label: 'Visual Inspection Task',
          confidence: 0.92,
          properties: {
            taskType: 'inspection',
            purpose: 'assess pipe damage',
            tools: ['visual', 'specialized tools']
          }
        },
        {
          type: 'kg:Task',
          text: 'Leak Repair with Epoxy',
          label: 'Minor Leak Repair Task',
          confidence: 0.90,
          properties: {
            taskType: 'repair',
            method: 'epoxy application',
            severity: 'minor'
          }
        },
        {
          type: 'kg:Task',
          text: 'Pipe Section Replacement',
          label: 'Pipe Replacement Task',
          confidence: 0.93,
          properties: {
            taskType: 'replacement',
            severity: 'extensive damage',
            steps: ['shut off water', 'drain pipes', 'cut pipe', 'install new section', 'test']
          }
        }
      ],
      relationshipDetails: []
    }
  }, 'phase2_sent_pipe_repair');

  // Installation tasks
  await instanceExtractor.extractInstances({
    extractions: {
      entityDetails: [
        {
          type: 'kg:Task',
          text: 'Toilet Installation',
          label: 'Toilet Installation Task',
          confidence: 0.91,
          properties: {
            taskType: 'installation',
            fixture: 'toilet',
            components: ['wax ring', 'flange']
          }
        },
        {
          type: 'kg:Task',
          text: 'Sink Installation',
          label: 'Sink Installation Task',
          confidence: 0.91,
          properties: {
            taskType: 'installation',
            fixture: 'sink',
            steps: ['connect supply lines', 'seal drain assembly']
          }
        },
        {
          type: 'kg:Task',
          text: 'Shower Installation',
          label: 'Shower Installation Task',
          confidence: 0.90,
          properties: {
            taskType: 'installation',
            fixture: 'shower',
            requirements: ['waterproofing', 'framing']
          }
        }
      ],
      relationshipDetails: []
    }
  }, 'phase2_sent_installations');

  // Drain cleaning tasks
  await instanceExtractor.extractInstances({
    extractions: {
      entityDetails: [
        {
          type: 'kg:Task',
          text: 'Drain Cleaning',
          label: 'Drain Cleaning Task',
          confidence: 0.93,
          properties: {
            taskType: 'maintenance',
            tools: ['plunger', 'hand auger', 'motorized snake', 'hydro-jetting'],
            diagnostic: 'camera inspection'
          }
        },
        {
          type: 'kg:Task',
          text: 'Camera Inspection',
          label: 'Drain Camera Inspection',
          confidence: 0.92,
          properties: {
            taskType: 'diagnostic',
            timing: 'before and after cleaning',
            purpose: 'diagnose blockages'
          }
        }
      ],
      relationshipDetails: []
    }
  }, 'phase2_sent_drain_cleaning');

  // Water heater tasks
  await instanceExtractor.extractInstances({
    extractions: {
      entityDetails: [
        {
          type: 'kg:MaintenanceInspection',
          text: 'Water Heater Diagnostics',
          label: 'Water Heater Diagnostic Task',
          confidence: 0.94,
          properties: {
            taskType: 'diagnostics',
            checks: ['thermostat', 'heating element', 'gas valve']
          }
        },
        {
          type: 'kg:MaintenanceInspection',
          text: 'Tank Flushing',
          label: 'Water Heater Maintenance Task',
          confidence: 0.93,
          properties: {
            taskType: 'maintenance',
            purpose: 'remove sediment buildup',
            frequency: 'periodic'
          }
        },
        {
          type: 'kg:Task',
          text: 'Water Heater Installation',
          label: 'Water Heater Installation Task',
          confidence: 0.95,
          properties: {
            taskType: 'installation',
            steps: ['disconnect old unit', 'connect water supply', 'connect power', 'install safety features'],
            safetyFeatures: ['pressure relief valve']
          }
        }
      ],
      relationshipDetails: []
    }
  }, 'phase2_sent_water_heater');

  // Leak detection tasks
  await instanceExtractor.extractInstances({
    extractions: {
      entityDetails: [
        {
          type: 'kg:Task',
          text: 'Leak Detection',
          label: 'Leak Detection Task',
          confidence: 0.94,
          properties: {
            taskType: 'diagnostic',
            tools: ['acoustic detector', 'thermal camera', 'moisture meter', 'tracer gas'],
            approach: 'minimize structural damage'
          }
        }
      ],
      relationshipDetails: []
    }
  }, 'phase2_sent_leak_detection');

  console.log('✅ Phase 2 entity instances created');

  // Generate comprehensive report
  console.log('\n⚙️  Step 6: Generating comprehensive markdown report...\n');

  const reporter = new MarkdownReporter(
    tripleStore,
    knowledgeGraphStore,
    hierarchyTraversal
  );

  // Combine both source texts with attribution
  const combinedSourceText = `## Phase 1: Plumbing System Basics

${phase1Text}

## Phase 2: Real-World Plumber Tasks

**Source:** ${articleUrl}

${phase2Text}`;

  const report = await reporter.generateReport({
    title: 'Plumbing Knowledge Graph - Phase 2 Extended',
    domain: 'Plumbing & HVAC',
    sourceText: combinedSourceText,
    includeBootstrap: true,
    includeInstances: true,
    includeProcessDetails: true
  });

  // Save report
  const outputPath = 'plumbing-knowledge-graph-phase2-report.md';
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
    .slice(0, 15)
    .forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

  console.log('\n' + '='.repeat(70));
  console.log('\n✨ PHASE 2 COMPLETE!\\n');
  console.log(`📄 View your extended report at: ${outputPath}`);
  console.log(`🔗 Article source: ${articleUrl}\n`);

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
