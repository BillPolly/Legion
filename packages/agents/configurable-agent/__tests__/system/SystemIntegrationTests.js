/**
 * System Integration Tests for ConfigurableAgent
 * Tests real-world scenarios with production-like configurations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { 
  createCustomerServiceAgentConfig,
  createResearchAssistantConfig,
  createPersonalAssistantConfig,
  createEducationalTutorConfig,
  createTechnicalSupportConfig
} from './AgentConfigurations.js';

describe('System Integration Tests', () => {
  let resourceManager;
  let activeAgents = [];
  
  beforeAll(async () => {
    // Get ResourceManager singleton
    const { ResourceManager } = await import('@legion/resource-manager');
    resourceManager = await ResourceManager.getInstance();
    
    // Verify we have required resources for system testing
    const llmClient = await resourceManager.get('llmClient');
    expect(llmClient).toBeDefined();
  }, 45000);

  afterAll(async () => {
    // Clean up all active agents
    for (const agent of activeAgents) {
      try {
        await agent.receive({ type: 'shutdown', from: 'system-test-cleanup' });
      } catch (error) {
        console.warn('Agent cleanup warning:', error.message);
      }
    }
    activeAgents = [];
  });

  beforeEach(() => {
    // Reset active agents array for each test
    activeAgents = [];
  });

  afterEach(async () => {
    // Clean up agents created in this test
    for (const agent of activeAgents) {
      try {
        await agent.receive({ type: 'shutdown', from: 'test-cleanup' });
      } catch (error) {
        console.warn('Test agent cleanup warning:', error.message);
      }
    }
    activeAgents = [];
  });

  describe('9.1 Realistic Agent Configuration Testing', () => {

    it('should create and operate Customer Service Agent', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createCustomerServiceAgentConfig();
      const agent = new ConfigurableAgent(config, resourceManager);
      activeAgents.push(agent);
      
      await agent.initialize();
      expect(agent.initialized).toBe(true);
      expect(agent.name).toBe('CustomerServiceAgent');
      expect(agent.config.type).toBe('conversational');
      
      // Test customer service workflow
      const sessionId = 'customer-session-001';
      
      // Set customer context
      await agent.receive({
        type: 'state_update',
        from: 'system-test',
        updates: {
          customerName: 'Alice Johnson',
          customerTier: 'premium',
          ticketId: 'TICKET-12345',
          issueCategory: 'billing',
          priorityLevel: 3
        }
      });
      
      // Simulate customer service interaction
      const serviceResponse = await agent.receive({
        type: 'chat',
        from: 'customer',
        content: 'I have a question about my recent billing charge',
        sessionId
      });
      
      expect(serviceResponse.type).toBe('chat_response');
      expect(serviceResponse.content).toBeDefined();
      expect(typeof serviceResponse.content).toBe('string');
      
      // Test tool usage for calculations
      const calculationResponse = await agent.receive({
        type: 'tool_request',
        from: 'system-test',
        tool: 'subtract',
        operation: 'subtract',
        params: { a: 150.00, b: 25.00 },
        sessionId
      });
      
      expect(calculationResponse.success).toBe(true);
      expect(calculationResponse.result).toBe(125.00);
      
    }, 60000);

    it('should create and operate Research Assistant Agent', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createResearchAssistantConfig();
      const agent = new ConfigurableAgent(config, resourceManager);
      activeAgents.push(agent);
      
      await agent.initialize();
      expect(agent.initialized).toBe(true);
      expect(agent.name).toBe('ResearchAssistant');
      expect(agent.config.type).toBe('analytical');
      
      // Test research workflow
      const sessionId = 'research-session-001';
      
      // Set research context
      await agent.receive({
        type: 'state_update',
        from: 'researcher',
        updates: {
          researchTopic: 'Machine Learning Applications in Healthcare',
          researchDomain: 'Computer Science',
          citationStyle: 'APA',
          progressStage: 'literature_review'
        }
      });
      
      // Simulate research query
      const researchResponse = await agent.receive({
        type: 'chat',
        from: 'researcher',
        content: 'Please provide a brief overview of current ML applications in medical diagnosis',
        sessionId
      });
      
      expect(researchResponse.type).toBe('chat_response');
      expect(researchResponse.content).toBeDefined();
      
      // Test query capabilities for research information
      const queryResponse = await agent.receive({
        type: 'query',
        from: 'researcher',
        query: 'What research methodologies are available?',
        sessionId
      });
      
      expect(queryResponse.type).toBe('query_response');
      expect(queryResponse.data).toBeDefined();
      
    }, 45000);

    it('should create and operate Personal Assistant Agent', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createPersonalAssistantConfig();
      const agent = new ConfigurableAgent(config, resourceManager);
      activeAgents.push(agent);
      
      await agent.initialize();
      expect(agent.initialized).toBe(true);
      expect(agent.name).toBe('PersonalAssistant');
      
      // Test personal assistant workflow
      const sessionId = 'assistant-session-001';
      
      // Set personal context
      await agent.receive({
        type: 'state_update',
        from: 'user',
        updates: {
          userName: 'Bob Smith',
          timezone: 'America/New_York',
          preferences: { 
            workingHours: { start: '09:00', end: '17:00' },
            reminderStyle: 'polite',
            taskPriority: 'urgent-first'
          }
        }
      });
      
      // Test task-related interaction
      const assistantResponse = await agent.receive({
        type: 'chat',
        from: 'user',
        content: 'Help me plan my day. I need to finish a presentation and schedule two meetings.',
        sessionId
      });
      
      expect(assistantResponse.type).toBe('chat_response');
      expect(assistantResponse.content).toBeDefined();
      
    }, 40000);

    it('should create and operate Educational Tutor Agent', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createEducationalTutorConfig();
      const agent = new ConfigurableAgent(config, resourceManager);
      activeAgents.push(agent);
      
      await agent.initialize();
      expect(agent.initialized).toBe(true);
      expect(agent.name).toBe('EducationalTutor');
      expect(agent.config.type).toBe('instructional');
      
      // Test educational workflow
      const sessionId = 'tutoring-session-001';
      
      // Set student context
      await agent.receive({
        type: 'state_update',
        from: 'student',
        updates: {
          studentName: 'Sarah Chen',
          gradeLevel: 'high-school',
          learningStyle: 'visual',
          subjectFocus: ['mathematics', 'physics'],
          difficultyPreference: 'intermediate'
        }
      });
      
      // Test educational interaction
      const tutorResponse = await agent.receive({
        type: 'chat',
        from: 'student',
        content: 'Can you explain how to solve quadratic equations?',
        sessionId
      });
      
      expect(tutorResponse.type).toBe('chat_response');
      expect(tutorResponse.content).toBeDefined();
      
      // Test math calculation tool
      const mathResponse = await agent.receive({
        type: 'tool_request',
        from: 'student',
        tool: 'multiply',
        operation: 'multiply',
        params: { a: 15, b: 8 },
        sessionId
      });
      
      expect(mathResponse.success).toBe(true);
      expect(mathResponse.result).toBe(120);
      
    }, 50000);

    it('should create and operate Technical Support Agent', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createTechnicalSupportConfig();
      const agent = new ConfigurableAgent(config, resourceManager);
      activeAgents.push(agent);
      
      await agent.initialize();
      expect(agent.initialized).toBe(true);
      expect(agent.name).toBe('TechnicalSupport');
      expect(agent.config.type).toBe('diagnostic');
      
      // Test technical support workflow
      const sessionId = 'support-session-001';
      
      // Set technical context
      await agent.receive({
        type: 'state_update',
        from: 'user',
        updates: {
          ticketId: 'TECH-5678',
          systemType: 'web-application',
          operatingSystem: 'Linux Ubuntu 22.04',
          issueCategory: 'performance',
          urgencyLevel: 'high'
        }
      });
      
      // Test technical support interaction
      const supportResponse = await agent.receive({
        type: 'chat',
        from: 'user',
        content: 'Our application is running slowly and users are experiencing timeout errors',
        sessionId
      });
      
      expect(supportResponse.type).toBe('chat_response');
      expect(supportResponse.content).toBeDefined();
      
      // Test diagnostic query
      const diagnosticResponse = await agent.receive({
        type: 'query',
        from: 'user',
        query: 'What diagnostic steps should I take?',
        sessionId
      });
      
      expect(diagnosticResponse.type).toBe('query_response');
      expect(diagnosticResponse.data).toBeDefined();
      
    }, 45000);
  });

  describe('9.2 Multi-Agent Configuration Testing', () => {
    
    it('should handle multiple agents with different configurations simultaneously', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      // Create multiple agents with different configurations
      const customerAgent = new ConfigurableAgent(createCustomerServiceAgentConfig(), resourceManager);
      const assistantAgent = new ConfigurableAgent(createPersonalAssistantConfig(), resourceManager);
      const tutorAgent = new ConfigurableAgent(createEducationalTutorConfig(), resourceManager);
      
      activeAgents.push(customerAgent, assistantAgent, tutorAgent);
      
      // Initialize all agents
      await Promise.all([
        customerAgent.initialize(),
        assistantAgent.initialize(), 
        tutorAgent.initialize()
      ]);
      
      expect(customerAgent.initialized).toBe(true);
      expect(assistantAgent.initialized).toBe(true);
      expect(tutorAgent.initialized).toBe(true);
      
      // Test concurrent operations
      const [customerResponse, assistantResponse, tutorResponse] = await Promise.all([
        customerAgent.receive({
          type: 'chat',
          from: 'customer',
          content: 'I need help with my account',
          sessionId: 'customer-multi-test'
        }),
        assistantAgent.receive({
          type: 'chat',
          from: 'user',
          content: 'What are my tasks for today?',
          sessionId: 'assistant-multi-test'
        }),
        tutorAgent.receive({
          type: 'chat',
          from: 'student',
          content: 'Explain the Pythagorean theorem',
          sessionId: 'tutor-multi-test'
        })
      ]);
      
      expect(customerResponse.type).toBe('chat_response');
      expect(assistantResponse.type).toBe('chat_response');
      expect(tutorResponse.type).toBe('chat_response');
      
      expect(customerResponse.content).toBeDefined();
      expect(assistantResponse.content).toBeDefined();
      expect(tutorResponse.content).toBeDefined();
      
    }, 75000);
  });

  describe('9.3 Configuration Validation and Error Handling', () => {
    
    it('should validate complex configurations properly', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      // Test valid complex configuration
      const validConfig = createResearchAssistantConfig();
      const agent = new ConfigurableAgent(validConfig, resourceManager);
      activeAgents.push(agent);
      
      expect(() => agent).not.toThrow();
      await expect(agent.initialize()).resolves.not.toThrow();
      
      // Verify all components are properly configured
      expect(agent.config.capabilities).toBeDefined();
      expect(agent.config.capabilities.length).toBeGreaterThan(0);
      expect(agent.config.prompts).toBeDefined();
      expect(agent.config.state).toBeDefined();
      expect(agent.config.knowledge).toBeDefined();
      expect(agent.config.behaviors).toBeDefined();
    });
    
    it('should handle configuration errors gracefully', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      // Test invalid configuration
      const invalidConfig = {
        agent: {
          id: 'invalid-agent',
          // Missing required fields
        }
      };
      
      expect(() => {
        new ConfigurableAgent(invalidConfig, resourceManager);
      }).toThrow();
    });
  });

  describe('9.4 Real-World Scenario Testing', () => {
    
    it('should handle customer service escalation scenario', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createCustomerServiceAgentConfig();
      const agent = new ConfigurableAgent(config, resourceManager);
      activeAgents.push(agent);
      
      await agent.initialize();
      
      const sessionId = 'escalation-test-001';
      
      // Simulate escalation scenario
      await agent.receive({
        type: 'state_update',
        from: 'system',
        updates: {
          customerName: 'Frustrated Customer',
          customerTier: 'enterprise',
          issueCategory: 'critical-outage',
          priorityLevel: 5
        }
      });
      
      const escalationResponse = await agent.receive({
        type: 'chat',
        from: 'customer',
        content: 'This is the third time I\'m calling about this critical issue. Your system has been down for hours and it\'s costing us money!',
        sessionId
      });
      
      expect(escalationResponse.type).toBe('chat_response');
      expect(escalationResponse.content).toBeDefined();
      
    }, 40000);
    
    it('should handle educational assessment scenario', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createEducationalTutorConfig();
      const agent = new ConfigurableAgent(config, resourceManager);
      activeAgents.push(agent);
      
      await agent.initialize();
      
      const sessionId = 'assessment-test-001';
      
      // Set up student assessment context
      await agent.receive({
        type: 'state_update',
        from: 'system',
        updates: {
          studentName: 'Test Student',
          currentLesson: 'algebra-basics',
          lessonProgress: 0.7,
          strugglingTopics: ['quadratic-equations']
        }
      });
      
      const assessmentResponse = await agent.receive({
        type: 'chat',
        from: 'student',
        content: 'I\'m having trouble with this quadratic equation: x² - 5x + 6 = 0',
        sessionId
      });
      
      expect(assessmentResponse.type).toBe('chat_response');
      expect(assessmentResponse.content).toBeDefined();
      
    }, 45000);
  });
});