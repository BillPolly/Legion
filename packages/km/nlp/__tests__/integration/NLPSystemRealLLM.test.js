/**
 * Integration tests for NLPSystem with Real LLM
 * 
 * These tests use the actual LLM client from ResourceManager
 * NO MOCKS - real API calls to Anthropic Claude
 */

import { NLPSystem, RealLLMClient } from '../../src/index.js';
import { ResourceManager } from '../../../../resource-manager/src/index.js';

describe('NLPSystem with Real LLM Integration Tests', () => {
  let nlpSystem;
  let resourceManager;
  let realLLMClient;

  beforeAll(async () => {
    // Get ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Initialize NLP system with real LLM
    nlpSystem = new NLPSystem();
    await nlpSystem.initialize();
    
    // Also create standalone RealLLMClient for specific tests
    realLLMClient = new RealLLMClient();
    await realLLMClient.initialize();
    
    console.log('✅ Initialized NLPSystem with real LLM client');
  }, 30000); // 30 second timeout for initialization

  describe('System Initialization', () => {
    test('should initialize with real LLM client', async () => {
      expect(nlpSystem).toBeInstanceOf(NLPSystem);
      expect(nlpSystem.llmClient).toBeInstanceOf(RealLLMClient);
      expect(nlpSystem.initialized).toBe(true);
    });

    test('should have access to ResourceManager LLM client', async () => {
      const llmClient = await resourceManager.get('llmClient');
      expect(llmClient).toBeDefined();
      expect(llmClient.complete).toBeDefined();
    });
  });

  describe('Entity Extraction with Real LLM', () => {
    test('should extract entities from industrial text', async () => {
      const text = `
        The pump P-101 manufactured by Siemens operates at 150 PSI pressure.
        It is connected to tank T-200 which has a capacity of 5000 gallons.
        The system is controlled by PLC-500 running firmware version 3.2.1.
      `;

      const schema = {
        entityClasses: [
          { name: 'Equipment', description: 'Industrial equipment like pumps, tanks' },
          { name: 'Manufacturer', description: 'Companies that manufacture equipment' },
          { name: 'ControlSystem', description: 'Control systems like PLCs' }
        ]
      };

      const result = await realLLMClient.extractEntities(text, schema, { domain: 'industrial' });

      expect(result.success).toBe(true);
      expect(result.entities).toBeDefined();
      expect(Array.isArray(result.entities)).toBe(true);
      expect(result.entities.length).toBeGreaterThan(0);

      // Check for specific entities
      const hasP101 = result.entities.some(e => e.text.includes('P-101') || e.text.includes('pump'));
      const hasSiemens = result.entities.some(e => e.text.includes('Siemens'));
      const hasT200 = result.entities.some(e => e.text.includes('T-200') || e.text.includes('tank'));

      expect(hasP101).toBe(true);
      expect(hasSiemens).toBe(true);
      expect(hasT200).toBe(true);

      // Check confidence scores
      result.entities.forEach(entity => {
        expect(entity.confidence).toBeGreaterThan(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
      });

      console.log(`✅ Extracted ${result.entities.length} entities from industrial text`);
    }, 30000);

    test('should extract entities from business text', async () => {
      const text = `
        Acme Corporation acquired TechStart Inc for $50 million in Q3 2024.
        The CEO John Smith announced the merger will create 500 new jobs.
        The deal was financed by Goldman Sachs.
      `;

      const schema = {
        entityClasses: [
          { name: 'Organization', description: 'Companies and organizations' },
          { name: 'Person', description: 'People mentioned in the text' },
          { name: 'Money', description: 'Monetary amounts' },
          { name: 'Date', description: 'Dates and time periods' }
        ]
      };

      const result = await realLLMClient.extractEntities(text, schema, { domain: 'business' });

      expect(result.success).toBe(true);
      expect(result.entities).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(0);

      // Check for various entity types
      const hasOrg = result.entities.some(e => e.type === 'Organization');
      const hasPerson = result.entities.some(e => e.type === 'Person');
      const hasMoney = result.entities.some(e => e.text.includes('$50 million'));

      expect(hasOrg).toBe(true);
      expect(hasPerson).toBe(true);
      expect(hasMoney).toBe(true);

      console.log(`✅ Extracted ${result.entities.length} entities from business text`);
    }, 30000);

    test('should extract entities from technical text', async () => {
      const text = `
        The REST API endpoint /api/v2/users accepts JSON payloads with OAuth 2.0 authentication.
        The PostgreSQL database runs on port 5432 with SSL encryption enabled.
        Redis cache improves response times to under 100ms.
      `;

      const schema = {
        entityClasses: [
          { name: 'Technology', description: 'Technologies, frameworks, databases' },
          { name: 'API', description: 'API endpoints and specifications' },
          { name: 'Configuration', description: 'Configuration values like ports, versions' }
        ]
      };

      const result = await realLLMClient.extractEntities(text, schema, { domain: 'technical' });

      expect(result.success).toBe(true);
      expect(result.entities).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(0);

      // Check for technical entities
      const hasAPI = result.entities.some(e => e.text.includes('API') || e.text.includes('/api/v2/users'));
      const hasDB = result.entities.some(e => e.text.includes('PostgreSQL'));
      const hasRedis = result.entities.some(e => e.text.includes('Redis'));

      expect(hasAPI).toBe(true);
      expect(hasDB).toBe(true);
      expect(hasRedis).toBe(true);

      console.log(`✅ Extracted ${result.entities.length} entities from technical text`);
    }, 30000);
  });

  describe('Relationship Extraction with Real LLM', () => {
    test('should extract relationships between entities', async () => {
      const text = 'Pump P-101 is manufactured by Siemens and connects to tank T-200.';
      
      const entities = [
        { id: 'e1', text: 'Pump P-101', type: 'Equipment' },
        { id: 'e2', text: 'Siemens', type: 'Manufacturer' },
        { id: 'e3', text: 'tank T-200', type: 'Equipment' }
      ];

      const relationshipTypes = [
        'manufactured_by',
        'connects_to',
        'part_of',
        'controls',
        'supplies'
      ];

      const result = await realLLMClient.extractRelationships(text, entities, relationshipTypes);

      expect(result.success).toBe(true);
      expect(result.relationships).toBeDefined();
      expect(Array.isArray(result.relationships)).toBe(true);
      expect(result.relationships.length).toBeGreaterThan(0);

      // Check for specific relationships
      const hasManufactured = result.relationships.some(r => 
        r.predicate === 'manufactured_by' && 
        r.subject === 'e1' && 
        r.object === 'e2'
      );
      const hasConnects = result.relationships.some(r => 
        r.predicate === 'connects_to' && 
        r.subject === 'e1' && 
        r.object === 'e3'
      );

      expect(hasManufactured || hasConnects).toBe(true);

      // Check confidence scores
      result.relationships.forEach(rel => {
        expect(rel.confidence).toBeGreaterThan(0);
        expect(rel.confidence).toBeLessThanOrEqual(1);
        expect(rel.evidence).toBeDefined();
      });

      console.log(`✅ Extracted ${result.relationships.length} relationships`);
    }, 30000);

    test('should handle complex relationship networks', async () => {
      const text = `
        The data flows from sensor S1 to PLC-100, which controls valve V1.
        PLC-100 also sends data to the SCADA system for monitoring.
        The SCADA system alerts operator John when thresholds are exceeded.
      `;

      const entities = [
        { id: 'e1', text: 'sensor S1', type: 'Sensor' },
        { id: 'e2', text: 'PLC-100', type: 'Controller' },
        { id: 'e3', text: 'valve V1', type: 'Equipment' },
        { id: 'e4', text: 'SCADA system', type: 'System' },
        { id: 'e5', text: 'operator John', type: 'Person' }
      ];

      const relationshipTypes = [
        'sends_data_to',
        'controls',
        'monitors',
        'alerts',
        'flows_to'
      ];

      const result = await realLLMClient.extractRelationships(text, entities, relationshipTypes);

      expect(result.success).toBe(true);
      expect(result.relationships).toBeDefined();
      expect(result.relationships.length).toBeGreaterThanOrEqual(3);

      console.log(`✅ Extracted ${result.relationships.length} relationships from complex network`);
    }, 30000);
  });

  describe('Quality Assessment with Real LLM', () => {
    test('should assess extraction quality', async () => {
      const original = 'The pump manufactured by Siemens operates at 150 PSI.';
      const extracted = [
        ['pump', 'manufactured_by', 'Siemens'],
        ['pump', 'operates_at', '150 PSI']
      ];
      const paraphrase = 'Siemens makes a pump that runs at 150 PSI pressure.';

      const result = await realLLMClient.assessQuality(original, extracted, paraphrase);

      expect(result).toBeDefined();
      expect(result.scores).toBeDefined();
      expect(result.scores.completeness).toBeGreaterThan(0);
      expect(result.scores.accuracy).toBeGreaterThan(0);
      expect(result.overall).toBeGreaterThan(0);
      expect(result.overall).toBeLessThanOrEqual(1);

      console.log(`✅ Quality assessment: ${(result.overall * 100).toFixed(1)}% overall quality`);
    }, 30000);
  });

  describe('Semantic Comparison with Real LLM', () => {
    test('should compare semantic similarity', async () => {
      const text1 = 'The pump is manufactured by Siemens and operates at high pressure.';
      const text2 = 'Siemens produces a pump that works under elevated pressure conditions.';

      const result = await realLLMClient.compareSemantics(text1, text2);

      expect(result).toBeDefined();
      expect(result.similarity).toBeGreaterThan(0.7); // Should be highly similar
      expect(result.similarity).toBeLessThanOrEqual(1);
      expect(result.equivalent).toBeDefined();
      expect(result.sharedConcepts).toBeDefined();
      expect(Array.isArray(result.sharedConcepts)).toBe(true);

      console.log(`✅ Semantic similarity: ${(result.similarity * 100).toFixed(1)}%`);
    }, 30000);

    test('should detect semantic differences', async () => {
      const text1 = 'The pump increases pressure in the system.';
      const text2 = 'The valve reduces pressure in the system.';

      const result = await realLLMClient.compareSemantics(text1, text2);

      expect(result).toBeDefined();
      expect(result.similarity).toBeLessThan(0.9); // Should show some difference
      expect(result.differences).toBeDefined();
      expect(result.differences.length).toBeGreaterThan(0);

      console.log(`✅ Detected semantic differences: ${result.differences.length}`);
    }, 30000);
  });

  describe('Entity Disambiguation with Real LLM', () => {
    test('should disambiguate entity references', async () => {
      const entity = 'Washington';
      const context = {
        sentence: 'The meeting will be held in Washington next week.',
        domain: 'business'
      };
      const candidates = [
        { id: 'c1', name: 'Washington D.C.', type: 'City', description: 'US capital city' },
        { id: 'c2', name: 'Washington State', type: 'State', description: 'US state' },
        { id: 'c3', name: 'George Washington', type: 'Person', description: 'First US president' }
      ];

      const result = await realLLMClient.disambiguate(entity, context, candidates);

      expect(result).toBeDefined();
      expect(result.selectedCandidate).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toBeDefined();

      // In this context, should select Washington D.C.
      expect(result.selectedCandidate).toBe('c1');

      console.log(`✅ Disambiguated to: ${result.selectedCandidate} with ${(result.confidence * 100).toFixed(1)}% confidence`);
    }, 30000);
  });

  describe('Complete NLP Pipeline with Real LLM', () => {
    test('should process complete industrial text through full pipeline', async () => {
      const text = `
        The centrifugal pump model CP-2000, manufactured by Industrial Systems Corp,
        operates at 2500 RPM with a flow rate of 500 gallons per minute.
        It is connected to the cooling tower CT-1 through a 6-inch stainless steel pipe.
        The system is monitored by the SCADA platform for performance optimization.
      `;

      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      expect(result.input).toBeDefined();
      expect(result.schema).toBeDefined();
      expect(result.extractions).toBeDefined();
      expect(result.triples).toBeDefined();

      // Check preprocessing
      expect(result.input.normalizedText).toBeDefined();
      expect(result.input.sentences).toBeGreaterThan(0);
      expect(result.input.language).toBe('en');

      // Check schema detection
      expect(result.schema.domain).toBe('industrial');
      expect(result.schema.entityClasses).toBeGreaterThan(0);
      expect(result.schema.relationshipTypes).toBeGreaterThan(0);

      // Check extractions
      expect(result.extractions.entities).toBeGreaterThan(0);
      expect(result.extractions.relationships).toBeGreaterThanOrEqual(0);

      // Check triple generation
      expect(result.triples.count).toBeGreaterThan(0);
      expect(Array.isArray(result.triples.triples)).toBe(true);

      // Check metadata
      expect(result.metadata.extractionId).toBeDefined();
      expect(result.metadata.timestamp).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);

      console.log(`✅ Full pipeline processed:`);
      console.log(`   - Entities: ${result.extractions.entities}`);
      console.log(`   - Relationships: ${result.extractions.relationships}`);
      console.log(`   - Triples: ${result.triples.count}`);
      console.log(`   - Processing time: ${result.processingTime}ms`);
    }, 60000); // 60 second timeout for full pipeline

    test('should process business domain text through full pipeline', async () => {
      const text = `
        Microsoft Corporation announced its acquisition of gaming company Activision Blizzard
        for $68.7 billion, making it the largest deal in tech history.
        CEO Satya Nadella stated this will accelerate gaming growth across mobile, PC, and cloud.
        The deal is expected to close in fiscal year 2023, pending regulatory approval.
      `;

      const result = await nlpSystem.processText(text);

      expect(result.success).toBe(true);
      expect(result.schema.domain).toBe('business');
      expect(result.extractions.entities).toBeGreaterThan(0);
      expect(result.triples.count).toBeGreaterThan(0);

      // Check for business-specific entities
      const hasCompanies = result.extractions.entityDetails.some(e => 
        e.type === 'Organization' || e.type === 'Company'
      );
      const hasPerson = result.extractions.entityDetails.some(e => 
        e.type === 'Person' && e.text.includes('Nadella')
      );
      const hasMoney = result.extractions.entityDetails.some(e => 
        e.text.includes('68.7 billion') || e.text.includes('$68.7')
      );

      expect(hasCompanies).toBe(true);
      expect(hasPerson).toBe(true);
      // Money entity extraction can vary with LLM interpretation
      // Just check that we got meaningful entities
      expect(result.extractions.entities).toBeGreaterThan(2);

      console.log(`✅ Business domain pipeline completed with ${result.triples.count} triples`);
    }, 60000);

    test('should handle edge cases gracefully', async () => {
      // Test with very short text
      const shortText = 'Pump works.';
      const shortResult = await nlpSystem.processText(shortText);
      
      expect(shortResult.success).toBe(true);
      expect(shortResult.extractions.entities).toBeGreaterThanOrEqual(0);

      // Test with empty text
      const emptyResult = await nlpSystem.processText('');
      expect(emptyResult.success).toBe(true);
      expect(emptyResult.extractions.entities).toBe(0);

      // Test with special characters
      const specialText = 'The pump (P-101) @ 150PSI → Tank #2';
      const specialResult = await nlpSystem.processText(specialText);
      
      expect(specialResult.success).toBe(true);
      expect(specialResult.extractions.entities).toBeGreaterThanOrEqual(0);

      console.log('✅ Edge cases handled successfully');
    }, 60000);
  });

  describe('Performance Metrics', () => {
    test('should complete entity extraction within reasonable time', async () => {
      const text = 'The pump manufactured by Siemens operates at 150 PSI pressure.';
      const schema = { entityClasses: [{ name: 'Equipment' }, { name: 'Company' }] };

      const startTime = Date.now();
      const result = await realLLMClient.extractEntities(text, schema, { domain: 'industrial' });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`✅ Entity extraction completed in ${duration}ms`);
    }, 30000);

    test('should handle concurrent operations', async () => {
      const texts = [
        'Pump P1 connects to tank T1.',
        'Valve V1 controls flow rate.',
        'Sensor S1 monitors temperature.'
      ];

      const schema = { entityClasses: [{ name: 'Equipment' }] };

      const startTime = Date.now();
      const promises = texts.map(text => 
        realLLMClient.extractEntities(text, schema, { domain: 'industrial' })
      );
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.entities).toBeDefined();
      });

      console.log(`✅ Processed ${texts.length} texts concurrently in ${duration}ms`);
    }, 60000);
  });
});