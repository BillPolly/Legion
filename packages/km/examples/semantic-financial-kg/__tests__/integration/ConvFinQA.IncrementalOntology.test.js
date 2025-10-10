/**
 * Integration Test - ConvFinQA with Incremental Ontology Building
 *
 * Tests the complete pipeline using @legion/ontology for dynamic ontology creation:
 * - Parse ConvFinQA document
 * - Process table structure → dynamically create properties (TBox)
 * - Process narrative → extract entities and relationships
 * - Verify ontology grows incrementally from data
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyBuilder } from '@legion/ontology';
import { TripleStore } from '../../src/storage/TripleStore.js';
import { ConvFinQAParser } from '../../src/data/ConvFinQAParser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ConvFinQA Incremental Ontology Building', () => {
  let resourceManager;
  let llmClient;
  let searchProvider;
  let tripleStore;
  let ontologyBuilder;
  let convfinqaParser;

  beforeAll(async () => {
    // Get real components from ResourceManager
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    // Create SemanticSearchProvider
    searchProvider = await SemanticSearchProvider.create(resourceManager);
    await searchProvider.connect();

    // Create triple store
    tripleStore = new TripleStore();

    // Create OntologyBuilder (incremental ontology building!)
    // Disable Z3 verification for POC (Z3 has a bug with empty violations list)
    ontologyBuilder = new OntologyBuilder({
      tripleStore,
      semanticSearch: searchProvider,
      llmClient,
      verification: {
        enabled: false  // Disable for POC
      }
    });

    // Initialize parser
    convfinqaParser = new ConvFinQAParser();

    console.log('\n🔨 Starting with EMPTY ontology - will build incrementally from data');
  }, 120000);

  afterAll(async () => {
    if (searchProvider) {
      try {
        await searchProvider.deleteCollection('ontology-classes');
        await searchProvider.deleteCollection('ontology-relationships');
      } catch (error) {
        // Ignore errors
      }
    }
  });

  test('should build ontology and create instances from ConvFinQA data', async () => {
    console.log('\n=== LOADING CONVFINQA DATASET ===');

    // Load dataset
    const datasetPath = path.join(__dirname, '../../data/convfinqa_dataset.json');
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

    // Use first training example
    const record = dataset.train[0];
    console.log(`Document ID: ${record.id}`);

    console.log('\n=== PARSING DOCUMENT ===');
    const parsedDoc = convfinqaParser.parse(record);

    console.log(`Company: ${parsedDoc.metadata.company}`);
    console.log(`Year: ${parsedDoc.metadata.year}`);
    console.log(`Topic: ${parsedDoc.metadata.topic}`);
    console.log(`Table periods: ${parsedDoc.content.table.periods.join(', ')}`);
    console.log(`Table metrics: ${parsedDoc.content.table.metrics.length}`);

    // Check initial ontology state (should be empty except bootstrap)
    const initialClasses = await ontologyBuilder.countClasses();
    console.log(`\n📊 Initial ontology: ${initialClasses} classes`);

    console.log('\n=== STEP 1: Process Table Structure (Create Properties) ===');

    // Convert table to 2D array format for OntologyBuilder
    const tableArray = [
      // Header row
      ['', ...parsedDoc.content.table.periods],
      // Data rows
      ...parsedDoc.content.table.data
        .filter((dp, i, arr) => arr.findIndex(x => x.metric === dp.metric) === i) // Unique metrics
        .map(dp => {
          const row = [dp.metric];
          // Fill in values for each period
          parsedDoc.content.table.periods.forEach(period => {
            const dataPoint = parsedDoc.content.table.data.find(
              d => d.metric === dp.metric && d.period === period
            );
            row.push(dataPoint ? dataPoint.value.toString() : '');
          });
          return row;
        })
    ];

    console.log('Table structure:');
    console.log(`  Rows: ${tableArray.length}`);
    console.log(`  Metrics: ${tableArray.slice(1).map(row => row[0]).join(', ')}`);

    // Process table structure to create properties
    const tableResult = await ontologyBuilder.processTable(tableArray, {
      domain: 'finance',
      context: [
        parsedDoc.metadata.topic,
        `${parsedDoc.metadata.company} financial report`,
        parsedDoc.content.narrative.substring(0, 500)
      ],
      conversationId: parsedDoc.id
    });

    console.log('\n📊 Table processing result:');
    console.log(`  Success: ${tableResult.success}`);
    console.log(`  Entity class: ${tableResult.entityClass}`);
    console.log(`  Properties added: ${tableResult.propertiesAdded}`);

    expect(tableResult.success).toBe(true);
    expect(tableResult.propertiesAdded).toBeGreaterThan(0);

    console.log('\n=== STEP 2: Process Narrative Text (Create Classes) ===');

    // Process a sample of narrative to create entity classes
    const narrativeSample = parsedDoc.content.narrative.substring(0, 1000);

    const textResult = await ontologyBuilder.processText(narrativeSample, {
      domain: 'finance'
    });

    console.log('\n📊 Text processing result:');
    console.log(`  Success: ${textResult.success}`);
    console.log(`  Sentences processed: ${textResult.sentences.length}`);
    console.log(`  Total classes: ${textResult.ontologyStats.classes}`);
    console.log(`  Total properties: ${textResult.ontologyStats.properties}`);

    expect(textResult.success).toBe(true);
    expect(textResult.ontologyStats.classes).toBeGreaterThan(initialClasses);

    console.log('\n=== STEP 3: Verify Ontology Growth ===');

    // Query for financial metric properties
    const allProperties = await tripleStore.query(null, 'rdf:type', 'owl:DatatypeProperty');
    console.log(`\n📊 Total properties in ontology: ${allProperties.length}`);

    // Show some examples
    const propertyExamples = allProperties.slice(0, 5);
    console.log('\nExample properties created:');
    for (const [propUri] of propertyExamples) {
      const labels = await tripleStore.query(propUri, 'rdfs:label', null);
      const domains = await tripleStore.query(propUri, 'rdfs:domain', null);

      const label = labels[0]?.[2]?.replace(/"/g, '') || propUri;
      const domain = domains[0]?.[2] || 'unknown';

      console.log(`  ${propUri} (${label}) → domain: ${domain}`);
    }

    expect(allProperties.length).toBeGreaterThan(0);

    // Query for classes
    const allClasses = await tripleStore.query(null, 'rdf:type', 'owl:Class');
    console.log(`\n📊 Total classes in ontology: ${allClasses.length}`);

    // Show domain classes (non-bootstrap)
    const domainClasses = allClasses
      .map(([uri]) => uri)
      .filter(uri => uri.startsWith('kg:'))
      .filter(uri => !uri.match(/Continuant|Occurrent|PhysicalEntity|State|Process|Task$/));

    console.log('\nDomain classes created:');
    for (const classUri of domainClasses.slice(0, 5)) {
      const labels = await tripleStore.query(classUri, 'rdfs:label', null);
      const parents = await tripleStore.query(classUri, 'rdfs:subClassOf', null);

      const label = labels[0]?.[2]?.replace(/"/g, '') || classUri;
      const parent = parents[0]?.[2] || 'owl:Thing';

      console.log(`  ${classUri} (${label}) → ${parent}`);
    }

    expect(domainClasses.length).toBeGreaterThan(0);

    console.log('\n=== STEP 4: Create Entity Instances from Table Data ===');

    // Find the entity class for financial observations
    const entityClass = domainClasses.find(c => c.includes('FinancialReport')) || domainClasses[0];
    console.log(`Using entity class: ${entityClass}`);

    // Create property map from all properties
    const propertyMap = {};
    for (const metric of parsedDoc.content.table.metrics) {
      for (const [propUri] of allProperties) {
        const labels = await tripleStore.query(propUri, 'rdfs:label', null);
        const label = labels[0]?.[2]?.replace(/"/g, '').toLowerCase() || '';
        if (label.includes(metric.toLowerCase()) || metric.toLowerCase().includes(label)) {
          propertyMap[metric.toLowerCase()] = propUri;
          break;
        }
      }
    }

    console.log('Property map:', Object.keys(propertyMap).length, 'mappings');

    // Reuse tableArray from Step 1 - Process table data
    const tableDataResult = await ontologyBuilder.processTableData(tableArray, {
      entityClass,
      entityPrefix: parsedDoc.metadata.company,
      headerRow: 0,
      instanceColumns: [1, 2, 3],
      propertyMap
    });

    console.log('\n📊 Instance creation result:');
    console.log(`  Success: ${tableDataResult.success}`);
    console.log(`  Instances: ${tableDataResult.instancesCreated}`);
    console.log(`  Property assertions: ${tableDataResult.propertiesAsserted}`);

    expect(tableDataResult.success).toBe(true);
    expect(tableDataResult.instancesCreated).toBeGreaterThan(0);

    // Show example instance
    const instances = await tripleStore.query(null, 'rdf:type', entityClass);
    if (instances.length > 0) {
      const [instanceUri] = instances[0];
      const instanceTriples = await tripleStore.query(instanceUri, null, null);
      console.log(`\nExample instance: ${instanceUri}`);
      instanceTriples.slice(0, 5).forEach(([s, p, o]) => {
        console.log(`  ${p}: ${o}`);
      });
    }

    console.log('\n=== INCREMENTAL ONTOLOGY BUILDING TEST COMPLETE ===');
    console.log('✓ Ontology grew from bootstrap to domain-specific classes/properties');
    console.log('✓ Table metrics became owl:DatatypeProperty');
    console.log('✓ Narrative concepts became owl:Class');
    console.log(`✓ Final ontology: ${allClasses.length} classes, ${allProperties.length} properties`);
    console.log(`✓ Created ${instances.length} entity instances with actual data values`);

    // Verify ontology grew significantly
    expect(allClasses.length).toBeGreaterThan(initialClasses);
    expect(allProperties.length).toBeGreaterThan(0);
    expect(instances.length).toBeGreaterThan(0);
  }, 300000);
});
