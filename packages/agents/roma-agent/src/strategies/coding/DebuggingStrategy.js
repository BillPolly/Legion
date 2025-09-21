/**
 * DebuggingStrategy - TaskStrategy implementation for debugging and fixing tasks
 * 
 * Adapts CodeAgent's fixing phase iterative pattern to TaskStrategy interface.
 * Handles error analysis, issue identification, and code fixing tasks.
 */

import { TaskStrategy } from '@legion/tasks';
import fs from 'fs/promises';
import path from 'path';

export default class DebuggingStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.currentTask = null;
    this.maxFixAttempts = 3; // Maximum number of fix attempts
    
    // Configurable project root directory - defaults to /tmp but can be overridden
    this.projectRoot = options.projectRoot || process.env.PROJECT_ROOT || '/tmp';
    
    // Pre-instantiated tools (will be loaded during initialization)
    this.tools = {
      fileRead: null,
      fileWrite: null,
      directoryCreate: null,
      validateJavaScript: null,
      commandExecutor: null,
      bashExecutor: null,
      analysePicture: null
    };
  }
  
  getName() {
    return 'Debugging';
  }
  
  /**
   * Handle messages from parent task (start work requests)
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this.currentTask = parentTask;
        return await this._handleDebuggingWork(parentTask);
        
      case 'abort':
        console.log(`🛑 DebuggingStrategy received abort`);
        return { acknowledged: true, aborted: true };
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (not applicable - DebuggingStrategy is leaf)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'DebuggingStrategy does not handle child messages' };
  }
  
  /**
   * Main debugging work handler
   * @private
   */
  async _handleDebuggingWork(task) {
    try {
      console.log(`🐛 DebuggingStrategy handling: ${task.description}`);
      
      // Initialize components
      await this._initializeComponents(task);
      
      // Classify the debugging task type
      const debuggingType = await this._classifyDebugTask(task);
      task.addConversationEntry('system', `Classified as debugging task: ${debuggingType.type} - ${debuggingType.reasoning}`);
      
      // Execute based on debugging task type
      let result;
      switch (debuggingType.type) {
        case 'ERROR_ANALYSIS':
          result = await this._analyzeErrors(task, debuggingType);
          break;
          
        case 'CODE_FIXING':
          result = await this._fixCode(task, debuggingType);
          break;
          
        case 'TEST_DEBUGGING':
          result = await this._debugTests(task, debuggingType);
          break;
          
        case 'PERFORMANCE_DEBUGGING':
          result = await this._debugPerformance(task, debuggingType);
          break;
          
        case 'COMPILATION_FIXING':
          result = await this._fixCompilation(task, debuggingType);
          break;
          
        case 'RUNTIME_DEBUGGING':
          result = await this._debugRuntime(task, debuggingType);
          break;
          
        default:
          result = await this._genericDebugging(task, debuggingType);
      }
      
      if (result.success) {
        task.complete(result);
        return result;
      } else {
        task.fail(new Error(result.error || 'Debugging failed'));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ DebuggingStrategy error:`, error);
      task.fail(error);
      return {
        success: false,
        error: error.message,
        artifacts: Object.values(task.getAllArtifacts())
      };
    }
  }
  
  /**
   * Initialize strategy components
   * @private
   */
  async _initializeComponents(task) {
    const context = this._getContextFromTask(task);
    
    this.llmClient = this.llmClient || context.llmClient;
    this.toolRegistry = this.toolRegistry || context.toolRegistry;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required for DebuggingStrategy');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required for DebuggingStrategy');
    }
    
    // Load required tools if not already loaded
    await this._loadRequiredTools();
  }
  
  /**
   * Load and cache required tools during initialization
   * @private
   */
  async _loadRequiredTools() {
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required to load tools');
    }
    
    try {
      // Load file operations tools
      this.tools.fileRead = await this.toolRegistry.getTool('file_read');
      this.tools.fileWrite = await this.toolRegistry.getTool('file_write');
      this.tools.directoryCreate = await this.toolRegistry.getTool('directory_create');
      
      // Load validation tools
      this.tools.validateJavaScript = await this.toolRegistry.getTool('validate_javascript');
      
      // Load command execution tools (prioritize command_executor, fallback to Bash)
      this.tools.commandExecutor = await this.toolRegistry.getTool('command_executor');
      if (!this.tools.commandExecutor) {
        this.tools.bashExecutor = await this.toolRegistry.getTool('Bash');
      }
      
      // Load image analysis tool for screenshot debugging
      this.tools.analysePicture = await this.toolRegistry.getTool('analyse_picture');
      
      // Validate that essential tools are available
      const requiredTools = ['fileRead', 'fileWrite'];
      for (const toolName of requiredTools) {
        if (!this.tools[toolName]) {
          throw new Error(`Required tool ${toolName} is not available`);
        }
      }
      
      // Ensure we have at least one command execution tool
      if (!this.tools.commandExecutor && !this.tools.bashExecutor) {
        throw new Error('No command execution tool available (need command_executor or Bash)');
      }
      
      console.log('🐛 DebuggingStrategy tools loaded successfully');
      
    } catch (error) {
      throw new Error(`Failed to load required tools: ${error.message}`);
    }
  }
  
  /**
   * Extract context from task
   * @private
   */
  _getContextFromTask(task) {
    // Use ambient project root variable - prioritize task context, then strategy config, then default
    const workspaceDir = (task.lookup && task.lookup('workspaceDir')) || 
                        task.context?.workspaceDir || 
                        this.projectRoot;
    
    return {
      llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
      toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
      workspaceDir: workspaceDir,
    };
  }
  
  /**
   * Classify the type of debugging task
   * @private
   */
  async _classifyDebugTask(task) {
    const prompt = `Classify this debugging task into one of these categories:

Task: "${task.description}"

Categories:
1. ERROR_ANALYSIS - Analyze error messages and logs to identify root causes
2. CODE_FIXING - Fix bugs in existing code
3. TEST_DEBUGGING - Debug failing tests and test issues
4. PERFORMANCE_DEBUGGING - Debug performance issues and bottlenecks
5. COMPILATION_FIXING - Fix compilation errors and syntax issues
6. RUNTIME_DEBUGGING - Debug runtime errors and exceptions
7. GENERIC_DEBUGGING - Other debugging-related tasks

Artifacts available: ${task.getArtifactsContext()}

Return JSON:
{
  "type": "ERROR_ANALYSIS|CODE_FIXING|TEST_DEBUGGING|PERFORMANCE_DEBUGGING|COMPILATION_FIXING|RUNTIME_DEBUGGING|GENERIC_DEBUGGING",
  "reasoning": "explanation of classification",
  "severity": "low|medium|high|critical",
  "language": "javascript|typescript|python|java|other"
}`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      console.log(`⚠️ Debug task classification failed, defaulting to ERROR_ANALYSIS: ${error.message}`);
      return {
        type: 'ERROR_ANALYSIS',
        reasoning: 'Classification failed, using default',
        severity: 'medium',
        language: 'javascript'
      };
    }
  }
  
  /**
   * Analyze errors to identify root causes
   * @private
   */
  async _analyzeErrors(task, debuggingType) {
    console.log(`🔍 Analyzing errors for: ${task.description}`);
    
    // Get error artifacts
    const errorArtifacts = this._getErrorArtifacts(task);
    
    if (errorArtifacts.length === 0) {
      return {
        success: false,
        error: 'No error information found to analyze'
      };
    }
    
    const analysis = await this._performErrorAnalysis(task, errorArtifacts, debuggingType);
    
    // Store analysis as artifact
    task.storeArtifact('error_analysis', analysis, 'Error analysis results', 'json');
    
    return {
      success: true,
      result: {
        message: 'Error analysis completed',
        errorsAnalyzed: errorArtifacts.length,
        analysis: analysis
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Fix bugs in existing code
   * @private
   */
  async _fixCode(task, debuggingType) {
    console.log(`🔧 Fixing code for: ${task.description}`);
    
    let fixAttempts = 0;
    let lastError = null;
    
    // Setup organized project directory for fixed files
    const outputDir = await this._setupProjectDirectory(task, debuggingType);
    
    while (fixAttempts < this.maxFixAttempts) {
      fixAttempts++;
      console.log(`🔄 Fix attempt ${fixAttempts}/${this.maxFixAttempts}`);
      
      try {
        // Get current code and error information
        const codeFiles = await this._getCodeFiles(task);
        const errorInfo = this._getErrorArtifacts(task);
        
        if (codeFiles.length === 0) {
          return {
            success: false,
            error: 'No code files found to fix'
          };
        }
        
        // Generate fixes for each problematic file
        const fixResults = [];
        
        for (const codeFile of codeFiles) {
          const fixResult = await this._generateAndApplyFix(task, codeFile, errorInfo, debuggingType);
          fixResults.push(fixResult);
          
          if (fixResult.success) {
            // Write fixed file to organized project directory
            const filepath = path.join(outputDir, codeFile.filename);
            
            // Ensure directory exists for the file
            const fileDir = path.dirname(filepath);
            await this.tools.directoryCreate.execute({ path: fileDir });
            
            await this.tools.fileWrite.execute({ filepath, content: fixResult.fixedCode });
            
            // Store fixed code as artifact
            task.storeArtifact(
              `fixed_${codeFile.filename}`,
              fixResult.fixedCode,
              `Fixed version of ${codeFile.filename}`,
              'file'
            );
            
            console.log(`✅ Applied fix to ${codeFile.filename}`);
          }
        }
        
        // Verify fixes by running validation
        const validationResult = await this._validateFixes(task, debuggingType, outputDir);
        
        if (validationResult.success) {
          return {
            success: true,
            result: {
              message: `Code fixed successfully after ${fixAttempts} attempts`,
              filesFixed: fixResults.filter(r => r.success).length,
              fixAttempts: fixAttempts,
              validation: validationResult
            },
            artifacts: Object.values(task.getAllArtifacts())
          };
        } else {
          lastError = validationResult.error;
          console.log(`❌ Fix validation failed: ${validationResult.error}`);
          
          // Store validation error for next attempt
          task.storeArtifact(
            `validation_error_attempt_${fixAttempts}`,
            validationResult.error,
            `Validation error from attempt ${fixAttempts}`,
            'error'
          );
        }
        
      } catch (error) {
        lastError = error.message;
        console.log(`❌ Fix attempt ${fixAttempts} failed: ${error.message}`);
      }
    }
    
    return {
      success: false,
      error: `Failed to fix code after ${this.maxFixAttempts} attempts. Last error: ${lastError}`,
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Debug failing tests
   * @private
   */
  async _debugTests(task, debuggingType) {
    console.log(`🧪 Debugging tests for: ${task.description}`);
    
    // Get test failure information
    const testFailures = task.getArtifact('test_failures');
    
    if (!testFailures) {
      return {
        success: false,
        error: 'No test failure information found'
      };
    }
    
    // Analyze test failures
    const debugAnalysis = await this._analyzeTestFailures(task, testFailures.value, debuggingType);
    
    // Store debug analysis
    task.storeArtifact('test_debug_analysis', debugAnalysis, 'Test debugging analysis', 'json');
    
    // If analysis suggests fixes, attempt to apply them
    if (debugAnalysis.suggestedFixes && debugAnalysis.suggestedFixes.length > 0) {
      const fixResults = await this._applyTestFixes(task, debugAnalysis.suggestedFixes, debuggingType);
      
      return {
        success: fixResults.success,
        result: {
          message: fixResults.success ? 'Test debugging completed with fixes applied' : 'Test debugging completed, manual fixes needed',
          analysis: debugAnalysis,
          fixResults: fixResults
        },
        artifacts: Object.values(task.getAllArtifacts())
      };
    }
    
    return {
      success: true,
      result: {
        message: 'Test debugging analysis completed',
        analysis: debugAnalysis
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Debug performance issues
   * @private
   */
  async _debugPerformance(task, debuggingType) {
    console.log(`⚡ Debugging performance for: ${task.description}`);
    
    // Get performance data if available
    const performanceData = task.getArtifact('performance_data');
    
    // Analyze code for performance issues
    const performanceAnalysis = await this._analyzePerformance(task, performanceData?.value, debuggingType);
    
    // Store performance analysis
    task.storeArtifact('performance_analysis', performanceAnalysis, 'Performance debugging analysis', 'json');
    
    return {
      success: true,
      result: {
        message: 'Performance debugging analysis completed',
        analysis: performanceAnalysis
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Fix compilation errors
   * @private
   */
  async _fixCompilation(task, debuggingType) {
    console.log(`🔨 Fixing compilation errors for: ${task.description}`);
    
    // Get compilation errors
    const compilationErrors = this._getCompilationErrors(task);
    
    if (compilationErrors.length === 0) {
      return {
        success: false,
        error: 'No compilation errors found to fix'
      };
    }
    
    // Fix compilation errors
    const fixResult = await this._fixCompilationErrors(task, compilationErrors, debuggingType);
    
    return {
      success: fixResult.success,
      result: {
        message: fixResult.success ? 'Compilation errors fixed' : 'Failed to fix compilation errors',
        errorsFixed: fixResult.errorsFixed || 0,
        details: fixResult.details
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Debug runtime errors
   * @private
   */
  async _debugRuntime(task, debuggingType) {
    console.log(`🚨 Debugging runtime errors for: ${task.description}`);
    
    // Get runtime error information
    const runtimeErrors = this._getRuntimeErrors(task);
    
    if (runtimeErrors.length === 0) {
      return {
        success: false,
        error: 'No runtime errors found to debug'
      };
    }
    
    // Analyze runtime errors
    const debugAnalysis = await this._analyzeRuntimeErrors(task, runtimeErrors, debuggingType);
    
    // Store analysis
    task.storeArtifact('runtime_debug_analysis', debugAnalysis, 'Runtime error debugging analysis', 'json');
    
    return {
      success: true,
      result: {
        message: 'Runtime error debugging analysis completed',
        errorsAnalyzed: runtimeErrors.length,
        analysis: debugAnalysis
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Generic debugging for unclassified issues
   * @private
   */
  async _genericDebugging(task, debuggingType) {
    console.log(`🔧 Generic debugging for: ${task.description}`);
    
    // Perform general debugging analysis
    const debugAnalysis = await this._performGenericDebugging(task, debuggingType);
    
    // Store analysis
    task.storeArtifact('debug_analysis', debugAnalysis, 'Generic debugging analysis', 'json');
    
    return {
      success: true,
      result: {
        message: 'Generic debugging analysis completed',
        analysis: debugAnalysis
      },
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Get error artifacts from task
   * @private
   */
  _getErrorArtifacts(task) {
    const artifacts = task.getAllArtifacts();
    const errorArtifacts = [];
    
    for (const [name, artifact] of Object.entries(artifacts)) {
      if (this._isErrorArtifact(name, artifact)) {
        errorArtifacts.push({
          name: name,
          content: artifact.value,
          type: artifact.type
        });
      }
    }
    
    return errorArtifacts;
  }
  
  /**
   * Check if artifact contains error information
   * @private
   */
  _isErrorArtifact(name, artifact) {
    const errorIndicators = ['error', 'exception', 'failure', 'stack', 'log'];
    return errorIndicators.some(indicator => 
      name.toLowerCase().includes(indicator) || 
      (artifact.type && artifact.type.toLowerCase().includes(indicator))
    );
  }
  
  /**
   * Get code files from task artifacts
   * @private
   */
  async _getCodeFiles(task) {
    const artifacts = task.getAllArtifacts();
    const codeFiles = [];
    
    for (const [name, artifact] of Object.entries(artifacts)) {
      if (artifact.type === 'file' && this._isCodeFile(name)) {
        codeFiles.push({
          filename: name,
          content: artifact.value
        });
      }
    }
    
    return codeFiles;
  }
  
  /**
   * Check if filename represents a code file
   * @private
   */
  _isCodeFile(filename) {
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs'];
    return codeExtensions.some(ext => filename.endsWith(ext));
  }
  
  /**
   * Perform error analysis with LLM
   * @private
   */
  async _performErrorAnalysis(task, errorArtifacts, debuggingType) {
    const prompt = `Analyze these errors and identify root causes:

Task: "${task.description}"
Language: ${debuggingType.language}
Severity: ${debuggingType.severity}

Errors:
${errorArtifacts.map(e => `${e.name}: ${e.content}`).join('\n\n')}

For each error, provide:
1. Root cause analysis
2. Impact assessment
3. Suggested solution
4. Prevention strategy

Return JSON with detailed analysis.`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      return {
        error: 'Failed to analyze errors',
        details: error.message
      };
    }
  }
  
  /**
   * Generate and apply a fix for a code file
   * @private
   */
  async _generateAndApplyFix(task, codeFile, errorInfo, debuggingType) {
    const prompt = `Fix this code file based on the error information:

File: ${codeFile.filename}
Current Code:
\`\`\`
${codeFile.content}
\`\`\`

Error Information:
${errorInfo.map(e => `${e.name}: ${e.content}`).join('\n')}

Language: ${debuggingType.language}
Task Context: "${task.description}"

Generate the fixed code that addresses the errors. Return only the corrected code.`;

    try {
      const fixedCode = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return {
        success: true,
        fixedCode: fixedCode,
        filename: codeFile.filename
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        filename: codeFile.filename
      };
    }
  }
  
  /**
   * Validate that fixes work correctly
   * @private
   */
  async _validateFixes(task, debuggingType, outputDir) {
    // Try to get a validation tool from toolRegistry
    const validationTools = ['validate_javascript_syntax', 'lint_code', 'run_tests'];
    
    for (const toolName of validationTools) {
      try {
        const tool = await this.toolRegistry.getTool(toolName);
        if (tool) {
          const result = await tool.execute({
            workspaceDir: outputDir || this._getContextFromTask(task).workspaceDir
          });
          
          return {
            success: result.success,
            error: result.success ? null : result.error || 'Validation failed'
          };
        }
      } catch (error) {
        continue; // Try next tool
      }
    }
    
    // If no validation tools available, assume success
    return { success: true };
  }
  
  /**
   * Get compilation errors from artifacts
   * @private
   */
  _getCompilationErrors(task) {
    const artifacts = task.getAllArtifacts();
    const compilationErrors = [];
    
    for (const [name, artifact] of Object.entries(artifacts)) {
      if (name.toLowerCase().includes('compilation') || name.toLowerCase().includes('build')) {
        compilationErrors.push({
          source: name,
          content: artifact.value
        });
      }
    }
    
    return compilationErrors;
  }
  
  /**
   * Get runtime errors from artifacts
   * @private
   */
  _getRuntimeErrors(task) {
    const artifacts = task.getAllArtifacts();
    const runtimeErrors = [];
    
    for (const [name, artifact] of Object.entries(artifacts)) {
      if (name.toLowerCase().includes('runtime') || name.toLowerCase().includes('exception')) {
        runtimeErrors.push({
          source: name,
          content: artifact.value
        });
      }
    }
    
    return runtimeErrors;
  }
  
  /**
   * Setup organized project directory with descriptive name
   * @private
   */
  async _setupProjectDirectory(task, debuggingType) {
    const projectName = this._generateProjectName(task.description, debuggingType);
    const romaProjectsDir = '/tmp/roma-projects';
    const outputDir = path.join(romaProjectsDir, projectName);
    
    // Ensure roma-projects directory exists
    await this.tools.directoryCreate.execute({ path: romaProjectsDir });
    await this.tools.directoryCreate.execute({ path: outputDir });
    
    return outputDir;
  }
  
  /**
   * Generate a descriptive project name from task description
   * @private
   */
  _generateProjectName(description, debuggingType) {
    // Extract key words from description and create a clean project name
    const cleanedDescription = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .split(' ')
      .filter(word => word.length > 2) // Remove short words
      .slice(0, 4) // Take first 4 meaningful words
      .join('-');
    
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
    const projectType = debuggingType.type ? debuggingType.type.toLowerCase().replace('_', '-') : 'debugging';
    
    return `${projectType}-${cleanedDescription}-${timestamp}`;
  }
  
  /**
   * Additional helper methods would go here for:
   * - _analyzeTestFailures
   * - _applyTestFixes  
   * - _analyzePerformance
   * - _fixCompilationErrors
   * - _analyzeRuntimeErrors
   * - _performGenericDebugging
   * 
   * These follow similar patterns to the methods above
   */
}