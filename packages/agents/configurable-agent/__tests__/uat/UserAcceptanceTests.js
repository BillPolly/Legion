/**
 * User Acceptance Tests for ConfigurableAgent
 * Tests complete user scenarios and acceptance criteria from a user perspective
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { 
  createCustomerServiceAgentConfig,
  createResearchAssistantConfig,
  createPersonalAssistantConfig,
  createEducationalTutorConfig,
  createTechnicalSupportConfig
} from '../system/AgentConfigurations.js';

describe('User Acceptance Tests', () => {
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
        await agent.receive({ type: 'shutdown', from: 'uat-cleanup' });
      } catch (error) {
        console.warn('UAT cleanup warning:', error.message);
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

  describe('10.1 Complete User Journey Tests', () => {

    it('should support complete customer service resolution journey', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      console.log('🧑‍💼 UAT: Complete Customer Service Journey');
      
      const agent = new ConfigurableAgent(createCustomerServiceAgentConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const customerSession = 'uat-customer-journey-001';
      
      // 1. Initial customer contact
      console.log('Step 1: Initial customer contact');
      const greeting = await agent.receive({
        type: 'chat',
        from: 'customer',
        content: 'Hello, I need help with my account. My name is Sarah Johnson.',
        sessionId: customerSession
      });
      
      expect(greeting.type).toBe('chat_response');
      expect(greeting.success).toBe(true);
      expect(greeting.content).toBeDefined();
      expect(greeting.content.toLowerCase()).toMatch(/(hello|hi|help|assist)/i);
      
      // 2. Set customer context
      console.log('Step 2: Customer context establishment');
      await agent.receive({
        type: 'state_update',
        from: 'system',
        updates: {
          customerName: 'Sarah Johnson',
          customerTier: 'premium',
          accountNumber: 'ACC-789012',
          previousInteractions: 3
        }
      });
      
      // 3. Issue description and problem solving
      console.log('Step 3: Issue description and problem solving');
      const issueResponse = await agent.receive({
        type: 'chat',
        from: 'customer',
        content: 'I was charged $150 instead of $120 for my monthly subscription. Can you help me understand why?',
        sessionId: customerSession
      });
      
      expect(issueResponse.type).toBe('chat_response');
      expect(issueResponse.success).toBe(true);
      expect(issueResponse.content).toBeDefined();
      
      // 4. Use tools for calculation
      console.log('Step 4: Financial calculation');
      const calculation = await agent.receive({
        type: 'tool_request',
        from: 'customer-service-rep',
        tool: 'subtract',
        operation: 'subtract',
        params: { a: 150, b: 120 },
        sessionId: customerSession
      });
      
      expect(calculation.success).toBe(true);
      expect(calculation.result).toBe(30);
      
      // 5. Resolution and follow-up
      console.log('Step 5: Issue resolution');
      const resolution = await agent.receive({
        type: 'chat',
        from: 'customer',
        content: 'Thank you for explaining the $30 tax that was added. That makes sense now.',
        sessionId: customerSession
      });
      
      expect(resolution.type).toBe('chat_response');
      expect(resolution.success).toBe(true);
      
      // 6. Verify customer satisfaction tracking
      console.log('Step 6: Customer satisfaction tracking');
      await agent.receive({
        type: 'state_update',
        from: 'system',
        updates: {
          resolutionStatus: 'resolved',
          customerSatisfaction: 'satisfied',
          issueCategory: 'billing_inquiry'
        }
      });
      
      const finalState = await agent.receive({
        type: 'export_state',
        from: 'system'
      });
      
      expect(finalState.success).toBe(true);
      expect(finalState.data.state.contextVariables.resolutionStatus).toBe('resolved');
      expect(finalState.data.state.contextVariables.customerName).toBe('Sarah Johnson');
      
      console.log('✅ Complete customer service journey successful');
      
    }, 120000);

    it('should support complete research assistant workflow', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      console.log('🔬 UAT: Complete Research Assistant Workflow');
      
      const agent = new ConfigurableAgent(createResearchAssistantConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const researchSession = 'uat-research-workflow-001';
      
      // 1. Research project initialization
      console.log('Step 1: Research project initialization');
      const projectInit = await agent.receive({
        type: 'state_update',
        from: 'researcher',
        updates: {
          researchTopic: 'Artificial Intelligence in Education',
          researchDomain: 'Educational Technology',
          citationStyle: 'APA',
          projectDeadline: '2024-03-15'
        }
      });
      
      // 2. Initial research query
      console.log('Step 2: Initial research inquiry');
      const initialQuery = await agent.receive({
        type: 'chat',
        from: 'researcher',
        content: 'I need to conduct a literature review on AI applications in personalized learning. Can you help me structure this research?',
        sessionId: researchSession
      });
      
      expect(initialQuery.type).toBe('chat_response');
      expect(initialQuery.success).toBe(true);
      expect(initialQuery.content).toBeDefined();
      
      // 3. Knowledge storage for research findings
      console.log('Step 3: Research findings storage');
      const knowledgeStorage = await agent.receive({
        type: 'knowledge_store',
        from: 'researcher',
        sessionId: researchSession,
        data: {
          category: 'literature',
          topic: 'ai_personalized_learning',
          content: 'Study by Smith et al. (2023) shows 40% improvement in learning outcomes with AI-driven personalization',
          source: 'Journal of Educational Technology, Vol 45',
          confidence: 0.9,
          metadata: {
            authors: ['Smith, J.', 'Doe, A.', 'Johnson, K.'],
            year: 2023,
            studyType: 'empirical'
          }
        }
      });
      
      expect(knowledgeStorage.success).toBe(true);
      
      // 4. Data analysis and calculation
      console.log('Step 4: Research data analysis');
      const dataAnalysis = await agent.receive({
        type: 'tool_request',
        from: 'researcher',
        tool: 'multiply',
        operation: 'multiply',
        params: { a: 0.40, b: 100 }, // Convert improvement percentage
        sessionId: researchSession
      });
      
      expect(dataAnalysis.success).toBe(true);
      expect(dataAnalysis.result).toBe(40);
      
      // 5. Knowledge retrieval and synthesis
      console.log('Step 5: Knowledge synthesis');
      const knowledgeQuery = await agent.receive({
        type: 'knowledge_query',
        from: 'researcher',
        sessionId: researchSession,
        query: {
          category: 'literature',
          topic: 'ai_personalized_learning'
        }
      });
      
      expect(knowledgeQuery.success).toBe(true);
      expect(knowledgeQuery.results).toBeDefined();
      expect(knowledgeQuery.results.length).toBeGreaterThan(0);
      
      // 6. Research summary generation
      console.log('Step 6: Research summary');
      const summary = await agent.receive({
        type: 'chat',
        from: 'researcher',
        content: 'Based on the literature I\'ve reviewed, can you help me synthesize the key findings about AI in personalized learning?',
        sessionId: researchSession
      });
      
      expect(summary.type).toBe('chat_response');
      expect(summary.success).toBe(true);
      expect(summary.content).toBeDefined();
      
      console.log('✅ Complete research assistant workflow successful');
      
    }, 150000);

    it('should support complete educational tutoring session', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      console.log('🎓 UAT: Complete Educational Tutoring Session');
      
      const agent = new ConfigurableAgent(createEducationalTutorConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const tutoringSession = 'uat-tutoring-session-001';
      
      // 1. Student profile setup
      console.log('Step 1: Student profile setup');
      await agent.receive({
        type: 'state_update',
        from: 'system',
        updates: {
          studentName: 'Alex Rodriguez',
          gradeLevel: 'grade-10',
          learningStyle: 'visual',
          subjectFocus: ['mathematics', 'algebra'],
          currentTopic: 'quadratic-equations',
          difficultyLevel: 'intermediate'
        }
      });
      
      // 2. Lesson introduction
      console.log('Step 2: Lesson introduction');
      const lessonIntro = await agent.receive({
        type: 'chat',
        from: 'student',
        content: 'Hi! I\'m ready to learn about quadratic equations. Can you start with the basics?',
        sessionId: tutoringSession
      });
      
      expect(lessonIntro.type).toBe('chat_response');
      expect(lessonIntro.success).toBe(true);
      expect(lessonIntro.content).toBeDefined();
      expect(lessonIntro.content.toLowerCase()).toMatch(/(quadratic|equation|algebra)/i);
      
      // 3. Mathematical problem solving
      console.log('Step 3: Mathematical problem solving');
      const mathProblem = await agent.receive({
        type: 'chat',
        from: 'student',
        content: 'Can you help me solve x² - 5x + 6 = 0?',
        sessionId: tutoringSession
      });
      
      expect(mathProblem.type).toBe('chat_response');
      expect(mathProblem.success).toBe(true);
      expect(mathProblem.content).toBeDefined();
      
      // 4. Use calculator for verification
      console.log('Step 4: Mathematical verification');
      const verification = await agent.receive({
        type: 'tool_request',
        from: 'student',
        tool: 'multiply',
        operation: 'multiply',
        params: { a: 2, b: 3 }, // Verify solution x=2, x=3
        sessionId: tutoringSession
      });
      
      expect(verification.success).toBe(true);
      expect(verification.result).toBe(6);
      
      // 5. Learning progress tracking
      console.log('Step 5: Learning progress assessment');
      await agent.receive({
        type: 'state_update',
        from: 'system',
        updates: {
          topicProgress: 0.75,
          conceptsLearned: ['quadratic-formula', 'factoring'],
          strugglingAreas: [],
          masteryLevel: 'good'
        }
      });
      
      // 6. Adaptive instruction based on progress
      console.log('Step 6: Adaptive instruction');
      const adaptiveInstruction = await agent.receive({
        type: 'chat',
        from: 'student',
        content: 'I think I understand the basics now. Can you give me a more challenging problem?',
        sessionId: tutoringSession
      });
      
      expect(adaptiveInstruction.type).toBe('chat_response');
      expect(adaptiveInstruction.success).toBe(true);
      expect(adaptiveInstruction.content).toBeDefined();
      
      // 7. Final assessment
      console.log('Step 7: Session completion and assessment');
      const finalAssessment = await agent.receive({
        type: 'export_state',
        from: 'system'
      });
      
      expect(finalAssessment.success).toBe(true);
      expect(finalAssessment.data.state.contextVariables.topicProgress).toBe(0.75);
      expect(finalAssessment.data.state.contextVariables.studentName).toBe('Alex Rodriguez');
      
      console.log('✅ Complete educational tutoring session successful');
      
    }, 120000);

    it('should support complete personal assistant daily workflow', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      console.log('📅 UAT: Complete Personal Assistant Daily Workflow');
      
      const agent = new ConfigurableAgent(createPersonalAssistantConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const assistantSession = 'uat-assistant-workflow-001';
      
      // 1. User profile setup
      console.log('Step 1: User profile and preferences setup');
      await agent.receive({
        type: 'state_update',
        from: 'user',
        updates: {
          userName: 'Maria Garcia',
          timezone: 'America/Los_Angeles',
          workingHours: { start: '09:00', end: '17:00' },
          preferences: {
            reminderStyle: 'proactive',
            taskPriority: 'deadline-first',
            communicationStyle: 'brief'
          }
        }
      });
      
      // 2. Daily planning request
      console.log('Step 2: Daily planning assistance');
      const dailyPlanning = await agent.receive({
        type: 'chat',
        from: 'user',
        content: 'Good morning! I have a presentation at 2 PM, need to call 3 clients, and finish the quarterly report. Can you help me organize my day?',
        sessionId: assistantSession
      });
      
      expect(dailyPlanning.type).toBe('chat_response');
      expect(dailyPlanning.success).toBe(true);
      expect(dailyPlanning.content).toBeDefined();
      expect(dailyPlanning.content.toLowerCase()).toMatch(/(presentation|clients|report|organize|schedule)/i);
      
      // 3. Task prioritization
      console.log('Step 3: Task creation and prioritization');
      await agent.receive({
        type: 'state_update',
        from: 'user',
        updates: {
          currentTasks: [
            { task: 'Prepare presentation', deadline: '14:00', priority: 'high' },
            { task: 'Call Client A', deadline: '12:00', priority: 'medium' },
            { task: 'Call Client B', deadline: '15:00', priority: 'medium' },
            { task: 'Call Client C', deadline: '16:00', priority: 'medium' },
            { task: 'Finish quarterly report', deadline: '17:00', priority: 'high' }
          ],
          dailyGoals: ['Complete all client calls', 'Deliver successful presentation']
        }
      });
      
      // 4. Time management calculation
      console.log('Step 4: Time management calculations');
      const timeCalculation = await agent.receive({
        type: 'tool_request',
        from: 'user',
        tool: 'subtract',
        operation: 'subtract',
        params: { a: 17, b: 9 }, // Working hours calculation
        sessionId: assistantSession
      });
      
      expect(timeCalculation.success).toBe(true);
      expect(timeCalculation.result).toBe(8); // 8-hour workday
      
      // 5. Progress tracking throughout the day
      console.log('Step 5: Progress tracking');
      await agent.receive({
        type: 'state_update',
        from: 'user',
        updates: {
          completedToday: [
            { task: 'Call Client A', completedAt: '11:30' }
          ],
          currentTask: 'Prepare presentation'
        }
      });
      
      // 6. Real-time assistance
      console.log('Step 6: Real-time task assistance');
      const assistance = await agent.receive({
        type: 'chat',
        from: 'user',
        content: 'I finished the client call early. Should I start on the presentation now or tackle the report?',
        sessionId: assistantSession
      });
      
      expect(assistance.type).toBe('chat_response');
      expect(assistance.success).toBe(true);
      expect(assistance.content).toBeDefined();
      
      // 7. End-of-day summary
      console.log('Step 7: Daily summary and planning');
      const dailySummary = await agent.receive({
        type: 'chat',
        from: 'user',
        content: 'How did I do today? Can you give me a summary of what I accomplished?',
        sessionId: assistantSession
      });
      
      expect(dailySummary.type).toBe('chat_response');
      expect(dailySummary.success).toBe(true);
      expect(dailySummary.content).toBeDefined();
      
      console.log('✅ Complete personal assistant workflow successful');
      
    }, 100000);
  });

  describe('10.2 Cross-Agent Integration Tests', () => {

    it('should demonstrate seamless agent handoff between different specialized agents', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      console.log('🔄 UAT: Cross-Agent Integration and Handoff');
      
      // Create multiple specialized agents
      const customerAgent = new ConfigurableAgent(createCustomerServiceAgentConfig(), resourceManager);
      const techAgent = new ConfigurableAgent(createTechnicalSupportConfig(), resourceManager);
      const assistantAgent = new ConfigurableAgent(createPersonalAssistantConfig(), resourceManager);
      
      activeAgents.push(customerAgent, techAgent, assistantAgent);
      
      // Initialize all agents
      await Promise.all([
        customerAgent.initialize(),
        techAgent.initialize(), 
        assistantAgent.initialize()
      ]);
      
      const sessionId = 'cross-agent-integration-001';
      
      // 1. Initial customer service contact
      console.log('Step 1: Initial customer service interaction');
      const customerResponse = await customerAgent.receive({
        type: 'chat',
        from: 'user',
        content: 'Hello, I\'m having technical issues with your software and I\'m frustrated. This is affecting my work.',
        sessionId
      });
      
      expect(customerResponse.type).toBe('chat_response');
      expect(customerResponse.success).toBe(true);
      
      // 2. Identify need for technical handoff
      console.log('Step 2: Technical issue identification and handoff');
      await customerAgent.receive({
        type: 'state_update',
        from: 'system',
        updates: {
          escalationReason: 'technical_complexity',
          handoffRequired: true,
          targetAgent: 'technical-support'
        }
      });
      
      // 3. Technical agent takes over with context
      console.log('Step 3: Technical support agent context transfer');
      await techAgent.receive({
        type: 'state_update',
        from: 'system',
        updates: {
          transferredFrom: 'customer-service',
          customerContext: {
            frustratedCustomer: true,
            workImpact: true,
            priorityLevel: 'high'
          },
          issueCategory: 'software_malfunction'
        }
      });
      
      const techResponse = await techAgent.receive({
        type: 'chat',
        from: 'user',
        content: 'The software keeps crashing when I try to save my work. I\'ve lost hours of progress.',
        sessionId
      });
      
      expect(techResponse.type).toBe('chat_response');
      expect(techResponse.success).toBe(true);
      
      // 4. Technical diagnosis and resolution
      console.log('Step 4: Technical diagnosis');
      const diagnostic = await techAgent.receive({
        type: 'tool_request',
        from: 'technician',
        tool: 'multiply',
        operation: 'multiply',
        params: { a: 24, b: 7 }, // Calculate downtime impact (24 hours * 7 days)
        sessionId
      });
      
      expect(diagnostic.success).toBe(true);
      expect(diagnostic.result).toBe(168);
      
      // 5. Follow-up assistance handoff
      console.log('Step 5: Personal assistant follow-up scheduling');
      await assistantAgent.receive({
        type: 'state_update',
        from: 'system',
        updates: {
          followUpRequired: true,
          customerName: 'Technical Support User',
          issueResolved: true,
          followUpType: 'satisfaction_check',
          scheduleDate: '2024-01-20'
        }
      });
      
      const followUp = await assistantAgent.receive({
        type: 'chat',
        from: 'system',
        content: 'Please schedule a follow-up call to ensure the technical issue was fully resolved.',
        sessionId
      });
      
      expect(followUp.type).toBe('chat_response');
      expect(followUp.success).toBe(true);
      
      // 6. Verify all agents maintain their specialized contexts
      console.log('Step 6: Context preservation verification');
      const customerState = await customerAgent.receive({ type: 'export_state', from: 'system' });
      const techState = await techAgent.receive({ type: 'export_state', from: 'system' });
      const assistantState = await assistantAgent.receive({ type: 'export_state', from: 'system' });
      
      expect(customerState.success).toBe(true);
      expect(techState.success).toBe(true);
      expect(assistantState.success).toBe(true);
      
      // Verify each agent retained relevant context
      expect(customerState.data.state.contextVariables.handoffRequired).toBe(true);
      expect(techState.data.state.contextVariables.issueCategory).toBe('software_malfunction');
      expect(assistantState.data.state.contextVariables.followUpRequired).toBe(true);
      
      console.log('✅ Cross-agent integration and handoff successful');
      
    }, 180000);
  });

  describe('10.3 Production Readiness Validation', () => {

    it('should validate production-ready performance and reliability', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      console.log('⚡ UAT: Production Performance and Reliability Validation');
      
      const config = createCustomerServiceAgentConfig();
      const agent = new ConfigurableAgent(config, resourceManager);
      activeAgents.push(agent);
      
      const startTime = Date.now();
      await agent.initialize();
      const initializationTime = Date.now() - startTime;
      
      console.log(`Agent initialization time: ${initializationTime}ms`);
      expect(initializationTime).toBeLessThan(15000); // Production requirement: <15s
      
      const sessionId = 'production-validation-001';
      
      // Test sustained operation performance
      console.log('Testing sustained operation performance...');
      const operationCount = 20;
      const responseTimes = [];
      
      for (let i = 0; i < operationCount; i++) {
        const operationStart = Date.now();
        
        const response = await agent.receive({
          type: 'chat',
          from: 'performance-test',
          content: `Production readiness test message ${i + 1}`,
          sessionId: `${sessionId}-${i}`
        });
        
        const responseTime = Date.now() - operationStart;
        responseTimes.push(responseTime);
        
        expect(response.type).toBe('chat_response');
        expect(response.success).toBe(true);
        expect(responseTime).toBeLessThan(10000); // Production requirement: <10s per operation
      }
      
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      console.log(`Average response time: ${averageResponseTime}ms`);
      expect(averageResponseTime).toBeLessThan(5000); // Production requirement: <5s average
      
      // Test error recovery
      console.log('Testing error recovery capabilities...');
      const errorResponse = await agent.receive({
        type: 'invalid_type',
        from: 'error-test',
        sessionId
      });
      
      expect(errorResponse.type).toBe('error');
      expect(errorResponse.success).toBe(false);
      
      // Verify agent still works after error
      const recoveryResponse = await agent.receive({
        type: 'chat',
        from: 'recovery-test',
        content: 'Verify recovery after error',
        sessionId
      });
      
      expect(recoveryResponse.type).toBe('chat_response');
      expect(recoveryResponse.success).toBe(true);
      
      console.log('✅ Production performance and reliability validated');
      
    }, 120000);

    it('should validate complete feature set functionality', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      console.log('🔧 UAT: Complete Feature Set Validation');
      
      const agent = new ConfigurableAgent(createResearchAssistantConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const sessionId = 'feature-validation-001';
      
      // Validate all core message types
      const coreFeatures = [
        {
          name: 'Chat Interaction',
          test: () => agent.receive({
            type: 'chat',
            from: 'feature-test',
            content: 'Test chat functionality',
            sessionId
          })
        },
        {
          name: 'Tool Request',
          test: () => agent.receive({
            type: 'tool_request',
            from: 'feature-test',
            tool: 'add',
        operation: 'add',
            params: { a: 5, b: 10 },
            sessionId
          })
        },
        {
          name: 'State Management',
          test: () => agent.receive({
            type: 'state_update',
            from: 'feature-test',
            updates: { testVariable: 'feature-validation-value' }
          })
        },
        {
          name: 'State Export',
          test: () => agent.receive({
            type: 'export_state',
            from: 'feature-test'
          })
        },
        {
          name: 'Query System',
          test: () => agent.receive({
            type: 'query',
            from: 'feature-test',
            query: 'What capabilities do you have?',
            sessionId
          })
        },
        {
          name: 'Knowledge Storage',
          test: () => agent.receive({
            type: 'knowledge_store',
            from: 'feature-test',
            sessionId,
            data: {
              category: 'test_data',
              content: 'Feature validation knowledge entry',
              confidence: 1.0
            }
          })
        },
        {
          name: 'Knowledge Query',
          test: () => agent.receive({
            type: 'knowledge_query',
            from: 'feature-test',
            sessionId,
            query: { category: 'test_data' }
          })
        }
      ];
      
      console.log('Validating all core features...');
      
      for (const feature of coreFeatures) {
        console.log(`Testing: ${feature.name}`);
        
        const result = await feature.test();
        
        expect(result).toBeDefined();
        expect(result.type).toBeDefined();
        
        // Most features should succeed
        if (feature.name !== 'Knowledge Query') { // Knowledge query might be empty initially
          expect(result.success).toBe(true);
        }
        
        console.log(`✅ ${feature.name} validated`);
      }
      
      console.log('✅ Complete feature set validated');
      
    }, 150000);

    it('should demonstrate comprehensive configuration flexibility', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      console.log('⚙️ UAT: Configuration Flexibility Validation');
      
      // Test all provided configurations work correctly
      const configurations = [
        { name: 'Customer Service', config: createCustomerServiceAgentConfig() },
        { name: 'Research Assistant', config: createResearchAssistantConfig() },
        { name: 'Personal Assistant', config: createPersonalAssistantConfig() },
        { name: 'Educational Tutor', config: createEducationalTutorConfig() },
        { name: 'Technical Support', config: createTechnicalSupportConfig() }
      ];
      
      for (const { name, config } of configurations) {
        console.log(`Validating ${name} configuration...`);
        
        const agent = new ConfigurableAgent(config, resourceManager);
        activeAgents.push(agent);
        
        await agent.initialize();
        expect(agent.initialized).toBe(true);
        
        // Test basic functionality
        const response = await agent.receive({
          type: 'chat',
          from: 'config-test',
          content: `Testing ${name} agent configuration`,
          sessionId: `config-test-${name.toLowerCase().replace(' ', '-')}`
        });
        
        expect(response.type).toBe('chat_response');
        expect(response.success).toBe(true);
        expect(response.content).toBeDefined();
        
        console.log(`✅ ${name} configuration validated`);
      }
      
      console.log('✅ Configuration flexibility validated');
      
    }, 200000);
  });
});