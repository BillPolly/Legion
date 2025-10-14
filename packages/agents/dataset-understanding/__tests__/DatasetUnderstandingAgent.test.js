/**
 * Dataset Understanding Agent Tests
 */

import { DatasetUnderstandingAgent } from '../src/DatasetUnderstandingAgent.js';
import { ResourceManager } from '@legion/resource-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DatasetUnderstandingAgent', () => {
  let resourceManager;
  let agent;

  beforeAll(async () => {
    // Get ResourceManager singleton (no timeout - must work)
    resourceManager = await ResourceManager.getInstance();
  }, 30000);

  beforeEach(async () => {
    agent = new DatasetUnderstandingAgent(resourceManager);
    await agent.initialize();
  });

  test('should understand ConvFinQA dataset structure', async () => {
    const datasetPath = path.join(
      __dirname,
      '../examples/convfinqa-extract.json'
    );

    const result = await agent.understandDataset(datasetPath, 3);

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();

    // Check dataset info
    expect(result.output.datasetInfo.filePath).toBe(datasetPath);
    expect(result.output.datasetInfo.samplesExamined).toBe(3);
    expect(result.output.datasetInfo.totalRecords).toBeGreaterThan(0);

    // Check structure
    expect(result.output.structure).toBeDefined();
    expect(result.output.structure.format).toBe('JSON');
    expect(result.output.structure.recordSchema).toBeDefined();

    // Check domain
    expect(result.output.domain).toBeDefined();
    expect(result.output.domain.primaryDomain).toBeTruthy();
    expect(result.output.domain.confidence).toBeGreaterThan(0);
    expect(result.output.domain.evidence).toBeInstanceOf(Array);

    // Check key concepts
    expect(result.output.keyConcepts).toBeInstanceOf(Array);
    expect(result.output.keyConcepts.length).toBeGreaterThan(0);

    // Check extraction schema
    expect(result.output.extractionSchema).toBeDefined();
    expect(result.output.extractionSchema.steps).toBeInstanceOf(Array);
    expect(result.output.extractionSchema.steps.length).toBeGreaterThan(0);

    // Check data quality
    expect(result.output.dataQuality).toBeDefined();

    // Check recommendations
    expect(result.output.recommendations).toBeDefined();
    expect(result.output.recommendations.ontologyBuilding).toBeInstanceOf(Array);
    expect(result.output.recommendations.ingestion).toBeInstanceOf(Array);

    console.log('\n📊 UNDERSTANDING OUTPUT:');
    console.log(JSON.stringify(result.output, null, 2));
  }, 120000); // 2 minutes timeout for LLM calls

  test('should identify financial domain for ConvFinQA', async () => {
    const datasetPath = path.join(
      __dirname,
      '../examples/convfinqa-extract.json'
    );

    const result = await agent.understandDataset(datasetPath, 3);

    expect(result.success).toBe(true);

    // Domain should be financial/corporate finance related
    const domain = result.output.domain.primaryDomain.toLowerCase();
    expect(
      domain.includes('finance') ||
      domain.includes('financial') ||
      domain.includes('accounting')
    ).toBe(true);

    console.log(`\n✓ Identified domain: ${result.output.domain.primaryDomain}`);
    console.log(`✓ Confidence: ${result.output.domain.confidence}`);
  }, 120000);

  test('should extract relevant concepts', async () => {
    const datasetPath = path.join(
      __dirname,
      '../examples/convfinqa-extract.json'
    );

    const result = await agent.understandDataset(datasetPath, 3);

    expect(result.success).toBe(true);

    const concepts = result.output.keyConcepts;
    expect(concepts.length).toBeGreaterThan(0);

    // Should have identified some financial concepts
    const conceptNames = concepts.map(c => c.concept.toLowerCase());

    // Log identified concepts
    console.log('\n✓ Identified concepts:');
    concepts.forEach(c => {
      console.log(`  - ${c.concept}: ${c.description}`);
      console.log(`    Examples: ${c.examples.slice(0, 3).join(', ')}`);
    });

    expect(conceptNames.length).toBeGreaterThan(0);
  }, 120000);
});
