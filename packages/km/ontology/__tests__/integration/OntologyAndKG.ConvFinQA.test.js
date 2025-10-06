/**
 * Integration Test: Ontology + KG Pipeline with ConvFinQA Dataset
 *
 * Tests the complete pipeline:
 * 1. Build ontology from narrative text (TBox)
 * 2. Create KG instances from structured table data (ABox)
 * 3. Query instances to answer questions
 */

import { OntologyBuilder } from '../../src/OntologyBuilder.js';
import { SimpleTripleStore } from '@legion/rdf';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs';
import path from 'path';

describe('Ontology + KG Pipeline Integration (ConvFinQA)', () => {
  let resourceManager;
  let llmClient;
  let tripleStore;
  let semanticSearch;
  let ontologyBuilder;
  let mroData;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    // Load MRO dataset (use import.meta.url for Jest compatibility)
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const dataPath = path.join(__dirname, '../tmp/MRO_2007_page134_data.json');
    mroData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  }, 60000);

  beforeEach(async () => {
    tripleStore = new SimpleTripleStore();
    semanticSearch = await SemanticSearchProvider.create(resourceManager);

    ontologyBuilder = new OntologyBuilder({
      tripleStore,
      semanticSearch,
      llmClient,
      verification: {
        enabled: false  // Disabled for speed in tests
      }
    });

    // Bootstrap ontology
    await ontologyBuilder.ensureBootstrapLoaded();
  });

  test('should build financial ontology from MRO text', async () => {
    // Extract text from MRO dataset
    const sentences = mroData[0].pre_text;
    const text = sentences.join(' ');

    // Build ontology from text
    const result = await ontologyBuilder.processText(text, { domain: 'finance' });

    expect(result.success).toBe(true);
    expect(result.ontologyStats.classes).toBeGreaterThan(10);
    expect(result.ontologyStats.properties).toBeGreaterThan(0);

    // Verify StockOption class was created
    const stockOptionClass = await tripleStore.query('kg:StockOption', 'rdf:type', 'owl:Class');
    expect(stockOptionClass).toHaveLength(1);

    // Verify it has a parent class
    const parents = await tripleStore.query('kg:StockOption', 'rdfs:subClassOf', null);
    expect(parents.length).toBeGreaterThan(0);

    console.log(`✅ Created ${result.ontologyStats.classes} classes from MRO text`);
  }, 60000);

  test('should create KG instances from Black-Scholes table', async () => {
    // First build ontology
    const sentences = mroData[0].pre_text;
    const text = sentences.join(' ');
    await ontologyBuilder.processText(text, { domain: 'finance' });

    // Add Black-Scholes properties to ontology
    const blackScholesProperties = [
      { uri: 'kg:expectedDividends', label: 'Expected Dividends', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:expectedLife', label: 'Expected Life', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:expectedVolatility', label: 'Expected Volatility', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:riskFreeRate', label: 'Risk Free Rate', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:grantDateFairValue', label: 'Grant Date Fair Value', domain: 'kg:StockOption', range: 'xsd:decimal' }
    ];

    for (const prop of blackScholesProperties) {
      await tripleStore.add(prop.uri, 'rdf:type', 'owl:DatatypeProperty');
      await tripleStore.add(prop.uri, 'rdfs:label', `"${prop.label}"`);
      await tripleStore.add(prop.uri, 'rdfs:domain', prop.domain);
      await tripleStore.add(prop.uri, 'rdfs:range', prop.range);
    }

    // Process table to create instances
    const table = mroData[0].table_ori;
    const metadata = {
      entityClass: 'kg:StockOption',
      entityPrefix: 'MRO_StockOption',
      headerRow: 0,
      instanceColumns: [1, 2, 3],  // 2007, 2006, 2005
      propertyMap: {
        'weighted average exercise price': 'kg:exercisePrice',
        'expected annual dividends': 'kg:expectedDividends',
        'expected life': 'kg:expectedLife',
        'expected volatility': 'kg:expectedVolatility',
        'risk-free interest rate': 'kg:riskFreeRate',
        'weighted average grant date fair value': 'kg:grantDateFairValue'
      }
    };

    const result = await ontologyBuilder.processTableData(table, metadata);

    expect(result.success).toBe(true);
    expect(result.instancesCreated).toBe(18); // 3 years × 6 property assertions

    // Verify instances were created
    const instances = await tripleStore.query(null, 'rdf:type', 'kg:StockOption');
    const mroInstances = instances.filter(([uri]) => uri.includes('MRO_StockOption'));

    expect(mroInstances).toHaveLength(3); // 2007, 2006, 2005

    console.log(`✅ Created ${mroInstances.length} stock option instances`);
  }, 60000);

  test('should query KG instances to answer ConvFinQA questions', async () => {
    // Build complete ontology + KG
    const sentences = mroData[0].pre_text;
    const text = sentences.join(' ');
    await ontologyBuilder.processText(text, { domain: 'finance' });

    // Add properties and create instances
    const blackScholesProperties = [
      { uri: 'kg:expectedDividends', label: 'Expected Dividends', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:expectedLife', label: 'Expected Life', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:expectedVolatility', label: 'Expected Volatility', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:riskFreeRate', label: 'Risk Free Rate', domain: 'kg:StockOption', range: 'xsd:decimal' },
      { uri: 'kg:grantDateFairValue', label: 'Grant Date Fair Value', domain: 'kg:StockOption', range: 'xsd:decimal' }
    ];

    for (const prop of blackScholesProperties) {
      await tripleStore.add(prop.uri, 'rdf:type', 'owl:DatatypeProperty');
      await tripleStore.add(prop.uri, 'rdfs:label', `"${prop.label}"`);
      await tripleStore.add(prop.uri, 'rdfs:domain', prop.domain);
      await tripleStore.add(prop.uri, 'rdfs:range', prop.range);
    }

    const table = mroData[0].table_ori;
    const metadata = {
      entityClass: 'kg:StockOption',
      entityPrefix: 'MRO_StockOption',
      headerRow: 0,
      instanceColumns: [1, 2, 3],
      propertyMap: {
        'weighted average exercise price': 'kg:exercisePrice',
        'expected annual dividends': 'kg:expectedDividends',
        'expected life': 'kg:expectedLife',
        'expected volatility': 'kg:expectedVolatility',
        'risk-free interest rate': 'kg:riskFreeRate',
        'weighted average grant date fair value': 'kg:grantDateFairValue'
      }
    };

    await ontologyBuilder.processTableData(table, metadata);

    // Now query KG to answer ConvFinQA question:
    // "By how much did the weighted average exercise price per share increase from 2005 to 2007?"

    // Get 2007 instance
    const props2007 = await tripleStore.query('kg:MRO_StockOption_2007', 'kg:exercisePrice', null);
    expect(props2007).toHaveLength(1);
    const price2007 = parseFloat(props2007[0][2].replace(/[^\d.]/g, ''));

    // Get 2005 instance
    const props2005 = await tripleStore.query('kg:MRO_StockOption_2005', 'kg:exercisePrice', null);
    expect(props2005).toHaveLength(1);
    const price2005 = parseFloat(props2005[0][2].replace(/[^\d.]/g, ''));

    // Calculate percentage increase
    const increase = ((price2007 - price2005) / price2005) * 100;

    expect(price2007).toBeCloseTo(60.94, 2);
    expect(price2005).toBeCloseTo(25.14, 2);
    expect(increase).toBeCloseTo(142.4, 1); // Expected answer: 142.4%

    console.log(`✅ Answered question via KG: ${increase.toFixed(1)}% increase (expected: 142.4%)`);
  }, 60000);

  test('should demonstrate complete pipeline: text → ontology → table → KG → query', async () => {
    // Step 1: Build ontology from text
    const sentences = mroData[0].pre_text;
    const text = sentences.join(' ');
    const ontologyResult = await ontologyBuilder.processText(text, { domain: 'finance' });

    expect(ontologyResult.success).toBe(true);
    console.log(`Step 1: Built ontology with ${ontologyResult.ontologyStats.classes} classes`);

    // Step 2: Add domain-specific properties
    const properties = [
      'kg:expectedDividends',
      'kg:expectedLife',
      'kg:expectedVolatility',
      'kg:riskFreeRate',
      'kg:grantDateFairValue'
    ];

    for (const propUri of properties) {
      await tripleStore.add(propUri, 'rdf:type', 'owl:DatatypeProperty');
      await tripleStore.add(propUri, 'rdfs:domain', 'kg:StockOption');
      await tripleStore.add(propUri, 'rdfs:range', 'xsd:decimal');
    }

    console.log(`Step 2: Added ${properties.length} Black-Scholes properties`);

    // Step 3: Create KG instances from table
    const table = mroData[0].table_ori;
    const instanceResult = await ontologyBuilder.processTableData(table, {
      entityClass: 'kg:StockOption',
      entityPrefix: 'MRO_StockOption',
      headerRow: 0,
      instanceColumns: [1, 2, 3],
      propertyMap: {
        'weighted average exercise price': 'kg:exercisePrice',
        'expected annual dividends': 'kg:expectedDividends',
        'expected life': 'kg:expectedLife',
        'expected volatility': 'kg:expectedVolatility',
        'risk-free interest rate': 'kg:riskFreeRate',
        'weighted average grant date fair value': 'kg:grantDateFairValue'
      }
    });

    expect(instanceResult.success).toBe(true);
    console.log(`Step 3: Created ${instanceResult.instancesCreated} instances`);

    // Step 4: Query KG to extract structured data
    const instances = await tripleStore.query(null, 'rdf:type', 'kg:StockOption');
    const mroInstances = instances.filter(([uri]) => uri.includes('MRO_StockOption'));

    const kgData = {};
    for (const [uri] of mroInstances) {
      const year = uri.split('_')[2];
      const allProps = await tripleStore.query(uri, null, null);

      kgData[year] = {};
      for (const [, predicate, value] of allProps) {
        if (predicate !== 'rdf:type') {
          const key = predicate.replace('kg:', '');
          const val = value.replace(/["\^]|xsd:\w+/g, '').trim();
          kgData[year][key] = parseFloat(val) || val;
        }
      }
    }

    expect(Object.keys(kgData)).toHaveLength(3);
    expect(kgData['2007'].exercisePrice).toBeCloseTo(60.94, 2);
    expect(kgData['2006'].exercisePrice).toBeCloseTo(37.84, 2);
    expect(kgData['2005'].exercisePrice).toBeCloseTo(25.14, 2);

    console.log(`Step 4: Extracted structured data for ${Object.keys(kgData).length} years`);
    console.log('\n✅ Complete pipeline verified: Text → Ontology → Table → KG → Query');
  }, 60000);
});
