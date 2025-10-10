import { jest } from '@jest/globals';
import { OntologyBuilder } from '@legion/ontology';
import { TripleStore } from '../../src/storage/TripleStore.js';
import { ResourceManager } from '@legion/resource-manager';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { InstanceBuilder } from '../../src/kg/InstanceBuilder.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { ConvFinQAParser } from '../../src/data/ConvFinQAParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ConvFinQA Instance Creation (ABox)', () => {
  let resourceManager;
  let tripleStore;
  let ontologyBuilder;
  let instanceBuilder;
  let llmClient;
  let searchProvider;
  let parsedDoc;
  let semanticModel;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    // Load ConvFinQA example 1
    const datasetPath = path.join(__dirname, '../../data/convfinqa_dataset.json');
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    const record = dataset.train[0];

    // Parse the document
    const parser = new ConvFinQAParser();
    parsedDoc = parser.parse(record);

    console.log('\n📊 CONVFINQA EXAMPLE 1:');
    console.log('Company:', parsedDoc.metadata.company);
    console.log('Year:', parsedDoc.metadata.year);
    console.log('Topic:', parsedDoc.metadata.topic);
    console.log('Table periods:', parsedDoc.content.table.periods);
    console.log('Table metrics:', parsedDoc.content.table.metrics);
  }, 60000);

  beforeEach(async () => {
    // Create fresh triple store and search provider for each test
    tripleStore = new TripleStore();

    // Create search provider
    searchProvider = await SemanticSearchProvider.create(resourceManager);
    await searchProvider.connect();

    // Create ontology builder
    ontologyBuilder = new OntologyBuilder({
      tripleStore,
      semanticSearch: searchProvider,
      llmClient,
      verification: { enabled: false }
    });

    // Create instance builder
    instanceBuilder = new InstanceBuilder({
      tripleStore,
      ontologyBuilder,
      llmClient,
      semanticSearch: searchProvider
    });
  }, 30000);

  afterEach(async () => {
    if (searchProvider) {
      try {
        await searchProvider.deleteCollection('ontology-classes');
        await searchProvider.deleteCollection('ontology-relationships');
      } catch (error) {
        // Ignore errors
      }
    }
  });


  test('should create complete knowledge graph from table data (Phase 7)', async () => {
    console.log('\n🔍 PHASE 1: BUILD ONTOLOGY (TBox)');

    const document = {
      type: 'financial_report',
      metadata: parsedDoc.metadata,
      tableStructure: {
        rows: parsedDoc.content.table.data.length,
        columns: parsedDoc.content.table.periods.length + 1,
        metrics: parsedDoc.content.table.metrics,
        periods: parsedDoc.content.table.periods
      },
      hasTable: parsedDoc.metadata.hasTable,
      hasNarrative: parsedDoc.content.narrative.length > 0,
      narrativeSample: parsedDoc.content.narrative.substring(0, 500)
    };

    semanticModel = await ontologyBuilder.designSemanticModel(document, {
      domain: 'finance'
    });

    await ontologyBuilder.buildFromSemanticModel(semanticModel);

    console.log('\n🔍 PHASE 2: CREATE KNOWLEDGE GRAPH (ABox) - Phase 7 with Provenance');

    // Reconstruct ConvFinQA table format from parsed data
    const convfinqaTable = {};
    parsedDoc.content.table.data.forEach(item => {
      if (!convfinqaTable[item.period]) {
        convfinqaTable[item.period] = {};
      }
      convfinqaTable[item.period][item.metric] = item.value;
    });

    // Create KG using Phase 7 API with full metadata
    const data = {
      table: convfinqaTable,
      metadata: {
        sourceDocument: `${parsedDoc.metadata.company}/${parsedDoc.metadata.year}/page_${parsedDoc.metadata.page}.pdf`,
        documentId: parsedDoc.id,
        scale: 'thousands', // ConvFinQA financial data is typically in thousands
        currency: 'USD',
        company: parsedDoc.metadata.company,
        organizationUri: `data:${parsedDoc.metadata.company}`
      }
    };

    const results = await instanceBuilder.createInstances(data);

    console.log('\n📊 PHASE 7 KNOWLEDGE GRAPH RESULTS:');
    console.log('Table entities:', results.table.entities.length);
    console.log('Table relationships:', results.table.relationships.length);

    // Phase 7 verification: Check for structured entities
    const tables = results.table.entities.filter(e => e.type === 'kg:Table');
    const cells = results.table.entities.filter(e => e.type === 'kg:TableCell');
    const financialValues = results.table.entities.filter(e => e.type === 'kg:FinancialValue');
    const observations = results.table.entities.filter(e => e.type === 'kg:Observation');
    const metrics = results.table.entities.filter(e => e.type === 'kg:FinancialMetric');
    const periods = results.table.entities.filter(e => e.type === 'kg:TimePeriod');

    console.log('\n📊 ENTITY BREAKDOWN:');
    console.log('  Tables:', tables.length);
    console.log('  Cells:', cells.length);
    console.log('  FinancialValues:', financialValues.length);
    console.log('  Observations:', observations.length);
    console.log('  Metrics:', metrics.length);
    console.log('  Periods:', periods.length);

    // Verify Phase 7 structure
    expect(tables.length).toBe(1); // One table entity
    expect(cells.length).toBeGreaterThan(0); // Cell entities for provenance
    expect(financialValues.length).toBeGreaterThan(0); // Structured FinancialValue entities
    expect(observations.length).toBeGreaterThan(0); // Observations

    // Calculate expected observations (non-null values)
    const expectedObservations = parsedDoc.content.table.data.filter(
      obs => obs.value !== undefined && obs.value !== null && obs.value !== ''
    ).length;

    expect(observations.length).toBe(expectedObservations);

    // Note: TableProvenanceBuilder creates period/metric entities for each observation
    // Deduplication happens when storing to triple store
    // So we expect: periods = observations (one per observation), metrics = observations
    expect(periods.length).toBeGreaterThanOrEqual(parsedDoc.content.table.periods.length);
    expect(metrics.length).toBeGreaterThanOrEqual(parsedDoc.content.table.metrics.length);

    console.log('\n✅ PHASE 7: 100% TABLE COVERAGE ACHIEVED');
    console.log(`All ${parsedDoc.content.table.metrics.length} metrics × ${parsedDoc.content.table.periods.length} periods = ${expectedObservations} observations`);

    // Verify Phase 7: Check FinancialValue has scale applied
    if (financialValues.length > 0) {
      const firstValue = financialValues[0];
      console.log('\n📊 SAMPLE FinancialValue (Phase 7):');
      console.log('  URI:', firstValue.uri);
      console.log('  Properties:', firstValue.properties);

      expect(firstValue.properties['kg:actualAmount']).toBeDefined();
      expect(firstValue.properties['kg:scale']).toBe('thousands');
      expect(firstValue.properties['kg:currency']).toBe('USD');
    }

    // Verify provenance chain exists
    const provenanceRels = results.table.relationships.filter(r =>
      r.predicate === 'kg:sourceTable' || r.predicate === 'kg:sourceCell'
    );
    expect(provenanceRels.length).toBeGreaterThan(0);
    console.log(`✓ Provenance relationships: ${provenanceRels.length}`);

    // Sample observation
    if (observations.length > 0) {
      console.log('\n📊 SAMPLE OBSERVATION:');
      const firstObs = observations[0];
      console.log(`  URI: ${firstObs.uri}`);
      console.log(`  Label: ${firstObs.label}`);
      console.log(`  Type: ${firstObs.type}`);
    }

    console.log('\n✅ PHASE 7 KNOWLEDGE GRAPH COMPLETE WITH FULL PROVENANCE');
  }, 180000);
});
