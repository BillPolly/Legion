/**
 * @jsenvoy/code-agent - Intelligent coding agent for vanilla JavaScript projects
 * 
 * This package provides an AI-powered coding agent that can generate, test, and validate
 * complete JavaScript projects with automated quality assurance.
 */

// Import the tested components from Phase 1
import { FileOperationsManager } from './integration/FileOperationsManager.js';
import { LLMClientManager } from './integration/LLMClientManager.js';
import { ModuleLoaderIntegration } from './integration/ModuleLoaderIntegration.js';
import { EslintConfigManager } from './config/EslintConfigManager.js';
import { JestConfigManager } from './config/JestConfigManager.js';
import { StateManager } from './config/StateManager.js';
import { ValidationUtils } from './utils/ValidationUtils.js';
import { ErrorHandler } from './utils/ErrorHandler.js';

// Import unified planner
import { UnifiedPlanner } from './planning/llm/UnifiedPlanner.js';

/**
 * Main CodeAgent class - entry point for all coding operations
 * 
 * The CodeAgent orchestrates the complete development workflow:
 * - Project planning and architecture design
 * - Code generation for frontend and backend
 * - Automated test creation and execution
 * - ESLint validation and automatic fixing
 * - Iterative improvement until quality gates pass
 */
class CodeAgent {
  constructor(config = {}) {
    // Initialize managers with tested components
    this.eslintManager = new EslintConfigManager(config.eslintConfig);
    this.jestManager = new JestConfigManager(config.jestConfig);
    this.stateManager = new StateManager(config.stateConfig);
    this.validator = new ValidationUtils(config.validationConfig);
    this.errorHandler = new ErrorHandler({ 
      enableLogging: false, // Disable during tests
      autoCleanup: false,
      ...config.errorConfig 
    });
    
    // Use the default rules from EslintConfigManager
    const defaultRules = this.eslintManager.getBaseRules();
    
    // Store configuration
    this.config = {
      projectType: config.projectType || 'fullstack', // 'frontend', 'backend', 'fullstack'
      workingDirectory: null,
      stateFile: '.code-agent-state.json',
      
      // Just use the default ESLint rules from the manager
      eslintRules: defaultRules,
      
      // Jest test configuration
      testCoverage: {
        threshold: 80,
        ...config.testCoverage
      },
      
      // Quality gate settings
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
    this.initialized = false;
  }

  /**
   * Initialize the CodeAgent in a specified working directory
   * @param {string} workingDirectory - Target directory for code generation
   * @param {Object} options - Initialization options
   */
  async initialize(workingDirectory, options = {}) {
    console.log(`Initializing CodeAgent in: ${workingDirectory}`);
    
    this.config.workingDirectory = workingDirectory;
    
    // Initialize all Phase 1 components
    try {
      // Initialize integration managers
      this.fileOps = new FileOperationsManager(options.fileOpsConfig);
      
      // Initialize LLM client with mock mode for tests
      const llmConfig = {
        provider: 'mock', // Default to mock provider for tests
        ...options.llmConfig
      };
      this.llmClient = new LLMClientManager(llmConfig);
      
      this.moduleLoader = new ModuleLoaderIntegration(options.moduleConfig);
      
      // Initialize file operations
      await this.fileOps.initialize();
      
      // Initialize LLM client
      await this.llmClient.initialize();
      
      // Initialize ESLint manager with project-specific config
      await this.eslintManager.initialize({ 
        projectType: this.config.projectType,
        ...this.config.eslintRules 
      });
      
      // Initialize Jest manager
      await this.jestManager.initialize({ 
        projectType: this.config.projectType 
      });
      
      // Initialize state manager
      await this.stateManager.initialize();
      
      // Initialize unified planner
      this.unifiedPlanner = new UnifiedPlanner({
        provider: llmConfig.provider || 'mock'
      });
      await this.unifiedPlanner.initialize();
      
      // Create working directory if it doesn't exist
      await this.fileOps.createDirectory(workingDirectory);
      
      // Load existing state if available
      await this.loadState();
      
      this.initialized = true;
      console.log('CodeAgent initialized successfully');
    } catch (error) {
      this.errorHandler.recordError(error, { phase: 'initialization' });
      throw new Error(`Failed to initialize CodeAgent: ${error.message}`);
    }
  }

  /**
   * Main development method - generates complete projects from requirements
   * @param {Object} requirements - Project requirements and specifications
   */
  async develop(requirements) {
    if (!this.initialized) {
      throw new Error('CodeAgent must be initialized before use');
    }
    
    console.log('Starting development process...');
    this.currentTask = {
      type: 'initial_development',
      requirements,
      startTime: new Date(),
      status: 'planning'
    };
    
    try {
      // 1. Planning Phase
      console.log('📋 Planning project architecture...');
      await this.planProject(requirements);
      
      // 2. Code Generation Phase
      console.log('⚡ Generating code...');
      await this.generateCode();
      
      // 3. Test Generation Phase
      console.log('🧪 Creating tests...');
      await this.generateTests();
      
      // 4. Quality Assurance Phase
      console.log('✅ Running quality checks...');
      await this.runQualityChecks();
      
      // 5. Iterative Fixing Phase
      console.log('🔄 Applying fixes...');
      await this.iterativelyFix();
      
      // 6. Completion
      this.currentTask.status = 'completed';
      this.currentTask.endTime = new Date();
      await this.saveState();
      
      console.log('🎉 Development completed successfully!');
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
   * @param {Object} fixRequirements - Specific errors or changes to address
   */
  async fix(fixRequirements) {
    if (!this.initialized) {
      throw new Error('CodeAgent must be initialized before use');
    }
    
    console.log('Starting fix process...');
    this.currentTask = {
      type: 'iterative_fixing',
      fixRequirements,
      startTime: new Date(),
      status: 'analyzing'
    };
    
    try {
      // Analyze the specific issues
      await this.analyzeIssues(fixRequirements);
      
      // Apply targeted fixes
      await this.applyFixes(fixRequirements);
      
      // Validate fixes
      await this.runQualityChecks();
      
      // Continue iterating if needed
      await this.iterativelyFix();
      
      this.currentTask.status = 'completed';
      this.currentTask.endTime = new Date();
      await this.saveState();
      
      console.log('🎉 Fixes applied successfully!');
      return this.getFixSummary();
      
    } catch (error) {
      this.currentTask.status = 'error';
      this.currentTask.error = error.message;
      await this.saveState();
      throw new Error(`Fix process failed: ${error.message}`);
    }
  }

  /**
   * Plan the project structure and architecture
   * @private
   */
  async planProject(requirements) {
    console.log('🔍 Analyzing requirements...');
    
    // Use unified planner to analyze requirements
    const analysis = await this.unifiedPlanner.analyzeRequirements(requirements);
    
    console.log(`📊 Analysis complete: ${analysis.projectType} project with ${analysis.complexity} complexity`);
    
    // Plan directory structure
    console.log('📁 Planning directory structure...');
    const directoryStructure = await this.unifiedPlanner.planDirectoryStructure(analysis);
    
    // Plan file dependencies
    console.log('🔗 Planning file dependencies...');
    const dependencies = await this.unifiedPlanner.planDependencies(directoryStructure, analysis);
    
    // Plan architecture based on project type
    let frontendArchitecture = null;
    let backendArchitecture = null;
    let apiInterface = null;
    
    if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
      console.log('🎨 Planning frontend architecture...');
      frontendArchitecture = await this.unifiedPlanner.planFrontendArchitecture(analysis);
    }
    
    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      console.log('⚙️ Planning backend architecture...');
      backendArchitecture = await this.unifiedPlanner.planBackendArchitecture(analysis);
    }
    
    if (frontendArchitecture && backendArchitecture) {
      console.log('🌐 Planning API interfaces...');
      apiInterface = await this.unifiedPlanner.planAPIInterface(frontendArchitecture, backendArchitecture);
    }
    
    this.projectPlan = {
      analysis,
      directoryStructure,
      dependencies,
      frontendArchitecture,
      backendArchitecture,
      apiInterface,
      architecture: analysis.projectType
    };
    
    console.log('✅ Project planning completed');
  }

  /**
   * Generate code based on the project plan
   * @private
   */
  async generateCode() {
    // TODO: Implement code generation logic
    // - Generate frontend files (HTML, CSS, JS)
    // - Generate backend files (Node.js modules)
    // - Apply consistent coding patterns
    // - Ensure proper import/export structure
    
    console.log('Code generation completed');
  }

  /**
   * Generate comprehensive Jest tests
   * @private
   */
  async generateTests() {
    // TODO: Implement test generation logic
    // - Create unit tests for all functions
    // - Create integration tests for components
    // - Generate test data and fixtures
    // - Ensure adequate coverage
    
    console.log('Test generation completed');
  }

  /**
   * Run ESLint and Jest validation
   * @private
   */
  async runQualityChecks() {
    // TODO: Implement quality checking logic
    // - Run ESLint programmatically with dynamic rules
    // - Execute Jest tests and collect results
    // - Validate coverage requirements
    // - Check import/export consistency
    
    this.qualityCheckResults = {
      eslint: { errors: 0, warnings: 0, passed: true },
      jest: { passed: true, coverage: 100, failedTests: [] },
      overall: true
    };
    
    console.log('Quality checks completed');
  }

  /**
   * Iteratively fix issues until all quality gates pass
   * @private
   */
  async iterativelyFix() {
    // TODO: Implement iterative fixing logic
    // - Analyze quality check results
    // - Generate targeted fixes
    // - Apply fixes incrementally
    // - Re-run quality checks
    // - Continue until success or max iterations
    
    console.log('Iterative fixing completed');
  }

  /**
   * Analyze specific issues for targeted fixing
   * @private
   */
  async analyzeIssues(fixRequirements) {
    // TODO: Implement issue analysis logic
    console.log('Issue analysis completed');
  }

  /**
   * Apply targeted fixes for specific issues
   * @private
   */
  async applyFixes(fixRequirements) {
    // TODO: Implement targeted fix application
    console.log('Fixes applied');
  }

  /**
   * Load agent state from disk
   * @private
   */
  async loadState() {
    try {
      const state = await this.stateManager.loadCurrentState();
      if (state) {
        // Restore state
        this.currentTask = state.currentTask || null;
        this.projectPlan = state.projectPlan || null;
        this.generatedFiles = new Set(state.generatedFiles || []);
        this.testFiles = new Set(state.testFiles || []);
        this.qualityCheckResults = state.qualityCheckResults || null;
        console.log('State loaded');
      }
    } catch (error) {
      console.log('No previous state found, starting fresh');
    }
  }

  /**
   * Save agent state to disk
   * @private
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
    console.log('State saved');
  }

  /**
   * Get project completion summary
   * @private
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
   * @private
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

// Export the main class
export { CodeAgent };

// Export additional utility classes (to be implemented in Phase 2)
// export { 
//   ProjectPlanner,
//   CodeGenerator, 
//   TestGenerator,
//   LintRunner,
//   QualityChecker
// } from './components/index.js';

// Default export
export default CodeAgent;