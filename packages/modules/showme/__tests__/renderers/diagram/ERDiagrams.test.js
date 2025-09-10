/**
 * Comprehensive tests for ER Diagram functionality
 * Tests all ER-specific components: cardinality, weak entities, inheritance, validation, layout, symbols, export
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Import all ER components
import { CardinalityRenderer } from '../../../src/renderers/diagram/er/CardinalityRenderer.js';
import { WeakEntityRenderer } from '../../../src/renderers/diagram/er/WeakEntityRenderer.js';
import { InheritanceRenderer } from '../../../src/renderers/diagram/er/InheritanceRenderer.js';
import { ERValidator } from '../../../src/renderers/diagram/er/ERValidator.js';
import { ERLayoutEngine } from '../../../src/renderers/diagram/er/ERLayoutEngine.js';
import { ERSymbolLibrary } from '../../../src/renderers/diagram/er/ERSymbolLibrary.js';
import { ERExporter } from '../../../src/renderers/diagram/er/ERExporter.js';

// Mock DOM environment
global.document = {
  createElementNS: jest.fn((namespace, tagName) => ({
    setAttribute: jest.fn(),
    appendChild: jest.fn(),
    textContent: '',
    style: {}
  })),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => [])
};

global.XMLSerializer = jest.fn(() => ({
  serializeToString: jest.fn(() => '<svg></svg>')
}));

describe('ER Diagrams', () => {
  describe('CardinalityRenderer', () => {
    let renderer;
    let mockSvgGroup;

    beforeEach(() => {
      renderer = new CardinalityRenderer();
      mockSvgGroup = {
        appendChild: jest.fn(),
        ownerDocument: global.document
      };
    });

    test('should initialize with default configuration', () => {
      expect(renderer.config.notation).toBe('chen');
      expect(renderer.config.fontSize).toBe(12);
      expect(renderer.config.offset).toBe(20);
    });

    test('should render cardinality for relationship edge', () => {
      const edge = { id: 'rel1', name: 'relationship' };
      const sourcePos = { x: 100, y: 100 };
      const targetPos = { x: 200, y: 200 };
      const cardinality = { source: 'one', target: 'many' };

      renderer.renderCardinality(edge, sourcePos, targetPos, cardinality, mockSvgGroup);
      
      expect(mockSvgGroup.appendChild).toHaveBeenCalled();
    });

    test('should parse cardinality strings correctly', () => {
      expect(renderer.parseCardinality('1')).toEqual({ min: 1, max: 1, type: 'exact' });
      expect(renderer.parseCardinality('1..N')).toEqual({ min: 1, max: Infinity, type: 'range' });
      expect(renderer.parseCardinality('0,1')).toEqual({ min: 0, max: 1, type: 'range' });
      expect(renderer.parseCardinality('1:N')).toEqual({ min: 1, max: Infinity, type: 'range' });
    });

    test('should validate cardinality specifications', () => {
      expect(renderer.validateCardinality('1')).toBe(true);
      expect(renderer.validateCardinality('1..N')).toBe(true);
      expect(renderer.validateCardinality({ min: 1, max: 5 })).toBe(true);
      expect(renderer.validateCardinality({ type: 'one' })).toBe(true);
      expect(renderer.validateCardinality('')).toBe(false);
      expect(renderer.validateCardinality(null)).toBe(false);
    });

    test('should format cardinality for different notation styles', () => {
      // Chen notation
      renderer.setNotation('chen');
      expect(renderer._formatCardinality({ type: 'many' })).toBe('N');
      
      // Crow's foot notation
      renderer.setNotation('crow-foot');
      expect(renderer._formatCardinality({ type: 'many' })).toBe('∞');
      
      // IE notation
      renderer.setNotation('ie-notation');
      expect(renderer._formatCardinality({ type: 'many' })).toBe('*');
    });

    test('should get available cardinality types for notation', () => {
      renderer.setNotation('chen');
      const chenTypes = renderer.getAvailableCardinalityTypes();
      expect(chenTypes).toContain('N');
      expect(chenTypes).toContain('1:N');

      renderer.setNotation('crow-foot');
      const crowTypes = renderer.getAvailableCardinalityTypes();
      expect(crowTypes).toContain('∞');
      expect(crowTypes).toContain('0,1');
    });
  });

  describe('WeakEntityRenderer', () => {
    let renderer;
    let mockSvgGroup;

    beforeEach(() => {
      renderer = new WeakEntityRenderer();
      mockSvgGroup = {
        appendChild: jest.fn(),
        ownerDocument: global.document
      };
    });

    test('should initialize with default configuration', () => {
      expect(renderer.config.borderStyle).toBe('double');
      expect(renderer.config.usePattern).toBe(true);
      expect(renderer.config.patternType).toBe('diagonal-lines');
    });

    test('should render weak entity with double border', () => {
      const entity = {
        id: 'weakEntity1',
        type: 'weak-entity',
        name: 'WeakEntity',
        relationships: [{ identifying: true }]
      };

      renderer.renderWeakEntity(entity, 100, 100, 120, 80, mockSvgGroup);
      
      expect(mockSvgGroup.appendChild).toHaveBeenCalled();
      expect(global.document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'g');
    });

    test('should render dependency indicator for weak entities', () => {
      const entity = {
        id: 'weakEntity1',
        type: 'weak-entity',
        relationships: [{ identifying: true }]
      };

      renderer.config.showDependencyIndicator = true;
      renderer.renderWeakEntity(entity, 100, 100, 120, 80, mockSvgGroup);
      
      expect(mockSvgGroup.appendChild).toHaveBeenCalled();
    });

    test('should render identifying relationship with double line', () => {
      const edge = { id: 'rel1', identifying: true };
      const sourcePos = { x: 100, y: 100 };
      const targetPos = { x: 200, y: 200 };

      renderer.renderIdentifyingRelationship(edge, sourcePos, targetPos, mockSvgGroup);
      
      expect(mockSvgGroup.appendChild).toHaveBeenCalled();
    });

    test('should validate weak entity data', () => {
      const validWeakEntity = {
        id: 'we1',
        type: 'weak-entity',
        relationships: [{ identifying: true }]
      };

      const invalidWeakEntity = {
        id: 'we2',
        type: 'weak-entity',
        relationships: []
      };

      expect(renderer.validateWeakEntity(validWeakEntity).valid).toBe(true);
      expect(renderer.validateWeakEntity(invalidWeakEntity).valid).toBe(false);
    });

    test('should wrap text for entity labels', () => {
      const longText = 'This is a very long entity name that should be wrapped';
      const lines = renderer._wrapText(longText, 100);
      
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0].length).toBeLessThan(longText.length);
    });
  });

  describe('InheritanceRenderer', () => {
    let renderer;
    let mockSvgGroup;

    beforeEach(() => {
      renderer = new InheritanceRenderer();
      mockSvgGroup = {
        appendChild: jest.fn(),
        ownerDocument: global.document
      };
    });

    test('should initialize with default configuration', () => {
      expect(renderer.config.symbolType).toBe('triangle');
      expect(renderer.config.symbolSize).toBe(15);
      expect(renderer.config.showConstraints).toBe(true);
    });

    test('should render ISA inheritance relationship', () => {
      const relationship = {
        id: 'inh1',
        type: 'inheritance',
        parent: 'entity1',
        children: ['entity2', 'entity3'],
        constraints: { disjoint: true, total: false }
      };

      const parentPos = { x: 100, y: 100 };
      const childrenPositions = [
        { x: 50, y: 200 },
        { x: 150, y: 200 }
      ];

      renderer.renderInheritance(relationship, parentPos, childrenPositions, mockSvgGroup);
      
      expect(mockSvgGroup.appendChild).toHaveBeenCalled();
    });

    test('should render different ISA symbol types', () => {
      const relationship = { id: 'inh1', type: 'inheritance' };
      const parentPos = { x: 100, y: 100 };
      const childrenPositions = [{ x: 100, y: 200 }];

      // Test triangle symbol
      renderer.config.symbolType = 'triangle';
      renderer.renderInheritance(relationship, parentPos, childrenPositions, mockSvgGroup);
      
      // Test diamond symbol
      renderer.config.symbolType = 'diamond';
      renderer.renderInheritance(relationship, parentPos, childrenPositions, mockSvgGroup);
      
      // Test circle symbol
      renderer.config.symbolType = 'circle';
      renderer.renderInheritance(relationship, parentPos, childrenPositions, mockSvgGroup);
      
      expect(mockSvgGroup.appendChild).toHaveBeenCalled();
    });

    test('should render constraint indicators', () => {
      const constraints = {
        disjoint: true,
        total: false,
        overlapping: false,
        partial: true
      };

      const position = { x: 100, y: 100 };
      renderer._renderConstraints(constraints, position, mockSvgGroup);
      
      expect(mockSvgGroup.appendChild).toHaveBeenCalled();
    });

    test('should validate inheritance relationships', () => {
      const validInheritance = {
        id: 'inh1',
        parent: 'entity1',
        children: ['entity2']
      };

      const invalidInheritance = {
        id: 'inh2'
        // missing parent and children
      };

      expect(renderer.validateInheritance(validInheritance).valid).toBe(true);
      expect(renderer.validateInheritance(invalidInheritance).valid).toBe(false);
    });
  });

  describe('ERValidator', () => {
    let validator;

    beforeEach(() => {
      validator = new ERValidator();
    });

    test('should initialize with default validation rules', () => {
      const rules = validator.getAvailableRules();
      expect(rules).toContain('entity-has-name');
      expect(rules).toContain('relationship-degree-valid');
      expect(rules).toContain('weak-entity-rules');
      expect(rules).toContain('inheritance-cycles');
    });

    test('should validate complete ER diagram', () => {
      const validDiagram = {
        entities: [
          { id: 'e1', name: 'Customer', type: 'entity' },
          { id: 'e2', name: 'Order', type: 'weak-entity' }
        ],
        relationships: [
          {
            id: 'r1',
            name: 'Places',
            entities: ['e1', 'e2'],
            identifying: true
          }
        ],
        attributes: [
          { id: 'a1', name: 'CustomerID', type: 'key', entityId: 'e1' },
          { id: 'a2', name: 'OrderNumber', type: 'partial-key', entityId: 'e2' }
        ],
        inheritances: []
      };

      const result = validator.validateDiagram(validDiagram);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should detect validation errors', () => {
      const invalidDiagram = {
        entities: [
          { id: 'e1' }, // Missing name
          { id: 'e2', name: 'WeakEntity', type: 'weak-entity' } // No identifying relationship
        ],
        relationships: [
          { id: 'r1' } // Missing name and entities
        ],
        attributes: [],
        inheritances: []
      };

      const result = validator.validateDiagram(invalidDiagram);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should detect inheritance cycles', () => {
      const cyclicDiagram = {
        entities: [
          { id: 'e1', name: 'A' },
          { id: 'e2', name: 'B' },
          { id: 'e3', name: 'C' }
        ],
        relationships: [],
        attributes: [],
        inheritances: [
          { parent: 'e1', child: 'e2' },
          { parent: 'e2', child: 'e3' },
          { parent: 'e3', child: 'e1' } // Creates cycle
        ]
      };

      const result = validator.validateDiagram(cyclicDiagram);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Circular inheritance'))).toBe(true);
    });

    test('should validate cardinality formats', () => {
      expect(validator._isValidCardinalityFormat('1')).toBe(true);
      expect(validator._isValidCardinalityFormat('1..N')).toBe(true);
      expect(validator._isValidCardinalityFormat('0,1')).toBe(true);
      expect(validator._isValidCardinalityFormat('invalid')).toBe(false);
    });

    test('should add and remove custom validation rules', () => {
      const customRule = jest.fn(() => ({ errors: [], warnings: [] }));
      
      validator.addRule('custom-rule', customRule);
      expect(validator.getAvailableRules()).toContain('custom-rule');
      
      validator.removeRule('custom-rule');
      expect(validator.getAvailableRules()).not.toContain('custom-rule');
    });
  });

  describe('ERLayoutEngine', () => {
    let layoutEngine;
    let containerBounds;

    beforeEach(() => {
      layoutEngine = new ERLayoutEngine();
      containerBounds = { x: 0, y: 0, width: 800, height: 600 };
    });

    test('should initialize with default configuration', () => {
      expect(layoutEngine.config.defaultAlgorithm).toBe('hierarchical-er');
      expect(layoutEngine.config.entitySpacing).toBe(150);
      expect(layoutEngine.config.avoidOverlaps).toBe(true);
    });

    test('should calculate hierarchical layout for ER diagram', () => {
      const diagram = {
        entities: [
          { id: 'e1', name: 'Customer', type: 'entity' },
          { id: 'e2', name: 'Order', type: 'entity' },
          { id: 'e3', name: 'OrderItem', type: 'weak-entity' }
        ],
        relationships: [
          { id: 'r1', entities: ['e1', 'e2'] },
          { id: 'r2', entities: ['e2', 'e3'], identifying: true }
        ],
        inheritances: []
      };

      const layout = layoutEngine.calculateLayout(diagram, containerBounds);
      
      expect(layout.entities).toBeDefined();
      expect(layout.relationships).toBeDefined();
      expect(layout.bounds).toBeDefined();
      expect(layout.entities.size).toBe(3);
    });

    test('should select appropriate layout algorithm', () => {
      const inheritanceHeavyDiagram = {
        entities: [
          { id: 'e1' }, { id: 'e2' }, { id: 'e3' }
        ],
        relationships: [],
        inheritances: [
          { parent: 'e1', child: 'e2' },
          { parent: 'e1', child: 'e3' }
        ]
      };

      const elements = layoutEngine._parseERDiagram(inheritanceHeavyDiagram);
      const algorithm = layoutEngine._selectLayoutAlgorithm(elements);
      
      expect(algorithm).toBe('hierarchical-er');
    });

    test('should calculate radial layout for highly connected diagrams', () => {
      const connectedDiagram = {
        entities: [
          { id: 'e1' }, { id: 'e2' }, { id: 'e3' }, { id: 'e4' }
        ],
        relationships: [
          { id: 'r1', entities: ['e1', 'e2'] },
          { id: 'r2', entities: ['e1', 'e3'] },
          { id: 'r3', entities: ['e1', 'e4'] },
          { id: 'r4', entities: ['e2', 'e3'] },
          { id: 'r5', entities: ['e3', 'e4'] }
        ],
        inheritances: []
      };

      const layout = layoutEngine.calculateLayout(connectedDiagram, containerBounds);
      expect(layout.entities.size).toBe(4);
    });

    test('should position weak entities near their strong dependencies', () => {
      const diagramWithWeakEntities = {
        entities: [
          { id: 'e1', name: 'Order', type: 'entity' },
          { id: 'e2', name: 'OrderItem', type: 'weak-entity' }
        ],
        relationships: [
          { id: 'r1', entities: ['e1', 'e2'], identifying: true }
        ],
        inheritances: []
      };

      const layout = layoutEngine.calculateLayout(diagramWithWeakEntities, containerBounds);
      
      const strongEntityPos = layout.entities.get('e1');
      const weakEntityPos = layout.entities.get('e2');
      
      expect(strongEntityPos).toBeDefined();
      expect(weakEntityPos).toBeDefined();
      
      // Weak entity should be positioned near strong entity
      const distance = Math.sqrt(
        Math.pow(weakEntityPos.x - strongEntityPos.x, 2) + 
        Math.pow(weakEntityPos.y - strongEntityPos.y, 2)
      );
      expect(distance).toBeLessThan(200); // Should be reasonably close
    });

    test('should cache layout results', () => {
      const diagram = {
        entities: [{ id: 'e1' }],
        relationships: [],
        inheritances: []
      };

      const layout1 = layoutEngine.calculateLayout(diagram, containerBounds);
      const layout2 = layoutEngine.calculateLayout(diagram, containerBounds);
      
      expect(layout1).toBe(layout2); // Should return cached result
    });

    test('should clear layout cache', () => {
      layoutEngine.clearCache();
      expect(layoutEngine.layoutCache.size).toBe(0);
    });
  });

  describe('ERSymbolLibrary', () => {
    let symbolLibrary;

    beforeEach(() => {
      symbolLibrary = new ERSymbolLibrary();
    });

    test('should initialize with default symbols', () => {
      const symbols = symbolLibrary.getAvailableSymbols();
      expect(symbols).toContain('entity');
      expect(symbols).toContain('weak-entity');
      expect(symbols).toContain('relationship');
      expect(symbols).toContain('attribute');
      expect(symbols).toContain('isa-triangle');
    });

    test('should create entity symbol', () => {
      const symbol = symbolLibrary.createSymbol('entity', {
        x: 100,
        y: 100,
        label: 'Customer'
      });

      expect(symbol.element).toBeDefined();
      expect(symbol.bounds).toBeDefined();
      expect(symbol.connectionPoints).toBeDefined();
    });

    test('should create weak entity symbol with double border', () => {
      const symbol = symbolLibrary.createSymbol('weak-entity', {
        x: 100,
        y: 100,
        label: 'OrderItem'
      });

      expect(symbol.element).toBeDefined();
      expect(symbol.bounds).toBeDefined();
      expect(global.document.createElementNS).toHaveBeenCalledWith('http://www.w3.org/2000/svg', 'g');
    });

    test('should create relationship symbol', () => {
      const symbol = symbolLibrary.createSymbol('relationship', {
        x: 100,
        y: 100,
        label: 'Contains'
      });

      expect(symbol.element).toBeDefined();
      expect(symbol.bounds).toBeDefined();
      expect(symbol.connectionPoints).toBeDefined();
    });

    test('should create different attribute types', () => {
      const attributeTypes = ['attribute', 'key-attribute', 'multivalued-attribute', 'derived-attribute'];
      
      for (const type of attributeTypes) {
        const symbol = symbolLibrary.createSymbol(type, {
          x: 100,
          y: 100,
          label: 'AttributeName'
        });
        
        expect(symbol.element).toBeDefined();
        expect(symbol.bounds).toBeDefined();
      }
    });

    test('should create ISA symbols', () => {
      const isaTypes = ['isa-triangle', 'isa-diamond', 'isa-circle'];
      
      for (const type of isaTypes) {
        const symbol = symbolLibrary.createSymbol(type, {
          x: 100,
          y: 100
        });
        
        expect(symbol.element).toBeDefined();
        expect(symbol.bounds).toBeDefined();
      }
    });

    test('should create composite symbols', () => {
      const symbols = [
        { type: 'entity', options: { x: 100, y: 100, label: 'Entity' } },
        { type: 'attribute', options: { x: 150, y: 50, label: 'Attr' } }
      ];

      const composite = symbolLibrary.createCompositeSymbol(symbols);
      
      expect(composite.element).toBeDefined();
      expect(composite.bounds).toBeDefined();
    });

    test('should get symbol categories', () => {
      const categories = symbolLibrary.getSymbolCategories();
      
      expect(categories.entities).toContain('entity');
      expect(categories.relationships).toContain('relationship');
      expect(categories.attributes).toContain('attribute');
      expect(categories.inheritance).toContain('isa-triangle');
    });

    test('should export symbol as SVG', () => {
      const svgString = symbolLibrary.exportSymbolAsSVG('entity', {
        x: 100,
        y: 100,
        label: 'Test'
      });

      expect(typeof svgString).toBe('string');
      expect(global.XMLSerializer).toHaveBeenCalled();
    });

    test('should throw error for unknown symbol type', () => {
      expect(() => {
        symbolLibrary.createSymbol('unknown-symbol');
      }).toThrow('Unknown symbol type: unknown-symbol');
    });
  });

  describe('ERExporter', () => {
    let exporter;
    let sampleDiagram;

    beforeEach(() => {
      exporter = new ERExporter();
      sampleDiagram = {
        name: 'Sample ER Diagram',
        entities: [
          {
            id: 'e1',
            name: 'Customer',
            type: 'entity'
          },
          {
            id: 'e2',
            name: 'Order',
            type: 'entity'
          }
        ],
        relationships: [
          {
            id: 'r1',
            name: 'Places',
            entities: ['e1', 'e2'],
            cardinality: { e1: 'one', e2: 'many' }
          }
        ],
        attributes: [
          { id: 'a1', name: 'CustomerID', type: 'key', entityId: 'e1' },
          { id: 'a2', name: 'CustomerName', type: 'simple', entityId: 'e1' },
          { id: 'a3', name: 'OrderID', type: 'key', entityId: 'e2' }
        ],
        inheritances: []
      };
    });

    test('should initialize with available export formats', () => {
      const formats = exporter.getAvailableFormats();
      const formatKeys = formats.map(f => f.key);
      
      expect(formatKeys).toContain('sql-ddl');
      expect(formatKeys).toContain('json-schema');
      expect(formatKeys).toContain('graphql');
      expect(formatKeys).toContain('er-json');
    });

    test('should export to SQL DDL format', () => {
      const result = exporter.export(sampleDiagram, 'sql-ddl');
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('CREATE TABLE');
      expect(result.content).toContain('Customer');
      expect(result.content).toContain('PRIMARY KEY');
    });

    test('should export to JSON Schema format', () => {
      const result = exporter.export(sampleDiagram, 'json-schema');
      
      expect(result.success).toBe(true);
      const schema = JSON.parse(result.content);
      expect(schema.$schema).toBeDefined();
      expect(schema.definitions).toBeDefined();
      expect(schema.definitions.Customer).toBeDefined();
    });

    test('should export to GraphQL Schema format', () => {
      const result = exporter.export(sampleDiagram, 'graphql');
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('type Customer');
      expect(result.content).toContain('type Order');
      expect(result.content).toContain('type Query');
    });

    test('should export to native ER JSON format', () => {
      const result = exporter.export(sampleDiagram, 'er-json');
      
      expect(result.success).toBe(true);
      const erJson = JSON.parse(result.content);
      expect(erJson.entities).toHaveLength(2);
      expect(erJson.relationships).toHaveLength(1);
      expect(erJson.exportInfo.format).toBe('er-json');
    });

    test('should handle invalid export format', () => {
      const result = exporter.export(sampleDiagram, 'invalid-format');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported export format');
    });

    test('should validate export format', () => {
      expect(exporter.isValidFormat('sql-ddl')).toBe(true);
      expect(exporter.isValidFormat('invalid-format')).toBe(false);
    });

    test('should get format metadata', () => {
      const metadata = exporter.getFormatMetadata('sql-ddl');
      
      expect(metadata.name).toBe('SQL DDL');
      expect(metadata.extension).toBe('.sql');
      expect(metadata.mimeType).toBe('text/sql');
    });

    test('should parse cardinality for SQL generation', () => {
      const result = exporter.export(sampleDiagram, 'sql-ddl', {
        includeComments: true,
        includeConstraints: true
      });
      
      expect(result.success).toBe(true);
      expect(result.content).toContain('-- Generated SQL DDL');
    });

    test('should add custom export format', () => {
      const customExporter = jest.fn(() => ({
        content: 'custom format content',
        metadata: {}
      }));

      exporter.addExportFormat('custom', {
        name: 'Custom Format',
        description: 'Custom export format',
        extension: '.custom',
        mimeType: 'text/custom',
        exporter: customExporter
      });

      const result = exporter.export(sampleDiagram, 'custom');
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('custom format content');
      expect(customExporter).toHaveBeenCalled();
    });

    test('should remove export format', () => {
      expect(exporter.isValidFormat('sql-ddl')).toBe(true);
      
      exporter.removeExportFormat('sql-ddl');
      
      expect(exporter.isValidFormat('sql-ddl')).toBe(false);
    });

    test('should update configuration', () => {
      exporter.updateConfiguration({ sqlDialect: 'postgresql' });
      
      expect(exporter.config.sqlDialect).toBe('postgresql');
    });

    test('should handle naming conventions correctly', () => {
      expect(exporter._toCamelCase('user_name')).toBe('userName');
      expect(exporter._toCamelCase('user-name')).toBe('userName');
      expect(exporter._toPascalCase('user_name')).toBe('UserName');
    });
  });

  describe('Integration Tests', () => {
    test('should work together - complete ER diagram workflow', () => {
      // Create components
      const validator = new ERValidator();
      const layoutEngine = new ERLayoutEngine();
      const symbolLibrary = new ERSymbolLibrary();
      const exporter = new ERExporter();

      // Sample ER diagram
      const diagram = {
        name: 'University Database',
        entities: [
          { id: 'student', name: 'Student', type: 'entity' },
          { id: 'course', name: 'Course', type: 'entity' },
          { id: 'enrollment', name: 'Enrollment', type: 'weak-entity' }
        ],
        relationships: [
          {
            id: 'enrolls',
            name: 'Enrolls',
            entities: ['student', 'enrollment'],
            identifying: true
          },
          {
            id: 'offers',
            name: 'Offers',
            entities: ['course', 'enrollment'],
            identifying: true
          }
        ],
        attributes: [
          { id: 'sid', name: 'StudentID', type: 'key', entityId: 'student' },
          { id: 'cid', name: 'CourseID', type: 'key', entityId: 'course' },
          { id: 'grade', name: 'Grade', type: 'simple', entityId: 'enrollment' }
        ],
        inheritances: []
      };

      // 1. Validate diagram
      const validation = validator.validateDiagram(diagram);
      expect(validation.valid).toBe(true);

      // 2. Calculate layout
      const layout = layoutEngine.calculateLayout(diagram, {
        x: 0, y: 0, width: 800, height: 600
      });
      expect(layout.entities.size).toBe(3);

      // 3. Create symbols
      const entitySymbol = symbolLibrary.createSymbol('entity', {
        x: 100, y: 100, label: 'Student'
      });
      expect(entitySymbol.element).toBeDefined();

      const weakEntitySymbol = symbolLibrary.createSymbol('weak-entity', {
        x: 200, y: 200, label: 'Enrollment'
      });
      expect(weakEntitySymbol.element).toBeDefined();

      // 4. Export to multiple formats
      const sqlExport = exporter.export(diagram, 'sql-ddl');
      expect(sqlExport.success).toBe(true);
      expect(sqlExport.content).toContain('CREATE TABLE');

      const jsonSchemaExport = exporter.export(diagram, 'json-schema');
      expect(jsonSchemaExport.success).toBe(true);
      
      const parsedSchema = JSON.parse(jsonSchemaExport.content);
      expect(parsedSchema.definitions.Student).toBeDefined();
      expect(parsedSchema.definitions.Course).toBeDefined();
      expect(parsedSchema.definitions.Enrollment).toBeDefined();
    });

    test('should handle complex inheritance hierarchy', () => {
      const complexDiagram = {
        entities: [
          { id: 'person', name: 'Person', type: 'entity' },
          { id: 'student', name: 'Student', type: 'entity' },
          { id: 'employee', name: 'Employee', type: 'entity' },
          { id: 'gradStudent', name: 'GraduateStudent', type: 'entity' }
        ],
        relationships: [],
        attributes: [
          { id: 'pid', name: 'PersonID', type: 'key', entityId: 'person' }
        ],
        inheritances: [
          { parent: 'person', child: 'student' },
          { parent: 'person', child: 'employee' },
          { parent: 'student', child: 'gradStudent' }
        ]
      };

      const validator = new ERValidator();
      const layoutEngine = new ERLayoutEngine();

      // Validate inheritance structure
      const validation = validator.validateDiagram(complexDiagram);
      expect(validation.valid).toBe(true);

      // Layout should handle hierarchy
      const layout = layoutEngine.calculateLayout(complexDiagram, {
        x: 0, y: 0, width: 800, height: 600
      });
      expect(layout.entities.size).toBe(4);
    });
  });
});