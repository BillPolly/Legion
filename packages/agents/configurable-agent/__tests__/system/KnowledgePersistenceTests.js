/**
 * Knowledge Persistence and Retrieval Tests
 * Tests knowledge graph functionality across multiple sessions and persistence scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createResearchAssistantConfig, createCustomerServiceAgentConfig } from './AgentConfigurations.js';

describe('Knowledge Persistence and Retrieval Tests', () => {
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
        await agent.receive({ type: 'shutdown', from: 'knowledge-test-cleanup' });
      } catch (error) {
        console.warn('Knowledge test cleanup warning:', error.message);
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

  describe('9.4 Knowledge Graph Persistence and Retrieval', () => {

    it('should persist knowledge across chat sessions', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const agent = new ConfigurableAgent(createResearchAssistantConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const baseSessionId = 'knowledge-persistence-001';
      
      // Session 1: Store initial knowledge
      const session1 = `${baseSessionId}-session1`;
      
      await agent.receive({
        type: 'chat',
        from: 'researcher',
        content: 'I\'m researching machine learning applications in healthcare. Key findings: CNNs are effective for medical image analysis, achieving 95% accuracy in chest X-ray diagnosis.',
        sessionId: session1
      });
      
      // Store explicit knowledge
      await agent.receive({
        type: 'knowledge_store',
        from: 'researcher',
        sessionId: session1,
        data: {
          category: 'research_findings',
          topic: 'ML_in_healthcare', 
          content: 'Convolutional Neural Networks achieve 95% accuracy in chest X-ray diagnosis',
          source: 'research_session_1',
          confidence: 0.9,
          metadata: {
            researchDomain: 'computer_science',
            application: 'medical_imaging'
          }
        }
      });
      
      // Session 2: Access stored knowledge
      const session2 = `${baseSessionId}-session2`;
      
      const knowledgeQuery = await agent.receive({
        type: 'knowledge_query',
        from: 'researcher',
        sessionId: session2,
        query: {
          category: 'research_findings',
          topic: 'ML_in_healthcare',
          filters: {
            application: 'medical_imaging'
          }
        }
      });
      
      expect(knowledgeQuery.type).toBe('knowledge_response');
      expect(knowledgeQuery.success).toBe(true);
      expect(knowledgeQuery.results).toBeDefined();
      expect(knowledgeQuery.results.length).toBeGreaterThan(0);
      
      // Verify knowledge content persisted correctly
      const storedKnowledge = knowledgeQuery.results.find(item => 
        item.content.includes('95% accuracy') && item.content.includes('chest X-ray')
      );
      expect(storedKnowledge).toBeDefined();
      expect(storedKnowledge.source).toBe('research_session_1');
      
      // Session 3: Build on previous knowledge
      const session3 = `${baseSessionId}-session3`;
      
      const knowledgeAwareChat = await agent.receive({
        type: 'chat',
        from: 'researcher',
        content: 'What did I learn about CNN accuracy in medical imaging?',
        sessionId: session3
      });
      
      expect(knowledgeAwareChat.type).toBe('chat_response');
      expect(knowledgeAwareChat.content).toBeDefined();
      // The response should reference the stored knowledge
      expect(knowledgeAwareChat.content.toLowerCase()).toMatch(/(95%|accuracy|chest|x-ray|cnn)/i);
      
    }, 90000);

    it('should handle different knowledge persistence levels', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      // Create agent with session-level persistence
      const sessionConfig = createCustomerServiceAgentConfig();
      sessionConfig.agent.knowledge.persistence = 'session';
      
      const sessionAgent = new ConfigurableAgent(sessionConfig, resourceManager);
      activeAgents.push(sessionAgent);
      await sessionAgent.initialize();
      
      // Create agent with permanent persistence  
      const permanentConfig = createResearchAssistantConfig();
      permanentConfig.agent.knowledge.persistence = 'permanent';
      
      const permanentAgent = new ConfigurableAgent(permanentConfig, resourceManager);
      activeAgents.push(permanentAgent);
      await permanentAgent.initialize();
      
      const sessionId = 'persistence-level-test-001';
      
      // Store knowledge in both agents
      const sessionKnowledgeResult = await sessionAgent.receive({
        type: 'knowledge_store',
        from: 'test',
        sessionId,
        data: {
          category: 'customer_info',
          content: 'Customer prefers email communication over phone calls',
          persistence: 'session'
        }
      });
      
      const permanentKnowledgeResult = await permanentAgent.receive({
        type: 'knowledge_store',
        from: 'test', 
        sessionId,
        data: {
          category: 'research_data',
          content: 'Study shows 78% improvement with new methodology',
          persistence: 'permanent'
        }
      });
      
      expect(sessionKnowledgeResult.success).toBe(true);
      expect(permanentKnowledgeResult.success).toBe(true);
      
      // Query knowledge from both agents
      const sessionQuery = await sessionAgent.receive({
        type: 'knowledge_query',
        from: 'test',
        sessionId,
        query: { category: 'customer_info' }
      });
      
      const permanentQuery = await permanentAgent.receive({
        type: 'knowledge_query',
        from: 'test',
        sessionId,
        query: { category: 'research_data' }
      });
      
      expect(sessionQuery.success).toBe(true);
      expect(permanentQuery.success).toBe(true);
      
      expect(sessionQuery.results.length).toBeGreaterThan(0);
      expect(permanentQuery.results.length).toBeGreaterThan(0);
      
    }, 75000);

    it('should support semantic knowledge retrieval', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const agent = new ConfigurableAgent(createResearchAssistantConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const sessionId = 'semantic-retrieval-001';
      
      // Store diverse knowledge items
      const knowledgeItems = [
        {
          category: 'literature',
          topic: 'neural_networks',
          content: 'Deep learning models require large datasets and computational resources',
          metadata: { domain: 'AI', complexity: 'high' }
        },
        {
          category: 'literature', 
          topic: 'machine_learning',
          content: 'Support Vector Machines work well for classification tasks with small datasets',
          metadata: { domain: 'AI', complexity: 'medium' }
        },
        {
          category: 'methodologies',
          topic: 'research_methods',
          content: 'Cross-validation is essential for evaluating model performance reliably',
          metadata: { domain: 'statistics', complexity: 'medium' }
        },
        {
          category: 'literature',
          topic: 'data_science',
          content: 'Feature engineering often has more impact than algorithm selection',
          metadata: { domain: 'data_science', complexity: 'high' }
        }
      ];
      
      // Store all knowledge items
      for (const item of knowledgeItems) {
        const storeResult = await agent.receive({
          type: 'knowledge_store',
          from: 'test',
          sessionId,
          data: item
        });
        expect(storeResult.success).toBe(true);
      }
      
      // Test semantic queries
      const semanticQueries = [
        {
          query: { 
            semantic: 'algorithms for small datasets',
            categories: ['literature']
          },
          expectedMatch: 'Support Vector Machines'
        },
        {
          query: {
            semantic: 'model evaluation techniques',
            categories: ['methodologies']
          },
          expectedMatch: 'Cross-validation'
        },
        {
          query: {
            semantic: 'deep learning requirements',
            categories: ['literature'],
            filters: { complexity: 'high' }
          },
          expectedMatch: 'large datasets'
        }
      ];
      
      for (const testQuery of semanticQueries) {
        const queryResult = await agent.receive({
          type: 'knowledge_query',
          from: 'test',
          sessionId: sessionId + '-semantic',
          query: testQuery.query
        });
        
        expect(queryResult.type).toBe('knowledge_response');
        expect(queryResult.success).toBe(true);
        expect(queryResult.results).toBeDefined();
        
        // Verify semantic matching worked
        const matchingResult = queryResult.results.find(item => 
          item.content.includes(testQuery.expectedMatch)
        );
        expect(matchingResult).toBeDefined();
      }
      
    }, 120000);

    it('should handle knowledge graph relationships and connections', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const agent = new ConfigurableAgent(createResearchAssistantConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const sessionId = 'knowledge-relationships-001';
      
      // Store interconnected knowledge with relationships
      const relatedKnowledge = [
        {
          id: 'concept_1',
          category: 'literature',
          topic: 'neural_networks',
          content: 'Convolutional Neural Networks are specialized for image processing',
          relationships: {
            relatedTo: ['concept_2', 'concept_3'],
            enables: ['concept_4']
          }
        },
        {
          id: 'concept_2', 
          category: 'literature',
          topic: 'computer_vision',
          content: 'Computer vision applications include medical image analysis',
          relationships: {
            enabledBy: ['concept_1'],
            appliedIn: ['concept_5']
          }
        },
        {
          id: 'concept_3',
          category: 'methodologies',
          topic: 'training_techniques',
          content: 'Backpropagation is used to train neural networks',
          relationships: {
            appliesTo: ['concept_1'],
            requires: ['concept_4']
          }
        },
        {
          id: 'concept_4',
          category: 'data',
          topic: 'datasets',
          content: 'Large labeled datasets are required for supervised learning',
          relationships: {
            requiredFor: ['concept_1', 'concept_3'],
            exampleOf: ['concept_5']
          }
        },
        {
          id: 'concept_5',
          category: 'applications',
          topic: 'medical_ai',
          content: 'Medical AI applications show 90% accuracy in diagnostic tasks',
          relationships: {
            uses: ['concept_2'],
            requires: ['concept_4']
          }
        }
      ];
      
      // Store knowledge with relationships
      for (const item of relatedKnowledge) {
        const storeResult = await agent.receive({
          type: 'knowledge_store',
          from: 'test',
          sessionId,
          data: item
        });
        expect(storeResult.success).toBe(true);
      }
      
      // Query for related knowledge
      const relationshipQuery = await agent.receive({
        type: 'knowledge_query',
        from: 'test',
        sessionId,
        query: {
          id: 'concept_1',
          includeRelationships: true,
          relationshipDepth: 2
        }
      });
      
      expect(relationshipQuery.type).toBe('knowledge_response');
      expect(relationshipQuery.success).toBe(true);
      expect(relationshipQuery.results).toBeDefined();
      
      // Should return the main concept and its related concepts
      expect(relationshipQuery.results.length).toBeGreaterThan(1);
      
      const mainConcept = relationshipQuery.results.find(item => item.id === 'concept_1');
      expect(mainConcept).toBeDefined();
      expect(mainConcept.content).toContain('Convolutional Neural Networks');
      
    }, 90000);

    it('should support knowledge versioning and updates', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const agent = new ConfigurableAgent(createResearchAssistantConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const sessionId = 'knowledge-versioning-001';
      
      // Store initial version of knowledge
      const initialKnowledge = {
        id: 'research_finding_1',
        category: 'research_notes',
        topic: 'model_accuracy',
        content: 'Initial tests show 85% accuracy with basic CNN model',
        version: 1,
        metadata: {
          experiment: 'baseline',
          date: '2024-01-01'
        }
      };
      
      const initialStore = await agent.receive({
        type: 'knowledge_store',
        from: 'researcher',
        sessionId,
        data: initialKnowledge
      });
      
      expect(initialStore.success).toBe(true);
      
      // Update knowledge with new findings
      const updatedKnowledge = {
        id: 'research_finding_1',
        category: 'research_notes', 
        topic: 'model_accuracy',
        content: 'Improved tests show 92% accuracy after hyperparameter tuning',
        version: 2,
        metadata: {
          experiment: 'optimized',
          date: '2024-01-15',
          improvements: ['hyperparameter_tuning', 'data_augmentation']
        }
      };
      
      const updateStore = await agent.receive({
        type: 'knowledge_update',
        from: 'researcher',
        sessionId,
        data: updatedKnowledge
      });
      
      expect(updateStore.success).toBe(true);
      
      // Query for latest version
      const latestQuery = await agent.receive({
        type: 'knowledge_query',
        from: 'researcher',
        sessionId,
        query: {
          id: 'research_finding_1',
          version: 'latest'
        }
      });
      
      expect(latestQuery.success).toBe(true);
      expect(latestQuery.results.length).toBe(1);
      expect(latestQuery.results[0].content).toContain('92% accuracy');
      expect(latestQuery.results[0].version).toBe(2);
      
      // Query for version history
      const historyQuery = await agent.receive({
        type: 'knowledge_query',
        from: 'researcher',
        sessionId,
        query: {
          id: 'research_finding_1',
          includeHistory: true
        }
      });
      
      expect(historyQuery.success).toBe(true);
      expect(historyQuery.results.length).toBe(2); // Both versions
      
      // Verify both versions are present
      const versions = historyQuery.results.map(item => item.version).sort();
      expect(versions).toEqual([1, 2]);
      
    }, 75000);

    it('should maintain knowledge consistency across agent restarts', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const sessionId = 'knowledge-consistency-001';
      
      // Create first agent instance and store knowledge
      const agent1 = new ConfigurableAgent(createResearchAssistantConfig(), resourceManager);
      activeAgents.push(agent1);
      await agent1.initialize();
      
      const persistentKnowledge = {
        category: 'persistent_data',
        topic: 'consistency_test',
        content: 'This knowledge should persist across agent restarts',
        metadata: {
          testId: 'consistency-test-001',
          importance: 'high'
        }
      };
      
      const storeResult = await agent1.receive({
        type: 'knowledge_store',
        from: 'test',
        sessionId,
        data: persistentKnowledge
      });
      
      expect(storeResult.success).toBe(true);
      
      // Shut down first agent
      await agent1.receive({ type: 'shutdown', from: 'test' });
      
      // Create new agent instance with same configuration
      const agent2 = new ConfigurableAgent(createResearchAssistantConfig(), resourceManager);
      activeAgents.push(agent2);
      await agent2.initialize();
      
      // Query for previously stored knowledge
      const consistencyQuery = await agent2.receive({
        type: 'knowledge_query',
        from: 'test',
        sessionId,
        query: {
          category: 'persistent_data',
          topic: 'consistency_test'
        }
      });
      
      expect(consistencyQuery.success).toBe(true);
      expect(consistencyQuery.results).toBeDefined();
      expect(consistencyQuery.results.length).toBeGreaterThan(0);
      
      const retrievedKnowledge = consistencyQuery.results.find(item =>
        item.content === persistentKnowledge.content
      );
      
      expect(retrievedKnowledge).toBeDefined();
      expect(retrievedKnowledge.metadata.testId).toBe('consistency-test-001');
      
    }, 90000);
  });
});