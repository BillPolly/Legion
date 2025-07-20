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
import { DeploymentIntegration } from '../integration/DeploymentIntegration.js';
import { EslintConfigManager } from '../config/EslintConfigManager.js';
import { JestConfigManager } from '../config/JestConfigManager.js';
import { StateManager } from '../config/StateManager.js';
import { ValidationUtils } from '../utils/ValidationUtils.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';
import GitIntegrationManager from '../integration/GitIntegrationManager.js';
import GitConfigValidator from '../config/GitConfigValidator.js';

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
import { DeploymentPhase } from './phases/DeploymentPhase.js';

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
    this.deploymentResult = null;
    
    // Integration managers (to be initialized)
    this.fileOps = null;
    this.llmClient = null;
    this.moduleLoader = null;
    this.unifiedPlanner = null;
    this.deploymentIntegration = null;
    
    // Git integration
    this.gitIntegration = null;
    this.gitConfig = config.gitConfig || null;
    this.enableGitIntegration = config.enableGitIntegration === true;
    this.gitHooks = config.gitHooks || {};
    this.trackGitMetrics = config.trackGitMetrics === true;
    this.trackedFiles = new Set();
    this.gitMetrics = {
      totalCommits: 0,
      commitsByPhase: {},
      filesByPhase: {},
      commitSizes: []
    };
    
    // Resource Manager for dependency injection
    this.resourceManager = null;
    
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
    this.deploymentPhase = null;
    
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
      // Get or create ResourceManager for dependency injection
      this.resourceManager = options.resourceManager;
      if (!this.resourceManager) {
        // Create new ResourceManager if not provided
        const { ResourceManager } = await import('@jsenvoy/module-loader');
        this.resourceManager = new ResourceManager();
        await this.resourceManager.initialize();
      }
      
      // Register all factories for dependency injection
      await this._registerDependencyFactories(options);
      
      // Get dependencies from ResourceManager
      this.fileOps = await this.resourceManager.getOrCreate('fileOps', options.fileOpsConfig || {});
      this.llmClient = await this.resourceManager.getOrCreate('llmClient', {
        ...this.config.llmConfig,
        ...options.llmConfig
      });
      
      // Module loader still created directly but uses ResourceManager
      this.moduleLoader = new ModuleLoaderIntegration(options.moduleConfig);
      await this.moduleLoader.initialize();
      
      // Initialize deployment integration if deployment is enabled
      if (this.config.deployment?.enabled !== false) {
        this.deploymentIntegration = new DeploymentIntegration(this.moduleLoader, this.resourceManager);
      }
      
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
      
      // Initialize unified planner from ResourceManager
      this.unifiedPlanner = await this.resourceManager.getOrCreate('unifiedPlanner', {
        llmClient: this.llmClient.llmClient
      });
      await this.unifiedPlanner.initialize();
      
      // Initialize phase handlers
      this.planningPhase = new PlanningPhase(this);
      this.generationPhase = new GenerationPhase(this);
      this.testingPhase = new TestingPhase(this);
      this.qualityPhase = new QualityPhase(this);
      this.fixingPhase = new FixingPhase(this);
      this.deploymentPhase = new DeploymentPhase(this);
      
      // Initialize deployment phase if enabled
      if (this.deploymentIntegration) {
        await this.deploymentPhase.initialize(this.deploymentIntegration);
      }
      
      // Create working directory if it doesn't exist
      await this.fileOps.createDirectory(workingDirectory);
      
      // Load existing state if available
      await this.loadState();
      
      // Initialize Git integration if enabled
      if (this.enableGitIntegration) {
        await this.initializeGit(workingDirectory);
      }
      
      this.initialized = true;
      this.emit('info', {
        message: 'CodeAgent initialized successfully',
        agentId: this.id,
        gitEnabled: this.enableGitIntegration
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
      
      // 6. Deployment Phase (optional)
      if (this.config.deployment?.enabled && this.deploymentPhase && requirements.deploy !== false) {
        this.emit('phase-start', {
          phase: 'deployment',
          emoji: '🚀',
          message: 'Deploying application...'
        });
        const deploymentResult = await this.deployApplication();
        if (deploymentResult.success) {
          this.deploymentResult = deploymentResult;
        }
      }
      
      // 7. Completion
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

  /**
   * Initialize Git integration
   */
  async initializeGit(workingDirectory) {
    try {
      // Validate Git configuration
      const { config: validatedConfig } = GitConfigValidator.validateAndMerge(this.gitConfig || {});
      this.gitConfig = validatedConfig;
      
      // Register GitHub resources if not already present
      if (this.resourceManager.has('env.GITHUB_USER')) {
        this.resourceManager.register('GITHUB_USER', this.resourceManager.get('env.GITHUB_USER'));
      }
      if (this.resourceManager.has('env.GITHUB_PAT')) {
        this.resourceManager.register('GITHUB_PAT', this.resourceManager.get('env.GITHUB_PAT'));
      }
      if (this.resourceManager.has('env.GITHUB_AGENT_ORG')) {
        this.resourceManager.register('GITHUB_AGENT_ORG', this.resourceManager.get('env.GITHUB_AGENT_ORG'));
      } else {
        this.resourceManager.register('GITHUB_AGENT_ORG', 'AgentResults');
      }
      
      // Register LLM client for Git
      if (this.llmClient?.llmClient) {
        this.resourceManager.register('llmClient', this.llmClient.llmClient);
      }
      
      this.gitIntegration = new GitIntegrationManager(this.resourceManager, validatedConfig);
      await this.gitIntegration.initialize(workingDirectory);
      
      // Set up Git event forwarding
      this.gitIntegration.on('initialized', (data) => {
        this.emit('git-initialized', data);
      });
      
      this.gitIntegration.on('commit', (data) => {
        this.emit('git-commit', data);
        if (this.trackGitMetrics) {
          this.updateGitMetrics('commit', data);
        }
      });
      
      this.gitIntegration.on('branch', (data) => {
        this.emit('git-branch', data);
      });
      
      this.gitIntegration.on('error', (data) => {
        this.emit('git-error', data);
      });
      
      this.emit('info', {
        message: 'Git integration initialized',
        repository: workingDirectory,
        remote: validatedConfig.remote?.url
      });
      
    } catch (error) {
      this.emit('warning', {
        message: `Git integration initialization failed: ${error.message}`,
        error: error.message
      });
      // Don't throw - Git integration is optional
      this.gitIntegration = null;
      this.enableGitIntegration = false;
    }
  }

  /**
   * Initialize Git repository (can be called manually)
   */
  async initializeGitRepository() {
    if (!this.gitIntegration) {
      await this.enableGitIntegrationMethod();
    }
    
    if (!this.gitIntegration) {
      throw new Error('Git integration not initialized');
    }
    
    // Repository is already initialized in GitIntegrationManager
    this.emit('info', {
      message: 'Git repository ready',
      initialized: this.gitIntegration.isInitialized()
    });
  }

  /**
   * Enable Git integration after initialization
   */
  async enableGitIntegrationMethod() {
    if (!this.initialized) {
      throw new Error('CodeAgent must be initialized first');
    }
    
    if (!this.gitIntegration) {
      this.enableGitIntegration = true;
      await this.initializeGit(this.config.workingDirectory);
    }
    
    this.emit('info', {
      message: 'Git integration enabled'
    });
  }

  /**
   * Disable Git integration
   */
  async disableGitIntegration() {
    this.enableGitIntegration = false;
    if (this.gitIntegration) {
      // Clean up Git integration
      this.gitIntegration.removeAllListeners();
      this.gitIntegration = null;
    }
    
    this.emit('info', {
      message: 'Git integration disabled'
    });
  }

  /**
   * Start a new phase with Git branch
   */
  async startPhase(phaseName) {
    if (this.gitIntegration && this.gitConfig?.branchStrategy === 'phase') {
      const branchName = await this.gitIntegration.createPhaseBranch(phaseName);
      this.emit('git-branch-created', {
        phase: phaseName,
        branch: branchName
      });
    }
    
    this.currentPhase = phaseName;
    this.emit('phase-start', {
      phase: phaseName,
      gitEnabled: !!this.gitIntegration
    });
  }

  /**
   * Complete a phase with automatic commit
   */
  async completePhase(phaseName) {
    if (this.gitIntegration && this.gitConfig?.autoCommit) {
      // Get tracked files for this phase
      const phaseFiles = Array.from(this.trackedFiles);
      
      if (phaseFiles.length > 0) {
        const commitResult = await this.commitPhase(phaseName, phaseFiles, `Complete ${phaseName} phase`);
        
        this.emit('git-phase-commit', {
          phase: phaseName,
          commit: commitResult,
          files: phaseFiles
        });
      }
    }
    
    this.emit('phase-complete', {
      phase: phaseName,
      gitEnabled: !!this.gitIntegration
    });
  }

  /**
   * Commit files for a specific phase
   */
  async commitPhase(phase, files, message) {
    if (!this.gitIntegration) {
      return { success: false, error: 'Git integration not enabled' };
    }
    
    try {
      // Apply custom hooks if defined
      let finalMessage = message;
      if (this.gitHooks.beforeCommit) {
        const hookResult = await this.gitHooks.beforeCommit(files, message);
        if (!hookResult.allow) {
          return { success: false, error: 'Commit blocked by hook' };
        }
        finalMessage = hookResult.message || message;
      }
      
      // Use CommitOrchestrator through GitIntegrationManager
      const result = await this.gitIntegration.commitChanges(files, finalMessage, {
        phase,
        type: 'phase'
      });
      
      // After commit hook
      if (this.gitHooks.afterCommit && result.success) {
        await this.gitHooks.afterCommit(result);
      }
      
      // Update metrics
      if (this.trackGitMetrics) {
        this.updateGitMetrics('phase-commit', { phase, files, result });
      }
      
      return result;
      
    } catch (error) {
      this.emit('error', {
        message: `Git commit failed: ${error.message}`,
        phase,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Track a file for the current phase
   */
  async trackFile(filename) {
    this.trackedFiles.add(filename);
    
    if (this.gitIntegration) {
      // File will be staged during commit
      this.emit('git-track', {
        file: filename,
        phase: this.currentPhase
      });
    }
  }

  /**
   * Get Git configuration
   */
  async getGitConfig() {
    if (!this.gitIntegration) {
      return this.gitConfig || GitConfigValidator.getDefaultConfig();
    }
    
    return this.gitConfig;
  }

  /**
   * Update Git configuration
   */
  async updateGitConfig(updates) {
    if (!this.gitIntegration) {
      throw new Error('Git integration not enabled');
    }
    
    // Merge with existing config
    this.gitConfig = {
      ...this.gitConfig,
      ...updates,
      user: {
        ...this.gitConfig.user,
        ...updates.user
      },
      commit: {
        ...this.gitConfig.commit,
        ...updates.commit
      },
      branch: {
        ...this.gitConfig.branch,
        ...updates.branch
      }
    };
    
    // Validate updated config
    this.gitConfig = GitConfigValidator.validate(this.gitConfig);
    
    // Update GitIntegrationManager config
    this.gitIntegration.updateConfig(this.gitConfig);
    
    this.emit('git-config-updated', {
      config: this.gitConfig
    });
  }

  /**
   * Get Git status information
   */
  async getGitStatus() {
    if (!this.gitIntegration) {
      return {
        initialized: false,
        currentBranch: null,
        trackedFiles: [],
        untrackedFiles: [],
        commits: 0
      };
    }
    
    const status = await this.gitIntegration.getStatus();
    const metrics = await this.gitIntegration.getMetrics();
    
    return {
      initialized: this.gitIntegration.isInitialized(),
      currentBranch: status.branch,
      trackedFiles: Array.from(this.trackedFiles),
      untrackedFiles: status.untracked || [],
      commits: metrics.totalCommits || 0,
      changes: status.changes || []
    };
  }

  /**
   * Get GitIntegrationManager instance
   * @returns {GitIntegrationManager|null} The Git integration manager
   */
  get gitIntegrationManager() {
    return this.gitIntegration;
  }

  /**
   * Get Git metrics
   */
  async getGitMetrics() {
    if (!this.gitIntegration || !this.trackGitMetrics) {
      return this.gitMetrics;
    }
    
    const metrics = await this.gitIntegration.getMetrics();
    
    return {
      ...this.gitMetrics,
      ...metrics,
      averageCommitSize: this.gitMetrics.commitSizes.length > 0
        ? this.gitMetrics.commitSizes.reduce((a, b) => a + b, 0) / this.gitMetrics.commitSizes.length
        : 0
    };
  }

  /**
   * Update Git metrics
   */
  updateGitMetrics(event, data) {
    if (event === 'commit' || event === 'phase-commit') {
      this.gitMetrics.totalCommits++;
      
      const phase = data.phase || 'general';
      this.gitMetrics.commitsByPhase[phase] = (this.gitMetrics.commitsByPhase[phase] || 0) + 1;
      
      if (data.files) {
        this.gitMetrics.filesByPhase[phase] = (this.gitMetrics.filesByPhase[phase] || 0) + data.files.length;
        this.gitMetrics.commitSizes.push(data.files.length);
      }
    }
  }

  /**
   * Register dependency factories with ResourceManager
   * @private
   */
  async _registerDependencyFactories(options) {
    const rm = this.resourceManager;
    
    // Register FileOperationsManager factory
    if (!rm.has('fileOps')) {
      rm.registerFactory('fileOps', (config, resourceManager) => {
        return new FileOperationsManager(config);
      });
    }
    
    // Register LLMClientManager factory
    if (!rm.has('llmClient')) {
      rm.registerFactory('llmClient', async (config, resourceManager) => {
        // Determine provider from config or environment
        let provider = config.provider;
        let apiKey = config.apiKey;
        
        if (!provider && resourceManager.has('env.LLM_PROVIDER')) {
          provider = resourceManager.get('env.LLM_PROVIDER');
        }
        
        if (!provider) {
          throw new Error('LLM provider not configured. Set llmConfig.provider or LLM_PROVIDER environment variable');
        }
        
        // Get API key from config or environment
        if (!apiKey) {
          const envKey = `env.${provider.toUpperCase()}_API_KEY`;
          if (resourceManager.has(envKey)) {
            apiKey = resourceManager.get(envKey);
          }
        }
        
        if (!apiKey && provider !== 'mock') {
          throw new Error(`API key not found for provider '${provider}'. Set ${provider.toUpperCase()}_API_KEY in .env file`);
        }
        
        const llmConfig = {
          provider,
          apiKey,
          model: config.model || (provider === 'anthropic' ? 'claude-3-sonnet-20240229' : 'gpt-3.5-turbo'),
          ...config
        };
        
        const client = new LLMClientManager(llmConfig);
        await client.initialize();
        return client;
      });
    }
    
    // Register UnifiedPlanner factory
    if (!rm.has('unifiedPlanner')) {
      rm.registerFactory('unifiedPlanner', (config, resourceManager) => {
        return new UnifiedPlanner({
          llmClient: config.llmClient
        });
      });
    }
    
    // Register other common dependencies
    rm.registerFactory('eslintManager', (config) => new EslintConfigManager(config));
    rm.registerFactory('jestManager', (config) => new JestConfigManager(config));
    rm.registerFactory('stateManager', (config) => new StateManager(config));
    rm.registerFactory('validator', (config) => new ValidationUtils(config));
    rm.registerFactory('errorHandler', (config) => new ErrorHandler({
      enableLogging: false,
      autoCleanup: false,
      ...config
    }));
  }

  /**
   * Get project summary including all phases
   * @returns {Object} Project summary
   */
  getProjectSummary() {
    const summary = {
      projectName: this.projectPlan?.projectName || 'Generated Project',
      projectType: this.config.projectType,
      startTime: this.currentTask?.startTime,
      endTime: this.currentTask?.endTime,
      duration: this.currentTask?.endTime - this.currentTask?.startTime,
      phases: {
        planning: {
          completed: !!this.projectPlan,
          fileCount: this.projectPlan?.files?.length || 0
        },
        generation: {
          completed: this.generatedFiles.size > 0,
          filesGenerated: this.generatedFiles.size
        },
        testing: {
          completed: this.testFiles.size > 0,
          testsGenerated: this.testFiles.size
        },
        quality: {
          completed: !!this.qualityCheckResults,
          eslintPassed: this.qualityCheckResults?.eslint?.passed || false,
          jestPassed: this.qualityCheckResults?.jest?.passed || false,
          coverage: this.qualityCheckResults?.jest?.coverage || 0
        },
        fixing: {
          completed: this.qualityCheckResults?.overall || false,
          iterations: this.fixingPhase?.iterations || 0
        }
      },
      files: {
        generated: Array.from(this.generatedFiles),
        tests: Array.from(this.testFiles)
      },
      workingDirectory: this.config.workingDirectory
    };

    // Add deployment info if available
    if (this.deploymentResult) {
      summary.deployment = {
        completed: true,
        provider: this.deploymentResult.provider,
        deploymentId: this.deploymentResult.deploymentId,
        url: this.deploymentResult.url,
        status: this.deploymentResult.status
      };
    } else if (this.config.deployment?.enabled) {
      summary.deployment = {
        completed: false,
        enabled: true,
        provider: this.config.deployment.provider
      };
    }

    // Add Git info if available
    if (this.gitIntegration && this.trackGitMetrics) {
      summary.git = this.getGitSummary();
    }

    return summary;
  }

  /**
   * Deploy the generated application
   * @param {Object} deploymentConfig - Optional deployment configuration
   * @returns {Promise<Object>} Deployment result
   */
  async deployApplication(deploymentConfig = {}) {
    if (!this.deploymentPhase) {
      throw new Error('Deployment phase not initialized');
    }

    // Merge with default deployment config
    const config = {
      ...this.config.deployment,
      ...deploymentConfig
    };

    return await this.deploymentPhase.deployApplication(config);
  }

  /**
   * Get deployment status
   * @param {string} deploymentId - Optional deployment ID
   * @returns {Promise<Object>} Deployment status
   */
  async getDeploymentStatus(deploymentId) {
    if (!this.deploymentIntegration) {
      throw new Error('Deployment integration not initialized');
    }

    return await this.deploymentIntegration.getStatus(
      deploymentId || this.deploymentResult?.deploymentId
    );
  }

  /**
   * Get deployment logs
   * @param {string} deploymentId - Optional deployment ID
   * @param {Object} options - Log options
   * @returns {Promise<Object>} Deployment logs
   */
  async getDeploymentLogs(deploymentId, options = {}) {
    if (!this.deploymentPhase) {
      throw new Error('Deployment phase not initialized');
    }

    return await this.deploymentPhase.getDeploymentLogs(deploymentId, options);
  }

  /**
   * Stop deployment
   * @param {string} deploymentId - Optional deployment ID
   * @returns {Promise<Object>} Stop result
   */
  async stopDeployment(deploymentId) {
    if (!this.deploymentPhase) {
      throw new Error('Deployment phase not initialized');
    }

    return await this.deploymentPhase.stopDeployment(deploymentId);
  }

  /**
   * Remove deployment
   * @param {string} deploymentId - Optional deployment ID
   * @returns {Promise<Object>} Remove result
   */
  async removeDeployment(deploymentId) {
    if (!this.deploymentPhase) {
      throw new Error('Deployment phase not initialized');
    }

    return await this.deploymentPhase.removeDeployment(deploymentId);
  }

  /**
   * Run tests for the generated application
   * @returns {Promise<Object>} Test results
   */
  async testApplication() {
    if (!this.qualityPhase) {
      throw new Error('Quality phase not initialized');
    }

    this.emit('progress', {
      phase: 'testing',
      step: 'starting',
      message: '🧪 Running application tests...'
    });

    try {
      // Run Jest tests using the quality phase
      const testResults = await this.qualityPhase.runJestTests();
      
      this.emit('phase-complete', {
        phase: 'testing',
        message: `Tests ${testResults.passed ? 'PASSED' : 'FAILED'}: ${testResults.passedTests}/${testResults.totalTests} passed`,
        results: testResults
      });

      return {
        success: testResults.passed,
        totalTests: testResults.totalTests,
        passedTests: testResults.passedTests,
        failedTests: testResults.failedTests,
        coverage: testResults.coverage,
        failures: testResults.failures,
        testSuites: testResults.testSuites
      };
    } catch (error) {
      this.emit('error', {
        phase: 'testing',
        message: `Test execution failed: ${error.message}`,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cleanup CodeAgent resources
   */
  async cleanup() {
    try {
      // Save final state
      await this.saveState();
      
      // Cleanup deployment if active
      if (this.deploymentResult && this.config.deployment?.autoCleanup) {
        await this.removeDeployment(this.deploymentResult.deploymentId);
      }
      
      // Cleanup Git integration if enabled
      if (this.gitIntegration) {
        this.gitIntegration.removeAllListeners();
      }
      
      // Cleanup other managers
      // (Add more cleanup as needed)
      
    } catch (error) {
      this.emit('warning', {
        message: `Cleanup error: ${error.message}`,
        error: error.message
      });
    }
  }
}

export { CodeAgent };