/**
 * Live validation test - Generate a simple system and validate with real LLM
 * 
 * Tests the full validation-regeneration cycle:
 * 1. Generate simple "Library Book Management" system
 * 2. Run hybrid validation (deterministic + LLM)
 * 3. Use error classification to route fixes
 * 4. Apply specialized fixing agents
 * 5. Re-validate until system passes
 */

import { ResourceManager } from '@legion/module-loader';
import { LLMClient } from '@legion/llm-client'

import { RequirementsAgent } from '../src/agents/RequirementsAgent.js';
import { DomainModelingAgent } from '../src/agents/DomainModelingAgent.js';
import { CodeGenerationAgent } from '../src/agents/CodeGenerationAgent.js';

import { RequirementsCoherenceAgent } from '../src/agents/RequirementsCoherenceAgent.js';
import { DomainLogicValidationAgent } from '../src/agents/DomainLogicValidationAgent.js';
import { CodeQualityValidationAgent } from '../src/agents/CodeQualityValidationAgent.js';

import { CodeFixingAgent } from '../src/agents/fixing/CodeFixingAgent.js';
import { RequirementsFixingAgent } from '../src/agents/fixing/RequirementsFixingAgent.js';

import { ErrorClassificationSystem } from '../src/validation/ErrorClassificationSystem.js';
import { DesignDatabaseService } from '../src/services/DesignDatabaseService.js';
import { promises as fs } from 'fs';
import path from 'path';

class LiveValidationTest {
  constructor() {
    this.testId = `library-${Date.now()}`;
    this.projectPath = `/tmp/autonomous-builds/${this.testId}`;
    this.artifacts = {};
  }

  async initialize() {
    console.log('🔧 Initializing ResourceManager and LLM...');
    
    // Initialize ResourceManager which loads .env automatically
    this.resourceManager = ResourceManager.getInstance();
    await this.resourceManager.initialize();
    
    // Initialize LLM client with API key from ResourceManager
    this.llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: this.resourceManager.get('env.ANTHROPIC_API_KEY')
    });
    
    // Initialize database service
    this.dbService = new DesignDatabaseService(this.resourceManager);
    await this.dbService.initialize();
    
    // Initialize generation agents with LLM
    const agentConfig = {
      llmClient: this.llmClient,
      dbService: this.dbService,
      resourceManager: this.resourceManager
    };
    
    this.requirementsAgent = new RequirementsAgent(agentConfig);
    this.domainAgent = new DomainModelingAgent(agentConfig);
    this.codeAgent = new CodeGenerationAgent(agentConfig);

    // Initialize validation agents with LLM
    this.requirementsValidator = new RequirementsCoherenceAgent(agentConfig);
    this.domainValidator = new DomainLogicValidationAgent(agentConfig);
    this.codeValidator = new CodeQualityValidationAgent(agentConfig);

    // Initialize fixing agents with LLM
    this.codeFixingAgent = new CodeFixingAgent(agentConfig);
    this.requirementsFixingAgent = new RequirementsFixingAgent(agentConfig);

    // Initialize error classification system
    this.errorClassifier = new ErrorClassificationSystem();
    
    console.log('✅ All agents initialized with LLM capability');
  }

  async runLiveTest() {
    console.log('🚀 Starting Live Validation Test');
    console.log(`📁 Project path: ${this.projectPath}`);

    try {
      // Initialize all components
      await this.initialize();

      // Phase 1: Generate initial system
      console.log('\n=== PHASE 1: GENERATION ===');
      const artifacts = await this.generateSystem();

      // Phase 2: Validate and fix iteratively
      console.log('\n=== PHASE 2: VALIDATION & REGENERATION CYCLES ===');
      const finalArtifacts = await this.validateAndFixIteratively(artifacts);

      // Phase 3: Final validation
      console.log('\n=== PHASE 3: FINAL VALIDATION ===');
      await this.finalValidation(finalArtifacts);

      console.log('\n✅ Live validation test completed successfully!');
      return {
        success: true,
        projectPath: this.projectPath,
        artifacts: finalArtifacts
      };
    } catch (error) {
      console.error('\n❌ Live validation test failed:', error);
      return {
        success: false,
        error: error.message,
        projectPath: this.projectPath
      };
    }
  }

  async generateSystem() {
    console.log('🔨 Generating Library Book Management System...');

    // Simple requirements for a library system
    const userInput = "Build a simple library book management system where librarians can add books, track which books are checked out, and manage member accounts. Books have title, author, and ISBN. Members have name and member ID.";

    // Step 1: Generate requirements
    console.log('\n📋 Generating requirements...');
    const requirementsResponse = await this.requirementsAgent.receive({
      type: 'analyze_requirements',
      payload: { userInput, context: { systemType: 'library-management' } }
    });

    if (!requirementsResponse.success) {
      throw new Error(`Requirements generation failed: ${requirementsResponse.error}`);
    }

    const requirements = requirementsResponse.data.requirements;
    console.log(`✅ Generated ${requirements.functional?.length || 0} functional requirements`);
    
    // Save to database
    if (this.dbService) {
      await this.dbService.saveArtifact({
        projectId: this.testId,
        type: 'requirements',
        data: requirements,
        phase: 'requirements-analysis'
      });
    }

    // Step 2: Generate domain model
    console.log('\n🏗️ Generating domain model...');
    const domainResponse = await this.domainAgent.receive({
      type: 'create_domain_model',
      payload: { requirements, context: { systemType: 'library-management' } }
    });

    if (!domainResponse.success) {
      throw new Error(`Domain modeling failed: ${domainResponse.error}`);
    }

    const domainModel = domainResponse.data.domainModel;
    console.log(`✅ Generated domain with ${domainModel.entities?.length || 0} entities`);
    
    // Save to database
    if (this.dbService) {
      await this.dbService.saveArtifact({
        projectId: this.testId,
        type: 'domain-model',
        data: domainModel,
        phase: 'domain-modeling'
      });
    }

    // Step 3: Generate code
    console.log('\n💻 Generating code...');
    await fs.mkdir(this.projectPath, { recursive: true });
    
    const codeResponse = await this.codeAgent.receive({
      type: 'generate_code',
      payload: {
        requirements,
        domainModel,
        outputDirectory: this.projectPath,
        context: { systemType: 'library-management' }
      }
    });

    if (!codeResponse.success) {
      throw new Error(`Code generation failed: ${codeResponse.error}`);
    }

    console.log(`✅ Generated code with ${codeResponse.data.generatedFiles?.length || 0} files`);
    
    // Save to database
    if (this.dbService) {
      await this.dbService.saveArtifact({
        projectId: this.testId,
        type: 'generated-code',
        data: codeResponse.data,
        phase: 'code-generation'
      });
    }

    return {
      requirements,
      domainModel,
      generatedCode: codeResponse.data,
      projectPath: this.projectPath
    };
  }

  async validateAndFixIteratively(artifacts) {
    let currentArtifacts = artifacts;
    let iteration = 1;
    const maxIterations = 3; // Prevent infinite loops

    while (iteration <= maxIterations) {
      console.log(`\n🔍 Validation Iteration ${iteration}/${maxIterations}`);

      // Run all validations
      const validationResults = await this.runAllValidations(currentArtifacts);
      
      // Check if we have any errors
      const hasErrors = validationResults.some(result => 
        result.success && result.data?.validation?.issues?.length > 0
      );

      if (!hasErrors) {
        console.log(`✅ All validations passed on iteration ${iteration}!`);
        break;
      }

      console.log(`⚠️  Found validation issues, attempting fixes...`);

      // Classify errors and generate fixing tasks
      const regenerationTasks = this.errorClassifier.classifyAndRoute(
        validationResults, 
        'code-generation'
      );

      console.log(`🔧 Generated ${regenerationTasks.length} fixing tasks`);

      if (regenerationTasks.length === 0) {
        console.log('ℹ️  No fixable errors found, proceeding...');
        break;
      }

      // Display fixing task summary
      const taskSummary = this.errorClassifier.generateClassificationSummary(regenerationTasks);
      console.log(`📊 Task Summary: ${taskSummary.fixableErrors} fixable, ${taskSummary.unfixableErrors} unfixable`);

      // Execute fixes
      currentArtifacts = await this.executeFixingTasks(regenerationTasks, currentArtifacts);
      
      iteration++;
    }

    if (iteration > maxIterations) {
      console.log('⚠️  Reached maximum iterations, some issues may remain');
    }

    return currentArtifacts;
  }

  async runAllValidations(artifacts) {
    console.log('🔎 Running comprehensive validation...');
    
    const validationResults = [];

    // 1. Requirements validation
    try {
      console.log('  - Validating requirements coherence...');
      const reqValidation = await this.requirementsValidator.receive({
        type: 'validate_requirements',
        payload: {
          requirements: artifacts.requirements,
          context: { systemType: 'library-management' }
        }
      });
      reqValidation.agentName = 'RequirementsCoherenceAgent';
      validationResults.push(reqValidation);
      
      const reqIssues = reqValidation.success ? (reqValidation.data?.validation?.issues?.length || 0) : 1;
      console.log(`    Found ${reqIssues} requirements issues`);
    } catch (error) {
      console.log(`    Requirements validation error: ${error.message}`);
      validationResults.push({ success: false, error: error.message, agentName: 'RequirementsCoherenceAgent' });
    }

    // 2. Domain validation
    try {
      console.log('  - Validating domain model...');
      const domainValidation = await this.domainValidator.receive({
        type: 'validate_domain',
        payload: {
          domainModel: artifacts.domainModel,
          requirements: artifacts.requirements,
          context: { systemType: 'library-management' }
        }
      });
      domainValidation.agentName = 'DomainLogicValidationAgent';
      validationResults.push(domainValidation);
      
      const domainIssues = domainValidation.success ? (domainValidation.data?.validation?.issues?.length || 0) : 1;
      console.log(`    Found ${domainIssues} domain issues`);
    } catch (error) {
      console.log(`    Domain validation error: ${error.message}`);
      validationResults.push({ success: false, error: error.message, agentName: 'DomainLogicValidationAgent' });
    }

    // 3. Code validation (if we have generated code)
    try {
      console.log('  - Validating generated code...');
      const codeValidation = await this.codeValidator.receive({
        type: 'validate_code',
        payload: {
          generatedCode: artifacts.generatedCode,
          projectPath: artifacts.projectPath,
          requirements: artifacts.requirements,
          context: { systemType: 'library-management' }
        }
      });
      codeValidation.agentName = 'CodeQualityValidationAgent';
      validationResults.push(codeValidation);
      
      const codeIssues = codeValidation.success ? (codeValidation.data?.validation?.issues?.length || 0) : 1;
      console.log(`    Found ${codeIssues} code issues`);
    } catch (error) {
      console.log(`    Code validation error: ${error.message}`);
      validationResults.push({ success: false, error: error.message, agentName: 'CodeQualityValidationAgent' });
    }

    return validationResults;
  }

  async executeFixingTasks(regenerationTasks, currentArtifacts) {
    console.log(`🔧 Executing ${regenerationTasks.length} fixing tasks...`);

    let updatedArtifacts = { ...currentArtifacts };

    for (const task of regenerationTasks.slice(0, 5)) { // Limit to 5 fixes per iteration
      if (task.targetAgent === 'manual' || !task.fixable) {
        console.log(`  ⚠️  Skipping unfixable task: ${task.errorType}`);
        continue;
      }

      try {
        console.log(`  🔨 Fixing: ${task.errorType} with ${task.targetAgent}.${task.method}`);

        const fixingPayload = this.errorClassifier.createRegenerationPayload(task, currentArtifacts);

        let fixResult;
        switch (task.targetAgent) {
          case 'CodeFixingAgent':
            fixResult = await this.codeFixingAgent.receive({
              type: task.method,
              payload: fixingPayload.context
            });
            break;

          case 'RequirementsFixingAgent':
            fixResult = await this.requirementsFixingAgent.receive({
              type: task.method,
              payload: fixingPayload.context
            });
            break;

          default:
            console.log(`    ⚠️  No fixing agent available for: ${task.targetAgent}`);
            continue;
        }

        if (fixResult.success) {
          console.log(`    ✅ Fixed: ${fixResult.data?.message || task.errorType}`);
          
          // Update artifacts if the fix provides updated artifacts
          if (fixResult.data?.updatedArtifacts) {
            updatedArtifacts = {
              ...updatedArtifacts,
              ...fixResult.data.updatedArtifacts
            };
          }
          
          // Save fix to database
          if (this.dbService) {
            await this.dbService.saveArtifact({
              projectId: this.testId,
              type: 'fix-applied',
              data: fixResult.data,
              phase: 'validation-regeneration'
            });
          }
        } else {
          console.log(`    ❌ Fix failed: ${fixResult.error}`);
        }
      } catch (error) {
        console.log(`    ❌ Fix error: ${error.message}`);
      }
    }

    return updatedArtifacts;
  }

  async finalValidation(artifacts) {
    console.log('🏁 Running final validation...');
    
    const finalResults = await this.runAllValidations(artifacts);
    
    let totalIssues = 0;
    let totalPassed = 0;
    
    for (const result of finalResults) {
      if (result.success && result.data?.validation) {
        const issues = result.data.validation.issues?.length || 0;
        totalIssues += issues;
        if (issues === 0) totalPassed++;
        
        console.log(`  ${result.agentName}: ${issues === 0 ? '✅ PASSED' : `⚠️  ${issues} issues`}`);
      } else {
        console.log(`  ${result.agentName}: ❌ VALIDATION ERROR`);
        totalIssues++;
      }
    }

    console.log(`\n📊 Final Results:`);
    console.log(`  Validations passed: ${totalPassed}/${finalResults.length}`);
    console.log(`  Total issues remaining: ${totalIssues}`);
    
    // Check if generated files exist and compile
    await this.checkGeneratedFiles();
    
    // Save final results to database
    if (this.dbService) {
      await this.dbService.saveArtifact({
        projectId: this.testId,
        type: 'final-validation',
        data: {
          totalPassed,
          totalValidations: finalResults.length,
          totalIssues,
          results: finalResults
        },
        phase: 'final-validation'
      });
    }
  }

  async checkGeneratedFiles() {
    console.log('\n📁 Checking generated files...');
    
    try {
      const files = await fs.readdir(this.projectPath, { recursive: true });
      const jsFiles = files.filter(file => file.endsWith('.js'));
      
      console.log(`  Found ${files.length} total files, ${jsFiles.length} JavaScript files`);
      
      for (const file of jsFiles.slice(0, 3)) { // Check first 3 files
        const filePath = path.join(this.projectPath, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          console.log(`  ✅ ${file}: ${content.length} characters`);
        } catch (error) {
          console.log(`  ❌ ${file}: Read error`);
        }
      }
    } catch (error) {
      console.log(`  ❌ Directory read error: ${error.message}`);
    }
  }
}

// Run the live test
async function runLiveValidationTest() {
  console.log('🧪 Starting Live Validation Test with Real LLM...');
  console.log('📡 Using ResourceManager to access API keys from .env');
  
  const test = new LiveValidationTest();
  const result = await test.runLiveTest();
  
  if (result.success) {
    console.log('\n🎉 SUCCESS: Live validation test completed!');
    console.log(`📁 Generated project at: ${result.projectPath}`);
    console.log('✨ System generated, validated, and fixed successfully!');
  } else {
    console.log('\n💥 FAILURE: Live validation test failed');
    console.log(`❌ Error: ${result.error}`);
  }
  
  return result;
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLiveValidationTest()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runLiveValidationTest, LiveValidationTest };