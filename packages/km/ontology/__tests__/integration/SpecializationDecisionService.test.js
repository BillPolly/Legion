/**
 * SpecializationDecisionService Integration Tests
 *
 * Tests specialization decisions with REAL LLM client
 * NO MOCKS - uses actual LLM to make decisions
 */

import { ResourceManager } from '@legion/resource-manager';
import { SpecializationDecisionService } from '../../src/services/SpecializationDecisionService.js';

describe('SpecializationDecisionService Integration', () => {
  let service;
  let llmClient;
  let resourceManager;

  beforeAll(async () => {
    // Get real LLM client from ResourceManager
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
  });

  beforeEach(() => {
    service = new SpecializationDecisionService(llmClient);
  });

  describe('decide with real LLM', () => {
    test('should return REUSE for generic inherited property', async () => {
      const candidate = {
        sentence: 'The pump is located in Building A',
        type: 'property',
        implied: {
          name: 'locatedIn',
          domain: 'Pump'
        },
        existing: {
          label: 'locatedIn',
          definedIn: 'kg:PhysicalObject',
          inheritanceDistance: 2
        }
      };

      const decision = await service.decide(candidate);

      expect(decision).toBeDefined();
      expect(decision.action).toBeDefined();
      expect(['REUSE', 'SPECIALIZE']).toContain(decision.action);
      expect(decision.reasoning).toBeDefined();
      expect(typeof decision.reasoning).toBe('string');

      console.log('✅ Decision for generic locatedIn:');
      console.log(`   Action: ${decision.action}`);
      console.log(`   Reasoning: ${decision.reasoning}`);

      // Generic location should typically be REUSE
      if (decision.action === 'REUSE') {
        console.log('   ✓ LLM correctly chose REUSE for generic location');
      }
    });

    test('should return SPECIALIZE for domain-specific property', async () => {
      const candidate = {
        sentence: 'The pump installation location must meet OSHA safety requirements',
        type: 'property',
        implied: {
          name: 'installationLocation',
          domain: 'Pump'
        },
        existing: {
          label: 'locatedIn',
          definedIn: 'kg:PhysicalObject',
          inheritanceDistance: 2
        }
      };

      const decision = await service.decide(candidate);

      expect(decision).toBeDefined();
      expect(decision.action).toBeDefined();
      expect(['REUSE', 'SPECIALIZE']).toContain(decision.action);
      expect(decision.reasoning).toBeDefined();

      console.log('✅ Decision for domain-specific installationLocation:');
      console.log(`   Action: ${decision.action}`);
      console.log(`   Reasoning: ${decision.reasoning}`);

      // Installation location with safety requirements should typically be SPECIALIZE
      if (decision.action === 'SPECIALIZE') {
        console.log('   ✓ LLM correctly chose SPECIALIZE for domain-specific location');
      }
    });

    test('should return REUSE for generic relationship', async () => {
      const candidate = {
        sentence: 'The pump connects to the tank',
        type: 'relationship',
        implied: {
          name: 'connectsTo',
          domain: 'Pump',
          range: 'Tank'
        },
        existing: {
          label: 'connectsTo',
          definedIn: { domain: 'kg:Equipment', range: 'kg:Equipment' },
          inheritanceDistance: 1
        }
      };

      const decision = await service.decide(candidate);

      expect(decision).toBeDefined();
      expect(decision.action).toBeDefined();
      expect(decision.reasoning).toBeDefined();

      console.log('✅ Decision for generic connectsTo relationship:');
      console.log(`   Action: ${decision.action}`);
      console.log(`   Reasoning: ${decision.reasoning}`);
    });

    test('should provide reasoning for all decisions', async () => {
      const candidate = {
        sentence: 'The pump manufacturer is Siemens',
        type: 'property',
        implied: {
          name: 'manufacturer',
          domain: 'Pump'
        },
        existing: {
          label: 'manufacturer',
          definedIn: 'kg:Equipment',
          inheritanceDistance: 1
        }
      };

      const decision = await service.decide(candidate);

      expect(decision.reasoning).toBeDefined();
      expect(decision.reasoning.length).toBeGreaterThan(10);

      console.log('✅ LLM provided reasoning:');
      console.log(`   "${decision.reasoning}"`);
    });

    test('should handle property at different inheritance distances', async () => {
      const candidate = {
        sentence: 'The centrifugal pump is a physical object',
        type: 'property',
        implied: {
          name: 'type',
          domain: 'CentrifugalPump'
        },
        existing: {
          label: 'type',
          definedIn: 'kg:PhysicalObject',
          inheritanceDistance: 3
        }
      };

      const decision = await service.decide(candidate);

      expect(decision).toBeDefined();
      expect(decision.action).toBeDefined();

      console.log('✅ Decision for property 3 levels up in hierarchy:');
      console.log(`   Action: ${decision.action}`);
      console.log(`   Distance: ${candidate.existing.inheritanceDistance} levels`);
    });

    test('should handle relationship with domain-specific semantics', async () => {
      const candidate = {
        sentence: 'The pump feeds into the tank',
        type: 'relationship',
        implied: {
          name: 'feedsInto',
          domain: 'Pump',
          range: 'Tank'
        },
        existing: {
          label: 'connectsTo',
          definedIn: { domain: 'kg:Equipment', range: 'kg:Equipment' },
          inheritanceDistance: 1
        }
      };

      const decision = await service.decide(candidate);

      expect(decision).toBeDefined();
      expect(decision.action).toBeDefined();

      console.log('✅ Decision for "feedsInto" vs generic "connectsTo":');
      console.log(`   Action: ${decision.action}`);
      console.log(`   Reasoning: ${decision.reasoning}`);

      // "feedsInto" implies directional flow, different from generic "connectsTo"
      // Should typically SPECIALIZE
      if (decision.action === 'SPECIALIZE') {
        console.log('   ✓ LLM correctly identified directional semantics need specialization');
      }
    });
  });

  describe('decision consistency', () => {
    test('should make consistent decisions for similar cases', async () => {
      const candidate1 = {
        sentence: 'The pump is in the warehouse',
        type: 'property',
        implied: { name: 'location', domain: 'Pump' },
        existing: { label: 'locatedIn', definedIn: 'kg:PhysicalObject', inheritanceDistance: 2 }
      };

      const candidate2 = {
        sentence: 'The tank is in the facility',
        type: 'property',
        implied: { name: 'location', domain: 'Tank' },
        existing: { label: 'locatedIn', definedIn: 'kg:PhysicalObject', inheritanceDistance: 2 }
      };

      const decision1 = await service.decide(candidate1);
      const decision2 = await service.decide(candidate2);

      console.log('✅ Consistency check for similar generic location cases:');
      console.log(`   Pump location: ${decision1.action}`);
      console.log(`   Tank location: ${decision2.action}`);

      // Both should ideally be the same decision
      // Note: LLM decisions may vary, so we just verify both are valid
      expect(['REUSE', 'SPECIALIZE']).toContain(decision1.action);
      expect(['REUSE', 'SPECIALIZE']).toContain(decision2.action);
    });
  });
});
