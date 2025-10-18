/**
 * Integration tests for Semantic Inventory Service
 *
 * Tests REAL semantic inventory service integration.
 * NO MOCKS - Uses production Qdrant with 189K indexed vectors.
 */
import { ResourceManager } from '@legion/resource-manager';
import { SemanticInventoryService } from '@legion/semantic-inventory';

describe('Semantic Inventory Integration', () => {
  let resourceManager;
  let semanticInventory;

  beforeAll(async () => {
    // Get singleton ResourceManager (no timeout)
    resourceManager = await ResourceManager.getInstance();

    // Initialize REAL semantic inventory service
    semanticInventory = new SemanticInventoryService(resourceManager);
    await semanticInventory.initialize();
  }, 30000);

  describe('semanticSearchEntityTypes', () => {
    test('should return entity types for person-related text', async () => {
      const text = 'student teacher professor';
      const entityTypes = await semanticInventory.semanticSearchEntityTypes(text, {
        limit: 10
      });

      // Verify it returns an array of strings
      expect(Array.isArray(entityTypes)).toBe(true);
      expect(entityTypes.length).toBeGreaterThan(0);
      expect(entityTypes.length).toBeLessThanOrEqual(10);

      // All results should be strings
      entityTypes.forEach(type => {
        expect(typeof type).toBe('string');
      });

      // Should contain person-related types
      const hasPersonType = entityTypes.some(type =>
        type.toUpperCase().includes('PERSON')
      );
      expect(hasPersonType).toBe(true);
    }, 10000);

    test('should return entity types for location-related text', async () => {
      const text = 'city country building house';
      const entityTypes = await semanticInventory.semanticSearchEntityTypes(text, {
        limit: 10
      });

      expect(Array.isArray(entityTypes)).toBe(true);
      expect(entityTypes.length).toBeGreaterThan(0);

      // Should contain location-related types
      const hasLocationType = entityTypes.some(type =>
        type.toUpperCase().includes('LOCATION') ||
        type.toUpperCase().includes('PLACE')
      );
      expect(hasLocationType).toBe(true);
    }, 10000);

    test('should handle diverse entity types', async () => {
      const text = 'book car event organization';
      const entityTypes = await semanticInventory.semanticSearchEntityTypes(text, {
        limit: 20
      });

      expect(Array.isArray(entityTypes)).toBe(true);
      expect(entityTypes.length).toBeGreaterThan(0);
      expect(entityTypes.length).toBeLessThanOrEqual(20);
    }, 10000);
  });

  describe('semanticSearchRelationTypes', () => {
    test('should return RelationInventory for action-related text', async () => {
      const text = 'read write think perform';
      const inventory = await semanticInventory.semanticSearchRelationTypes(text, {
        rolesLimit: 10,
        predicatesLimit: 10,
        relationsLimit: 10
      });

      // Verify structure matches RelationInventory
      expect(inventory).toHaveProperty('roles');
      expect(inventory).toHaveProperty('unaryPredicates');
      expect(inventory).toHaveProperty('binaryRelations');

      // Verify all are arrays
      expect(Array.isArray(inventory.roles)).toBe(true);
      expect(Array.isArray(inventory.unaryPredicates)).toBe(true);
      expect(Array.isArray(inventory.binaryRelations)).toBe(true);

      // Verify all contain synset objects
      inventory.roles.forEach(role => {
        expect(typeof role).toBe('object');
        expect(role.label).toBeDefined();
      });
      inventory.unaryPredicates.forEach(pred => {
        expect(typeof pred).toBe('object');
        expect(Array.isArray(pred.synonyms)).toBe(true);
      });
      inventory.binaryRelations.forEach(rel => {
        expect(typeof rel).toBe('object');
        expect(Array.isArray(rel.synonyms)).toBe(true);
      });

      // Roles should include semantic roles (check .label field)
      const hasAgent = inventory.roles.some(role => role.label === 'Agent');
      const hasTheme = inventory.roles.some(role => role.label === 'Theme');
      expect(hasAgent || hasTheme).toBe(true);
    }, 10000);

    test('should return predicates for property text', async () => {
      const text = 'heavy tall blue intelligent';
      const inventory = await semanticInventory.semanticSearchRelationTypes(text, {
        rolesLimit: 5,
        predicatesLimit: 15,
        relationsLimit: 5
      });

      expect(inventory.unaryPredicates.length).toBeGreaterThan(0);
      expect(inventory.unaryPredicates.length).toBeLessThanOrEqual(15);
    }, 10000);

    test('should return binary relations for spatial/temporal text', async () => {
      const text = 'before after in on above below';
      const inventory = await semanticInventory.semanticSearchRelationTypes(text, {
        rolesLimit: 5,
        predicatesLimit: 5,
        relationsLimit: 15
      });

      expect(inventory.binaryRelations.length).toBeGreaterThan(0);
      expect(inventory.binaryRelations.length).toBeLessThanOrEqual(15);
    }, 10000);
  });

  describe('data validation', () => {
    test('entity types should be reasonable uppercase categories', async () => {
      const text = 'person book location organization event';
      const entityTypes = await semanticInventory.semanticSearchEntityTypes(text, {
        limit: 20
      });

      // Common expected entity types (partial list)
      const reasonableTypes = [
        'PERSON', 'LOCATION', 'ORGANIZATION', 'THING', 'EVENT',
        'PLACE', 'OBJECT', 'ENTITY', 'ARTIFACT', 'SUBSTANCE'
      ];

      // At least some should match known types
      const hasReasonableType = entityTypes.some(type =>
        reasonableTypes.some(reasonable =>
          type.toUpperCase().includes(reasonable)
        )
      );
      expect(hasReasonableType).toBe(true);
    }, 10000);

    test('roles should include standard semantic roles', async () => {
      const text = 'agent theme patient recipient experiencer instrument';
      const inventory = await semanticInventory.semanticSearchRelationTypes(text, {
        rolesLimit: 15,
        predicatesLimit: 5,
        relationsLimit: 5
      });

      // Standard VerbNet roles
      const standardRoles = [
        'Agent', 'Theme', 'Patient', 'Recipient', 'Experiencer',
        'Instrument', 'Location', 'Source', 'Goal', 'Time'
      ];

      // At least some should match standard roles (check .label field)
      const hasStandardRole = inventory.roles.some(role =>
        standardRoles.includes(role.label)
      );
      expect(hasStandardRole).toBe(true);
    }, 10000);

    test('predicates should be lowercase words', async () => {
      const text = 'student book heavy intelligent';
      const inventory = await semanticInventory.semanticSearchRelationTypes(text, {
        rolesLimit: 5,
        predicatesLimit: 20,
        relationsLimit: 5
      });

      // Predicates should be lowercase (check .synonyms array)
      inventory.unaryPredicates.forEach(pred => {
        pred.synonyms.forEach(syn => {
          expect(syn).toBe(syn.toLowerCase());
        });
      });
    }, 10000);

    test('binary relations should be reasonable spatial/temporal/causal terms', async () => {
      const text = 'before after in on spatially temporally';
      const inventory = await semanticInventory.semanticSearchRelationTypes(text, {
        rolesLimit: 5,
        predicatesLimit: 5,
        relationsLimit: 20
      });

      // Common relation patterns
      const commonRelations = [
        'in', 'on', 'before', 'after', 'above', 'below',
        'near', 'far', 'inside', 'outside', 'during', 'while'
      ];

      // At least some should match common relations (check .synonyms array)
      const hasCommonRelation = inventory.binaryRelations.some(rel =>
        rel.synonyms && rel.synonyms.some(syn => commonRelations.includes(syn))
      );
      expect(hasCommonRelation).toBe(true);
    }, 10000);
  });
});
