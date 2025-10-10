/**
 * Unit tests for OntologyValidator
 *
 * Tests validation of entity models against ontology using Z3 theorem prover
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { OntologyValidator } from '../../src/validation/OntologyValidator.js';
import { OntologyLoader } from '../../src/ontology/OntologyLoader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const POC_ONTOLOGY_PATH = join(__dirname, '../../data/poc-ontology.ttl');

describe('OntologyValidator', () => {
  let ontology;
  let validator;

  beforeAll(async () => {
    // Load POC ontology
    const loader = new OntologyLoader();
    ontology = await loader.load(POC_ONTOLOGY_PATH);

    // Create validator
    validator = new OntologyValidator(ontology);
    await validator.initialize();
  }, 60000);

  test('should validate valid entity model', async () => {
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
          label: 'Acme Reserves 2023'
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

    const result = await validator.validate(entityModel);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should detect invalid entity type', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:InvalidEntity',
          type: 'poc:InvalidClass',
          label: 'Invalid Entity'
        }
      ],
      relationships: []
    };

    const result = await validator.validate(entityModel);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('InvalidClass'))).toBe(true);
  });

  test('should detect invalid relationship property', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:AcmeCorp',
          type: 'poc:Company',
          label: 'Acme Corporation'
        },
        {
          uri: 'poc:Reserve_Acme',
          type: 'poc:Reserve',
          label: 'Acme Reserves'
        }
      ],
      relationships: [
        {
          subject: 'poc:AcmeCorp',
          predicate: 'poc:invalidProperty',
          object: 'poc:Reserve_Acme'
        }
      ]
    };

    const result = await validator.validate(entityModel);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('invalidProperty'))).toBe(true);
  });

  test('should detect domain constraint violation', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:NotACompany',
          type: 'poc:Reserve',
          label: 'Not a company'
        },
        {
          uri: 'poc:SomeReserve',
          type: 'poc:Reserve',
          label: 'Some Reserve'
        }
      ],
      relationships: [
        {
          subject: 'poc:NotACompany',
          predicate: 'poc:hasReserve',
          object: 'poc:SomeReserve'
        }
      ]
    };

    const result = await validator.validate(entityModel);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('Domain constraint violated'))).toBe(true);
  });

  test('should detect range constraint violation', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:AcmeCorp',
          type: 'poc:Company',
          label: 'Acme Corporation'
        },
        {
          uri: 'poc:NotAReserve',
          type: 'poc:Company',
          label: 'Not a reserve'
        }
      ],
      relationships: [
        {
          subject: 'poc:AcmeCorp',
          predicate: 'poc:hasReserve',
          object: 'poc:NotAReserve'
        }
      ]
    };

    const result = await validator.validate(entityModel);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('Range constraint violated'))).toBe(true);
  });

  test('should detect missing entity in relationship', async () => {
    const entityModel = {
      entities: [
        {
          uri: 'poc:AcmeCorp',
          type: 'poc:Company',
          label: 'Acme Corporation'
        }
      ],
      relationships: [
        {
          subject: 'poc:AcmeCorp',
          predicate: 'poc:hasReserve',
          object: 'poc:MissingReserve'
        }
      ]
    };

    const result = await validator.validate(entityModel);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('not found in entities'))).toBe(true);
  });

  test('should reject entity model with missing structure', async () => {
    const result1 = await validator.validate({ entities: [] });
    expect(result1.valid).toBe(false);
    expect(result1.errors.some(e => e.includes('missing relationships'))).toBe(true);

    const result2 = await validator.validate({ relationships: [] });
    expect(result2.valid).toBe(false);
    expect(result2.errors.some(e => e.includes('missing entities'))).toBe(true);
  });

  test('should validate complex entity model', async () => {
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
            amount: '3.7',
            year: '2012'
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

    const result = await validator.validate(entityModel);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
