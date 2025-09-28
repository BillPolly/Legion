import { OntologyExtractor } from '../../../src/ontology-pipeline/OntologyExtractor.js';

describe('OntologyExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new OntologyExtractor(null);
  });

  describe('constructor', () => {
    test('should create instance with data source', () => {
      expect(extractor).toBeInstanceOf(OntologyExtractor);
      expect(extractor.dataSource).toBeNull();
      expect(extractor.cache).toBeInstanceOf(Map);
    });
  });

  describe('detectDomain', () => {
    test('should detect industrial domain', () => {
      const text = 'Pump P101 operates at 150 psi and is connected to Tank T200.';
      const domain = extractor.detectDomain(text);
      expect(domain).toBe('industrial');
    });

    test('should detect business domain', () => {
      const text = 'John Smith works for Acme Corporation as a manager.';
      const domain = extractor.detectDomain(text);
      expect(domain).toBe('business');
    });

    test('should detect technical domain', () => {
      const text = 'This manual describes the installation procedure for the equipment.';
      const domain = extractor.detectDomain(text);
      expect(domain).toBe('technical');
    });

    test('should default to general domain', () => {
      const text = 'This is some random text without specific keywords.';
      const domain = extractor.detectDomain(text);
      expect(domain).toBe('general');
    });
  });

  describe('extractRelevantSchema', () => {
    test('should extract schema for industrial text', async () => {
      const text = 'Pump P101 is part of System S300.';
      const schema = await extractor.extractRelevantSchema(text);
      
      expect(schema.domain).toBe('industrial');
      expect(schema.entityClasses).toBeDefined();
      expect(schema.relationshipTypes).toBeDefined();
      expect(schema.properties).toBeDefined();
      expect(schema.examples).toBeDefined();
    });

    test('should extract schema for business text', async () => {
      const text = 'John Smith works for Acme Corporation.';
      const schema = await extractor.extractRelevantSchema(text);
      
      expect(schema.domain).toBe('business');
      expect(schema.entityClasses.length).toBeGreaterThan(0);
      expect(schema.relationshipTypes.length).toBeGreaterThan(0);
    });

    test('should handle empty text', async () => {
      const schema = await extractor.extractRelevantSchema('');
      expect(schema.domain).toBe('general');
    });
  });

  describe('getEntityClasses', () => {
    test('should return industrial entity classes', () => {
      const classes = extractor.getEntityClasses('industrial');
      
      expect(classes).toContainEqual(
        expect.objectContaining({
          name: 'Pump',
          uid: 'pump',
          description: 'Pumping equipment'
        })
      );
      
      expect(classes).toContainEqual(
        expect.objectContaining({
          name: 'Tank',
          uid: 'tank',
          description: 'Storage tanks and vessels'
        })
      );
    });

    test('should return business entity classes', () => {
      const classes = extractor.getEntityClasses('business');
      
      expect(classes).toContainEqual(
        expect.objectContaining({
          name: 'Person',
          uid: 'person',
          description: 'People and employees'
        })
      );
      
      expect(classes).toContainEqual(
        expect.objectContaining({
          name: 'Organization',
          uid: 'organization',
          description: 'Companies and organizations'
        })
      );
    });
  });

  describe('getRelationshipTypes', () => {
    test('should return base relationships for all domains', () => {
      const relationships = extractor.getRelationshipTypes('general');
      
      expect(relationships).toContainEqual(
        expect.objectContaining({
          name: 'is_part_of',
          uid: 'gellish:1230',
          description: 'Entity is part of another entity'
        })
      );
    });

    test('should return industrial-specific relationships', () => {
      const relationships = extractor.getRelationshipTypes('industrial');
      
      expect(relationships).toContainEqual(
        expect.objectContaining({
          name: 'manufactured_by',
          uid: 'manufactured_by',
          description: 'Equipment is manufactured by organization'
        })
      );
    });
  });

  describe('generateLLMSchema', () => {
    test('should generate LLM-friendly schema', async () => {
      const text = 'Pump P101 operates at 150 psi and is connected to Tank T200.';
      const schema = await extractor.extractRelevantSchema(text);
      const llmSchema = extractor.generateLLMSchema(schema);
      
      expect(llmSchema.entityTypes).toBeDefined();
      expect(llmSchema.relationshipTypes).toBeDefined();
      expect(llmSchema.constraints).toBeDefined();
      expect(llmSchema.domain).toBe('industrial');
      
      expect(llmSchema.entityTypes[0]).toHaveProperty('name');
      expect(llmSchema.entityTypes[0]).toHaveProperty('description');
      expect(llmSchema.entityTypes[0]).toHaveProperty('properties');
    });
  });

  describe('getFallbackSchema', () => {
    test('should return minimal fallback schema', () => {
      const schema = extractor.getFallbackSchema();
      
      expect(schema.domain).toBe('general');
      expect(schema.entityClasses).toHaveLength(1);
      expect(schema.relationshipTypes).toHaveLength(1);
      expect(schema.entityClasses[0].name).toBe('Entity');
    });
  });

  describe('clearCache', () => {
    test('should clear the cache', () => {
      extractor.cache.set('test', 'value');
      expect(extractor.cache.size).toBe(1);
      
      extractor.clearCache();
      expect(extractor.cache.size).toBe(0);
    });
  });
});
