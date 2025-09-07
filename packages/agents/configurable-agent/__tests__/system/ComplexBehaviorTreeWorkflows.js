/**
 * Complex Behavior Tree Workflow Tests
 * Tests sophisticated orchestration scenarios with real-world complexity
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createCustomerServiceAgentConfig, createEducationalTutorConfig } from './AgentConfigurations.js';

describe('Complex Behavior Tree Workflows', () => {
  let resourceManager;
  let activeAgents = [];
  
  beforeAll(async () => {
    const { ResourceManager } = await import('@legion/resource-manager');
    resourceManager = await ResourceManager.getInstance();
    
    const llmClient = await resourceManager.get('llmClient');
    expect(llmClient).toBeDefined();
  }, 30000);

  afterAll(async () => {
    for (const agent of activeAgents) {
      try {
        await agent.receive({ type: 'shutdown', from: 'workflow-test-cleanup' });
      } catch (error) {
        console.warn('Workflow test cleanup warning:', error.message);
      }
    }
    activeAgents = [];
  });

  beforeEach(() => {
    activeAgents = [];
  });

  afterEach(async () => {
    for (const agent of activeAgents) {
      try {
        await agent.receive({ type: 'shutdown', from: 'test-cleanup' });
      } catch (error) {
        console.warn('Test agent cleanup warning:', error.message);
      }
    }
    activeAgents = [];
  });

  describe('9.3 Complex BT Workflow Scenarios', () => {

    it('should execute customer service resolution workflow', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      const { createWorkflowConfig } = await import('../../src/bt/AgentBTConfig.js');
      
      const agent = new ConfigurableAgent(createCustomerServiceAgentConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const sessionId = 'customer-workflow-001';
      
      // Complex customer service workflow: 
      // 1. Greet customer and gather info
      // 2. Check customer tier and priority
      // 3. Analyze issue complexity  
      // 4. Route to appropriate resolution path
      // 5. Execute resolution steps
      // 6. Follow up and close
      
      const customerServiceWorkflow = createWorkflowConfig({
        sessionId,
        steps: [
          {
            type: 'chat',
            name: 'Initial Greeting',
            message: 'Hello! I\'m here to help resolve your issue today. Could you please describe what\'s happening?',
            outputVariable: 'greeting'
          },
          {
            type: 'state',
            name: 'Set Customer Context',
            action: 'update',
            updates: {
              customerName: 'John Doe',
              customerTier: 'premium', 
              issueCategory: 'technical',
              priorityLevel: 4,
              issueComplexity: 'medium'
            },
            outputVariable: 'customerContext'
          },
          {
            type: 'query',
            name: 'Check Available Tools',
            query: 'What technical support tools are available?',
            queryType: 'capabilities',
            outputVariable: 'availableTools'
          },
          {
            type: 'tool',
            name: 'Calculate Response Time',
            tool: 'calculator',
            operation: 'multiply',
            params: { a: 15, b: 4 }, // 15 min base * priority multiplier
            outputVariable: 'estimatedTime'
          },
          {
            type: 'chat', 
            name: 'Provide Resolution Plan',
            message: 'Based on your premium status and the technical nature of this issue, I\'ve identified the best resolution approach. Let me walk you through the steps.',
            outputVariable: 'resolutionPlan'
          },
          {
            type: 'state',
            name: 'Update Resolution Status',
            action: 'update', 
            updates: {
              resolutionStatus: 'in_progress',
              stepsCompleted: 5,
              customerSatisfaction: 'positive'
            },
            outputVariable: 'statusUpdate'
          }
        ],
        rollbackOnFailure: false
      });
      
      const workflowResult = await agent.receive({
        type: 'execute_bt',
        from: 'customer-service-test',
        sessionId,
        btConfig: customerServiceWorkflow,
        context: {
          customerIssue: 'Login system not working properly'
        }
      });
      
      expect(workflowResult.type).toBe('bt_execution_result');
      expect(workflowResult.success).toBe(true);
      expect(workflowResult.status).toBe('SUCCESS');
      
      // Verify all workflow steps were executed
      const expectedArtifacts = ['greeting', 'customerContext', 'availableTools', 'estimatedTime', 'resolutionPlan', 'statusUpdate'];
      expectedArtifacts.forEach(artifact => {
        expect(workflowResult.artifacts).toHaveProperty(artifact);
      });
      
      // Verify state was properly updated
      const stateExport = await agent.receive({
        type: 'export_state',
        from: 'workflow-test'
      });
      
      expect(stateExport.data.state.contextVariables.customerName).toBe('John Doe');
      expect(stateExport.data.state.contextVariables.resolutionStatus).toBe('in_progress');
      
    }, 120000);

    it('should execute educational assessment and adaptation workflow', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      const { createWorkflowConfig } = await import('../../src/bt/AgentBTConfig.js');
      
      const agent = new ConfigurableAgent(createEducationalTutorConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const sessionId = 'education-workflow-001';
      
      // Complex educational workflow:
      // 1. Assess current student knowledge
      // 2. Identify learning gaps
      // 3. Generate personalized content
      // 4. Deliver adaptive instruction 
      // 5. Conduct formative assessment
      // 6. Adjust difficulty and approach
      // 7. Provide feedback and next steps
      
      const educationalWorkflow = createWorkflowConfig({
        sessionId,
        steps: [
          {
            type: 'state',
            name: 'Initialize Student Profile',
            action: 'update',
            updates: {
              studentName: 'Emma Wilson',
              gradeLevel: 'grade-9',
              learningStyle: 'kinesthetic',
              currentTopic: 'algebraic-equations',
              priorKnowledge: 'basic-algebra',
              difficultyLevel: 'intermediate'
            },
            outputVariable: 'studentProfile'
          },
          {
            type: 'chat',
            name: 'Initial Assessment',
            message: 'Hi Emma! Today we\'re going to work on algebraic equations. Let\'s start with a quick assessment. Can you solve: 2x + 5 = 13?',
            outputVariable: 'assessmentQuestion'
          },
          {
            type: 'tool',
            name: 'Calculate Correct Answer',
            tool: 'calculator',
            operation: 'subtract',
            params: { a: 13, b: 5 }, // Should get 8, then divide by 2 to get x = 4
            outputVariable: 'calculatedStep1'
          },
          {
            type: 'tool',
            name: 'Complete Calculation',
            tool: 'calculator', 
            operation: 'divide',
            params: { a: 8, b: 2 }, // x = 4
            outputVariable: 'correctAnswer'
          },
          {
            type: 'query',
            name: 'Check Learning Resources',
            query: 'What teaching materials are available for algebra?',
            queryType: 'capabilities',
            outputVariable: 'teachingMaterials'
          },
          {
            type: 'chat',
            name: 'Provide Adaptive Instruction',
            message: 'Great! For kinesthetic learners like you, let\'s think of algebra like a balance scale. When we have 2x + 5 = 13, imagine 5 blocks plus 2 mystery boxes weighing the same as 13 blocks.',
            outputVariable: 'adaptiveExplanation'
          },
          {
            type: 'state',
            name: 'Update Learning Progress',
            action: 'update',
            updates: {
              topicProgress: 0.6,
              conceptsIntroduced: ['linear-equations', 'balance-method'],
              adaptationApplied: 'kinesthetic-visualization',
              nextSteps: 'practice-problems'
            },
            outputVariable: 'progressUpdate'
          },
          {
            type: 'chat',
            name: 'Provide Encouragement and Next Steps',
            message: 'You\'re making excellent progress! Your kinesthetic learning approach is working well. Let\'s try a few more practice problems to reinforce these concepts.',
            outputVariable: 'encouragementAndNextSteps'
          }
        ],
        rollbackOnFailure: false
      });
      
      const workflowResult = await agent.receive({
        type: 'execute_bt',
        from: 'education-test',
        sessionId,
        btConfig: educationalWorkflow,
        context: {
          lessonPlan: 'algebraic-equations-introduction',
          adaptiveMode: true
        }
      });
      
      expect(workflowResult.type).toBe('bt_execution_result');
      expect(workflowResult.success).toBe(true);
      expect(workflowResult.status).toBe('SUCCESS');
      
      // Verify educational workflow artifacts
      const expectedArtifacts = [
        'studentProfile', 'assessmentQuestion', 'calculatedStep1', 'correctAnswer',
        'teachingMaterials', 'adaptiveExplanation', 'progressUpdate', 'encouragementAndNextSteps'
      ];
      expectedArtifacts.forEach(artifact => {
        expect(workflowResult.artifacts).toHaveProperty(artifact);
      });
      
      // Verify learning progress tracking
      const stateExport = await agent.receive({
        type: 'export_state', 
        from: 'workflow-test'
      });
      
      expect(stateExport.data.state.contextVariables.studentName).toBe('Emma Wilson');
      expect(stateExport.data.state.contextVariables.topicProgress).toBe(0.6);
      expect(stateExport.data.state.contextVariables.adaptationApplied).toBe('kinesthetic-visualization');
      
    }, 120000);

    it('should execute branching decision workflow with conditional logic', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      const { createTaskExecutionConfig } = await import('../../src/bt/AgentBTConfig.js');
      
      const agent = new ConfigurableAgent(createCustomerServiceAgentConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const sessionId = 'branching-workflow-001';
      
      // Set up decision context
      await agent.receive({
        type: 'state_update',
        from: 'workflow-test',
        updates: {
          customerTier: 'enterprise',
          issueUrgency: 'critical',
          businessImpact: 'high',
          supportLevel: 'tier-3'
        }
      });
      
      // Execute high-priority escalation workflow
      const escalationWorkflow = createTaskExecutionConfig({
        sessionId,
        toolName: 'calculator',
        operation: 'multiply',
        params: { a: 24, b: 365 }, // Calculate annual impact
        chatAfterExecution: true,
        chatMessage: 'Based on your enterprise status and critical issue priority, I\'m immediately escalating this to our tier-3 support team and calculating the potential business impact.',
        saveStateAfter: true,
        stateUpdates: {
          escalationTriggered: true,
          escalationLevel: 'tier-3',
          businessImpactCalculated: true,
          priorityHandling: 'immediate'
        }
      });
      
      const escalationResult = await agent.receive({
        type: 'execute_bt',
        from: 'escalation-test',
        sessionId,
        btConfig: escalationWorkflow,
        context: {
          triggerReason: 'critical-enterprise-issue'
        }
      });
      
      expect(escalationResult.type).toBe('bt_execution_result');
      expect(escalationResult.success).toBe(true);
      expect(escalationResult.status).toBe('SUCCESS');
      
      // Verify escalation logic was executed
      expect(escalationResult.artifacts).toHaveProperty('toolResult');
      expect(escalationResult.artifacts).toHaveProperty('discussionResponse');
      expect(escalationResult.artifacts).toHaveProperty('stateUpdate');
      
      // Verify tool calculation result (24 * 365 = 8760)
      expect(escalationResult.artifacts.toolResult.result).toBe(8760);
      
    }, 90000);

    it('should execute parallel processing workflow with concurrent operations', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      const { createConversationFlowConfig } = await import('../../src/bt/AgentBTConfig.js');
      
      const agent = new ConfigurableAgent(createCustomerServiceAgentConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const sessionId = 'parallel-workflow-001';
      
      // Create a conversation flow that simulates parallel processing
      // Note: Our current BT implementation processes sequentially, but this tests
      // the ability to handle complex state and multiple rapid operations
      
      const parallelSimulationFlow = createConversationFlowConfig({
        sessionId,
        userMessage: 'I need help with multiple issues: billing, technical support, and account updates',
        queryCapabilities: true,
        saveState: true,
        includeStateUpdates: {
          multipleIssues: true,
          issueTypes: ['billing', 'technical', 'account'],
          processingMode: 'concurrent',
          complexityLevel: 'high'
        }
      });
      
      const parallelResult = await agent.receive({
        type: 'execute_bt',
        from: 'parallel-test',
        sessionId,
        btConfig: parallelSimulationFlow,
        context: {
          multiIssueRequest: true,
          prioritization: 'customer-impact'
        }
      });
      
      expect(parallelResult.type).toBe('bt_execution_result');
      expect(parallelResult.success).toBe(true);
      expect(parallelResult.status).toBe('SUCCESS');
      
      // Verify complex conversation flow artifacts
      expect(parallelResult.artifacts).toHaveProperty('chatResponse');
      expect(parallelResult.artifacts).toHaveProperty('capabilities');
      expect(parallelResult.artifacts).toHaveProperty('saveResult');
      
    }, 75000);

    it('should handle workflow failure and recovery scenarios', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      const { createWorkflowConfig } = await import('../../src/bt/AgentBTConfig.js');
      
      const agent = new ConfigurableAgent(createCustomerServiceAgentConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const sessionId = 'failure-recovery-workflow-001';
      
      // Create workflow with intentional failure point
      const failureRecoveryWorkflow = createWorkflowConfig({
        sessionId,
        steps: [
          {
            type: 'chat',
            name: 'Initial Step',
            message: 'Starting workflow process',
            outputVariable: 'initialStep'
          },
          {
            type: 'tool',
            name: 'Valid Calculation',
            tool: 'calculator',
            operation: 'add',
            params: { a: 10, b: 5 },
            outputVariable: 'validCalculation'
          },
          {
            type: 'tool',
            name: 'Invalid Tool Request',
            tool: 'nonexistent-tool',
            operation: 'invalid-operation',
            params: { x: 1 },
            outputVariable: 'invalidTool'
          },
          {
            type: 'chat',
            name: 'Recovery Step',
            message: 'Attempting to recover from previous error',
            outputVariable: 'recoveryStep'
          }
        ],
        rollbackOnFailure: false // Don't rollback, test partial execution
      });
      
      const failureResult = await agent.receive({
        type: 'execute_bt',
        from: 'failure-test',
        sessionId,
        btConfig: failureRecoveryWorkflow,
        context: {
          testFailureHandling: true
        }
      });
      
      // Expect partial success - some steps should succeed, others fail
      expect(failureResult.type).toBe('bt_execution_result');
      
      // Check that valid steps were executed
      expect(failureResult.artifacts).toHaveProperty('initialStep');
      expect(failureResult.artifacts).toHaveProperty('validCalculation');
      
      // Verify the valid calculation succeeded
      if (failureResult.artifacts.validCalculation) {
        expect(failureResult.artifacts.validCalculation.result).toBe(15);
      }
      
    }, 60000);

    it('should execute nested workflow with sub-workflows', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      const { createWorkflowConfig, createConversationFlowConfig } = await import('../../src/bt/AgentBTConfig.js');
      
      const agent = new ConfigurableAgent(createEducationalTutorConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const sessionId = 'nested-workflow-001';
      
      // First execute a setup conversation flow
      const setupFlow = createConversationFlowConfig({
        sessionId: sessionId + '-setup',
        userMessage: 'I want to learn about mathematics, specifically algebra',
        queryCapabilities: false,
        saveState: true,
        includeStateUpdates: {
          learningRequest: 'algebra',
          sessionSetup: true
        }
      });
      
      const setupResult = await agent.receive({
        type: 'execute_bt',
        from: 'nested-test',
        sessionId: sessionId + '-setup',
        btConfig: setupFlow
      });
      
      expect(setupResult.success).toBe(true);
      
      // Then execute main educational workflow
      const mainWorkflow = createWorkflowConfig({
        sessionId,
        steps: [
          {
            type: 'state',
            name: 'Set Learning Context',
            action: 'update',
            updates: {
              currentLesson: 'algebra-fundamentals',
              learningObjectives: ['understand-variables', 'solve-basic-equations'],
              instructionalMode: 'guided-practice'
            },
            outputVariable: 'learningContext'
          },
          {
            type: 'chat',
            name: 'Introduce Lesson',
            message: 'Welcome to algebra fundamentals! We\'ll start with understanding variables and then move to solving basic equations.',
            outputVariable: 'lessonIntroduction'
          },
          {
            type: 'tool',
            name: 'Demonstrate Calculation',
            tool: 'calculator',
            operation: 'multiply', 
            params: { a: 3, b: 7 },
            outputVariable: 'demonstrationCalc'
          }
        ],
        rollbackOnFailure: false
      });
      
      const mainResult = await agent.receive({
        type: 'execute_bt',
        from: 'nested-test',
        sessionId,
        btConfig: mainWorkflow,
        context: {
          previousSetup: setupResult.artifacts
        }
      });
      
      expect(mainResult.type).toBe('bt_execution_result');
      expect(mainResult.success).toBe(true);
      expect(mainResult.status).toBe('SUCCESS');
      
      // Verify nested workflow progression
      expect(mainResult.artifacts).toHaveProperty('learningContext');
      expect(mainResult.artifacts).toHaveProperty('lessonIntroduction');
      expect(mainResult.artifacts).toHaveProperty('demonstrationCalc');
      
    }, 90000);
  });
});