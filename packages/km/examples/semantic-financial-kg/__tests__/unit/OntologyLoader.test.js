/**
 * Unit tests for OntologyLoader
 *
 * Tests parsing POC ontology and verifying classes and properties
 */

import { describe, test, expect } from '@jest/globals';
import { OntologyLoader } from '../../src/ontology/OntologyLoader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const POC_ONTOLOGY_PATH = join(__dirname, '../../data/poc-ontology.ttl');

describe('OntologyLoader', () => {
  test('should load POC ontology file', async () => {
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);

    expect(ontology).toBeDefined();
    expect(ontology.classes).toBeDefined();
    expect(ontology.properties).toBeDefined();
  });

  test('should parse all classes from POC ontology', async () => {
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);

    // Verify 3 classes: Company, Reserve, Unit
    expect(ontology.classes.size).toBe(3);
    expect(ontology.classes.has('poc:Company')).toBe(true);
    expect(ontology.classes.has('poc:Reserve')).toBe(true);
    expect(ontology.classes.has('poc:Unit')).toBe(true);
  });

  test('should parse class metadata (label and comment)', async () => {
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);

    const companyClass = ontology.classes.get('poc:Company');
    expect(companyClass.label).toBe('Company');
    expect(companyClass.comment).toBe('A business organization');
  });

  test('should parse all properties from POC ontology', async () => {
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);

    // Verify 3 properties: hasReserve, amount, year
    expect(ontology.properties.size).toBe(3);
    expect(ontology.properties.has('poc:hasReserve')).toBe(true);
    expect(ontology.properties.has('poc:amount')).toBe(true);
    expect(ontology.properties.has('poc:year')).toBe(true);
  });

  test('should parse property metadata (label, comment, domain, range)', async () => {
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);

    const hasReserve = ontology.properties.get('poc:hasReserve');
    expect(hasReserve.label).toBe('has reserve');
    expect(hasReserve.comment).toBe('Company has a reserve');
    expect(hasReserve.domain).toBe('poc:Company');
    expect(hasReserve.range).toBe('poc:Reserve');
    expect(hasReserve.type).toBe('ObjectProperty');
  });

  test('should distinguish between object and datatype properties', async () => {
    const loader = new OntologyLoader();
    const ontology = await loader.load(POC_ONTOLOGY_PATH);

    const hasReserve = ontology.properties.get('poc:hasReserve');
    const amount = ontology.properties.get('poc:amount');
    const year = ontology.properties.get('poc:year');

    expect(hasReserve.type).toBe('ObjectProperty');
    expect(amount.type).toBe('DatatypeProperty');
    expect(year.type).toBe('DatatypeProperty');

    expect(amount.range).toBe('xsd:decimal');
    expect(year.range).toBe('xsd:integer');
  });
});
