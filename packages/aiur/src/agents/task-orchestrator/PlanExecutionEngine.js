/**
 * PlanExecutionEngine - Handles both planning and execution of tasks
 * 
 * This component manages:
 * - Planning phase: Creating detailed execution plans
 * - Execution phase: Running the plan steps
 * - Replanning: Modifying plans during execution
 * - State management throughout the process
 * 
 * Future enhancements will include:
 * - Integration with LLM planner module
 * - Real tool execution
 * - Dependency tracking
 * - Error recovery
 */
export class PlanExecutionEngine {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.state = 'idle'; // 'idle', 'planning', 'executing', 'replanning', 'paused'
    this.progress = 0;
    this.currentPlan = null;
    this.executionPhase = null;
    this.timers = [];
    
    // Future: Will integrate with plan executor module
    this.planExecutor = null;
  }
  
  /**
   * Start planning and execution
   */
  start(taskDescription, context = {}) {
    this.state = 'planning';
    this.progress = 0;
    
    // Send immediate acknowledgment
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_status',
      message: `I'll help you build a Shopify clone with all the features you requested. Let me create a detailed plan for this comprehensive e-commerce platform.`,
      progress: 0
    });
    
    // Then send planning status
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_update',
      message: 'Analyzing requirements and creating a plan...',
      progress: 0
    });
    
    // Start planning immediately
    this.createAndExecutePlan(taskDescription, context);
  }
  
  /**
   * Create and execute plan
   */
  async createAndExecutePlan(taskDescription, context) {
    if (this.state !== 'planning') return;
    
    // Create plan using LLM or mock
    this.currentPlan = await this.createPlan(taskDescription, context);
    this.progress = 20;
    
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_update',
      message: `Plan created with ${this.currentPlan.steps.length} steps. Beginning execution...`,
      progress: 20
    });
    
    this.state = 'executing';
    this.continueExecution();
  }
  
  /**
   * Create a plan using LLM or fallback to mock
   */
  async createPlan(taskDescription, context) {
    if (this.orchestrator.llmClient) {
      return this.createLLMPlan(taskDescription, context);
    }
    return this.createMockPlan(taskDescription, context);
  }
  
  /**
   * Create a plan using LLM
   */
  async createLLMPlan(taskDescription, context) {
    const contextStr = Object.entries(context)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    
    const prompt = `You are simulating a task planning system. Create a realistic execution plan for this task.

Task: ${taskDescription}
Context:
${contextStr || 'No additional context'}

Generate a JSON response with a detailed plan:
{
  "steps": [
    {"name": "Step Name", "description": "What this step does", "estimatedTime": 30},
    ...
  ],
  "totalEstimatedTime": 300,
  "complexity": "low|medium|high",
  "requiresUserInput": ["List of decisions that will need user input during execution"]
}

Make the steps realistic and specific to the task. Include EXACTLY 6 steps.
Each step should have a clear name and description.
Make sure at least 2 of the steps will require user input (include these in requiresUserInput).`;

    try {
      const result = await this.orchestrator.llmClient.complete(prompt, 2000);
      const plan = this.parseJSONResponse(result);
      
      if (plan && plan.steps) {
        return {
          description: taskDescription,
          context: context,
          steps: plan.steps.map(s => s.name),
          stepDetails: plan.steps,
          currentStep: 0,
          metadata: {
            createdAt: new Date().toISOString(),
            estimatedTime: plan.totalEstimatedTime || plan.steps.length * 30,
            complexity: plan.complexity || 'medium',
            requiresUserInput: plan.requiresUserInput || []
          }
        };
      }
    } catch (error) {
      console.error('PlanExecutionEngine: LLM plan generation failed:', error);
    }
    
    // Fallback to mock
    return this.createMockPlan(taskDescription, context);
  }
  
  /**
   * Create a mock plan for testing
   */
  createMockPlan(taskDescription, context) {
    // Always create exactly 6 steps
    const steps = [
      'Initialize Project',
      'Setup Core Architecture', 
      'Implement Main Features',
      'Configure Integrations',
      'Testing & Quality Assurance',
      'Final Review & Deployment'
    ];
    
    return {
      description: taskDescription,
      context: context,
      steps: steps,
      currentStep: 0,
      metadata: {
        createdAt: new Date().toISOString(),
        estimatedTime: steps.length * 2, // 2 seconds per step for mock
        requiresUserInput: ['Setup Core Architecture', 'Configure Integrations'] // Steps that might need user input
      }
    };
  }
  
  /**
   * Parse JSON from LLM response
   */
  parseJSONResponse(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e);
    }
    return null;
  }
  
  /**
   * Continue execution
   */
  async continueExecution() {
    if (this.state !== 'executing') return;
    
    const step = this.currentPlan.steps[this.currentPlan.currentStep];
    const stepDetail = this.currentPlan.stepDetails?.[this.currentPlan.currentStep];
    this.executionPhase = step;
    
    // Generate execution narrative if LLM available
    if (this.orchestrator.llmClient && stepDetail) {
      await this.simulateStepExecution(step, stepDetail);
    } else {
      // Simple execution message
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_update',
        message: `Executing step ${this.currentPlan.currentStep + 1}/${this.currentPlan.steps.length}: ${step}...`,
        progress: this.progress
      });
    }
    
    // Check if this step needs user input
    const needsInput = await this.checkForUserInput(step);
    if (needsInput) {
      return; // Wait for user response
    }
    
    // Send thought update about step completion
    await this.sendStepCompletionThought(step, this.currentPlan.currentStep);
    
    // Immediately proceed to next step (no timeout)
    this.currentPlan.currentStep++;
    this.progress = Math.min(95, this.progress + Math.floor(75 / this.currentPlan.steps.length));
    
    if (this.currentPlan.currentStep < this.currentPlan.steps.length) {
      // Brief delay to allow UI to update, then continue
      setTimeout(() => {
        if (this.state === 'executing') {
          this.continueExecution();
        }
      }, 100); // Very short delay just for UI updates
    } else {
      this.complete();
    }
  }
  
  /**
   * Send thought update about step completion
   */
  async sendStepCompletionThought(stepName, completedStepIndex) {
    if (!this.orchestrator.llmClient) {
      // Simple fallback thought
      this.orchestrator.sendThoughtToUser(`✅ Completed step ${completedStepIndex + 1}: ${stepName}`);
      return;
    }
    
    const stepDetail = this.currentPlan.stepDetails?.[completedStepIndex];
    const prompt = `You just completed a step in a complex task. Generate a thoughtful progress update.

Completed Step: ${stepName} (Step ${completedStepIndex + 1} of 6)
Step Description: ${stepDetail?.description || stepName}
Overall Task: ${this.currentPlan.description}
Progress: ${this.progress}%

Generate a brief, conversational thought that shows:
1. What was accomplished in this step
2. How it contributes to the overall goal
3. Brief hint about what's coming next (if not the last step)

Keep it to 1-2 sentences. Sound like you're actually doing the work and making progress.
Start with an appropriate emoji (✅ for completion, 🔧 for technical work, 📋 for planning, etc.)`;

    try {
      const thought = await this.orchestrator.llmClient.complete(prompt, 300);
      this.orchestrator.sendThoughtToUser(thought.trim());
    } catch (error) {
      console.error('PlanExecutionEngine: Failed to generate step completion thought:', error);
      // Fallback to simple thought
      this.orchestrator.sendThoughtToUser(`✅ Completed step ${completedStepIndex + 1}: ${stepName}`);
    }
  }
  
  /**
   * Simulate step execution with LLM
   */
  async simulateStepExecution(stepName, stepDetail) {
    const prompt = `You are simulating the execution of a task step. Generate a realistic progress update.

Current Step: ${stepName}
Step Description: ${stepDetail?.description || stepName}
Step Number: ${this.currentPlan.currentStep + 1} of ${this.currentPlan.steps.length}

Generate a conversational status update that sounds like the system is actually doing the work.
Be specific about what's happening. Include technical details if relevant.
Keep it to 1-2 sentences.`;

    try {
      const update = await this.orchestrator.llmClient.complete(prompt, 200);
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_update',
        message: update.trim(),
        progress: this.progress
      });
    } catch (error) {
      // Fallback to simple message
      this.orchestrator.sendToChatAgent({
        type: 'orchestrator_update',
        message: `Executing: ${stepName}...`,
        progress: this.progress
      });
    }
  }
  
  /**
   * Check if current step needs user input
   */
  async checkForUserInput(step) {
    // Use LLM to decide if this step needs user input
    if (this.orchestrator.llmClient) {
      return this.checkForUserInputWithLLM(step);
    }
    
    // Fallback: No LLM available, don't ask for input
    return false;
  }
  
  /**
   * Use LLM to decide if user input is needed
   */
  async checkForUserInputWithLLM(step) {
    const stepIndex = this.currentPlan.currentStep;
    const stepDetail = this.currentPlan.stepDetails?.[stepIndex];
    
    const prompt = `You are simulating task execution. Decide if this step needs user input.

Current Step: ${step} (Step ${stepIndex + 1} of 6)
Step Description: ${stepDetail?.description || step}
Task: ${this.currentPlan.description}

During complex task execution, you sometimes need to ask the user for decisions or clarifications.
This should feel realistic - about 30-40% of steps need some user input.

Respond with JSON:
{
  "needsInput": true/false,
  "question": "Your question for the user (if needsInput is true)",
  "reason": "Why you need input or why you don't"
}

Be realistic about when input is actually needed for this type of step.`;

    try {
      const result = await this.orchestrator.llmClient.complete(prompt, 500);
      const decision = this.parseJSONResponse(result);
      
      if (decision && decision.needsInput) {
        this.requestUserInput(decision.question || this.generateQuestionForStep(step));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('PlanExecutionEngine: LLM input check failed:', error);
      // No fallback - just continue without user input
      return false;
    }
  }
  
  /**
   * Generate a question based on the step
   */
  generateQuestionForStep(step) {
    const stepLower = step.toLowerCase();
    
    if (stepLower.includes('architecture')) {
      return 'Would you prefer a microservices architecture or a monolithic approach for easier deployment?';
    } else if (stepLower.includes('integration')) {
      return 'Which payment provider would you like to integrate: Stripe, PayPal, or both?';
    } else if (stepLower.includes('database')) {
      return 'What database would you prefer: PostgreSQL for relational data or MongoDB for flexibility?';
    } else if (stepLower.includes('frontend')) {
      return 'Which frontend framework should we use: React for flexibility or Next.js for full-stack features?';
    }
    
    return 'What approach would you prefer for this step?';
  }
  
  /**
   * Request replanning
   */
  requestReplan(modification) {
    this.state = 'replanning';
    this.clearTimers();
    
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_update',
      message: 'Updating the plan based on your feedback...',
      progress: this.progress
    });
    
    // Immediate replanning (no timeout)
    setTimeout(() => {
      if (this.state === 'replanning') {
        // Mock: Add a new step to demonstrate replanning
        const newStep = `Handle modification: ${modification.modification.substring(0, 50)}...`;
        this.currentPlan.steps.splice(this.currentPlan.currentStep + 1, 0, newStep);
        
        this.state = 'executing';
        
        this.orchestrator.sendToChatAgent({
          type: 'orchestrator_update',
          message: 'Plan updated. Continuing with the modified approach...',
          progress: this.progress
        });
        
        this.continueExecution();
      }
    }, 100); // Very brief delay for UI updates
  }
  
  /**
   * Request information from user (called by engine when needed)
   */
  requestUserInput(question) {
    this.pause();
    this.orchestrator.interactionHandler.startClarification([{
      key: 'engineRequest',
      question: question
    }]);
  }
  
  /**
   * Pause execution
   */
  pause() {
    if (this.state === 'executing' || this.state === 'planning') {
      this.clearTimers();
      this.state = 'paused';
    }
  }
  
  /**
   * Resume execution
   */
  resume() {
    if (this.state === 'paused') {
      this.state = 'executing';
      this.continueExecution();
    }
  }
  
  /**
   * Cancel everything
   */
  cancel() {
    this.clearTimers();
    this.state = 'idle';
    this.progress = 0;
    this.currentPlan = null;
    this.executionPhase = null;
  }
  
  /**
   * Complete the task
   */
  complete() {
    this.state = 'idle';
    this.progress = 100;
    
    const summary = this.generateTaskSummary();
    
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_complete',
      message: `Task completed successfully! ${summary}`,
      success: true,
      wasActive: true,
      taskSummary: {
        description: this.currentPlan.description,
        stepsCompleted: this.currentPlan.steps.length,
        duration: this.calculateDuration()
      }
    });
    
    // Reset
    this.currentPlan = null;
    this.executionPhase = null;
  }
  
  /**
   * Generate task summary
   */
  generateTaskSummary() {
    if (!this.currentPlan) return 'All steps have been executed.';
    
    return `Completed ${this.currentPlan.steps.length} steps for "${this.currentPlan.description}".`;
  }
  
  /**
   * Calculate task duration
   */
  calculateDuration() {
    if (!this.currentPlan || !this.currentPlan.metadata.createdAt) return 'unknown';
    
    const start = new Date(this.currentPlan.metadata.createdAt);
    const duration = Date.now() - start.getTime();
    return `${Math.round(duration / 1000)} seconds`;
  }
  
  /**
   * Get current status
   */
  getStatus() {
    const phaseInfo = this.getPhaseDescription();
    const stepInfo = this.currentPlan && this.state === 'executing' 
      ? ` (Step ${this.currentPlan.currentStep + 1}/${this.currentPlan.steps.length})`
      : '';
    
    return `Current state: ${this.state}, Progress: ${this.progress}%, ${phaseInfo}${stepInfo}`;
  }
  
  /**
   * Get phase description
   */
  getPhaseDescription() {
    if (this.state === 'planning') return 'creating the plan';
    if (this.state === 'replanning') return 'updating the plan';
    if (this.state === 'executing' && this.executionPhase) return `executing ${this.executionPhase}`;
    if (this.state === 'paused') return 'paused';
    return 'idle';
  }
  
  /**
   * Provide context information
   */
  provideContext(context) {
    // Merge with existing context
    if (this.currentPlan) {
      this.currentPlan.context = { ...this.currentPlan.context, ...context };
    }
    console.log('PlanExecutionEngine: Received context', context);
  }
  
  /**
   * Clear all timers
   */
  clearTimers() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers = [];
  }
}