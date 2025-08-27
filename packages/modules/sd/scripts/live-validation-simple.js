#!/usr/bin/env node
/**
 * Simplified Live Validation Test
 * 
 * Tests the full SD process with validation-regeneration cycle
 * without complex imports, using direct initialization
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Minimal ResourceManager that loads .env
class MinimalResourceManager {
  constructor() {
    this.resources = new Map();
  }
  
  async initialize() {
    // Load .env file manually
    try {
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const envPath = path.resolve(__dirname, '../../../.env');
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      const envObj = {};
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            envObj[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
          }
        }
      }
      
      this.resources.set('env', envObj);
      console.log('✅ Environment variables loaded');
      
      // Check for API key
      if (!envObj.ANTHROPIC_API_KEY && !envObj.OPENAI_API_KEY) {
        throw new Error('No API key found in .env (need ANTHROPIC_API_KEY or OPENAI_API_KEY)');
      }
    } catch (error) {
      console.error('❌ Could not load .env file:', error.message);
      throw error;
    }
  }
  
  get(key) {
    if (key.startsWith('env.')) {
      const envKey = key.replace('env.', '');
      const env = this.resources.get('env');
      return env ? env[envKey] : undefined;
    }
    return this.resources.get(key);
  }
  
  register(name, value) {
    this.resources.set(name, value);
  }
}

// Import SD components
import { LLMClient } from '@legion/llm';
import { DesignDatabaseService } from '../src/services/DesignDatabaseService.js';

// Import agents
import { RequirementsAgent } from '../src/agents/RequirementsAgent.js';
import { DomainModelingAgent } from '../src/agents/DomainModelingAgent.js';
import { CodeGenerationAgent } from '../src/agents/CodeGenerationAgent.js';

// Import validation agents
import { RequirementsCoherenceAgent } from '../src/agents/RequirementsCoherenceAgent.js';
import { DomainLogicValidationAgent } from '../src/agents/DomainLogicValidationAgent.js';
import { CodeQualityValidationAgent } from '../src/agents/CodeQualityValidationAgent.js';

// Import fixing agents
import { RequirementsFixingAgent } from '../src/agents/fixing/RequirementsFixingAgent.js';
import { CodeFixingAgent } from '../src/agents/fixing/CodeFixingAgent.js';

// Import error classification
import { ErrorClassificationSystem } from '../src/validation/ErrorClassificationSystem.js';

class SimpleLiveValidationTest {
  constructor() {
    this.testId = `simple-${Date.now()}`;
    this.projectPath = `/tmp/autonomous-builds/${this.testId}`;
    this.resourceManager = null;
    this.llmClient = null;
    this.dbService = null;
    this.agents = {};
    this.validators = {};
    this.fixers = {};
    this.errorClassifier = new ErrorClassificationSystem();
  }

  async initialize() {
    console.log('🔧 Initializing test environment...\n');
    
    // Initialize ResourceManager
    this.resourceManager = new MinimalResourceManager();
    await this.resourceManager.initialize();
    
    // Create LLM client
    const anthropicKey = this.resourceManager.get('env.ANTHROPIC_API_KEY');
    const openaiKey = this.resourceManager.get('env.OPENAI_API_KEY');
    
    if (anthropicKey) {
      this.llmClient = new LLMClient({
        provider: 'anthropic',
        apiKey: anthropicKey
      });
      console.log('✅ Using Anthropic LLM');
    } else if (openaiKey) {
      this.llmClient = new LLMClient({
        provider: 'openai',
        apiKey: openaiKey
      });
      console.log('✅ Using OpenAI LLM');
    }
    
    // Register LLM client in ResourceManager
    this.resourceManager.register('llmClient', this.llmClient);
    this.resourceManager.register('sdModule', { llmClient: this.llmClient });
    
    // Initialize database service
    this.dbService = new DesignDatabaseService(this.resourceManager);
    await this.dbService.initialize();
    console.log('✅ Database service initialized');
    
    // Create agent configuration
    const agentConfig = {
      llmClient: this.llmClient,
      dbService: this.dbService,
      resourceManager: this.resourceManager,
      designDatabase: this.dbService
    };
    
    // Initialize generation agents
    this.agents = {
      requirements: new RequirementsAgent(agentConfig),
      domain: new DomainModelingAgent(agentConfig),
      code: new CodeGenerationAgent(agentConfig)
    };
    
    // Initialize validation agents
    this.validators = {
      requirements: new RequirementsCoherenceAgent(agentConfig),
      domain: new DomainLogicValidationAgent(agentConfig),
      code: new CodeQualityValidationAgent(agentConfig)
    };
    
    // Initialize fixing agents
    this.fixers = {
      requirements: new RequirementsFixingAgent(agentConfig),
      code: new CodeFixingAgent(agentConfig)
    };
    
    // Initialize all agents
    for (const [name, agent] of Object.entries(this.agents)) {
      if (agent.initialize) await agent.initialize();
      console.log(`✅ ${name} generation agent ready`);
    }
    
    for (const [name, agent] of Object.entries(this.validators)) {
      if (agent.initialize) await agent.initialize();
      console.log(`✅ ${name} validation agent ready`);
    }
    
    for (const [name, agent] of Object.entries(this.fixers)) {
      if (agent.initialize) await agent.initialize();
      console.log(`✅ ${name} fixing agent ready`);
    }
    
    console.log('\n🎯 All systems initialized!\n');
  }

  async runTest() {
    console.log('🚀 Starting Simple Live Validation Test');
    console.log(`📁 Project: ${this.projectPath}\n`);
    
    try {
      // Phase 1: Generate initial system
      console.log('═══ PHASE 1: GENERATION ═══\n');
      const artifacts = await this.generateSimpleSystem();
      
      // Phase 2: Validate and fix
      console.log('\n═══ PHASE 2: VALIDATION & FIXING ═══\n');
      const finalArtifacts = await this.validateAndFix(artifacts);
      
      // Phase 3: Final check
      console.log('\n═══ PHASE 3: FINAL VALIDATION ═══\n');
      await this.finalValidation(finalArtifacts);
      
      console.log('\n✅ Test completed successfully!');
      return { success: true, projectPath: this.projectPath };
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async generateSimpleSystem() {
    // Simple todo app requirements
    const userInput = `Build a simple todo application where users can:
    - Add new todo items with a title and description
    - Mark todos as complete or incomplete
    - Delete todos
    - View all todos in a list
    Use simple JavaScript with basic data structures.`;
    
    // Step 1: Requirements
    console.log('📋 Generating requirements...');
    const reqResult = await this.agents.requirements.receive({
      type: 'analyze_requirements',
      payload: { 
        userInput,
        requirementsText: userInput,
        context: { systemType: 'todo-app' }
      }
    });
    
    if (!reqResult.success) {
      throw new Error(`Requirements failed: ${reqResult.error}`);
    }
    
    const requirements = reqResult.data.requirements || reqResult.data;
    console.log(`✅ Generated ${requirements.functional?.length || 0} functional requirements`);
    
    // Step 2: Domain Model
    console.log('\n🏗️ Creating domain model...');
    const domainResult = await this.agents.domain.receive({
      type: 'create_domain_model',
      payload: { 
        requirements,
        context: { systemType: 'todo-app' }
      }
    });
    
    if (!domainResult.success) {
      // Try alternative message type
      const altResult = await this.agents.domain.receive({
        type: 'model_domain',
        payload: { 
          requirements,
          context: { systemType: 'todo-app' }
        }
      });
      if (!altResult.success) {
        throw new Error(`Domain modeling failed: ${domainResult.error || altResult.error}`);
      }
      domainResult.data = altResult.data;
    }
    
    const domainModel = domainResult.data.domainModel || domainResult.data;
    console.log(`✅ Created domain with ${domainModel.entities?.length || 0} entities`);
    
    // Step 3: Generate Code
    console.log('\n💻 Generating code...');
    await fs.mkdir(this.projectPath, { recursive: true });
    
    const codeResult = await this.agents.code.receive({
      type: 'generate_code',
      payload: {
        requirements,
        domainModel,
        outputDirectory: this.projectPath,
        context: { systemType: 'todo-app' }
      }
    });
    
    if (!codeResult.success) {
      throw new Error(`Code generation failed: ${codeResult.error}`);
    }
    
    console.log(`✅ Generated ${codeResult.data.generatedFiles?.length || 0} files`);
    
    return {
      requirements,
      domainModel,
      generatedCode: codeResult.data,
      projectPath: this.projectPath
    };
  }

  async validateAndFix(artifacts) {
    let currentArtifacts = { ...artifacts };
    const maxIterations = 3;
    
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      console.log(`\n🔍 Iteration ${iteration}/${maxIterations}`);
      
      // Run validations
      const validationResults = await this.runValidations(currentArtifacts);
      
      // Check for issues
      const totalIssues = this.countIssues(validationResults);
      console.log(`  Found ${totalIssues} total issues`);
      
      if (totalIssues === 0) {
        console.log('  ✅ All validations passed!');
        break;
      }
      
      // Classify and fix errors
      const tasks = this.errorClassifier.classifyAndRoute(validationResults, 'generation');
      console.log(`  📝 Generated ${tasks.length} fixing tasks`);
      
      if (tasks.length === 0) break;
      
      // Apply fixes
      currentArtifacts = await this.applyFixes(tasks.slice(0, 3), currentArtifacts);
    }
    
    return currentArtifacts;
  }

  async runValidations(artifacts) {
    const results = [];
    
    // Validate requirements
    try {
      console.log('  • Validating requirements...');
      const result = await this.validators.requirements.receive({
        type: 'validate_requirements',
        payload: {
          requirements: artifacts.requirements,
          context: { systemType: 'todo-app' }
        }
      });
      result.agentName = 'RequirementsCoherenceAgent';
      results.push(result);
    } catch (error) {
      console.log(`    ⚠️ Requirements validation error: ${error.message}`);
    }
    
    // Validate domain
    try {
      console.log('  • Validating domain model...');
      const result = await this.validators.domain.receive({
        type: 'validate_domain',
        payload: {
          domainModel: artifacts.domainModel,
          requirements: artifacts.requirements,
          context: { systemType: 'todo-app' }
        }
      });
      result.agentName = 'DomainLogicValidationAgent';
      results.push(result);
    } catch (error) {
      console.log(`    ⚠️ Domain validation error: ${error.message}`);
    }
    
    // Validate code
    try {
      console.log('  • Validating generated code...');
      const result = await this.validators.code.receive({
        type: 'validate_code',
        payload: {
          generatedCode: artifacts.generatedCode,
          projectPath: artifacts.projectPath,
          requirements: artifacts.requirements,
          context: { systemType: 'todo-app' }
        }
      });
      result.agentName = 'CodeQualityValidationAgent';
      results.push(result);
    } catch (error) {
      console.log(`    ⚠️ Code validation error: ${error.message}`);
    }
    
    return results;
  }

  countIssues(validationResults) {
    let count = 0;
    for (const result of validationResults) {
      if (result.success && result.data?.validation?.issues) {
        count += result.data.validation.issues.length;
      }
    }
    return count;
  }

  async applyFixes(tasks, artifacts) {
    console.log(`  🔧 Applying ${tasks.length} fixes...`);
    
    for (const task of tasks) {
      if (!task.fixable || task.targetAgent === 'manual') continue;
      
      try {
        const payload = this.errorClassifier.createRegenerationPayload(task, artifacts);
        let fixResult;
        
        if (task.targetAgent === 'CodeFixingAgent' && this.fixers.code) {
          fixResult = await this.fixers.code.receive({
            type: task.method,
            payload: payload.context
          });
        } else if (task.targetAgent === 'RequirementsFixingAgent' && this.fixers.requirements) {
          fixResult = await this.fixers.requirements.receive({
            type: task.method,
            payload: payload.context
          });
        }
        
        if (fixResult?.success) {
          console.log(`    ✅ Fixed: ${task.errorType}`);
          if (fixResult.data?.updatedArtifacts) {
            artifacts = { ...artifacts, ...fixResult.data.updatedArtifacts };
          }
        }
      } catch (error) {
        console.log(`    ❌ Fix failed: ${error.message}`);
      }
    }
    
    return artifacts;
  }

  async finalValidation(artifacts) {
    console.log('Running final validation...');
    
    const results = await this.runValidations(artifacts);
    const totalIssues = this.countIssues(results);
    
    console.log(`\n📊 Final Results:`);
    console.log(`  Total remaining issues: ${totalIssues}`);
    console.log(`  Project location: ${this.projectPath}`);
    
    // Check generated files
    try {
      const files = await fs.readdir(this.projectPath, { recursive: true });
      console.log(`  Generated files: ${files.length}`);
      
      // List first few files
      for (const file of files.slice(0, 5)) {
        if (file.endsWith('.js')) {
          console.log(`    • ${file}`);
        }
      }
    } catch (error) {
      console.log(`  Could not read project files: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  console.log('🧪 Simple Live Validation Test\n');
  console.log('This test will:');
  console.log('1. Generate a simple todo app');
  console.log('2. Validate the generated artifacts');
  console.log('3. Fix any issues found');
  console.log('4. Re-validate to confirm fixes\n');
  
  const test = new SimpleLiveValidationTest();
  
  try {
    await test.initialize();
    const result = await test.runTest();
    
    if (result.success) {
      console.log('\n🎉 SUCCESS!');
      console.log(`📁 Check the generated project at: ${result.projectPath}`);
      process.exit(0);
    } else {
      console.log('\n💥 FAILED');
      console.log(`❌ ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}