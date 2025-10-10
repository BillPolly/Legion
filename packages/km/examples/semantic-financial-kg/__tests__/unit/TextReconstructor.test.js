/**
 * Unit tests for TextReconstructor
 *
 * Tests LLM-based natural language reconstruction from entity models
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { TextReconstructor } from '../../src/verification/TextReconstructor.js';
import { ResourceManager } from '@legion/resource-manager';

describe('TextReconstructor', () => {
  let resourceManager;
  let llmClient;
  let reconstructor;

  beforeAll(async () => {
    // Get ResourceManager singleton with real components (NO MOCKS!)
    resourceManager = await ResourceManager.getInstance();

    // Get real LLM client
    llmClient = await resourceManager.get('llmClient');
    if (!llmClient) {
      throw new Error('LLMClient not available from ResourceManager');
    }

    // Create reconstructor
    reconstructor = new TextReconstructor(llmClient);
  }, 60000);

  test('should reconstruct text from simple entity model', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:AcmeCorp',
          type: 'poc:Company',
          label: 'Acme Corporation'
        },
        {
          uri: 'poc:Reserve_Acme_2023',
          type: 'poc:Reserve',
          label: 'Acme Reserves 2023',
          properties: {
            'poc:amount': '5.2',
            'poc:year': '2023'
          }
        }
      ],
      relationships: [
        {
          subject: 'poc:AcmeCorp',
          predicate: 'poc:hasReserve',
          object: 'poc:Reserve_Acme_2023'
        }
      ]
    };

    const text = await reconstructor.reconstruct(entityModel);

    expect(text).toBeDefined();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);

    // Should mention key facts
    const lowerText = text.toLowerCase();
    expect(lowerText).toMatch(/acme/i);
    expect(lowerText).toMatch(/reserve/i);
    expect(lowerText).toMatch(/5\.2|5.2/);
    expect(lowerText).toMatch(/2023/);
  }, 30000);

  test('should reconstruct text from complex financial entity model', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:JPMorganChase',
          type: 'poc:Company',
          label: 'JPMorgan Chase'
        },
        {
          uri: 'poc:LitigationReserve_2012',
          type: 'poc:Reserve',
          label: 'Litigation Reserve 2012',
          properties: {
            'poc:amount': '3.7',
            'poc:year': '2012'
          }
        },
        {
          uri: 'poc:Unit_Billion_USD',
          type: 'poc:Unit',
          label: 'Billion USD'
        }
      ],
      relationships: [
        {
          subject: 'poc:JPMorganChase',
          predicate: 'poc:hasReserve',
          object: 'poc:LitigationReserve_2012'
        }
      ]
    };

    const text = await reconstructor.reconstruct(entityModel);

    expect(text).toBeDefined();
    expect(typeof text).toBe('string');

    // Should mention key facts
    const lowerText = text.toLowerCase();
    expect(lowerText).toMatch(/jpmorgan|jp morgan/i);
    expect(lowerText).toMatch(/litigation|reserve/i);
    expect(lowerText).toMatch(/3\.7|3.7/);
    expect(lowerText).toMatch(/2012/);
  }, 30000);

  test('should handle entity model with multiple entities and relationships', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:Company1',
          type: 'poc:Company',
          label: 'First Company',
          properties: {
            'poc:foundedYear': '1990'
          }
        },
        {
          uri: 'poc:Company2',
          type: 'poc:Company',
          label: 'Second Company',
          properties: {
            'poc:foundedYear': '2000'
          }
        },
        {
          uri: 'poc:Reserve1',
          type: 'poc:Reserve',
          label: 'Reserve One',
          properties: {
            'poc:amount': '10.5',
            'poc:year': '2023'
          }
        },
        {
          uri: 'poc:Reserve2',
          type: 'poc:Reserve',
          label: 'Reserve Two',
          properties: {
            'poc:amount': '20.8',
            'poc:year': '2024'
          }
        }
      ],
      relationships: [
        {
          subject: 'poc:Company1',
          predicate: 'poc:hasReserve',
          object: 'poc:Reserve1'
        },
        {
          subject: 'poc:Company2',
          predicate: 'poc:hasReserve',
          object: 'poc:Reserve2'
        }
      ]
    };

    const text = await reconstructor.reconstruct(entityModel);

    expect(text).toBeDefined();
    expect(typeof text).toBe('string');

    // Should mention all key facts
    const lowerText = text.toLowerCase();
    expect(lowerText).toMatch(/first company|company1/i);
    expect(lowerText).toMatch(/second company|company2/i);
    expect(lowerText).toMatch(/10\.5|10.5/);
    expect(lowerText).toMatch(/20\.8|20.8/);
    expect(lowerText).toMatch(/2023/);
    expect(lowerText).toMatch(/2024/);
  }, 30000);

  test('should generate concise but complete text', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:TechCo',
          type: 'poc:Company',
          label: 'TechCo Inc'
        },
        {
          uri: 'poc:Reserve_Tech_2024',
          type: 'poc:Reserve',
          label: 'TechCo Reserve 2024',
          properties: {
            'poc:amount': '8.5',
            'poc:year': '2024'
          }
        }
      ],
      relationships: [
        {
          subject: 'poc:TechCo',
          predicate: 'poc:hasReserve',
          object: 'poc:Reserve_Tech_2024'
        }
      ]
    };

    const text = await reconstructor.reconstruct(entityModel);

    // Should be concise (not too long)
    expect(text.length).toBeLessThan(500);

    // But should be complete (mention all facts)
    const lowerText = text.toLowerCase();
    expect(lowerText).toMatch(/techco/i);
    expect(lowerText).toMatch(/8\.5|8.5/);
    expect(lowerText).toMatch(/2024/);
  }, 30000);

  test('should handle entity model with only entities (no relationships)', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:AcmeCorp',
          type: 'poc:Company',
          label: 'Acme Corporation',
          properties: {
            'poc:foundedYear': '1950'
          }
        }
      ],
      relationships: []
    };

    const text = await reconstructor.reconstruct(entityModel);

    expect(text).toBeDefined();
    expect(typeof text).toBe('string');

    // Should mention entity facts
    const lowerText = text.toLowerCase();
    expect(lowerText).toMatch(/acme/i);
    expect(lowerText).toMatch(/1950/);
  }, 30000);
});
