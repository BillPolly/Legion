/**
 * DRSOrchestrator - Main entry point for DRS pipeline
 *
 * Orchestrates all 7 stages (0-6) in sequence:
 * 0. Memory Init
 * 1. Mention Extraction  
 * 2. Coreference Resolution
 * 3. Event & Relation Extraction
 * 4. Scope Planning
 * 5. DRS Builder
 * 6. DRS Validation
 *
 * Returns DRSResult with all intermediate results and metadata
 */

import { SemanticInventoryService } from '@legion/semantic-inventory';
import { Stage0_MemoryInit } from './stages/Stage0_MemoryInit.js';
import { Stage1_MentionExtraction } from './stages/Stage1_MentionExtraction.js';
import { Stage2_CoreferenceResolution } from './stages/Stage2_CoreferenceResolution.js';
import { Stage3_EventExtraction } from './stages/Stage3_EventExtraction.js';
import { Stage4_ScopePlanning } from './stages/Stage4_ScopePlanning.js';
import { Stage5_DRSBuilder } from './stages/Stage5_DRSBuilder.js';
import { Stage6_DRSValidation } from './stages/Stage6_DRSValidation.js';

export class DRSOrchestrator {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.llmClient = null;
    this.semanticInventory = null;
    
    // Stages (initialized in initialize())
    this.stage0 = null;
    this.stage1 = null;
    this.stage2 = null;
    this.stage3 = null;
    this.stage4 = null;
    this.stage5 = null;
    this.stage6 = null;
  }

  /**
   * Initialize all stages
   */
  async initialize() {
    // Get LLM client from resource manager
    this.llmClient = await this.resourceManager.get('llmClient');

    // Initialize semantic inventory
    this.semanticInventory = new SemanticInventoryService(this.resourceManager);
    await this.semanticInventory.initialize();

    // Initialize all stages
    this.stage0 = new Stage0_MemoryInit();
    this.stage1 = new Stage1_MentionExtraction(this.llmClient, this.semanticInventory);
    this.stage2 = new Stage2_CoreferenceResolution(this.llmClient, this.semanticInventory);
    this.stage3 = new Stage3_EventExtraction(this.llmClient, this.semanticInventory);
    this.stage4 = new Stage4_ScopePlanning(this.llmClient);
    this.stage5 = new Stage5_DRSBuilder();
    this.stage6 = new Stage6_DRSValidation();
  }

  /**
   * Run full DRS pipeline on text
   * @param {string} text - Input text
   * @returns {Promise<DRSResult>}
   */
  async run(text) {
    const startTime = Date.now();
    const stageResults = [];

    try {
      // Stage 0: Memory Init
      const stage0Start = Date.now();
      let memory = this.stage0.process(text);
      stageResults.push({
        stage: 'Stage 0: Memory Init',
        time: Date.now() - stage0Start
      });

      // Stage 1: Mention Extraction
      const stage1Start = Date.now();
      memory = await this.stage1.process(memory);
      stageResults.push({
        stage: 'Stage 1: Mention Extraction',
        time: Date.now() - stage1Start
      });

      // Stage 2: Coreference Resolution
      const stage2Start = Date.now();
      memory = await this.stage2.process(memory);
      stageResults.push({
        stage: 'Stage 2: Coreference Resolution',
        time: Date.now() - stage2Start
      });

      // Stage 3: Event & Relation Extraction
      const stage3Start = Date.now();
      memory = await this.stage3.process(memory);
      stageResults.push({
        stage: 'Stage 3: Event & Relation Extraction',
        time: Date.now() - stage3Start
      });

      // Stage 4: Scope Planning
      const stage4Start = Date.now();
      const scopePlan = await this.stage4.process(memory);
      stageResults.push({
        stage: 'Stage 4: Scope Planning',
        time: Date.now() - stage4Start
      });

      // Stage 5: DRS Builder
      const stage5Start = Date.now();
      const drs = this.stage5.process(memory, scopePlan);
      stageResults.push({
        stage: 'Stage 5: DRS Builder',
        time: Date.now() - stage5Start
      });

      // Stage 6: DRS Validation
      const stage6Start = Date.now();
      const validation = this.stage6.process(drs);
      stageResults.push({
        stage: 'Stage 6: DRS Validation',
        time: Date.now() - stage6Start
      });

      const totalTime = Date.now() - startTime;

      // Return DRSResult
      return {
        success: validation.valid,
        text: text,
        memory: memory,
        scopePlan: scopePlan,
        drs: drs,
        validation: validation,
        metadata: {
          stages: stageResults,
          totalTime: totalTime,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      // Propagate errors from stages
      throw error;
    }
  }
}
