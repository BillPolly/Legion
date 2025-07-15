/**
 * CodeAgent - Main orchestrator for code generation
 * 
 * A lean class that coordinates all phases of the code generation process
 * including planning, generation, testing, quality checks, and fixing.
 */

import { EventEmitter } from 'events';

// Import integration components
import { FileOperationsManager } from '../integration/FileOperationsManager.js';
import { LLMClientManager } from '../integration/LLMClientManager.js';
import { ModuleLoaderIntegration } from '../integration/ModuleLoaderIntegration.js';
import { EslintConfigManager } from '../config/EslintConfigManager.js';
import { JestConfigManager } from '../config/JestConfigManager.js';
import { StateManager } from '../config/StateManager.js';
import { ValidationUtils } from '../utils/ValidationUtils.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

// Import unified planner
import { UnifiedPlanner } from '../planning/llm/UnifiedPlanner.js';

// Import generators
import { HTMLGenerator } from '../generation/HTMLGenerator.js';
import { JSGenerator } from '../generation/JSGenerator.js';
import { CSSGenerator } from '../generation/CSSGenerator.js';
import { TestGenerator } from '../generation/TestGenerator.js';

// Import phases
import { PlanningPhase } from './phases/PlanningPhase.js';
import { GenerationPhase } from './phases/GenerationPhase.js';
import { TestingPhase } from './phases/TestingPhase.js';
import { QualityPhase } from './phases/QualityPhase.js';
import { FixingPhase } from './phases/FixingPhase.js';

/**
 * Main CodeAgent class - orchestrates the complete development workflow
 */
class CodeAgent extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Add unique ID for multiple instances
    this.id = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // For CLI usage, add default console logger
    if (config.enableConsoleOutput !== false) {
      this.on('progress', (e) => console.log(e.message));
      this.on('error', (e) => console.error(`❌ ${e.message}`));
      this.on('warning', (e) => console.warn(`⚠️ ${e.message}`));
      this.on('info', (e) => console.log(e.message));
      this.on('file-created', (e) => console.log(`📝 Generated: ${e.filename}`));
      this.on('phase-start', (e) => console.log(`\n${e.emoji} ${e.message}`));
      this.on('phase-complete', (e) => console.log(`✅ ${e.message}`));
    }
    
    // Initialize managers with tested components
    this.eslintManager = new EslintConfigManager(config.eslintConfig);
    this.jestManager = new JestConfigManager(config.jestConfig);
    this.stateManager = new StateManager(config.stateConfig);
    this.validator = new ValidationUtils(config.validationConfig);
    this.errorHandler = new ErrorHandler({ 
      enableLogging: false,
      autoCleanup: false,
      ...config.errorConfig 
    });
    
    // Use the default rules from EslintConfigManager
    const defaultRules = this.eslintManager.getBaseRules();
    
    // Store configuration
    this.config = {
      projectType: config.projectType || 'fullstack',
      workingDirectory: null,
      stateFile: '.code-agent-state.json',
      eslintRules: defaultRules,
      testCoverage: {
        threshold: 80,
        ...config.testCoverage
      },
      qualityGates: {
        eslintErrors: 0,
        eslintWarnings: 0,
        testCoverage: config.testCoverage?.threshold || 80,
        allTestsPass: true,
        ...config.qualityGates
      },
      ...config
    };
    
    // Internal state
    this.currentTask = null;
    this.projectPlan = null;
    this.generatedFiles = new Set();
    this.testFiles = new Set();
    this.qualityCheckResults = null;
    
    // Integration managers (to be initialized)
    this.fileOps = null;
    this.llmClient = null;
    this.moduleLoader = null;
    this.unifiedPlanner = null;
    
    // Code generators
    this.htmlGenerator = new HTMLGenerator(config.htmlConfig);
    this.jsGenerator = new JSGenerator(config.jsConfig);
    this.cssGenerator = new CSSGenerator(config.cssConfig);
    this.testGenerator = new TestGenerator(config.testConfig);
    
    // Phase handlers (to be initialized)
    this.planningPhase = null;
    this.generationPhase = null;
    this.testingPhase = null;
    this.qualityPhase = null;
    this.fixingPhase = null;
    
    this.initialized = false;
  }

  /**
   * Override emit to add timestamp and agentId to all events
   */
  emit(event, data) {
    return super.emit(event, {
      timestamp: new Date().toISOString(),
      agentId: this.id,
      ...data
    });
  }

  /**
   * Initialize the CodeAgent in a specified working directory
   */
  async initialize(workingDirectory, options = {}) {
    this.emit('info', {
      message: `Initializing CodeAgent in: ${workingDirectory}`,
      workingDirectory
    });
    
    this.config.workingDirectory = workingDirectory;
    
    try {
      // Initialize integration managers
      this.fileOps = new FileOperationsManager(options.fileOpsConfig);
      
      const llmConfig = {
        provider: 'mock',
        ...options.llmConfig
      };
      this.llmClient = new LLMClientManager(llmConfig);
      
      this.moduleLoader = new ModuleLoaderIntegration(options.moduleConfig);
      
      // Initialize all managers
      await this.fileOps.initialize();
      await this.llmClient.initialize();
      await this.eslintManager.initialize({ 
        projectType: this.config.projectType,
        ...this.config.eslintRules 
      });
      await this.jestManager.initialize({ 
        projectType: this.config.projectType 
      });
      await this.stateManager.initialize();
      
      // Initialize unified planner with LLM client
      this.unifiedPlanner = new UnifiedPlanner({
        provider: llmConfig.provider || 'mock',
        llmClient: this.llmClient.llmClient
      });
      await this.unifiedPlanner.initialize();
      
      // Initialize phase handlers
      this.planningPhase = new PlanningPhase(this);
      this.generationPhase = new GenerationPhase(this);
      this.testingPhase = new TestingPhase(this);
      this.qualityPhase = new QualityPhase(this);
      this.fixingPhase = new FixingPhase(this);
      
      // Create working directory if it doesn't exist
      await this.fileOps.createDirectory(workingDirectory);
      
      // Load existing state if available
      await this.loadState();
      
      this.initialized = true;
      this.emit('info', {
        message: 'CodeAgent initialized successfully',
        agentId: this.id
      });
    } catch (error) {
      this.errorHandler.recordError(error, { phase: 'initialization' });
      this.emit('error', {
        message: `Failed to initialize CodeAgent: ${error.message}`,
        phase: 'initialization',
        error: error.message
      });
      throw new Error(`Failed to initialize CodeAgent: ${error.message}`);
    }
  }

  /**
   * Main development method - generates complete projects from requirements
   */
  async develop(requirements) {
    if (!this.initialized) {
      throw new Error('CodeAgent must be initialized before use');
    }
    
    this.emit('info', {
      message: 'Starting development process...',
      requirements
    });
    this.currentTask = {
      type: 'initial_development',
      requirements,
      startTime: new Date(),
      status: 'planning'
    };
    
    try {
      // 1. Planning Phase
      this.emit('phase-start', {
        phase: 'planning',
        emoji: '📋',
        message: 'Planning project architecture...'
      });
      await this.planProject(requirements);
      
      // 2. Code Generation Phase
      this.emit('phase-start', {
        phase: 'generation',
        emoji: '⚡',
        message: 'Generating code...'
      });
      await this.generateCode();
      
      // 3. Test Generation Phase
      this.emit('phase-start', {
        phase: 'testing',
        emoji: '🧪',
        message: 'Creating tests...'
      });
      await this.generateTests();
      
      // 4. Quality Assurance Phase
      this.emit('phase-start', {
        phase: 'quality',
        emoji: '✅',
        message: 'Running quality checks...'
      });
      await this.runQualityChecks();
      
      // 5. Iterative Fixing Phase
      this.emit('phase-start', {
        phase: 'fixing',
        emoji: '🔄',
        message: 'Applying fixes...'
      });
      await this.iterativelyFix();
      
      // 6. Completion
      this.currentTask.status = 'completed';
      this.currentTask.endTime = new Date();
      await this.saveState();
      
      this.emit('info', {
        message: '🎉 Development completed successfully!',
        summary: this.getProjectSummary()
      });
      return this.getProjectSummary();
      
    } catch (error) {
      this.currentTask.status = 'error';
      this.currentTask.error = error.message;
      await this.saveState();
      throw new Error(`Development failed: ${error.message}`);
    }
  }

  /**
   * Fix specific errors or apply required changes
   */
  async fix(fixRequirements) {
    if (!this.initialized) {
      throw new Error('CodeAgent must be initialized before use');
    }
    
    this.emit('info', {
      message: 'Starting fix process...',
      fixRequirements
    });
    this.currentTask = {
      type: 'iterative_fixing',
      fixRequirements,
      startTime: new Date(),
      status: 'analyzing'
    };
    
    try {
      // Analyze the specific issues
      await this.fixingPhase.analyzeIssues(fixRequirements);
      
      // Apply targeted fixes
      await this.fixingPhase.applyFixes(fixRequirements);
      
      // Validate fixes
      await this.runQualityChecks();
      
      // Continue iterating if needed
      await this.iterativelyFix();
      
      this.currentTask.status = 'completed';
      this.currentTask.endTime = new Date();
      await this.saveState();
      
      this.emit('info', {
        message: '🎉 Fixes applied successfully!',
        summary: this.getFixSummary()
      });
      return this.getFixSummary();
      
    } catch (error) {
      this.currentTask.status = 'error';
      this.currentTask.error = error.message;
      await this.saveState();
      throw new Error(`Fix process failed: ${error.message}`);
    }
  }

  /**
   * Delegate to phase handlers
   */
  async planProject(requirements) {
    return this.planningPhase.planProject(requirements);
  }

  async generateCode() {
    return this.generationPhase.generateCode();
  }

  async generateTests() {
    return this.testingPhase.generateTests();
  }

  async runQualityChecks() {
    return this.qualityPhase.runQualityChecks();
  }

  async iterativelyFix() {
    return this.fixingPhase.iterativelyFix();
  }

  /**
   * Load agent state from disk
   */
  async loadState() {
    try {
      const stateFile = `${this.config.workingDirectory}/${this.config.stateFile}`;
      if (await this.fileOps.fileExists(stateFile)) {
        const savedState = await this.stateManager.loadState(stateFile);
        
        // Restore state
        this.currentTask = savedState.currentTask;
        this.projectPlan = savedState.projectPlan;
        this.generatedFiles = new Set(savedState.generatedFiles || []);
        this.testFiles = new Set(savedState.testFiles || []);
        this.qualityCheckResults = savedState.qualityCheckResults;
        
        this.emit('info', {
          message: 'Previous state loaded',
          state: savedState
        });
      }
    } catch (error) {
      this.emit('warning', {
        message: `Could not load previous state: ${error.message}`,
        error: error.message
      });
    }
  }

  /**
   * Save agent state to disk
   */
  async saveState() {
    const state = {
      currentTask: this.currentTask,
      projectPlan: this.projectPlan,
      generatedFiles: Array.from(this.generatedFiles),
      testFiles: Array.from(this.testFiles),
      qualityCheckResults: this.qualityCheckResults,
      workingDirectory: this.config.workingDirectory,
      projectType: this.config.projectType,
      timestamp: Date.now()
    };
    
    await this.stateManager.saveCurrentState(state);
    this.emit('info', {
      message: 'State saved',
      timestamp: state.timestamp
    });
  }

  /**
   * Get project completion summary
   */
  getProjectSummary() {
    return {
      projectType: this.config.projectType,
      filesGenerated: this.generatedFiles.size,
      testsCreated: this.testFiles.size,
      qualityGatesPassed: this.qualityCheckResults?.overall || false,
      duration: this.currentTask ? 
        new Date() - this.currentTask.startTime : 0
    };
  }

  /**
   * Get fix completion summary
   */
  getFixSummary() {
    return {
      issuesFixed: 0, // TODO: Track actual fixes
      qualityGatesPassed: this.qualityCheckResults?.overall || false,
      duration: this.currentTask ? 
        new Date() - this.currentTask.startTime : 0
    };
  }

  /**
   * Get current agent status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      workingDirectory: this.config.workingDirectory,
      currentTask: this.currentTask,
      projectPlan: this.projectPlan,
      qualityCheckResults: this.qualityCheckResults
    };
  }
}

export { CodeAgent };