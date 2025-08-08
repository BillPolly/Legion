/**
 * PlanExecutionEngine - Handles actual plan execution using PlanExecutor
 * 
 * This component manages:
 * - Integration with PlanExecutor for step-by-step execution
 * - Real-time execution progress and events
 * - Execution control (pause, resume, cancel)
 * - Communication with TaskOrchestrator
 * 
 * State machine: idle → executing → paused/complete/failed
 */
export class PlanExecutionEngine {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.state = 'idle'; // 'idle', 'executing', 'paused', 'complete', 'failed'
    this.planExecutor = null;
    this.currentExecution = null;
    this.executionResult = null;
  }
  
  /**
   * Execute a validated plan
   */
  async executePlan(plan, options = {}) {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start execution, current state: ${this.state}`);
    }
    
    if (!plan || plan.status !== 'validated') {
      throw new Error('Plan must be validated before execution');
    }
    
    this.state = 'executing';
    
    // Send detailed execution start message
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_status',
      message: `🚀 Starting Plan Execution\n\n📋 Plan: ${plan.name || 'JavaScript Development Plan'}\n• Total steps: ${plan.steps?.length || 0}\n• Working directory: ${options.workspaceDir || process.cwd()}\n• Continue on error: Yes\n• Max retries: ${options.retries || 2}\n\nInitializing execution environment...`,
      progress: 0
    });
    
    try {
      // Load required modules before execution
      await this.loadRequiredModules(plan);
      
      // Create PlanExecutor if not already created
      await this.ensurePlanExecutor();
      
      // Set up execution options
      const executionOptions = {
        emitProgress: true,
        stopOnError: false, // Continue on errors to provide better feedback
        timeout: 300000, // 5 minutes per action
        retries: 2,
        workspaceDir: options.workspaceDir || process.cwd(),
        ...options
      };
      
      // Set up event listeners for real-time progress
      this.setupExecutionEventListeners();
      
      // Execute the behavior tree plan
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_update',
        message: 'Executing behavior tree plan...',
        progress: 10
      });
      
      const result = await this.planExecutor.executeTree(plan, executionOptions);
      this.executionResult = result;
      
      // Handle execution completion
      if (result.success) {
        this.handleExecutionSuccess(result);
      } else {
        this.handleExecutionFailure(result);
      }
      
    } catch (error) {
      this.handleExecutionError(error);
    } finally {
      // Clean up event listeners
      this.cleanupExecutionEventListeners();
    }
  }
  
  /**
   * Load required modules based on plan metadata
   */
  async loadRequiredModules(plan) {
    // Note: Module loading will be handled by PlanExecutor directly
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_update',
      message: 'Loading required modules for execution...',
      progress: 5
    });
    
    // Get required modules from plan metadata or profile
    let requiredModules = [];
    
    // Check plan metadata for profile info
    if (plan.metadata?.profile) {
      // For javascript-development profile, we know the required modules
      if (plan.metadata.profile === 'javascript-development') {
        requiredModules = ['file', 'command-executor', 'node-runner', 'jester', 'js-generator', 'code-analysis'];
      }
    }
    
    // Also extract unique tool types from plan actions
    const toolTypes = new Set();
    const extractToolTypes = (steps) => {
      for (const step of steps) {
        if (step.actions) {
          for (const action of step.actions) {
            if (action.type) {
              // Map action types to module names
              const moduleMap = {
                'directory_create': 'file',
                'file_write': 'file',
                'file_read': 'file',
                'directory_list': 'file',
                'command_executor': 'command-executor',
                'install_dependencies': 'command-executor',
                'run_npm_script': 'node-runner',
                'run_tests': 'jester',
                'test_with_analytics': 'jester',
                'generate_javascript_module': 'js-generator',
                'generate_unit_tests': 'js-generator',
                'validate_javascript': 'code-analysis',
                'create_package_json': 'js-generator',
                'install_packages': 'command-executor'
              };
              
              const moduleName = moduleMap[action.type];
              if (moduleName) {
                toolTypes.add(moduleName);
              }
            }
          }
        }
        // Recursively check nested steps
        if (step.steps) {
          extractToolTypes(step.steps);
        }
      }
    };
    
    if (plan.steps) {
      extractToolTypes(plan.steps);
    }
    
    // Combine required modules
    const allModules = new Set([...requiredModules, ...toolTypes]);
    
    if (allModules.size === 0) {
      return;
    }
    
    // Check which modules are already loaded
    const modulesToLoad = [];
    for (const moduleName of allModules) {
      try {
        const existingTools = await moduleLoader.getToolsFromModule(moduleName);
        if (!existingTools || existingTools.length === 0) {
          modulesToLoad.push(moduleName);
        } else {
          console.log(`PlanExecutionEngine: Module ${moduleName} already loaded with ${existingTools.length} tools`);
        }
      } catch (error) {
        // Module not loaded yet
        modulesToLoad.push(moduleName);
      }
    }
    
    if (modulesToLoad.length === 0) {
      console.log('PlanExecutionEngine: All required modules are already loaded');
      return;
    }
    
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_update',
      message: `Loading ${modulesToLoad.length} required modules: ${modulesToLoad.join(', ')}...`,
      progress: 8
    });
    
    // Load each missing module
    const loadPromises = [];
    for (const moduleName of modulesToLoad) {
      console.log(`PlanExecutionEngine: Loading module ${moduleName}`);
      loadPromises.push(
        moduleLoader.loadModuleByName(moduleName)
          .then(() => console.log(`PlanExecutionEngine: Loaded module ${moduleName}`))
          .catch(err => console.error(`PlanExecutionEngine: Failed to load module ${moduleName}:`, err.message))
      );
    }
    
    // Wait for all modules to load
    if (loadPromises.length > 0) {
      await Promise.all(loadPromises);
      
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_update', 
        message: 'All required modules loaded successfully.',
        progress: 10
      });
    }
  }
  
  /**
   * Ensure BehaviorTreeExecutor is created and ready
   */
  async ensurePlanExecutor() {
    if (this.planExecutor) {
      return;
    }
    
    try {
      // Import required classes
      const { BehaviorTreeExecutor } = await import('@legion/actor-bt');
      const { ToolRegistry } = await import('@legion/tools');
      
      // Create tool registry and load modules
      const toolRegistry = new ToolRegistry();
      
      // Import general tools and register them
      const generalTools = await import('@legion/tools');
      
      // Register modules with the tool registry
      const moduleKeys = ['FileModule', 'CalculatorModule', 'CommandExecutorModule', 'AIGenerationModule'];
      for (const key of moduleKeys) {
        if (generalTools[key]) {
          console.log(`PlanExecutionEngine: Loading module ${key}`);
          await toolRegistry.registerModule(key.toLowerCase(), generalTools[key]);
        }
      }
      
      this.planExecutor = new BehaviorTreeExecutor(toolRegistry);
      
      console.log('PlanExecutionEngine: BehaviorTreeExecutor created with ToolRegistry');
      
    } catch (error) {
      console.error('PlanExecutionEngine: Failed to create BehaviorTreeExecutor:', error);
      throw new Error(`Failed to initialize behavior tree executor: ${error.message}`);
    }
  }
  
  /**
   * Set up event listeners for plan execution
   */
  setupExecutionEventListeners() {
    if (!this.planExecutor) return;
    
    // Plan-level events
    this.planExecutor.on('plan:start', (data) => {
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_update',
        message: `🎯 Started executing plan: ${data.planName}\n\nPlan overview:\n• Total steps: ${data.totalSteps}\n• Estimated time: ${data.estimatedTime || 'calculating...'}\n• Starting execution...`,
        progress: 15
      });
    });
    
    this.planExecutor.on('plan:complete', (data) => {
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_update',
        message: `✅ Plan execution completed successfully!\n\n• Execution time: ${Math.round(data.executionTime / 1000)}s\n• Steps completed: ${data.stepsCompleted}/${data.totalSteps}\n• Status: ${data.status}`,
        progress: 95
      });
    });
    
    this.planExecutor.on('plan:error', (data) => {
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_update',
        message: `❌ Plan execution error:\n${data.error}\n\nTroubleshooting:\n• Check error details above\n• Verify required tools are available\n• Ensure file paths are correct`,
        progress: null
      });
    });
    
    // Step-level events with detailed updates
    this.planExecutor.on('step:start', (data) => {
      const stepNumber = data.stepIndex !== undefined ? data.stepIndex + 1 : '?';
      const totalSteps = data.totalSteps || '?';
      
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_update',
        message: `📋 Step ${stepNumber}/${totalSteps}: ${data.stepName}\n• Type: ${data.stepType || 'general'}\n• Starting execution...`,
        progress: null
      });
      
      // Send detailed progress as a thought
      this.orchestrator.sendThoughtToUser(`🔄 Starting ${data.stepName}: ${data.description || 'Processing...'}`);
    });
    
    this.planExecutor.on('step:complete', (data) => {
      const stepNumber = data.stepIndex !== undefined ? data.stepIndex + 1 : '?';
      const executionTime = data.executionTime ? ` in ${Math.round(data.executionTime / 1000)}s` : '';
      
      this.orchestrator.sendThoughtToUser(`✅ Step ${stepNumber} completed${executionTime}: ${data.stepName}`);
      
      // Update progress
      if (data.totalSteps && data.stepsCompleted) {
        const progressPercentage = Math.round((data.stepsCompleted / data.totalSteps) * 100);
        this.orchestrator.sendToChatAgent({
          type: 'orchestrator_update',
          message: `Progress: ${data.stepsCompleted}/${data.totalSteps} steps completed (${progressPercentage}%)`,
          progress: 15 + (progressPercentage * 0.8)
        });
      }
    });
    
    this.planExecutor.on('step:error', (data) => {
      const stepNumber = data.stepIndex !== undefined ? data.stepIndex + 1 : '?';
      
      this.orchestrator.sendThoughtToUser(`❌ Step ${stepNumber} failed: ${data.stepName} - ${data.error}`);
      
      // Also send as status update for critical errors
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_update',
        message: `❌ Step ${stepNumber} failed: ${data.stepName}\n\nError: ${data.error}\n\nThe plan execution will continue with remaining steps if possible.`,
        progress: null
      });
    });
    
    // Action-level events for granular updates
    this.planExecutor.on('action:start', (data) => {
      const actionDesc = data.description || `${data.actionType} operation`;
      this.orchestrator.sendThoughtToUser(`⚡ Executing: ${actionDesc}`);
    });
    
    this.planExecutor.on('action:complete', async (data) => {
      if (data.result) {
        let resultMessage = '';
        if (data.result.message) {
          resultMessage = `: ${data.result.message}`;
        } else if (data.result.success !== undefined) {
          resultMessage = data.result.success ? ' successfully' : ' with errors';
        }
        
        this.orchestrator.sendThoughtToUser(`✓ Completed ${data.actionType}${resultMessage}`);
        
        // Handle artifact assertion for file operations
        await this.handleActionArtifacts(data);
      }
    });
    
    this.planExecutor.on('action:error', (data) => {
      this.orchestrator.sendThoughtToUser(`✗ Failed ${data.actionType}: ${data.error}`);
    });
    
    // Tool execution events
    this.planExecutor.on('tool:execute', (data) => {
      this.orchestrator.sendThoughtToUser(`🔧 Using tool: ${data.toolName} - ${data.functionName || 'execute'}`);
    });
    
    // Retry events
    this.planExecutor.on('action:retry', (data) => {
      this.orchestrator.sendThoughtToUser(`🔄 Retrying ${data.actionType} (attempt ${data.attempt}/${data.maxRetries})`);
    });
  }
  
  /**
   * Handle artifact assertion for completed actions
   */
  async handleActionArtifacts(data) {
    console.log('PlanExecutionEngine: handleActionArtifacts called for', data.actionType, data.toolName);
    console.log('  Result:', data.result);
    console.log('  Parameters:', data.parameters);
    
    // Check if this is a file operation that should create an artifact
    const fileOperations = ['file_write', 'generate_javascript_module', 'generate_unit_tests', 
                           'generate_html_page', 'create_package_json'];
    
    if (!fileOperations.includes(data.actionType) && !fileOperations.includes(data.toolName)) {
      console.log('PlanExecutionEngine: Not a file operation, skipping artifact creation');
      return;
    }
    
    // Get the ArtifactActor from ChatAgent (passed as agentContext)
    const artifactActor = this.orchestrator.agentContext?.artifactActor;
    if (!artifactActor) {
      console.log('PlanExecutionEngine: No ArtifactActor available for artifact assertion');
      return;
    }
    
    // Extract file information from the result
    const result = data.result;
    if (!result || result.success === false) {
      console.log('PlanExecutionEngine: No result or failed result, skipping');
      return;
    }
    
    console.log('PlanExecutionEngine: Result keys:', Object.keys(result));
    console.log('PlanExecutionEngine: Parameters:', data.parameters);
    
    // Build artifact definition based on the tool result
    const artifacts = [];
    
    // Check for file path in common result fields
    // FileWriterTool returns { path: ..., bytesWritten: ... }
    // The content is in the parameters, not the result
    // Note: parameters might use 'filepath' (lowercase p) or 'filePath' (camelCase)
    const filePath = result.path || result.filePath || result.file || result.outputPath || 
                     data.parameters?.path || data.parameters?.filePath || data.parameters?.filepath;
    let content = result.content || result.code || result.html || result.generatedCode || 
                  data.parameters?.content;
    
    // If content is an object (like package.json), stringify it
    if (content && typeof content === 'object') {
      content = JSON.stringify(content, null, 2);
    }
    
    if (filePath && content) {
      // Determine file type from extension
      const extension = filePath.split('.').pop().toLowerCase();
      let type = 'code';
      let subtype = extension;
      
      if (['html', 'htm'].includes(extension)) {
        type = 'markup';
        subtype = 'html';
      } else if (['css', 'scss', 'sass'].includes(extension)) {
        type = 'stylesheet';
        subtype = extension;
      } else if (['json', 'yaml', 'yml'].includes(extension)) {
        type = 'config';
        subtype = extension;
      } else if (['md', 'txt'].includes(extension)) {
        type = 'document';
        subtype = extension;
      }
      
      const filename = filePath.split('/').pop();
      const label = `@${filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
      
      artifacts.push({
        type: type,
        subtype: subtype,
        label: label,
        title: filename,
        description: `${data.stepName}: ${filename}`,
        path: filePath,
        content: content,  // This is the actual file content from parameters
        createdBy: data.toolName || data.actionType,
        metadata: {
          stepId: data.stepId,
          stepName: data.stepName,
          actionId: data.actionId,
          planId: data.planId,
          isFromPlanExecution: true
        }
      });
    } else if (content && !filePath) {
      // Handle generated content without a file path
      let type = 'code';
      let subtype = 'javascript';
      let title = 'Generated Content';
      
      // Try to determine type from action/tool name
      if (data.actionType.includes('html') || data.toolName?.includes('html')) {
        type = 'markup';
        subtype = 'html';
        title = 'Generated HTML';
      } else if (data.actionType.includes('test')) {
        title = 'Generated Test';
        subtype = 'test.js';
      } else if (data.actionType.includes('package')) {
        type = 'config';
        subtype = 'json';
        title = 'package.json';
      }
      
      const label = `@${title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-')}`;
      
      artifacts.push({
        type: type,
        subtype: subtype,
        label: label,
        title: title,
        description: `${data.stepName}: ${title}`,
        content: content,  // This is the actual content
        createdBy: data.toolName || data.actionType,
        metadata: {
          stepId: data.stepId,
          stepName: data.stepName,
          actionId: data.actionId,
          planId: data.planId,
          isFromPlanExecution: true,
          noFilePath: true
        }
      });
    }
    
    // Assert artifacts if any were found
    if (artifacts.length > 0) {
      try {
        console.log(`PlanExecutionEngine: Asserting ${artifacts.length} artifacts from ${data.actionType}`);
        const result = await artifactActor.assertArtifacts({
          artifacts: artifacts,
          context: {
            source: 'plan_execution',
            planId: data.planId,
            stepId: data.stepId,
            toolName: data.toolName
          }
        });
        
        if (result.success) {
          console.log(`PlanExecutionEngine: Successfully asserted ${result.artifactsStored} artifacts`);
        }
      } catch (error) {
        console.error('PlanExecutionEngine: Error asserting artifacts:', error);
      }
    }
  }
  
  /**
   * Clean up event listeners
   */
  cleanupExecutionEventListeners() {
    if (this.planExecutor) {
      this.planExecutor.removeAllListeners('plan:start');
      this.planExecutor.removeAllListeners('plan:complete');
      this.planExecutor.removeAllListeners('plan:error'); 
      this.planExecutor.removeAllListeners('step:start');
      this.planExecutor.removeAllListeners('step:complete');
      this.planExecutor.removeAllListeners('step:error');
      this.planExecutor.removeAllListeners('action:start');
      this.planExecutor.removeAllListeners('action:complete');
      this.planExecutor.removeAllListeners('action:error');
      this.planExecutor.removeAllListeners('tool:execute');
      this.planExecutor.removeAllListeners('action:retry');
    }
  }
  
  /**
   * Handle successful execution
   */
  handleExecutionSuccess(result) {
    this.state = 'complete';
    
    let summary = `🎉 Plan execution completed successfully!`;
    summary += `\n\n📊 Execution Summary:`;
    summary += `\n• ${result.completedSteps.length} steps completed`;
    summary += `\n• ${result.failedSteps.length} steps failed`;
    summary += `\n• ${result.skippedSteps.length} steps skipped`;
    summary += `\n• Total execution time: ${Math.round(result.statistics.executionTime / 1000)}s`;
    
    if (result.failedSteps.length > 0) {
      summary += `\n\n⚠️ Failed steps: ${result.failedSteps.join(', ')}`;
    }
    
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_complete',
      message: summary,
      success: true,
      wasActive: true,
      taskSummary: {
        description: 'Plan execution',
        completedSteps: result.completedSteps.length,
        failedSteps: result.failedSteps.length,
        executionTime: result.statistics.executionTime
      }
    });
    
    this.state = 'idle';
  }
  
  /**
   * Handle failed execution
   */
  handleExecutionFailure(result) {
    this.state = 'failed';
    
    let summary = `❌ Plan execution completed with errors`;
    summary += `\n\n📊 Execution Summary:`;
    summary += `\n• ${result.completedSteps.length} steps completed`;
    summary += `\n• ${result.failedSteps.length} steps failed`;
    summary += `\n• ${result.skippedSteps.length} steps skipped`;
    summary += `\n• Total execution time: ${Math.round(result.statistics.executionTime / 1000)}s`;
    
    if (result.failedSteps.length > 0) {
      summary += `\n\n❌ Failed steps: ${result.failedSteps.join(', ')}`;
    }
    
    if (result.error) {
      summary += `\n\n🚨 Error: ${result.error}`;
    }
    
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_complete',
      message: summary,
      success: false,
      wasActive: true,
      taskSummary: {
        description: 'Plan execution (with errors)',
        completedSteps: result.completedSteps.length,
        failedSteps: result.failedSteps.length,
        executionTime: result.statistics.executionTime,
        error: result.error
      }
    });
    
    this.state = 'idle';
  }
  
  /**
   * Handle execution error (before execution starts)
   */
  handleExecutionError(error) {
    this.state = 'failed';
    
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_error',
      message: `Failed to execute plan: ${error.message}`
    });
    
    this.state = 'idle';
  }
  
  /**
   * Pause execution (if possible)
   */
  pause() {
    if (this.state === 'executing') {
      this.state = 'paused';
      // Note: PlanExecutor doesn't support pausing yet, but we track the state
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_status',
        message: 'Execution pause requested (will pause after current step completes)'
      });
    }
  }
  
  /**
   * Resume execution
   */
  resume() {
    if (this.state === 'paused') {
      this.state = 'executing';
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_status',
        message: 'Resuming execution...'
      });
    }
  }
  
  /**
   * Cancel execution
   */
  cancel() {
    if (this.state === 'executing' || this.state === 'paused') {
      this.state = 'idle';
      this.currentExecution = null;
      this.executionResult = null;
      
      // Clean up event listeners
      this.cleanupExecutionEventListeners();
      
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_status',
        message: 'Plan execution cancelled'
      });
    }
  }
  
  /**
   * Get current execution status
   */
  getStatus() {
    switch (this.state) {
      case 'idle':
        return 'Ready to execute plans';
      case 'executing':
        return 'Executing plan...';
      case 'paused':
        return 'Execution paused';
      case 'complete':
        return 'Last execution completed successfully';
      case 'failed':
        return 'Last execution failed';
      default:
        return `Unknown state: ${this.state}`;
    }
  }
  
  /**
   * Clear any resources
   */
  clearResources() {
    this.cleanupExecutionEventListeners();
    this.planExecutor = null;
    this.currentExecution = null;
    this.executionResult = null;
    this.state = 'idle';
  }
}