/**
 * Comprehensive tests for Entity-Relationship Diagram functionality
 * Tests all ER components: entities, relationships, attributes, validation, layout, and export
 */

import { jest } from '@jest/globals';
import { EntityNode } from '../../../../src/renderers/diagram/nodes/EntityNode.js';
import { RelationshipEdge } from '../../../../src/renderers/diagram/edges/RelationshipEdge.js';
import { ERCardinalityNotation } from '../../../../src/renderers/diagram/notation/ERCardinalityNotation.js';
import { WeakEntitySupport } from '../../../../src/renderers/diagram/er/WeakEntitySupport.js';
import { InheritanceRelationship } from '../../../../src/renderers/diagram/relationships/InheritanceRelationship.js';
import { ERValidationEngine } from '../../../../src/renderers/diagram/validation/ERValidationEngine.js';
import { ERLayout } from '../../../../src/renderers/diagram/layout/ERLayout.js';
import { ERSymbolLibrary } from '../../../../src/renderers/diagram/symbols/ERSymbolLibrary.js';
import { ERExporter } from '../../../../src/renderers/diagram/export/ERExporter.js';

// Mock DOM and SVG
global.document = {
  createElementNS: jest.fn((ns, tagName) => ({
    setAttribute: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    remove: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn()
    },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    textContent: '',
    style: {},
    childNodes: [],
    parentNode: null
  })),
  createElement: jest.fn(tagName => ({
    setAttribute: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    remove: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn()
    },
    style: {}
  }))
};

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now())
};

describe('Entity-Relationship Diagram Tests', () => {
  
  describe('EntityNode Tests', () => {
    let entityNode;
    let container;

    beforeEach(() => {
      container = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      jest.clearAllMocks();
    });

    afterEach(() => {
      if (entityNode) {
        entityNode.destroy();
      }
    });

    test('should create strong entity with default configuration', () => {
      entityNode = new EntityNode({
        name: 'Customer',
        type: 'strong'
      });

      expect(entityNode).toBeDefined();
      expect(entityNode.config.name).toBe('Customer');
      expect(entityNode.config.type).toBe('strong');
      expect(entityNode.config.attributes).toEqual([]);
      expect(entityNode.primaryKeys.size).toBe(0);
      expect(entityNode.foreignKeys.size).toBe(0);
    });

    test('should create weak entity with proper styling', () => {
      entityNode = new EntityNode({
        name: 'OrderItem',
        type: 'weak'
      });

      expect(entityNode.config.type).toBe('weak');
      expect(entityNode.config.style.weakEntityStrokeWidth).toBe(4);
      expect(entityNode.config.style.weakEntityInnerStroke).toBe('#FFFFFF');
    });

    test('should create associative entity with dashed border', () => {
      entityNode = new EntityNode({
        name: 'Enrollment',
        type: 'associative'
      });

      expect(entityNode.config.type).toBe('associative');
      expect(entityNode.config.style.associativeEntityDashArray).toBe('5,5');
    });

    test('should add attributes with various properties', () => {
      entityNode = new EntityNode({ name: 'Product' });

      const primaryKey = entityNode.addAttribute({
        name: 'product_id',
        type: 'NUMBER',
        isPrimaryKey: true
      });

      const foreignKey = entityNode.addAttribute({
        name: 'category_id',
        type: 'NUMBER',
        isForeignKey: true,
        referencedEntity: 'Category',
        referencedAttribute: 'category_id'
      });

      const derivedAttr = entityNode.addAttribute({
        name: 'total_price',
        type: 'DECIMAL',
        isDerived: true
      });

      expect(entityNode.config.attributes).toHaveLength(3);
      expect(entityNode.primaryKeys.has(primaryKey.id)).toBe(true);
      expect(entityNode.foreignKeys.has(foreignKey.id)).toBe(true);
      expect(derivedAttr.isDerived).toBe(true);
    });

    test('should remove attributes correctly', () => {
      entityNode = new EntityNode({ name: 'User' });

      const attr1 = entityNode.addAttribute({ name: 'user_id', isPrimaryKey: true });
      const attr2 = entityNode.addAttribute({ name: 'email' });
      const attr3 = entityNode.addAttribute({ name: 'password' });

      const removed = entityNode.removeAttribute(attr2.id);

      expect(removed).toBe(true);
      expect(entityNode.config.attributes).toHaveLength(2);
      expect(entityNode.config.attributes.find(a => a.name === 'email')).toBeUndefined();
    });

    test('should update attribute properties', () => {
      entityNode = new EntityNode({ name: 'Account' });

      const attr = entityNode.addAttribute({ name: 'balance', type: 'DECIMAL' });
      
      entityNode.updateAttribute(attr.id, {
        isRequired: true,
        defaultValue: 0,
        constraints: ['MIN:0']
      });

      const updated = entityNode.config.attributes.find(a => a.id === attr.id);
      expect(updated.isRequired).toBe(true);
      expect(updated.defaultValue).toBe(0);
      expect(updated.constraints).toEqual(['MIN:0']);
    });

    test('should get primary and foreign keys', () => {
      entityNode = new EntityNode({ name: 'Order' });

      entityNode.addAttribute({ name: 'order_id', isPrimaryKey: true });
      entityNode.addAttribute({ name: 'customer_id', isForeignKey: true });
      entityNode.addAttribute({ name: 'order_date' });

      const primaryKeys = entityNode.getPrimaryKeys();
      const foreignKeys = entityNode.getForeignKeys();

      expect(primaryKeys).toHaveLength(1);
      expect(primaryKeys[0].name).toBe('order_id');
      expect(foreignKeys).toHaveLength(1);
      expect(foreignKeys[0].name).toBe('customer_id');
    });

    test('should calculate dimensions based on content', () => {
      entityNode = new EntityNode({ 
        name: 'VeryLongEntityNameForTesting',
        minWidth: 100,
        minHeight: 60
      });

      entityNode.addAttribute({ name: 'very_long_attribute_name_for_testing', type: 'VARCHAR(255)' });
      entityNode.addAttribute({ name: 'short_attr', type: 'INT' });

      expect(entityNode.config.width).toBeGreaterThan(entityNode.config.minWidth);
      expect(entityNode.config.height).toBeGreaterThan(entityNode.config.minHeight);
    });

    test('should render entity as SVG', () => {
      entityNode = new EntityNode({ name: 'TestEntity', type: 'strong' });
      entityNode.addAttribute({ name: 'id', isPrimaryKey: true });
      entityNode.addAttribute({ name: 'name' });

      const element = entityNode.render(container);

      expect(element).toBeDefined();
      expect(document.createElementNS).toHaveBeenCalled();
      expect(element.setAttribute).toHaveBeenCalledWith('class', 'entity-node entity-strong');
      expect(element.setAttribute).toHaveBeenCalledWith('data-entity-id', entityNode.config.id);
    });

    test('should handle selection and deselection', () => {
      entityNode = new EntityNode({ name: 'Selectable', selectable: true });
      entityNode.render(container);

      entityNode.select();
      expect(entityNode.isSelected).toBe(true);
      expect(entityNode.element.classList.add).toHaveBeenCalledWith('selected');

      entityNode.deselect();
      expect(entityNode.isSelected).toBe(false);
      expect(entityNode.element.classList.remove).toHaveBeenCalledWith('selected');
    });

    test('should get connection points', () => {
      entityNode = new EntityNode({
        name: 'Connection',
        x: 100,
        y: 100,
        width: 120,
        height: 80
      });

      const points = entityNode.getConnectionPoints();

      expect(points.top).toEqual({ x: 160, y: 100 });
      expect(points.right).toEqual({ x: 220, y: 140 });
      expect(points.bottom).toEqual({ x: 160, y: 180 });
      expect(points.left).toEqual({ x: 100, y: 140 });
      expect(points.center).toEqual({ x: 160, y: 140 });
    });

    test('should serialize and deserialize from JSON', () => {
      entityNode = new EntityNode({
        name: 'Serializable',
        type: 'weak',
        x: 50,
        y: 75,
        attributes: [
          { name: 'id', isPrimaryKey: true },
          { name: 'foreign_id', isForeignKey: true }
        ]
      });

      const json = entityNode.toJSON();
      const restored = EntityNode.fromJSON(json);

      expect(restored.config.name).toBe('Serializable');
      expect(restored.config.type).toBe('weak');
      expect(restored.config.x).toBe(50);
      expect(restored.config.y).toBe(75);
      expect(restored.config.attributes).toHaveLength(2);
    });
  });

  describe('RelationshipEdge Tests', () => {
    let relationshipEdge;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    afterEach(() => {
      if (relationshipEdge) {
        relationshipEdge.destroy();
      }
    });

    test('should create one-to-many relationship', () => {
      relationshipEdge = new RelationshipEdge({
        name: 'has',
        type: 'one-to-many',
        sourceEntity: 'Customer',
        targetEntity: 'Order',
        sourceCardinality: '1',
        targetCardinality: '*'
      });

      expect(relationshipEdge.config.type).toBe('one-to-many');
      expect(relationshipEdge.config.sourceCardinality).toBe('1');
      expect(relationshipEdge.config.targetCardinality).toBe('*');
    });

    test('should create many-to-many relationship', () => {
      relationshipEdge = new RelationshipEdge({
        name: 'enrolled_in',
        type: 'many-to-many',
        sourceEntity: 'Student',
        targetEntity: 'Course'
      });

      expect(relationshipEdge.config.type).toBe('many-to-many');
    });

    test('should validate relationship constraints', () => {
      relationshipEdge = new RelationshipEdge({
        name: 'owns',
        participationConstraints: {
          source: { min: 1, max: 1 },
          target: { min: 0, max: null }
        }
      });

      const isValid = relationshipEdge.validateConstraints();
      expect(isValid).toBe(true);
    });

    test('should handle identifying relationships', () => {
      relationshipEdge = new RelationshipEdge({
        name: 'identifies',
        isIdentifying: true,
        sourceEntity: 'Order',
        targetEntity: 'OrderItem'
      });

      expect(relationshipEdge.config.isIdentifying).toBe(true);
    });
  });

  describe('ERCardinalityNotation Tests', () => {
    let notation;

    beforeEach(() => {
      notation = new ERCardinalityNotation();
    });

    test('should convert to Chen notation', () => {
      expect(notation.toChen('1')).toBe('1');
      expect(notation.toChen('*')).toBe('N');
      expect(notation.toChen('0..*')).toBe('N');
      expect(notation.toChen('1..*')).toBe('M');
    });

    test('should convert to Crow\'s Foot notation', () => {
      expect(notation.toCrowsFoot('1')).toBe('||');
      expect(notation.toCrowsFoot('0..1')).toBe('|o');
      expect(notation.toCrowsFoot('*')).toBe('o{');
      expect(notation.toCrowsFoot('1..*')).toBe('|{');
    });

    test('should convert to UML notation', () => {
      expect(notation.toUML({ min: 1, max: 1 })).toBe('1');
      expect(notation.toUML({ min: 0, max: null })).toBe('0..*');
      expect(notation.toUML({ min: 1, max: null })).toBe('1..*');
      expect(notation.toUML({ min: 0, max: 1 })).toBe('0..1');
    });

    test('should parse cardinality strings', () => {
      expect(notation.parse('1')).toEqual({ min: 1, max: 1 });
      expect(notation.parse('*')).toEqual({ min: 0, max: null });
      expect(notation.parse('0..*')).toEqual({ min: 0, max: null });
      expect(notation.parse('1..5')).toEqual({ min: 1, max: 5 });
    });

    test('should validate cardinality', () => {
      expect(notation.isValid('1')).toBe(true);
      expect(notation.isValid('*')).toBe(true);
      expect(notation.isValid('0..1')).toBe(true);
      expect(notation.isValid('invalid')).toBe(false);
      expect(notation.isValid('5..2')).toBe(false);
    });
  });

  describe('WeakEntitySupport Tests', () => {
    let weakEntitySupport;

    beforeEach(() => {
      weakEntitySupport = new WeakEntitySupport();
    });

    test('should identify weak entity relationships', () => {
      const entity = { type: 'weak', name: 'OrderItem' };
      const relationship = { isIdentifying: true };

      expect(weakEntitySupport.isWeakEntity(entity)).toBe(true);
      expect(weakEntitySupport.isIdentifyingRelationship(relationship)).toBe(true);
    });

    test('should validate weak entity dependencies', () => {
      const weakEntity = {
        type: 'weak',
        relationships: [{ isIdentifying: true, targetEntity: 'Order' }]
      };

      const validation = weakEntitySupport.validateWeakEntity(weakEntity);
      expect(validation.isValid).toBe(true);
    });

    test('should find owner entity', () => {
      const entities = [
        { id: 'e1', name: 'Order', type: 'strong' },
        { id: 'e2', name: 'OrderItem', type: 'weak' }
      ];
      const relationships = [
        { source: 'e1', target: 'e2', isIdentifying: true }
      ];

      const owner = weakEntitySupport.findOwnerEntity('e2', entities, relationships);
      expect(owner).toBe('e1');
    });

    test('should detect partial key attributes', () => {
      const attribute = { isPartialKey: true, name: 'item_number' };
      
      expect(weakEntitySupport.isPartialKey(attribute)).toBe(true);
    });
  });

  describe('InheritanceRelationship Tests', () => {
    let inheritance;

    beforeEach(() => {
      inheritance = new InheritanceRelationship();
    });

    test('should create ISA relationship', () => {
      const isaRel = inheritance.createISA({
        parent: 'Vehicle',
        children: ['Car', 'Truck', 'Motorcycle']
      });

      expect(isaRel.type).toBe('isa');
      expect(isaRel.parent).toBe('Vehicle');
      expect(isaRel.children).toHaveLength(3);
    });

    test('should validate disjoint constraint', () => {
      const hierarchy = {
        parent: 'Person',
        children: ['Student', 'Employee'],
        disjointness: 'disjoint'
      };

      expect(inheritance.validateDisjointness(hierarchy)).toBe(true);
    });

    test('should validate completeness constraint', () => {
      const hierarchy = {
        parent: 'Account',
        children: ['Checking', 'Savings'],
        completeness: 'total'
      };

      expect(inheritance.validateCompleteness(hierarchy)).toBe(true);
    });

    test('should detect specialization vs generalization', () => {
      const spec = { direction: 'top-down', parent: 'Animal', children: ['Dog', 'Cat'] };
      const gen = { direction: 'bottom-up', children: ['Circle', 'Square'], parent: 'Shape' };

      expect(inheritance.isSpecialization(spec)).toBe(true);
      expect(inheritance.isGeneralization(gen)).toBe(true);
    });

    test('should handle multiple inheritance', () => {
      const multipleInheritance = {
        child: 'TeachingAssistant',
        parents: ['Student', 'Employee']
      };

      expect(inheritance.supportsMultipleInheritance()).toBe(true);
      expect(inheritance.validateMultipleInheritance(multipleInheritance)).toBe(true);
    });
  });

  describe('ERValidationEngine Tests', () => {
    let validationEngine;

    beforeEach(() => {
      validationEngine = new ERValidationEngine({
        validateEntities: true,
        validateRelationships: true,
        validateCardinality: true,
        validateNaming: true,
        strictMode: true
      });
    });

    test('should validate complete ER diagram', async () => {
      const diagram = {
        entities: [
          {
            id: 'e1',
            name: 'Customer',
            type: 'strong',
            attributes: [
              { name: 'customer_id', isPrimaryKey: true },
              { name: 'name', isRequired: true }
            ]
          },
          {
            id: 'e2',
            name: 'Order',
            type: 'strong',
            attributes: [
              { name: 'order_id', isPrimaryKey: true },
              { name: 'customer_id', isForeignKey: true }
            ]
          }
        ],
        relationships: [
          {
            id: 'r1',
            name: 'places',
            source: 'e1',
            target: 'e2',
            cardinality: { source: '1', target: '*' }
          }
        ]
      };

      const result = await validationEngine.validateDiagram(diagram);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.entityCount).toBe(2);
      expect(result.relationshipCount).toBe(1);
    });

    test('should detect missing primary keys', async () => {
      const diagram = {
        entities: [
          {
            id: 'e1',
            name: 'InvalidEntity',
            attributes: [
              { name: 'field1' },
              { name: 'field2' }
            ]
          }
        ]
      };

      const result = await validationEngine.validateDiagram(diagram);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Entity InvalidEntity must have at least one primary key');
    });

    test('should validate relationship cardinality', async () => {
      const diagram = {
        entities: [
          { id: 'e1', name: 'A', attributes: [{ isPrimaryKey: true }] },
          { id: 'e2', name: 'B', attributes: [{ isPrimaryKey: true }] }
        ],
        relationships: [
          {
            id: 'r1',
            source: 'e1',
            target: 'e2',
            cardinality: { source: 'invalid', target: '*' }
          }
        ]
      };

      const result = await validationEngine.validateDiagram(diagram);
      
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Invalid cardinality: invalid');
    });

    test('should validate foreign key references', async () => {
      const diagram = {
        entities: [
          {
            id: 'e1',
            name: 'Order',
            attributes: [
              { name: 'order_id', isPrimaryKey: true },
              { name: 'customer_id', isForeignKey: true, referencedEntity: 'NonExistent' }
            ]
          }
        ]
      };

      const result = await validationEngine.validateDiagram(diagram);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Foreign key customer_id references non-existent entity: NonExistent');
    });

    test('should validate weak entity constraints', async () => {
      const diagram = {
        entities: [
          {
            id: 'e1',
            name: 'WeakEntity',
            type: 'weak',
            attributes: [{ name: 'partial_key', isPartialKey: true }]
          }
        ],
        relationships: []
      };

      const result = await validationEngine.validateDiagram(diagram);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Weak entity WeakEntity must have an identifying relationship');
    });
  });

  describe('ERLayout Tests', () => {
    let erLayout;
    let nodes, edges;

    beforeEach(() => {
      erLayout = new ERLayout({
        strategy: 'hierarchical',
        entitySpacing: 150,
        minimizeCrossings: true
      });

      nodes = [
        { id: 'e1', type: 'entity', name: 'Customer' },
        { id: 'e2', type: 'entity', name: 'Order' },
        { id: 'e3', type: 'weak-entity', name: 'OrderItem' },
        { id: 'a1', type: 'attribute', entityId: 'e1', name: 'name' },
        { id: 'r1', type: 'relationship', name: 'places' }
      ];

      edges = [
        { type: 'participates', source: 'e1', target: 'r1' },
        { type: 'participates', source: 'r1', target: 'e2' },
        { type: 'inheritance', source: 'e2', target: 'e3' },
        { type: 'has-attribute', source: 'e1', target: 'a1' }
      ];
    });

    test('should apply hierarchical layout', async () => {
      const result = await erLayout.execute(nodes, edges);

      expect(result.positions).toBeDefined();
      expect(result.positions.size).toBeGreaterThan(0);
      expect(result.bounds).toBeDefined();
      expect(result.metadata.algorithm).toBe('er-layout');
      expect(result.metadata.strategy).toBe('hierarchical');
    });

    test('should apply organic layout', async () => {
      erLayout.config.strategy = 'organic';
      
      const result = await erLayout.execute(nodes, edges);

      expect(result.positions).toBeDefined();
      expect(result.metadata.strategy).toBe('organic');
    });

    test('should apply orthogonal layout', async () => {
      erLayout.config.strategy = 'orthogonal';
      
      const result = await erLayout.execute(nodes, edges);

      expect(result.positions).toBeDefined();
      expect(result.metadata.strategy).toBe('orthogonal');
    });

    test('should group weak entities', async () => {
      erLayout.config.groupWeakEntities = true;
      
      const result = await erLayout.execute(nodes, edges);

      expect(erLayout.entityGroups.size).toBeGreaterThan(0);
    });

    test('should minimize relationship crossings', async () => {
      erLayout.config.minimizeCrossings = true;
      
      const result = await erLayout.execute(nodes, edges);

      expect(result.positions).toBeDefined();
      // Crossing minimization algorithm should have run
    });

    test('should position attributes correctly', async () => {
      erLayout.config.attributePosition = 'radial';
      
      const result = await erLayout.execute(nodes, edges);

      expect(result.positions.has('a1')).toBe(true);
      const attrPos = result.positions.get('a1');
      expect(attrPos.x).toBeDefined();
      expect(attrPos.y).toBeDefined();
    });
  });

  describe('ERSymbolLibrary Tests', () => {
    let symbolLibrary;

    beforeEach(() => {
      symbolLibrary = new ERSymbolLibrary();
    });

    test('should get Chen notation symbols', () => {
      const symbols = symbolLibrary.getSymbols('chen');

      expect(symbols.entity).toBeDefined();
      expect(symbols.weakEntity).toBeDefined();
      expect(symbols.relationship).toBeDefined();
      expect(symbols.attribute).toBeDefined();
      expect(symbols.keyAttribute).toBeDefined();
      expect(symbols.derivedAttribute).toBeDefined();
    });

    test('should get Crow\'s Foot notation symbols', () => {
      const symbols = symbolLibrary.getSymbols('crowsfoot');

      expect(symbols.one).toBe('||');
      expect(symbols.many).toBe('|{');
      expect(symbols.zeroOrOne).toBe('|o');
      expect(symbols.zeroOrMany).toBe('o{');
    });

    test('should get UML notation symbols', () => {
      const symbols = symbolLibrary.getSymbols('uml');

      expect(symbols.class).toBeDefined();
      expect(symbols.interface).toBeDefined();
      expect(symbols.association).toBeDefined();
      expect(symbols.aggregation).toBeDefined();
      expect(symbols.composition).toBeDefined();
    });

    test('should render entity symbol', () => {
      const svg = symbolLibrary.renderSymbol('entity', 'chen', {
        width: 100,
        height: 60,
        fillColor: '#E8F4FD'
      });

      expect(svg).toBeDefined();
      expect(svg.type).toBe('rect');
    });

    test('should render relationship diamond', () => {
      const svg = symbolLibrary.renderSymbol('relationship', 'chen', {
        width: 80,
        height: 80
      });

      expect(svg).toBeDefined();
      expect(svg.type).toBe('polygon');
    });

    test('should render attribute oval', () => {
      const svg = symbolLibrary.renderSymbol('attribute', 'chen', {
        width: 60,
        height: 40
      });

      expect(svg).toBeDefined();
      expect(svg.type).toBe('ellipse');
    });

    test('should get custom symbol', () => {
      symbolLibrary.registerCustomSymbol('custom-entity', {
        type: 'path',
        path: 'M0,0 L100,0 L100,60 L0,60 Z'
      });

      const custom = symbolLibrary.getCustomSymbol('custom-entity');
      expect(custom).toBeDefined();
      expect(custom.type).toBe('path');
    });
  });

  describe('ERExporter Tests', () => {
    let exporter;
    let sampleDiagram;

    beforeEach(() => {
      exporter = new ERExporter({
        sqlDialect: 'mysql',
        generateConstraints: true,
        generateIndexes: true
      });

      sampleDiagram = {
        title: 'Sample ER Diagram',
        entities: [
          {
            id: 'e1',
            name: 'Customer',
            attributes: [
              { name: 'customer_id', type: 'NUMBER', isPrimaryKey: true, isAutoIncrement: true },
              { name: 'email', type: 'TEXT', isRequired: true, isUnique: true },
              { name: 'created_at', type: 'DATETIME', defaultValue: 'NOW()' }
            ]
          },
          {
            id: 'e2',
            name: 'Order',
            attributes: [
              { name: 'order_id', type: 'NUMBER', isPrimaryKey: true },
              { name: 'customer_id', type: 'NUMBER', isForeignKey: true, referencedEntity: 'Customer' },
              { name: 'total', type: 'DECIMAL' }
            ]
          }
        ],
        relationships: [
          {
            id: 'r1',
            source: 'e1',
            target: 'e2',
            type: 'one-to-many',
            cardinality: { source: '1', target: '*' }
          }
        ]
      };
    });

    test('should export to SQL DDL', () => {
      const sql = exporter.exportToSQL(sampleDiagram);

      expect(sql).toContain('CREATE TABLE');
      expect(sql).toContain('customer');
      expect(sql).toContain('order');
      expect(sql).toContain('PRIMARY KEY');
      expect(sql).toContain('FOREIGN KEY');
      expect(sql).toContain('AUTO_INCREMENT');
    });

    test('should export to PostgreSQL dialect', () => {
      exporter.config.sqlDialect = 'postgresql';
      
      const sql = exporter.exportToSQL(sampleDiagram);

      expect(sql).toContain('SERIAL');
      expect(sql).toContain('TIMESTAMP');
      expect(sql).toContain('"'); // PostgreSQL quote character
    });

    test('should export to JSON Schema', () => {
      const jsonSchema = exporter.exportToJSONSchema(sampleDiagram);
      const parsed = JSON.parse(jsonSchema);

      expect(parsed.$schema).toBeDefined();
      expect(parsed.definitions).toBeDefined();
      expect(parsed.definitions.Customer).toBeDefined();
      expect(parsed.definitions.Order).toBeDefined();
      expect(parsed.definitions.Customer.properties.customer_id).toBeDefined();
      expect(parsed.definitions.Customer.required).toContain('email');
    });

    test('should export to PlantUML', () => {
      const plantuml = exporter.exportToPlantUML(sampleDiagram);

      expect(plantuml).toContain('@startuml');
      expect(plantuml).toContain('@enduml');
      expect(plantuml).toContain('entity "Customer"');
      expect(plantuml).toContain('entity "Order"');
      expect(plantuml).toContain('*customer_id');
      expect(plantuml).toContain('+customer_id');
    });

    test('should export to Crow\'s Foot notation', () => {
      const crowsfoot = exporter.exportToCrowsFoot(sampleDiagram);

      expect(crowsfoot).toContain('ENTITY Customer');
      expect(crowsfoot).toContain('ENTITY Order');
      expect(crowsfoot).toContain('PK customer_id');
      expect(crowsfoot).toContain('FK customer_id');
      expect(crowsfoot).toContain('||--|{');
    });

    test('should export to Markdown documentation', () => {
      const markdown = exporter.exportToMarkdown(sampleDiagram);

      expect(markdown).toContain('# Sample ER Diagram');
      expect(markdown).toContain('## Entities');
      expect(markdown).toContain('### Customer');
      expect(markdown).toContain('### Order');
      expect(markdown).toContain('| Attribute | Type | Constraints | Description |');
      expect(markdown).toContain('## Relationships');
    });

    test('should generate migration scripts', () => {
      const migration = exporter.exportToMigration(sampleDiagram, {
        name: 'initial_schema',
        framework: 'generic'
      });

      expect(migration).toContain('-- UP');
      expect(migration).toContain('-- DOWN');
      expect(migration).toContain('CREATE TABLE');
      expect(migration).toContain('DROP TABLE');
    });

    test('should validate diagram before export', () => {
      const invalidDiagram = {
        entities: []
      };

      expect(() => exporter.exportToSQL(invalidDiagram))
        .toThrow('Diagram must contain at least one entity');
    });

    test('should handle naming conventions', () => {
      exporter.config.sqlNamingConvention = 'snake_case';
      
      const entity = {
        entities: [{
          name: 'CustomerOrder',
          attributes: [{ name: 'orderId', isPrimaryKey: true }]
        }]
      };

      const sql = exporter.exportToSQL(entity);
      expect(sql).toContain('customer_order');
      expect(sql).toContain('order_id');
    });

    test('should get supported export formats', () => {
      const formats = exporter.getSupportedFormats();

      expect(formats).toContainEqual(expect.objectContaining({ format: 'sql' }));
      expect(formats).toContainEqual(expect.objectContaining({ format: 'jsonschema' }));
      expect(formats).toContainEqual(expect.objectContaining({ format: 'plantuml' }));
      expect(formats).toContainEqual(expect.objectContaining({ format: 'markdown' }));
    });
  });

  describe('Integration Tests', () => {
    test('should create complete ER diagram workflow', async () => {
      // Create entities
      const customer = new EntityNode({ name: 'Customer', type: 'strong' });
      customer.addAttribute({ name: 'customer_id', isPrimaryKey: true });
      customer.addAttribute({ name: 'name', isRequired: true });

      const order = new EntityNode({ name: 'Order', type: 'strong' });
      order.addAttribute({ name: 'order_id', isPrimaryKey: true });
      order.addAttribute({ name: 'customer_id', isForeignKey: true });

      const orderItem = new EntityNode({ name: 'OrderItem', type: 'weak' });
      orderItem.addAttribute({ name: 'item_number', isPartialKey: true });
      orderItem.addAttribute({ name: 'quantity' });

      // Create relationships
      const places = new RelationshipEdge({
        name: 'places',
        sourceEntity: 'Customer',
        targetEntity: 'Order',
        type: 'one-to-many'
      });

      const contains = new RelationshipEdge({
        name: 'contains',
        sourceEntity: 'Order',
        targetEntity: 'OrderItem',
        isIdentifying: true
      });

      // Validate diagram
      const validationEngine = new ERValidationEngine();
      const diagram = {
        entities: [customer.toJSON(), order.toJSON(), orderItem.toJSON()],
        relationships: [places, contains]
      };

      const validationResult = await validationEngine.validateDiagram(diagram);
      expect(validationResult.isValid).toBe(true);

      // Apply layout
      const layout = new ERLayout();
      const nodes = [
        { id: 'e1', type: 'entity', ...customer.toJSON() },
        { id: 'e2', type: 'entity', ...order.toJSON() },
        { id: 'e3', type: 'weak-entity', ...orderItem.toJSON() }
      ];
      const edges = [
        { type: 'participates', source: 'e1', target: 'e2' },
        { type: 'identifying', source: 'e2', target: 'e3' }
      ];

      const layoutResult = await layout.execute(nodes, edges);
      expect(layoutResult.positions.size).toBeGreaterThan(0);

      // Export to SQL
      const exporter = new ERExporter();
      const sql = exporter.exportToSQL(diagram);
      expect(sql).toContain('CREATE TABLE');

      // Export to JSON Schema
      const jsonSchema = exporter.exportToJSONSchema(diagram);
      expect(jsonSchema).toBeDefined();
    });

    test('should handle complex inheritance hierarchy', async () => {
      // Create parent entity
      const vehicle = new EntityNode({ name: 'Vehicle' });
      vehicle.addAttribute({ name: 'vehicle_id', isPrimaryKey: true });
      vehicle.addAttribute({ name: 'manufacturer' });

      // Create child entities
      const car = new EntityNode({ name: 'Car' });
      car.addAttribute({ name: 'num_doors' });

      const truck = new EntityNode({ name: 'Truck' });
      truck.addAttribute({ name: 'cargo_capacity' });

      // Create inheritance relationship
      const inheritance = new InheritanceRelationship();
      const hierarchy = inheritance.createISA({
        parent: 'Vehicle',
        children: ['Car', 'Truck'],
        disjointness: 'disjoint',
        completeness: 'partial'
      });

      // Validate inheritance
      expect(inheritance.validateDisjointness(hierarchy)).toBe(true);
      expect(inheritance.validateCompleteness(hierarchy)).toBe(true);

      // Apply specialized layout
      const layout = new ERLayout({
        inheritanceDirection: 'vertical',
        inheritanceAlignment: 'tree'
      });

      const nodes = [
        { id: 'v1', type: 'entity', name: 'Vehicle' },
        { id: 'c1', type: 'entity', name: 'Car' },
        { id: 't1', type: 'entity', name: 'Truck' }
      ];
      const edges = [
        { type: 'inheritance', source: 'v1', target: 'c1' },
        { type: 'inheritance', source: 'v1', target: 't1' }
      ];

      const result = await layout.execute(nodes, edges);
      expect(result.metadata.inheritanceCount).toBe(2);
    });

    test('should export complex diagram with all features', async () => {
      const complexDiagram = {
        title: 'University Database',
        entities: [
          {
            name: 'Person',
            attributes: [
              { name: 'person_id', isPrimaryKey: true },
              { name: 'name' },
              { name: 'age', isDerived: true }
            ]
          },
          {
            name: 'Student',
            parent: 'Person',
            attributes: [
              { name: 'student_number', isUnique: true },
              { name: 'gpa', type: 'DECIMAL' }
            ]
          },
          {
            name: 'Course',
            attributes: [
              { name: 'course_code', isPrimaryKey: true },
              { name: 'title' },
              { name: 'credits' }
            ]
          },
          {
            name: 'Enrollment',
            type: 'associative',
            attributes: [
              { name: 'grade' },
              { name: 'semester' }
            ]
          }
        ],
        relationships: [
          {
            name: 'enrolled_in',
            source: 'Student',
            target: 'Course',
            type: 'many-to-many',
            through: 'Enrollment'
          }
        ],
        inheritances: [
          {
            parentId: 'Person',
            childId: 'Student',
            disjointness: 'overlapping',
            completeness: 'partial'
          }
        ]
      };

      const exporter = new ERExporter();
      
      // Test all export formats
      const sql = exporter.exportToSQL(complexDiagram);
      expect(sql).toContain('CREATE TABLE');

      const plantuml = exporter.exportToPlantUML(complexDiagram);
      expect(plantuml).toContain('@startuml');

      const markdown = exporter.exportToMarkdown(complexDiagram);
      expect(markdown).toContain('## Inheritance Hierarchies');
    });
  });

  describe('Performance Tests', () => {
    test('should handle large diagrams efficiently', async () => {
      const startTime = performance.now();
      
      // Create large diagram
      const entities = [];
      const relationships = [];
      
      for (let i = 0; i < 100; i++) {
        entities.push({
          id: `e${i}`,
          type: 'entity',
          name: `Entity${i}`,
          attributes: [
            { name: `id${i}`, isPrimaryKey: true },
            { name: `field${i}` }
          ]
        });
      }

      for (let i = 0; i < 50; i++) {
        relationships.push({
          id: `r${i}`,
          type: 'relationship',
          source: `e${i}`,
          target: `e${i + 50}`,
          cardinality: { source: '1', target: '*' }
        });
      }

      // Apply layout
      const layout = new ERLayout();
      const result = await layout.execute(entities, relationships);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result.positions.size).toBe(100);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should export large diagrams efficiently', () => {
      const startTime = performance.now();
      
      const largeDiagram = {
        entities: []
      };

      for (let i = 0; i < 50; i++) {
        largeDiagram.entities.push({
          name: `Table${i}`,
          attributes: Array.from({ length: 10 }, (_, j) => ({
            name: `col${j}`,
            type: 'VARCHAR',
            isPrimaryKey: j === 0
          }))
        });
      }

      const exporter = new ERExporter();
      const sql = exporter.exportToSQL(largeDiagram);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(sql).toBeDefined();
      expect(sql.split('CREATE TABLE').length - 1).toBe(50);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});