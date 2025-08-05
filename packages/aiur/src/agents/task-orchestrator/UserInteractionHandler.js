/**
 * UserInteractionHandler - Manages all user interactions and controls the plan execution
 * 
 * This component is responsible for:
 * - Processing user input and determining appropriate actions
 * - Managing dialogue flow for gathering requirements
 * - Controlling the PlanExecutionEngine based on user feedback
 * - Generating appropriate responses to the user
 */
export class UserInteractionHandler {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.conversationMode = 'normal'; // 'normal', 'clarifying', 'confirming'
    this.pendingQuestions = [];
    this.context = {};
  }
  
  /**
   * Process user input and decide action
   */
  async processUserInput(message) {
    const input = message.content || '';
    
    // Check if we're in a dialogue mode
    if (this.conversationMode === 'clarifying') {
      return this.handleClarification(input);
    }
    
    // Use LLM to analyze user intent if available
    if (this.orchestrator.llmClient) {
      return this.processWithLLM(input);
    }
    
    // Fallback to simple keyword matching
    return this.processWithKeywords(input);
  }
  
  /**
   * Process user input using LLM
   */
  async processWithLLM(input) {
    const currentState = this.orchestrator.planExecutionEngine.getStatus();
    const taskDescription = this.orchestrator.currentTask?.description || 'Unknown task';
    
    const prompt = `You are simulating a task orchestration system that is currently executing a complex task.

Current Task: ${taskDescription}
Current Status: ${currentState}

The user just said: "${input}"

Analyze the user's intent and respond with a JSON object:
{
  "intent": "status|pause|resume|cancel|modify|question|acknowledge",
  "requiresAction": true/false,
  "response": "Your response to the user",
  "modificationDetails": "If intent is modify, describe what needs to be changed"
}

Be conversational but informative. If they're asking about progress, give specific details about what step we're on.
If they want to modify something, acknowledge it and explain what will happen.`;

    try {
      const result = await this.orchestrator.llmClient.complete(prompt, 1000);
      const analysis = this.parseJSONResponse(result);
      
      if (!analysis) {
        return this.processWithKeywords(input);
      }
      
      // Handle the intent
      switch (analysis.intent) {
        case 'cancel':
          this.orchestrator.planExecutionEngine.cancel();
          break;
        case 'pause':
          this.orchestrator.planExecutionEngine.pause();
          break;
        case 'resume':
          this.orchestrator.planExecutionEngine.resume();
          break;
        case 'modify':
          if (analysis.modificationDetails) {
            this.handlePlanModification(analysis.modificationDetails);
          }
          break;
      }
      
      return this.respond(analysis.response);
      
    } catch (error) {
      console.error('UserInteractionHandler: LLM error:', error);
      return this.processWithKeywords(input);
    }
  }
  
  /**
   * Fallback keyword-based processing
   */
  processWithKeywords(input) {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('stop') || lowerInput.includes('cancel')) {
      this.orchestrator.planExecutionEngine.cancel();
      return this.respond('I\'ve cancelled the task.');
    }
    
    if (lowerInput.includes('pause')) {
      this.orchestrator.planExecutionEngine.pause();
      return this.respond('Task paused. Say "resume" to continue.');
    }
    
    if (lowerInput.includes('resume') && this.orchestrator.planExecutionEngine.state === 'paused') {
      this.orchestrator.planExecutionEngine.resume();
      return this.respond('Resuming the task...');
    }
    
    if (lowerInput.includes('status') || lowerInput.includes('progress')) {
      const status = this.orchestrator.planExecutionEngine.getStatus();
      return this.respond(status);
    }
    
    // Check for plan modifications
    if (this.detectPlanModification(input)) {
      return this.handlePlanModification(input);
    }
    
    // Default: acknowledge and continue
    return this.respond(`I understand. I'm currently ${this.orchestrator.planExecutionEngine.getPhaseDescription()}. The task is progressing well.`);
  }
  
  /**
   * Parse JSON from LLM response
   */
  parseJSONResponse(text) {
    try {
      // Extract JSON from the response
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
   * Handle initial task setup
   */
  async handleTaskStart(taskDescription, context) {
    // Check if we need to gather more information
    const questions = this.determineRequiredQuestions(taskDescription);
    
    if (questions.length > 0) {
      this.respond(`Before I create the detailed plan, I need some information to make the right architectural decisions.`);
      this.startClarification(questions);
    } else {
      // Start immediately - the PlanExecutionEngine will send the initial acknowledgment
      this.orchestrator.planExecutionEngine.start(taskDescription, context);
    }
  }
  
  /**
   * Determine what questions to ask based on task
   */
  determineRequiredQuestions(taskDescription) {
    const questions = [];
    const lowerDesc = taskDescription.toLowerCase();
    
    // Mock questions for now - will be enhanced later
    if (lowerDesc.includes('web') || lowerDesc.includes('app')) {
      questions.push({
        key: 'framework',
        question: 'What framework would you like to use? (e.g., React, Vue, Angular)'
      });
    }
    
    if (lowerDesc.includes('database')) {
      questions.push({
        key: 'dbType',
        question: 'What type of database would you prefer? (e.g., PostgreSQL, MongoDB, MySQL)'
      });
    }
    
    return questions;
  }
  
  /**
   * Handle clarification dialogue
   */
  handleClarification(input) {
    // Store the answer
    const currentQuestion = this.pendingQuestions.shift();
    if (currentQuestion) {
      this.context[currentQuestion.key] = input;
    }
    
    // Check if more questions
    if (this.pendingQuestions.length > 0) {
      const nextQuestion = this.pendingQuestions[0];
      return this.respond(nextQuestion.question);
    }
    
    // All questions answered, continue with task
    this.conversationMode = 'normal';
    this.orchestrator.planExecutionEngine.provideContext(this.context);
    this.orchestrator.planExecutionEngine.start(this.orchestrator.currentTask.description, this.context);
    return this.respond('Thank you! I have all the information I need. Let me start working on this...');
  }
  
  /**
   * Detect if user wants to modify the plan
   */
  detectPlanModification(input) {
    const modificationKeywords = ['add', 'change', 'modify', 'update', 'include', 'also', 'instead', 'different'];
    return modificationKeywords.some(keyword => input.toLowerCase().includes(keyword));
  }
  
  /**
   * Handle plan modification request
   */
  handlePlanModification(input) {
    this.respond(`I'll update the plan to incorporate that change. Let me adjust things...`);
    this.orchestrator.planExecutionEngine.requestReplan({
      modification: input,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Start clarification dialogue
   */
  startClarification(questions) {
    this.conversationMode = 'clarifying';
    this.pendingQuestions = questions;
    if (questions.length > 0) {
      return this.respond(questions[0].question);
    }
  }
  
  /**
   * Send response to user via ChatAgent
   */
  respond(message) {
    this.orchestrator.sendToChatAgent({
      type: 'orchestrator_status',
      message: message,
      progress: this.orchestrator.planExecutionEngine.progress
    });
  }
}