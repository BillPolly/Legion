#!/usr/bin/env node
/**
 * Generate Markdown Report from MongoDB
 *
 * Usage:
 *   node scripts/generate-report.js [options]
 *
 * Options:
 *   --mongo-uri <uri>       MongoDB connection string (default: mongodb://localhost:27017)
 *   --database <name>       Database name (default: knowledge-graph)
 *   --ontology <name>       Ontology collection name (default: ontology_triples)
 *   --entities <name>       Entities collection name (default: knowledge_graph)
 *   --output <file>         Output file path (default: knowledge-graph-report.md)
 *   --title <title>         Report title (default: Knowledge Graph Report)
 *   --domain <domain>       Domain name (default: General)
 *   --include-bootstrap     Include bootstrap ontology details
 *   --no-instances          Exclude entity instances
 *   --no-process-details    Exclude process preconditions/postconditions
 *   --help                  Show this help message
 */

import { MongoTripleStore } from '../src/stores/MongoTripleStore.js';
import { KnowledgeGraphStore } from '../../entity-store/src/KnowledgeGraphStore.js';
import { HierarchyTraversalService } from '../src/services/HierarchyTraversalService.js';
import { MarkdownReporter } from '../src/reporters/MarkdownReporter.js';
import { writeFile } from 'fs/promises';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mongoUri: 'mongodb://localhost:27017',
    database: 'knowledge-graph',
    ontologyCollection: 'ontology_triples',
    entitiesCollection: 'knowledge_graph',
    output: 'knowledge-graph-report.md',
    title: 'Knowledge Graph Report',
    domain: 'General',
    sourceText: null,
    includeBootstrap: false,
    includeInstances: true,
    includeProcessDetails: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(`
Generate Markdown Report from MongoDB

Usage:
  node scripts/generate-report.js [options]

Options:
  --mongo-uri <uri>       MongoDB connection string (default: mongodb://localhost:27017)
  --database <name>       Database name (default: knowledge-graph)
  --ontology <name>       Ontology collection name (default: ontology_triples)
  --entities <name>       Entities collection name (default: knowledge_graph)
  --output <file>         Output file path (default: knowledge-graph-report.md)
  --title <title>         Report title (default: Knowledge Graph Report)
  --domain <domain>       Domain name (default: General)
  --source-text <text>    Source text used to build the graph (optional)
  --include-bootstrap     Include bootstrap ontology details
  --no-instances          Exclude entity instances
  --no-process-details    Exclude process preconditions/postconditions
  --help                  Show this help message

Examples:
  # Generate report with default settings
  node scripts/generate-report.js

  # Custom database and output
  node scripts/generate-report.js --database my-kg --output my-report.md

  # Include bootstrap details
  node scripts/generate-report.js --include-bootstrap --title "Full Report"

  # Schema only (no instances)
  node scripts/generate-report.js --no-instances --output schema-only.md
`);
      process.exit(0);
    } else if (arg === '--mongo-uri' && i + 1 < args.length) {
      options.mongoUri = args[++i];
    } else if (arg === '--database' && i + 1 < args.length) {
      options.database = args[++i];
    } else if (arg === '--ontology' && i + 1 < args.length) {
      options.ontologyCollection = args[++i];
    } else if (arg === '--entities' && i + 1 < args.length) {
      options.entitiesCollection = args[++i];
    } else if (arg === '--output' && i + 1 < args.length) {
      options.output = args[++i];
    } else if (arg === '--title' && i + 1 < args.length) {
      options.title = args[++i];
    } else if (arg === '--domain' && i + 1 < args.length) {
      options.domain = args[++i];
    } else if (arg === '--source-text' && i + 1 < args.length) {
      options.sourceText = args[++i];
    } else if (arg === '--include-bootstrap') {
      options.includeBootstrap = true;
    } else if (arg === '--no-instances') {
      options.includeInstances = false;
    } else if (arg === '--no-process-details') {
      options.includeProcessDetails = false;
    }
  }

  return options;
}

async function generateReport() {
  const options = parseArgs();

  console.log('\n📄 Generating Knowledge Graph Report\n');
  console.log(`Database: ${options.database}`);
  console.log(`Output: ${options.output}\n`);

  // Connect to MongoDB
  console.log('🔌 Connecting to MongoDB...');
  const tripleStore = new MongoTripleStore({
    connectionString: options.mongoUri,
    database: options.database,
    collection: options.ontologyCollection
  });
  await tripleStore.connect();

  const hierarchyTraversal = new HierarchyTraversalService(tripleStore);

  const knowledgeGraphStore = new KnowledgeGraphStore({
    connectionString: options.mongoUri,
    database: options.database,
    collection: options.entitiesCollection,
    hierarchyTraversal
  });
  await knowledgeGraphStore.connect();

  console.log('✅ Connected\n');

  // Generate report
  console.log('📊 Generating report...');
  const reporter = new MarkdownReporter(
    tripleStore,
    knowledgeGraphStore,
    hierarchyTraversal
  );

  const report = await reporter.generateReport({
    title: options.title,
    domain: options.domain,
    sourceText: options.sourceText,
    includeBootstrap: options.includeBootstrap,
    includeInstances: options.includeInstances,
    includeProcessDetails: options.includeProcessDetails
  });

  // Save to file
  await writeFile(options.output, report, 'utf-8');

  console.log(`✅ Report generated: ${options.output}`);
  console.log(`\nReport Statistics:`);
  console.log(`  - Length: ${report.length} characters`);
  console.log(`  - Lines: ${report.split('\n').length}`);

  // Show summary
  const summary = await reporter.generateSummary();
  console.log(`\n${summary}\n`);

  // Cleanup
  await tripleStore.disconnect();
  await knowledgeGraphStore.disconnect();
}

generateReport().catch(error => {
  console.error('\n❌ Error generating report:', error.message);
  console.error(error.stack);
  process.exit(1);
});
