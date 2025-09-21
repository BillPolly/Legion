/**
 * DevelopmentOrchestrationStrategy - Coordinates coding, testing, and debugging in a loop
 * 
 * This strategy implements a complete development workflow:
 * 1. Code generation → 2. Test writing → 3. Test execution → 4. Debugging → 5. Loop back
 * 
 * It manages the interaction between CodingStrategy, TestWritingStrategy, TestExecutionStrategy, and DebuggingStrategy,
 * handling failure routing (determining if test or code needs fixing) and orchestrating
 * the iterative development process.
 */

import { TaskStrategy } from '@legion/tasks';
import StrategySelector from '../StrategySelector.js';
import TestExecutionStrategy from '../coding/TestExecutionStrategy.js';
import path from 'path';

export default class DevelopmentOrchestrationStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.currentTask = null;
    
    // Configurable project root directory
    this.projectRoot = options.projectRoot || process.env.PROJECT_ROOT || '/tmp';
    
    // Maximum iterations to prevent infinite loops
    this.maxIterations = options.maxIterations || 5;
    
    // Strategy selector for dynamic strategy selection
    this.strategySelector = null;
    
    // Active strategies (will be selected dynamically based on task)
    this.codingStrategy = null;
    this.testWritingStrategy = null;
    this.testExecutionStrategy = null;
    this.debuggingStrategy = null;
    
    // Orchestration state
    this.currentIteration = 0;
    this.workflowState = 'INITIAL'; // INITIAL, CODING, TESTING, DEBUGGING, COMPLETED, FAILED
  }
  
  getName() {
    return 'DevelopmentOrchestration';
  }
  
  /**
   * Handle messages from parent task (start work requests)
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        this.currentTask = parentTask;
        return await this._handleOrchestrationWork(parentTask);
        
      case 'abort':
        console.log(`🛑 DevelopmentOrchestrationStrategy received abort`);
        return { acknowledged: true, aborted: true };
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle messages from child tasks (strategy results)
   */
  async onChildMessage(childTask, message) {
    // The orchestration strategy manages the workflow based on child results
    switch (message.type) {
      case 'completed':
        return await this._handleChildCompletion(childTask, message.result);
        
      case 'failed':
        return await this._handleChildFailure(childTask, message.error);
        
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Main orchestration work handler - manages the development loop
   * @private
   */
  async _handleOrchestrationWork(task) {
    try {
      console.log(`🎯 DevelopmentOrchestrationStrategy handling: ${task.description}`);
      
      // Initialize components and sub-strategies
      await this._initializeComponents(task);
      
      // Reset orchestration state
      this.currentIteration = 0;
      this.workflowState = 'INITIAL';
      
      // Start the development workflow
      const result = await this._executeWorkflowLoop(task);
      
      if (result.success) {
        task.complete(result);
        return result;
      } else {
        task.fail(new Error(result.error || 'Development orchestration failed'));
        return result;
      }
      
    } catch (error) {
      console.error(`❌ DevelopmentOrchestrationStrategy error:`, error);
      task.fail(error);
      return {
        success: false,
        error: error.message,
        artifacts: Object.values(task.getAllArtifacts())
      };
    }
  }
  
  /**
   * Initialize strategy components and sub-strategies
   * @private
   */
  async _initializeComponents(task) {
    const context = this._getContextFromTask(task);
    
    this.llmClient = this.llmClient || context.llmClient;
    this.toolRegistry = this.toolRegistry || context.toolRegistry;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required for DevelopmentOrchestrationStrategy');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required for DevelopmentOrchestrationStrategy');
    }
    
    // Initialize strategy selector with shared configuration
    const strategyOptions = { projectRoot: this.projectRoot };
    this.strategySelector = new StrategySelector(this.llmClient, this.toolRegistry, strategyOptions);
    
    // Select appropriate strategies based on the task
    console.log('🎯 Selecting specialized strategies for task...');
    
    // Select coding strategy
    const codingSelection = await this.strategySelector.selectAndInstantiate(task, 'coding', strategyOptions);
    this.codingStrategy = codingSelection.strategy;
    console.log(`  📝 Coding: ${codingSelection.metadata.name} (${codingSelection.metadata.type})`);
    
    // Select test writing strategy
    const testWritingSelection = await this.strategySelector.selectAndInstantiate(task, 'testing', strategyOptions);
    this.testWritingStrategy = testWritingSelection.strategy;
    console.log(`  🧪 Testing: ${testWritingSelection.metadata.name} (${testWritingSelection.metadata.type})`);
    
    // Test execution always uses generic strategy (no specialized versions yet)
    this.testExecutionStrategy = new TestExecutionStrategy(this.llmClient, this.toolRegistry, strategyOptions);
    console.log(`  🏃 Execution: TestExecutionStrategy (generic)`);
    
    // Select debugging strategy
    const debuggingSelection = await this.strategySelector.selectAndInstantiate(task, 'debugging', strategyOptions);
    this.debuggingStrategy = debuggingSelection.strategy;
    console.log(`  🐛 Debugging: ${debuggingSelection.metadata.name} (${debuggingSelection.metadata.type})`);
    
    console.log('🎯 DevelopmentOrchestrationStrategy components initialized with specialized strategies');
  }
  
  /**
   * Execute the main development workflow loop
   * @private
   */
  async _executeWorkflowLoop(task) {
    console.log(`🔄 Starting development workflow loop`);
    
    while (this.currentIteration < this.maxIterations) {
      this.currentIteration++;
      console.log(`\n🔄 Development Loop Iteration ${this.currentIteration}/${this.maxIterations}`);
      
      // Step 1: Code Generation (if not already done or needs re-coding)
      if (this.workflowState === 'INITIAL' || this.workflowState === 'CODING') {
        console.log(`📝 Step 1: Code Generation`);
        const codingResult = await this._executeStrategy(task, this.codingStrategy, 'CODING');
        
        if (!codingResult.success) {
          return {
            success: false,
            error: `Code generation failed: ${codingResult.error}`,
            iterations: this.currentIteration,
            artifacts: Object.values(task.getAllArtifacts())
          };
        }
        
        this.workflowState = 'TESTING';
        task.addConversationEntry('system', `Code generation completed. Generated ${codingResult.result.filesGenerated || 1} files.`);
      }
      
      // Step 2: Test Generation and Execution
      if (this.workflowState === 'TESTING') {
        console.log(`🧪 Step 2: Test Generation and Execution`);
        
        // First generate tests
        const testGenerationResult = await this._executeTestGeneration(task);
        if (!testGenerationResult.success) {
          return {
            success: false,
            error: `Test generation failed: ${testGenerationResult.error}`,
            iterations: this.currentIteration,
            artifacts: Object.values(task.getAllArtifacts())
          };
        }
        
        // Then execute tests
        const testExecutionResult = await this._executeTestExecution(task);
        
        if (testExecutionResult.success) {
          // Tests passed - development is complete
          this.workflowState = 'COMPLETED';
          task.addConversationEntry('system', `All tests passed! Development workflow completed successfully.`);
          
          return {
            success: true,
            result: {
              message: `Development workflow completed successfully after ${this.currentIteration} iterations`,
              iterations: this.currentIteration,
              finalState: this.workflowState,
              testsRun: testExecutionResult.result.testsRun,
              testsPassed: testExecutionResult.result.testsPassed
            },
            artifacts: Object.values(task.getAllArtifacts())
          };
        } else {
          // Tests failed - proceed to debugging
          this.workflowState = 'DEBUGGING';
          task.addConversationEntry('system', `Tests failed. Proceeding to debugging phase.`);
        }
      }
      
      // Step 3: Debugging and Issue Resolution
      if (this.workflowState === 'DEBUGGING') {
        console.log(`🐛 Step 3: Debugging and Issue Resolution`);
        
        const debuggingResult = await this._executeStrategy(task, this.debuggingStrategy, 'DEBUGGING');
        
        if (!debuggingResult.success) {
          return {
            success: false,
            error: `Debugging failed: ${debuggingResult.error}`,
            iterations: this.currentIteration,
            artifacts: Object.values(task.getAllArtifacts())
          };
        }
        
        // Analyze what needs to be fixed based on debugging results
        const nextAction = await this._determineNextAction(task, debuggingResult);
        
        switch (nextAction.action) {
          case 'FIX_CODE':
            this.workflowState = 'CODING';
            task.addConversationEntry('system', `Debugging suggests fixing code. Reason: ${nextAction.reasoning}`);
            break;
            
          case 'FIX_TESTS':
            this.workflowState = 'TESTING';
            task.addConversationEntry('system', `Debugging suggests fixing tests. Reason: ${nextAction.reasoning}`);
            break;
            
          case 'RETRY_TESTING':
            this.workflowState = 'TESTING';
            task.addConversationEntry('system', `Debugging completed fixes. Retrying tests.`);
            break;
            
          default:
            // If we can't determine next action, try re-testing
            this.workflowState = 'TESTING';
        }
      }
    }
    
    // Maximum iterations reached
    return {
      success: false,
      error: `Development workflow did not converge after ${this.maxIterations} iterations`,
      iterations: this.currentIteration,
      finalState: this.workflowState,
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Execute a specific strategy and handle its result
   * @private
   */
  async _executeStrategy(task, strategy, phase) {
    try {
      console.log(`  🚀 Executing ${strategy.getName()} strategy for ${phase}`);
      
      // Create a task-specific message to the strategy
      const strategyResult = await strategy.onParentMessage(task, { type: 'start' });
      
      if (strategyResult.success) {
        console.log(`  ✅ ${strategy.getName()} completed successfully`);
      } else {
        console.log(`  ❌ ${strategy.getName()} failed: ${strategyResult.error}`);
      }
      
      return strategyResult;
      
    } catch (error) {
      console.log(`  ❌ ${strategy.getName()} threw error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Execute test generation phase
   * @private
   */
  async _executeTestGeneration(task) {
    // Create a test generation specific task context
    const testGenerationTask = {
      ...task,
      description: `Generate tests for: ${task.description}`
    };
    
    return await this._executeStrategy(testGenerationTask, this.testWritingStrategy, 'TEST_GENERATION');
  }
  
  /**
   * Execute test execution phase
   * @private
   */
  async _executeTestExecution(task) {
    // Create a test execution specific task context
    const testExecutionTask = {
      ...task,
      description: `Run tests for: ${task.description}`
    };
    
    return await this._executeStrategy(testExecutionTask, this.testExecutionStrategy, 'TEST_EXECUTION');
  }
  
  /**
   * Determine next action based on debugging results
   * @private
   */
  async _determineNextAction(task, debuggingResult) {
    const prompt = `Based on this debugging analysis, determine what should be done next:

Task: "${task.description}"
Current Iteration: ${this.currentIteration}/${this.maxIterations}
Workflow State: ${this.workflowState}

Debugging Result: ${JSON.stringify(debuggingResult.result || debuggingResult, null, 2)}

Available Artifacts: ${task.getArtifactsContext()}

Determine the next action:
1. FIX_CODE - The issue is in the generated code and needs to be regenerated/fixed
2. FIX_TESTS - The issue is in the tests (incorrect expectations, bad test logic)
3. RETRY_TESTING - Debugging applied fixes, retry testing to see if issues are resolved

Return JSON:
{
  "action": "FIX_CODE|FIX_TESTS|RETRY_TESTING",
  "reasoning": "explanation of why this action is recommended",
  "confidence": "high|medium|low"
}`;

    try {
      const response = await this.llmClient.generateResponse([{
        role: 'user',
        content: prompt
      }]);
      
      return JSON.parse(response);
    } catch (error) {
      console.log(`⚠️ Next action determination failed, defaulting to RETRY_TESTING: ${error.message}`);
      return {
        action: 'RETRY_TESTING',
        reasoning: 'Action determination failed, retrying tests as default',
        confidence: 'low'
      };
    }
  }
  
  /**
   * Handle child strategy completion
   * @private
   */
  async _handleChildCompletion(childTask, result) {
    console.log(`✅ Child strategy completed: ${JSON.stringify(result)}`);
    
    // Strategy completed successfully - orchestration will handle next steps in main loop
    return { acknowledged: true, success: true };
  }
  
  /**
   * Handle child strategy failure
   * @private
   */
  async _handleChildFailure(childTask, error) {
    console.log(`❌ Child strategy failed: ${error.message}`);
    
    // Strategy failed - orchestration will handle failure in main loop
    return { acknowledged: true, success: false, error: error.message };
  }
  
  /**
   * Extract context from task
   * @private
   */
  _getContextFromTask(task) {
    return {
      llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
      toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
      workspaceDir: (task.lookup && task.lookup('workspaceDir')) || task.context?.workspaceDir || this.projectRoot,
    };
  }
}