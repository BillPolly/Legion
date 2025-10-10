import { jest } from '@jest/globals';
import { TableProvenanceBuilder } from '../../src/kg/TableProvenanceBuilder.js';
import { ValueExtractor } from '../../src/kg/ValueExtractor.js';

/**
 * Phase 7: TableProvenanceBuilder Tests
 *
 * Tests creation of Table and Cell entities with full provenance tracking.
 */

describe('TableProvenanceBuilder (Phase 7)', () => {
  let builder;
  let valueExtractor;

  beforeAll(() => {
    valueExtractor = new ValueExtractor();
    builder = new TableProvenanceBuilder({ valueExtractor });
  });

  describe('Unit Tests: Table entity creation', () => {
    test('should create Table entity with metadata', () => {
      const tableData = {
        headers: ['Company', 'Revenue'],
        rows: [
          ['Acme Corp', '1000000'],
          ['Tech Inc', '2000000']
        ]
      };

      const metadata = {
        sourceDocument: 'JKHY/2009/page_28.pdf',
        documentId: 'Single_JKHY/2009/page_28.pdf-3',
        caption: 'Year ended June 30',
        scale: 'thousands',
        currency: 'USD'
      };

      const tableEntity = builder.buildTableEntity(tableData, metadata);

      console.log('\n📊 Table entity:', JSON.stringify(tableEntity, null, 2));

      expect(tableEntity.uri).toContain('Table_');
      expect(tableEntity.type).toBe('kg:Table');
      expect(tableEntity.properties['kg:sourceDocument']).toBe('JKHY/2009/page_28.pdf');
      expect(tableEntity.properties['kg:caption']).toBe('Year ended June 30');
      expect(tableEntity.properties['kg:rowCount']).toBe('2');
      expect(tableEntity.properties['kg:columnCount']).toBe('2');
      expect(tableEntity.properties['kg:defaultScale']).toBe('thousands');

      console.log('✅ Created Table entity with metadata');
    });

    test('should handle ConvFinQA table format', () => {
      const tableData = {
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
        scale: 'thousands'
      };

      const tableEntity = builder.buildTableEntity(tableData, metadata);

      console.log('\n📊 ConvFinQA table entity:', tableEntity);

      expect(tableEntity.type).toBe('kg:Table');
      expect(tableEntity.properties['kg:rowCount']).toBe('2');
      expect(tableEntity.properties['kg:columnCount']).toBe('2');

      const headers = JSON.parse(tableEntity.properties['kg:columnHeaders']);
      expect(headers).toContain('2009');
      expect(headers).toContain('2008');

      console.log('✅ Handled ConvFinQA format');
    });
  });

  describe('Unit Tests: Cell entity creation', () => {
    test('should create Cell entities for all cells', () => {
      const tableData = {
        headers: ['Company', 'Revenue'],
        rows: [
          ['Acme Corp', '1,000,000']
        ]
      };

      const tableUri = 'data:Table_Test';
      const metadata = { currency: 'USD' };

      const cells = builder.buildCellEntities(tableData, tableUri, metadata);

      console.log('\n📊 Created cells:', cells.length);
      console.log('First cell:', JSON.stringify(cells[0], null, 2));

      expect(cells.length).toBeGreaterThan(0);

      const firstCell = cells[0];
      expect(firstCell.cellEntity).toBeDefined();
      expect(firstCell.valueEntity).toBeDefined();
      expect(firstCell.cellEntity.type).toBe('kg:TableCell');
      expect(firstCell.cellEntity.properties['kg:row']).toBeDefined();
      expect(firstCell.cellEntity.properties['kg:column']).toBeDefined();

      console.log('✅ Created Cell entities');
    });

    test('should link cells to FinancialValue entities', () => {
      const tableData = {
        headers: ['Q1', 'Q2'],
        rows: [
          ['100000', '120000']
        ]
      };

      const tableUri = 'data:Table_Test';
      const metadata = { scale: 'thousands', currency: 'USD' };

      const cells = builder.buildCellEntities(tableData, tableUri, metadata);

      expect(cells.length).toBe(2);

      cells.forEach(cell => {
        expect(cell.valueEntity.type).toBe('kg:FinancialValue');
        expect(cell.valueEntity.properties['kg:actualAmount']).toBeDefined();
        expect(cell.valueEntity.properties['kg:currency']).toBe('USD');
        expect(cell.valueEntity.properties['kg:scale']).toBe('thousands');
      });

      console.log('✅ Linked cells to FinancialValue entities');
    });
  });

  describe('Unit Tests: Observation creation with provenance', () => {
    test('should create observations with full provenance chain', () => {
      const tableData = {
        headers: ['2009'],
        rows: [
          ['103102']
        ]
      };

      const tableUri = 'data:Table_JKHY';
      const metadata = { scale: 'thousands', currency: 'USD' };

      const cells = builder.buildCellEntities(tableData, tableUri, metadata);
      const result = builder.createObservationsWithProvenance(cells, tableUri, {
        organizationUri: 'data:JKHY'
      });

      console.log('\n📊 Observations with provenance:');
      console.log('  Entities:', result.entities.length);
      console.log('  Relationships:', result.relationships.length);

      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.relationships.length).toBeGreaterThan(0);

      // Check observation exists
      const observation = result.entities.find(e => e.type === 'kg:Observation');
      expect(observation).toBeDefined();

      // Check provenance relationships
      const sourceTableRel = result.relationships.find(r =>
        r.predicate === 'kg:sourceTable'
      );
      expect(sourceTableRel).toBeDefined();
      expect(sourceTableRel.object).toBe(tableUri);

      const sourceCellRel = result.relationships.find(r =>
        r.predicate === 'kg:sourceCell'
      );
      expect(sourceCellRel).toBeDefined();

      const valueRel = result.relationships.find(r =>
        r.predicate === 'kg:hasFinancialValue'
      );
      expect(valueRel).toBeDefined();

      console.log('✅ Created observations with complete provenance');
    });
  });

  describe('Integration Tests: Complete table KG', () => {
    test('should build complete table knowledge graph', () => {
      const tableData = {
        headers: ['2009', '2008'],
        rows: [
          ['103102', '104222'],
          ['74397', '70420']
        ]
      };

      const metadata = {
        sourceDocument: 'JKHY/2009/page_28.pdf',
        documentId: 'Single_JKHY/2009/page_28.pdf-3',
        scale: 'thousands',
        currency: 'USD'
      };

      const kg = builder.buildTableKnowledgeGraph(tableData, metadata);

      console.log('\n📊 Complete table KG:');
      console.log('  Total entities:', kg.entities.length);
      console.log('  Total relationships:', kg.relationships.length);
      console.log('  Cells processed:', kg.cellCount);

      expect(kg.tableEntity).toBeDefined();
      expect(kg.tableEntity.type).toBe('kg:Table');
      expect(kg.entities.length).toBeGreaterThan(4);
      expect(kg.relationships.length).toBeGreaterThan(0);
      expect(kg.cellCount).toBe(4);

      // Verify structure
      const tables = kg.entities.filter(e => e.type === 'kg:Table');
      const cells = kg.entities.filter(e => e.type === 'kg:TableCell');
      const values = kg.entities.filter(e => e.type === 'kg:FinancialValue');
      const observations = kg.entities.filter(e => e.type === 'kg:Observation');

      expect(tables.length).toBe(1);
      expect(cells.length).toBe(4);
      expect(values.length).toBe(4);
      expect(observations.length).toBe(4);

      console.log('✅ Built complete table knowledge graph');
    });

    test('should build KG for ConvFinQA table', () => {
      const tableData = {
        "Year ended June 30, 2009": {
          "net income": 103102.0,
          "non-cash expenses": 74397.0,
          "change in receivables": 21214.0
        },
        "2008": {
          "net income": 104222.0,
          "non-cash expenses": 70420.0,
          "change in receivables": -2913.0
        },
        "2007": {
          "net income": 104681.0,
          "non-cash expenses": 56348.0,
          "change in receivables": -28853.0
        }
      };

      const metadata = {
        sourceDocument: 'JKHY/2009/page_28.pdf',
        documentId: 'Single_JKHY/2009/page_28.pdf-3',
        scale: 'thousands',
        currency: 'USD',
        organizationUri: 'data:JKHY'
      };

      const kg = builder.buildTableKnowledgeGraph(tableData, metadata);

      console.log('\n📊 ConvFinQA table KG:');
      console.log('  Entities:', kg.entities.length);
      console.log('  Relationships:', kg.relationships.length);
      console.log('  Cells:', kg.cellCount);

      expect(kg.cellCount).toBe(9); // 3 rows × 3 columns
      expect(kg.entities.length).toBeGreaterThan(20); // Table + cells + values + observations + metrics + periods

      // Verify can query by metric
      const netIncomeObs = kg.entities.filter(e =>
        e.type === 'kg:Observation' && e.label.includes('net income')
      );
      expect(netIncomeObs.length).toBe(3); // One for each period

      console.log('✅ Built ConvFinQA table KG');
    });

    test('should maintain provenance traceability', () => {
      const tableData = {
        headers: ['2009'],
        rows: [['103102']]
      };

      const metadata = {
        sourceDocument: 'JKHY/2009/page_28.pdf',
        scale: 'thousands'
      };

      const kg = builder.buildTableKnowledgeGraph(tableData, metadata);

      // Find an observation
      const observation = kg.entities.find(e => e.type === 'kg:Observation');
      expect(observation).toBeDefined();

      // Trace back through provenance
      const sourceTableRel = kg.relationships.find(r =>
        r.subject === observation.uri && r.predicate === 'kg:sourceTable'
      );
      expect(sourceTableRel).toBeDefined();

      const table = kg.entities.find(e => e.uri === sourceTableRel.object);
      expect(table).toBeDefined();
      expect(table.properties['kg:sourceDocument']).toBe('JKHY/2009/page_28.pdf');

      // Trace to cell
      const sourceCellRel = kg.relationships.find(r =>
        r.subject === observation.uri && r.predicate === 'kg:sourceCell'
      );
      expect(sourceCellRel).toBeDefined();

      const cell = kg.entities.find(e => e.uri === sourceCellRel.object);
      expect(cell).toBeDefined();
      expect(cell.type).toBe('kg:TableCell');

      // Trace to value
      const valueRel = kg.relationships.find(r =>
        r.subject === observation.uri && r.predicate === 'kg:hasFinancialValue'
      );
      expect(valueRel).toBeDefined();

      const value = kg.entities.find(e => e.uri === valueRel.object);
      expect(value).toBeDefined();
      expect(value.type).toBe('kg:FinancialValue');
      expect(value.properties['kg:actualAmount']).toBe('103102000');

      console.log('\n📊 Provenance chain verified:');
      console.log('  Observation →', observation.uri);
      console.log('  → Cell →', cell.uri);
      console.log('  → Value →', value.uri);
      console.log('  → Table →', table.uri);
      console.log('  → Document:', table.properties['kg:sourceDocument']);

      console.log('✅ Provenance traceability verified');
    });
  });
});
