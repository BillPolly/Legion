import { LLMClient } from '@legion/llm-client';
import { PerspectiveGenerationError } from './errors/index.js';
import { ObjectId } from 'mongodb';

export class SOPPerspectives {
  constructor({ resourceManager, sopStorage }) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    if (!sopStorage) {
      throw new Error('sopStorage is required');
    }
    
    this.resourceManager = resourceManager;
    this.sopStorage = sopStorage;
    this.llmClient = null;
    this.nomicService = null;
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    const anthropicKey = this.resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    
    this.llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: 'claude-3-5-sonnet-20241022'
    });
    
    let nomicService = this.resourceManager.get('nomicService');
    if (!nomicService) {
      const { NomicEmbeddings } = await import('@legion/nomic');
      nomicService = new NomicEmbeddings();
      await nomicService.initialize();
      this.resourceManager.set('nomicService', nomicService);
    }
    this.nomicService = nomicService;
    
    this.initialized = true;
  }
  
  async generateForSOP(sopId, options = {}) {
    if (!this.initialized) await this.initialize();
    
    const sop = await this.sopStorage.findSOP(sopId);
    if (!sop) {
      throw new PerspectiveGenerationError(
        `SOP not found: ${sopId}`,
        sopId,
        new Error('SOP not found')
      );
    }
    
    const sopTypes = await this.sopStorage.findPerspectiveTypes({ scope: 'sop' });
    const stepType = await this.sopStorage.getPerspectiveType('step_perspective');
    
    const sopPerspectives = await this._generateSOPLevelPerspectives(sop, sopTypes);
    const stepPerspectives = await this._generateStepPerspectives(sop, stepType);
    
    const allPerspectives = [...sopPerspectives, ...stepPerspectives];
    
    await this._embedPerspectives(allPerspectives);
    
    await this.sopStorage.saveSOPPerspectives(allPerspectives);
    
    return allPerspectives;
  }
  
  async generateForAllSOPs(options = {}) {
    if (!this.initialized) await this.initialize();
    
    const sops = await this.sopStorage.findSOPs();
    
    const results = {
      generated: 0,
      failed: 0,
      errors: []
    };
    
    for (const sop of sops) {
      try {
        if (!options.forceRegenerate) {
          const existing = await this.sopStorage.findPerspectivesBySOP(sop._id);
          if (existing.length > 0) {
            continue;
          }
        }
        
        const perspectives = await this.generateForSOP(sop._id, options);
        results.generated += perspectives.length;
      } catch (error) {
        results.failed++;
        results.errors.push({
          sopId: sop._id,
          title: sop.title,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  async _generateSOPLevelPerspectives(sop, types) {
    const prompt = this._createSOPLevelPrompt(sop, types);
    const response = await this.llmClient.complete(prompt, 1000);
    const parsed = this._parseSOPLevelResponse(response, types);
    
    const batchId = this._generateBatchId();
    
    return types.map((type, i) => ({
      sop_id: sop._id,
      sop_title: sop.title,
      perspective_type_name: type.name,
      perspective_type_id: type._id,
      scope: 'sop',
      content: parsed[i]?.content || `Generated perspective for ${sop.title}`,
      keywords: this._extractKeywords(parsed[i]?.content || ''),
      embedding: null,
      embedding_model: null,
      embedding_dimensions: null,
      generated_at: new Date(),
      llm_model: 'claude-3-5-sonnet-20241022',
      batch_id: batchId
    }));
  }
  
  async _generateStepPerspectives(sop, stepType) {
    if (!sop.steps || sop.steps.length === 0) {
      return [];
    }
    
    const prompt = this._createStepPerspectivesPrompt(sop);
    const response = await this.llmClient.complete(prompt, 1000);
    const parsed = this._parseStepPerspectivesResponse(response, sop.steps);
    
    const batchId = this._generateBatchId();
    
    return sop.steps.map((step, i) => ({
      sop_id: sop._id,
      sop_title: sop.title,
      perspective_type_name: 'step_perspective',
      perspective_type_id: stepType._id,
      scope: 'step',
      step_index: i,
      content: parsed[i]?.content || `Perspective for step: ${step.gloss}`,
      keywords: this._extractKeywords(parsed[i]?.content || step.gloss),
      embedding: null,
      embedding_model: null,
      embedding_dimensions: null,
      generated_at: new Date(),
      llm_model: 'claude-3-5-sonnet-20241022',
      batch_id: batchId
    }));
  }
  
  async _embedPerspectives(perspectives) {
    const contents = perspectives.map(p => p.content);
    const embeddings = await this.nomicService.embedBatch(contents);
    
    for (let i = 0; i < perspectives.length; i++) {
      perspectives[i].embedding = embeddings[i];
      perspectives[i].embedding_model = 'nomic-embed-text-v1.5';
      perspectives[i].embedding_dimensions = 768;
    }
  }
  
  _createSOPLevelPrompt(sop, types) {
    const outputKeys = sop.outputs ? Object.keys(sop.outputs).join(', ') : 'None';
    
    return `Generate 4 perspectives for this SOP. Each MUST be ONE sentence maximum.

SOP: ${sop.title}
Intent: ${sop.intent}
Prerequisites: ${sop.prerequisites?.join(', ') || 'None'}
Tools: ${sop.toolsMentioned?.join(', ') || 'None'}
Outputs: ${outputKeys}

Generate perspectives:
1. Intent: What user goal does this address?
2. Preconditions: What must be true beforehand?
3. Tools: What tools/resources are used?
4. Outcomes: What results are produced?

Return JSON array: [{"content": "..."}, {"content": "..."}, {"content": "..."}, {"content": "..."}]`;
  }
  
  _createStepPerspectivesPrompt(sop) {
    const stepsList = sop.steps.map((s, i) => `${i+1}. ${s.gloss}`).join('\n');
    
    return `Generate perspectives for these steps from SOP: ${sop.title}

Steps:
${stepsList}

For each step, describe what it accomplishes in ONE sentence.

Return JSON array with ${sop.steps.length} entries: [{"content": "..."}, ...]`;
  }
  
  _parseSOPLevelResponse(response, types) {
    try {
      const jsonMatch = response.match(/\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/);
      if (jsonMatch) {
        const perspectives = JSON.parse(jsonMatch[0]);
        if (Array.isArray(perspectives) && perspectives.length === types.length) {
          return perspectives;
        }
      }
    } catch (error) {
    }
    
    return types.map(() => ({ content: '' }));
  }
  
  _parseStepPerspectivesResponse(response, steps) {
    try {
      const jsonMatch = response.match(/\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/);
      if (jsonMatch) {
        const perspectives = JSON.parse(jsonMatch[0]);
        if (Array.isArray(perspectives) && perspectives.length === steps.length) {
          return perspectives;
        }
      }
    } catch (error) {
    }
    
    return steps.map(() => ({ content: '' }));
  }
  
  _extractKeywords(content) {
    if (!content || typeof content !== 'string') return [];
    
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that'
    ]);
    
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word))
      .slice(0, 10);
    
    return [...new Set(words)];
  }
  
  _generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}