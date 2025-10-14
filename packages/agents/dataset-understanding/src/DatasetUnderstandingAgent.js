/**
 * Dataset Understanding Agent
 *
 * Examines a JSON dataset and produces comprehensive understanding of:
 * - Structure and schema
 * - Domain and key concepts
 * - Extraction patterns
 * - Data quality
 *
 * Does NOT build ontologies or ingest data - only produces understanding.
 */

import { ConfigurableAgent } from '@legion/configurable-agent';
import fs from 'fs/promises';
import path from 'path';

export class DatasetUnderstandingAgent extends ConfigurableAgent {
  constructor(resourceManager, config = {}) {
    const agentConfig = {
      agent: {
        id: config.id || 'dataset-understanding-agent',
        name: 'Dataset Understanding Agent',
        type: 'task',
        version: '1.0.0',
        capabilities: [
          {
            module: 'file',
            tools: ['file_read', 'file_stat']
          }
        ],
        llm: {
          provider: config.llmProvider || 'anthropic',
          model: config.llmModel || 'claude-sonnet-4',
          temperature: 0.0,
          maxTokens: 8000
        },
        state: {
          maxHistorySize: 10,
          contextVariables: {
            filePath: { type: 'string', persistent: true },
            sampleSize: { type: 'number', persistent: true },
            samples: { type: 'array', persistent: true },
            structure: { type: 'object', persistent: true },
            domain: { type: 'object', persistent: true },
            concepts: { type: 'array', persistent: true },
            extractionSchema: { type: 'object', persistent: true }
          }
        }
      }
    };

    super(agentConfig, resourceManager);
    this.llmClient = null;
    this.promptManager = null;
  }

  async initialize() {
    await super.initialize();

    // Get LLM client and prompt manager from ResourceManager
    this.llmClient = await this.resourceManager.get('llmClient');
    this.promptManager = await this.resourceManager.get('promptManager');

    if (!this.llmClient) {
      throw new Error('LLM client not available in ResourceManager');
    }
  }

  /**
   * Main entry point - understand a dataset
   */
  async receive(message) {
    if (message.type === 'understand_dataset') {
      return await this.understandDataset(message.filePath, message.sampleSize || 3);
    }

    return await super.receive(message);
  }

  /**
   * Execute full understanding workflow
   */
  async understandDataset(filePath, sampleSize = 3) {
    try {
      console.log(`\n📊 DATASET UNDERSTANDING WORKFLOW`);
      console.log('='.repeat(60));
      console.log(`File: ${filePath}`);
      console.log(`Sample size: ${sampleSize}`);
      console.log('='.repeat(60));

      // Step 1: Load dataset
      console.log('\n[1/8] Loading dataset...');
      const datasetInfo = await this.loadDataset(filePath);

      // Step 2: Sample records
      console.log('\n[2/8] Sampling records...');
      const samples = await this.sampleRecords(datasetInfo.data, sampleSize);
      this.state.setVariable('samples', samples);

      // Step 3: Analyze structure
      console.log('\n[3/8] Analyzing structure...');
      const structure = await this.analyzeStructure(datasetInfo.data, samples);
      this.state.setVariable('structure', structure);

      // Step 4: Identify domain
      console.log('\n[4/8] Identifying domain...');
      const domain = await this.identifyDomain(samples);
      this.state.setVariable('domain', domain);

      // Step 5: Extract concepts
      console.log('\n[5/8] Extracting key concepts...');
      const concepts = await this.extractConcepts(samples, domain);
      this.state.setVariable('concepts', concepts);

      // Step 6: Design extraction schema
      console.log('\n[6/8] Designing extraction schema...');
      const extractionSchema = await this.designExtractionSchema(structure, concepts);
      this.state.setVariable('extractionSchema', extractionSchema);

      // Step 7: Assess quality
      console.log('\n[7/8] Assessing data quality...');
      const dataQuality = await this.assessQuality(samples);

      // Step 8: Generate recommendations
      console.log('\n[8/8] Generating recommendations...');
      const recommendations = await this.generateRecommendations(domain, concepts, structure);

      // Compile final output
      const output = {
        datasetInfo: {
          filePath,
          fileSize: datasetInfo.fileSize,
          samplesExamined: sampleSize,
          totalRecords: datasetInfo.totalRecords,
          analysisTimestamp: new Date().toISOString()
        },
        structure,
        domain,
        keyConcepts: concepts,
        extractionSchema,
        dataQuality,
        recommendations
      };

      console.log('\n✅ UNDERSTANDING COMPLETE');
      console.log(`   Domain: ${domain.primaryDomain}`);
      console.log(`   Concepts: ${concepts.length}`);
      console.log(`   Confidence: ${domain.confidence}`);
      console.log('='.repeat(60));

      return {
        success: true,
        output
      };

    } catch (error) {
      console.error(`\n❌ Understanding failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Step 1: Load dataset and extract metadata
   */
  async loadDataset(filePath) {
    const stats = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Determine total records
    let totalRecords = 0;
    if (data.train) totalRecords += data.train.length;
    if (data.dev) totalRecords += data.dev.length;
    if (data.test) totalRecords += data.test.length;

    console.log(`  ✓ Loaded ${stats.size} bytes, ${totalRecords} records`);

    return {
      filePath,
      fileSize: stats.size,
      data,
      totalRecords
    };
  }

  /**
   * Step 2: Sample records from dataset
   */
  async sampleRecords(data, sampleSize) {
    // For ConvFinQA-like datasets, sample from train set
    const records = data.train || data.records || data;

    if (!Array.isArray(records)) {
      throw new Error('Dataset format not recognized - expected array of records');
    }

    // Take first N samples (could randomize later)
    const samples = records.slice(0, sampleSize);

    console.log(`  ✓ Sampled ${samples.length} records`);

    return samples;
  }

  /**
   * Step 3: Analyze structure introspectively
   */
  async analyzeStructure(data, samples) {
    // Detect top-level structure
    const topLevelKeys = Object.keys(data);
    const topLevelStructure = topLevelKeys.map(key => ({
      key,
      type: Array.isArray(data[key]) ? 'array' : typeof data[key],
      length: Array.isArray(data[key]) ? data[key].length : undefined
    }));

    // Analyze sample record schema
    const recordSchema = this.introspectSchema(samples[0]);

    console.log(`  ✓ Top-level keys: ${topLevelKeys.join(', ')}`);
    console.log(`  ✓ Record schema detected`);

    return {
      format: 'JSON',
      topLevelStructure: topLevelKeys.join(', '),
      topLevelKeys: topLevelStructure,
      recordSchema
    };
  }

  /**
   * Introspect schema of a single record
   */
  introspectSchema(record, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return 'object (nested)';

    if (Array.isArray(record)) {
      return `array[${record.length}]`;
    }

    if (typeof record !== 'object' || record === null) {
      return typeof record;
    }

    const schema = {};
    for (const [key, value] of Object.entries(record)) {
      schema[key] = this.introspectSchema(value, depth + 1, maxDepth);
    }

    return schema;
  }

  /**
   * Step 4: Identify domain using LLM world knowledge
   */
  async identifyDomain(samples) {
    const prompt = `You are analyzing a dataset to determine its domain.

**Dataset Samples:**
${samples.map((s, i) => `\n---\nSample ${i + 1}:\n${JSON.stringify(s, null, 2)}`).join('\n')}

**Task:**
Based on these samples, identify:
1. The PRIMARY DOMAIN (e.g., Corporate Finance, Healthcare, E-commerce)
2. SUB-DOMAINS (more specific areas)
3. CONFIDENCE (0.0 to 1.0)
4. EVIDENCE (specific observations that support your classification)

Use your world knowledge about different domains to make this determination.

Output ONLY valid JSON (no markdown, no code blocks):
{
  "primaryDomain": "...",
  "subDomains": ["...", "..."],
  "confidence": 0.95,
  "evidence": ["...", "..."]
}`;

    const response = await this.llmClient.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      maxTokens: 2000
    });

    const domain = JSON.parse(response.trim());

    console.log(`  ✓ Domain: ${domain.primaryDomain} (confidence: ${domain.confidence})`);

    return domain;
  }

  /**
   * Step 5: Extract key concepts using LLM
   */
  async extractConcepts(samples, domain) {
    const prompt = `You are analyzing dataset samples to identify key concepts.

**Domain Context:** ${domain.primaryDomain}

**Dataset Samples:**
${samples.map((s, i) => `\n---\nSample ${i + 1}:\n${JSON.stringify(s, null, 2).substring(0, 1000)}...`).join('\n')}

**Task:**
Identify the KEY CONCEPTS that appear in this data. For each concept:
1. NAME - What is it called?
2. DESCRIPTION - What does it represent?
3. EXAMPLES - Provide 3-5 concrete examples from the data
4. EXTRACTION PATTERN - How would you find/extract this from the JSON?

Focus on domain entities (nouns) and relationships (verbs).

Output ONLY valid JSON array (no markdown, no code blocks):
[
  {
    "concept": "Company",
    "description": "A business entity being reported on",
    "examples": ["JKHY", "RSG", "AAPL"],
    "extractionPattern": "Parse company ticker from id field"
  }
]`;

    const response = await this.llmClient.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      maxTokens: 3000
    });

    const concepts = JSON.parse(response.trim());

    console.log(`  ✓ Identified ${concepts.length} key concepts`);

    return concepts;
  }

  /**
   * Step 6: Design extraction schema using LLM
   */
  async designExtractionSchema(structure, concepts) {
    const prompt = `You are creating navigation instructions for extracting data from a JSON dataset.

**Dataset Structure:**
${JSON.stringify(structure, null, 2)}

**Key Concepts:**
${concepts.map(c => `- ${c.concept}: ${c.description}`).join('\n')}

**Task:**
Create a STEP-BY-STEP extraction schema that explains:
1. How to navigate the JSON structure
2. What paths to follow
3. What variability exists
4. What canonicalization is needed

Be SPECIFIC about JSON paths (e.g., \`/train[i]/doc/table\`).
Note where formats vary and normalization is required.

Output ONLY valid JSON (no markdown, no code blocks):
{
  "steps": [
    {
      "step": 1,
      "description": "...",
      "path": "...",
      "note": "..."
    }
  ],
  "navigationPatterns": {
    "timePeriods": { "location": "...", "variability": "...", "canonicalization": "..." }
  }
}`;

    const response = await this.llmClient.generateText({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.0,
      maxTokens: 3000
    });

    const extractionSchema = JSON.parse(response.trim());

    console.log(`  ✓ Designed ${extractionSchema.steps.length} extraction steps`);

    return extractionSchema;
  }

  /**
   * Step 7: Assess data quality
   */
  async assessQuality(samples) {
    const issues = [];
    const anomalies = [];

    // Check for missing fields
    const allKeys = new Set();
    samples.forEach(s => this.collectKeys(s, allKeys));

    // Check for null/undefined values
    samples.forEach((s, i) => {
      this.checkNulls(s, `sample[${i}]`, issues);
    });

    // Look for anomalies
    samples.forEach((s, i) => {
      this.detectAnomalies(s, `sample[${i}]`, anomalies);
    });

    console.log(`  ✓ Found ${issues.length} issues, ${anomalies.length} anomalies`);

    return {
      completeness: {
        missingFields: issues,
        nullValues: issues.filter(i => i.includes('null'))
      },
      consistency: {
        issues: []  // TODO: detect inconsistencies
      },
      anomalies
    };
  }

  collectKeys(obj, keys, prefix = '') {
    if (typeof obj !== 'object' || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.add(fullKey);
      this.collectKeys(value, keys, fullKey);
    }
  }

  checkNulls(obj, path, issues) {
    if (obj === null || obj === undefined) {
      issues.push(`${path}: null/undefined value`);
      return;
    }

    if (typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      this.checkNulls(value, `${path}.${key}`, issues);
    }
  }

  detectAnomalies(obj, path, anomalies) {
    if (typeof obj !== 'object' || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      // Detect negative percentages
      if (key.toLowerCase().includes('percentage') && typeof value === 'number' && value < 0) {
        anomalies.push(`${path}.${key}: Negative percentage (${value})`);
      }

      this.detectAnomalies(value, `${path}.${key}`, anomalies);
    }
  }

  /**
   * Step 8: Generate recommendations
   */
  async generateRecommendations(domain, concepts, structure) {
    return {
      ontologyBuilding: [
        `Create classes for key concepts: ${concepts.map(c => c.concept).join(', ')}`,
        'Establish class hierarchies based on domain relationships',
        'Define properties for each class',
        'Create relationships between entities'
      ],
      normalization: [
        'Build canonical label service for varying field names',
        'Implement unit inference from context',
        'Standardize time period formats'
      ],
      ingestion: [
        'Process records incrementally to handle large datasets',
        'Use extraction schema to navigate JSON structure',
        'Apply canonicalization during extraction',
        'Store in dual-layer Neo4j architecture (ontology + instances)'
      ]
    };
  }
}
