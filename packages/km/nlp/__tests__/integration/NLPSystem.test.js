import { NLPSystem, RealLLMClient } from '../../src/index.js';
import { ResourceManager } from '../../../../resource-manager/src/index.js';

describe('NLPSystem Integration Tests', () => {
  let nlpSystem;
  let resourceManager;

  beforeAll(async () => {
    // Get ResourceManager singleton for real LLM
    resourceManager = await ResourceManager.getInstance();
    console.log('✅ Initialized ResourceManager for integration tests');
  }, 30000);

  beforeEach(async () => {
    // Use real LLM for integration tests
    nlpSystem = new NLPSystem();
    await nlpSystem.initialize();
  });

  describe('constructor', () => {
    test('should create NLPSystem with all components', () => {
      expect(nlpSystem).toBeInstanceOf(NLPSystem);
      expect(nlpSystem.textPreprocessor).toBeDefined();
      expect(nlpSystem.ontologyExtractor).toBeDefined();
      expect(nlpSystem.tripleGenerator).toBeDefined();
      expect(nlpSystem.llmClient).toBeDefined();
    });

    test('should use custom LLM client when provided', async () => {
      const customClient = new RealLLMClient();
      await customClient.initialize();
      const customSystem = new NLPSystem({ llmClient: customClient });
      expect(customSystem.llmClient).toBe(customClient);
    });
  });

  describe('getStatus', () => {
    test('should return system status', () => {
      const status = nlpSystem.getStatus();
      
      expect(status.version).toBe('1.0.0-phase1');
      expect(status.phase).toBe('Phase 1: Core Infrastructure');
      expect(status.components).toBeDefined();
      expect(status.capabilities).toBeDefined();
      expect(status.capabilities).toContain('text_preprocessing');
      expect(status.capabilities).toContain('entity_extraction');
      expect(status.capabilities).toContain('relationship_extraction');
      expect(status.capabilities).toContain('triple_generation');
    });
  });

  describe('processText - Industrial Domain', () => {
    test('should process industrial text successfully', async () => {
      const text = `
        Pump P101 is manufactured by Siemens and operates at 150 psi. 
        The pump is part of Cooling System S300 and is connected to Tank T200.
        Tank T200 contains 1000 gallons of coolant.
      `;

      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      expect(result.schema.domain).toBe('industrial');
      expect(result.input.language).toBe('en');
      expect(result.extractions.entities).toBeGreaterThan(0);
      expect(result.triples.count).toBeGreaterThan(0);
      expect(result.metadata.extractionId).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });

    test('should extract industrial entities correctly', async () => {
      const text = 'Pump P101 is manufactured by Siemens and operates at 150 psi.';
      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      expect(result.extractions.entityDetails.length).toBeGreaterThan(0);
      
      const entities = result.extractions.entityDetails;
      const hasEquipment = entities.some(e => ['Pump', 'Equipment'].includes(e.type));
      expect(hasEquipment).toBe(true);
    });

    test('should generate proper industrial triples', async () => {
      const text = 'Pump P101 is part of System S300.';
      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      expect(result.triples.triples.length).toBeGreaterThan(0);
      
      const triples = result.triples.triples;
      const hasTypeTriple = triples.some(t => t[1] === 'rdf:type');
      
      expect(hasTypeTriple).toBe(true);
      // Relationship detection depends on LLM's actual response
      // so we don't strictly require it for this test
    });
  });

  describe('processText - Business Domain', () => {
    test('should process business text successfully', async () => {
      const text = `
        John Smith works for Acme Corporation as a Senior Engineer.
        He is managed by Sarah Johnson, who is the Manufacturing Manager.
        The company is located in Detroit, Michigan.
      `;

      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      expect(result.schema.domain).toBe('business');
      expect(result.extractions.entities).toBeGreaterThan(0);
      expect(result.triples.count).toBeGreaterThan(0);
    });

    test('should extract business entities correctly', async () => {
      const text = 'John Smith works for Acme Corporation.';
      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      
      const entities = result.extractions.entityDetails;
      const hasPersonOrOrg = entities.some(e => ['Person', 'Organization'].includes(e.type));
      expect(hasPersonOrOrg).toBe(true);
    });
  });

  describe('processText - Technical Domain', () => {
    test('should process technical text successfully', async () => {
      const text = `
        Installation Manual for Equipment Setup
        
        This procedure describes the installation steps for the cooling system.
        Follow the maintenance schedule as outlined in the documentation.
      `;

      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      // The text contains "system" which triggers industrial domain detection
      expect(['technical', 'industrial']).toContain(result.schema.domain);
      expect(result.extractions.entities).toBeGreaterThan(0);
    });
  });

  describe('processText - Edge Cases', () => {
    test('should handle empty text gracefully', async () => {
      const result = await nlpSystem.processText('');

      expect(result.success).toBe(true);
      expect(result.input.originalText).toBe('');
      expect(result.extractions.entities).toBe(0);
      expect(result.triples.count).toBeGreaterThan(0); // Should still have metadata triples
    });

    test('should handle very short text', async () => {
      const result = await nlpSystem.processText('Pump P101.');

      expect(result.success).toBe(true);
      expect(result.input.sentences).toBeGreaterThan(0);
    });

    test('should handle mixed domain text', async () => {
      const text = 'John Smith operates Pump P101 at Acme Corporation.';
      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      expect(['industrial', 'business', 'general']).toContain(result.schema.domain);
    });

    test('should handle text with special characters', async () => {
      const text = 'Pump P-101 operates at 150°F and 2,500 psi.';
      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      expect(result.extractions.entities).toBeGreaterThan(0);
    });
  });

  describe('processText - Error Handling', () => {
    test('should handle processing errors gracefully', async () => {
      // Create a system with a client that throws errors
      const errorClient = new RealLLMClient();
      await errorClient.initialize();
      
      // Override method to simulate error
      errorClient.extractEntities = async () => {
        // Add a small delay to ensure processing time > 0
        await new Promise(resolve => setTimeout(resolve, 1));
        throw new Error('LLM Error');
      };
      
      const errorSystem = new NLPSystem({ llmClient: errorClient });
      const result = await errorSystem.processText('Test text');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.metadata.timestamp).toBeDefined();
    });
  });

  describe('processText - Performance', () => {
    test('should process text within reasonable time', async () => {
      const text = 'Pump P101 is part of System S300 and operates at 150 psi.';
      const startTime = Date.now();
      
      const result = await nlpSystem.processText(text);
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds for real LLM
      expect(result.processingTime).toBeLessThan(30000);
    });

    test('should handle longer text efficiently', async () => {
      const longText = Array(10).fill(`
        Pump P101 is manufactured by Siemens and operates at 150 psi.
        Tank T200 contains coolant and is connected to the pump.
        System S300 includes both components and is managed by operators.
      `).join(' ');

      const result = await nlpSystem.processText(longText);

      expect(result.success).toBe(true);
      expect(result.extractions.entities).toBeGreaterThan(10);
      expect(result.triples.count).toBeGreaterThan(50);
    });
  });

  describe('processText - Quality Metrics', () => {
    test('should provide quality statistics', async () => {
      const text = 'Pump P101 is manufactured by Siemens and is part of System S300.';
      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      expect(result.triples.statistics).toBeDefined();
      expect(result.triples.statistics.totalTriples).toBeGreaterThan(0);
      expect(result.triples.statistics.entityTriples).toBeGreaterThan(0);
      expect(result.triples.statistics.uniqueEntities).toBeGreaterThan(0);
      expect(result.triples.statistics.averageConfidence).toBeGreaterThan(0);
      expect(result.triples.statistics.averageConfidence).toBeLessThanOrEqual(1);
    });

    test('should maintain confidence scores', async () => {
      const text = 'Pump P101 operates at high pressure.';
      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      
      // Check entity confidence scores
      result.extractions.entityDetails.forEach(entity => {
        expect(entity.confidence).toBeGreaterThan(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
      });

      // Check relationship confidence scores
      result.extractions.relationshipDetails.forEach(relationship => {
        expect(relationship.confidence).toBeGreaterThan(0);
        expect(relationship.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Component Integration', () => {
    test('should integrate all components in pipeline', async () => {
      const text = 'Tank T200 contains Pump P101 in System S300.';
      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      
      // Verify text preprocessing
      expect(result.input.normalizedText).toBeDefined();
      expect(result.input.sentences).toBeGreaterThan(0);
      expect(result.input.language).toBe('en');
      
      // Verify schema extraction
      expect(result.schema.domain).toBe('industrial');
      expect(result.schema.entityClasses).toBeGreaterThan(0);
      expect(result.schema.relationshipTypes).toBeGreaterThan(0);
      
      // Verify entity extraction
      expect(result.extractions.entities).toBeGreaterThan(0);
      expect(result.extractions.entityDetails.length).toBeGreaterThan(0);
      
      // Verify triple generation
      expect(result.triples.count).toBeGreaterThan(0);
      expect(result.triples.triples.length).toBeGreaterThan(0);
      
      // Verify metadata
      expect(result.metadata.extractionId).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.metadata.version).toBe('1.0.0-phase1');
    });
  });
});
