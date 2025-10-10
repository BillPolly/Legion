import { jest } from '@jest/globals';
import { TableInstanceCreator } from '../../src/kg/TableInstanceCreator.js';
import { ResourceManager } from '@legion/resource-manager';
import { TripleStore } from '../../src/storage/TripleStore.js';
import { SemanticSearchProvider } from '@legion/semantic-search';
import { OntologyBuilder } from '@legion/ontology';
import { OntologyRetriever } from '../../src/kg/OntologyRetriever.js';

/**
 * Phase 4: Table Instance Creation Tests
 *
 * Tests that TableInstanceCreator can convert structured table data
 * to observation-pattern knowledge graphs.
 */

describe('TableInstanceCreator (Phase 4)', () => {
  let resourceManager;
  let llmClient;
  let tripleStore;
  let semanticSearch;
  let ontologyBuilder;
  let ontologyRetriever;
  let tableInstanceCreator;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');

    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    // Set up ontology infrastructure
    semanticSearch = await SemanticSearchProvider.create(resourceManager);
    await semanticSearch.connect();

    tripleStore = new TripleStore();
    ontologyBuilder = new OntologyBuilder({
      tripleStore,
      semanticSearch,
      llmClient,
      verification: { enabled: false }
    });

    ontologyRetriever = new OntologyRetriever({ semanticSearch, tripleStore });

    // Create TableInstanceCreator
    tableInstanceCreator = new TableInstanceCreator({
      llmClient,
      tripleStore,
      ontologyRetriever
    });
  }, 60000);

  describe('Unit Tests: Table structure analysis', () => {
    test('should analyze simple table structure', () => {
      const table = {
        headers: ['Company', 'Revenue'],
        rows: [
          ['Acme Corp', '1000000'],
          ['Tech Inc', '2000000']
        ]
      };

      const structure = tableInstanceCreator.analyzeTableStructure(table);

      console.log('\n📊 Table structure:', structure);

      expect(structure).toHaveProperty('rowCount');
      expect(structure).toHaveProperty('columnCount');
      expect(structure).toHaveProperty('headers');
      expect(structure.rowCount).toBe(2);
      expect(structure.columnCount).toBe(2);

      console.log('✅ Successfully analyzed table structure');
    });

    test('should format table data for LLM prompt (legacy method)', () => {
      const table = {
        headers: ['Company', 'Revenue'],
        rows: [
          ['Acme Corp', '1000000']
        ]
      };

      const ontologyText = `CLASSES:
- kg:Organization (Organization)

DATATYPE PROPERTIES:
- kg:hasRevenue (has revenue)
  Domain: kg:Organization
  Range: xsd:decimal`;

      const formatted = tableInstanceCreator.formatTableForPrompt(table, ontologyText);

      // Phase 7 note: This is a legacy method for compatibility
      // formatTableForPrompt only formats table structure, not ontology
      expect(formatted).toContain('Company');
      expect(formatted).toContain('Revenue');
      expect(formatted).toContain('Acme Corp');

      console.log('✅ Successfully formatted table for LLM prompt (legacy method)');
    });
  });

  describe('Integration Tests: Create instances from tables', () => {
    test('should create instances from simple 2x2 table', async () => {
      const table = {
        headers: ['Company', 'Revenue'],
        rows: [
          ['Acme Corp', '500000'],
          ['Tech Inc', '750000']
        ]
      };

      const ontologyText = `CLASSES:
- kg:Organization (Organization)
- kg:FinancialMetric (Financial Metric)
- kg:Observation (Observation)

DATATYPE PROPERTIES:
- kg:hasValue (has value)
  Domain: kg:Observation
  Range: xsd:decimal

OBJECT PROPERTIES:
- kg:forOrganization (for organization)
  Domain: kg:Observation
  Range: kg:Organization
- kg:hasMetric (has metric)
  Domain: kg:Observation
  Range: kg:FinancialMetric`;

      const instances = await tableInstanceCreator.createInstancesFromTable(table, ontologyText);

      console.log('\n📊 Created instances from table:', JSON.stringify(instances, null, 2));

      expect(instances).toHaveProperty('entities');
      expect(instances.entities.length).toBeGreaterThan(0);

      console.log('✅ Successfully created instances from simple table');
    }, 45000);

    test('should verify structured value entities created (Phase 7)', async () => {
      const table = {
        headers: ['Company', 'Revenue', 'Employees'],
        rows: [
          ['Acme Corp', '500000', '50']
        ]
      };

      const ontologyText = `CLASSES:
- kg:Organization (Organization)
- kg:FinancialMetric (Financial Metric)
- kg:Observation (Observation)`;

      const metadata = {
        currency: 'USD',
        sourceDocument: 'test.pdf'
      };

      const instances = await tableInstanceCreator.createInstancesFromTable(table, ontologyText, metadata);

      console.log('\n📊 FinancialValue entities:', instances.entities.filter(e =>
        e.type === 'kg:FinancialValue'
      ));

      // Phase 7: Should have FinancialValue entities with full metadata
      const valueEntities = instances.entities.filter(e =>
        e.type === 'kg:FinancialValue'
      );
      expect(valueEntities.length).toBeGreaterThan(0);

      // Verify FinancialValue has proper structure
      const firstValue = valueEntities[0];
      expect(firstValue.properties['kg:numericValue']).toBeDefined();
      expect(firstValue.properties['kg:actualAmount']).toBeDefined();
      expect(firstValue.properties['kg:currency']).toBe('USD');

      // Should have Table entity
      const tableEntity = instances.entities.find(e => e.type === 'kg:Table');
      expect(tableEntity).toBeDefined();
      expect(tableEntity.properties['kg:sourceDocument']).toBe('test.pdf');

      // Should have Cell entities
      const cellEntities = instances.entities.filter(e => e.type === 'kg:TableCell');
      expect(cellEntities.length).toBeGreaterThan(0);

      console.log('✅ Structured value entities created correctly (Phase 7)');
    }, 45000);

    test('should verify observation instances created', async () => {
      const table = {
        headers: ['Company', 'Q1 Revenue', 'Q2 Revenue'],
        rows: [
          ['Acme Corp', '100000', '120000']
        ]
      };

      const ontologyText = `CLASSES:
- kg:Organization (Organization)
- kg:FinancialMetric (Financial Metric)
- kg:Observation (Observation)

DATATYPE PROPERTIES:
- kg:hasValue (has value)
  Domain: kg:Observation
  Range: xsd:decimal

OBJECT PROPERTIES:
- kg:forOrganization (for organization)
  Domain: kg:Observation
  Range: kg:Organization
- kg:hasMetric (has metric)
  Domain: kg:Observation
  Range: kg:FinancialMetric`;

      const instances = await tableInstanceCreator.createInstancesFromTable(table, ontologyText);

      console.log('\n📊 Observation instances:', instances.entities.filter(e =>
        e.type && e.type.includes('Observation')
      ));

      // Should have observation instances for the data cells
      const observations = instances.entities.filter(e =>
        e.type && e.type.includes('Observation')
      );
      expect(observations.length).toBeGreaterThan(0);

      console.log('✅ Observation instances created correctly');
    }, 45000);

    test('should verify all instances are added to triple store', async () => {
      const initialSize = await tripleStore.size();

      const table = {
        headers: ['Company', 'Revenue'],
        rows: [
          ['DataCorp', '1000000']
        ]
      };

      const ontologyText = `CLASSES:
- kg:Organization (Organization)
- kg:FinancialMetric (Financial Metric)
- kg:Observation (Observation)

DATATYPE PROPERTIES:
- kg:hasValue (has value)
  Domain: kg:Observation
  Range: xsd:decimal`;

      const instances = await tableInstanceCreator.createInstancesFromTable(table, ontologyText);

      // Add to triple store
      const count = await tripleStore.storeEntityModel(instances);

      console.log(`\n📊 Added ${count} triples to store from table`);

      const finalSize = await tripleStore.size();
      expect(finalSize).toBeGreaterThan(initialSize);

      console.log('✅ Table instances added to triple store correctly');
    }, 45000);

    test('should handle ConvFinQA format with scale metadata (Phase 7)', async () => {
      // ConvFinQA nested object format
      const table = {
        "2009": {
          "net income": 103102.0,
          "non-cash expenses": 74397.0
        },
        "2008": {
          "net income": 104222.0,
          "non-cash expenses": 70420.0
        }
      };

      const metadata = {
        sourceDocument: 'JKHY/2009/page_28.pdf',
        documentId: 'Single_JKHY/2009/page_28.pdf-3',
        scale: 'thousands',
        currency: 'USD',
        caption: 'Year ended June 30'
      };

      const instances = await tableInstanceCreator.createInstancesFromTable(table, '', metadata);

      console.log('\n📊 ConvFinQA table KG:');
      console.log('  Total entities:', instances.entities.length);
      console.log('  Total relationships:', instances.relationships.length);
      console.log('  Cells processed:', instances.cellCount);

      // Verify table entity has metadata
      expect(instances.tableEntity.properties['kg:sourceDocument']).toBe('JKHY/2009/page_28.pdf');
      expect(instances.tableEntity.properties['kg:caption']).toBe('Year ended June 30');
      expect(instances.tableEntity.properties['kg:defaultScale']).toBe('thousands');

      // Verify FinancialValue entities have scale applied
      const valueEntities = instances.entities.filter(e => e.type === 'kg:FinancialValue');
      expect(valueEntities.length).toBe(4); // 2x2 table

      // Check first value: 103102 thousands = 103,102,000
      const netIncome2009 = valueEntities.find(v =>
        v.properties['kg:numericValue'] === '103102'
      );
      expect(netIncome2009).toBeDefined();
      expect(netIncome2009.properties['kg:scale']).toBe('thousands');
      expect(netIncome2009.properties['kg:actualAmount']).toBe('103102000');
      expect(netIncome2009.properties['kg:currency']).toBe('USD');

      // Verify observations link to correct metrics and periods
      const observations = instances.entities.filter(e => e.type === 'kg:Observation');
      expect(observations.length).toBe(4);

      const netIncomeObs = observations.filter(o =>
        o.label.includes('net income')
      );
      expect(netIncomeObs.length).toBe(2); // One for each year

      console.log('\n📊 Sample FinancialValue with scale:');
      console.log(JSON.stringify(netIncome2009, null, 2));

      console.log('✅ ConvFinQA format with scale metadata handled correctly (Phase 7)');
    }, 45000);
  });
});
