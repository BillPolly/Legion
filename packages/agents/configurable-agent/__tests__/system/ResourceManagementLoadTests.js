/**
 * Resource Management Load Tests
 * Tests system performance and resource management under various load conditions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { createCustomerServiceAgentConfig, createPersonalAssistantConfig } from './AgentConfigurations.js';

describe('Resource Management Load Tests', () => {
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
        await agent.receive({ type: 'shutdown', from: 'load-test-cleanup' });
      } catch (error) {
        console.warn('Load test cleanup warning:', error.message);
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

  describe('9.5 Resource Management Under Load', () => {

    it('should handle multiple concurrent agent operations', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const concurrentCount = 5;
      const operationsPerAgent = 10;
      
      console.log(`Creating ${concurrentCount} agents for concurrent load test`);
      
      // Create multiple agents
      const agents = [];
      for (let i = 0; i < concurrentCount; i++) {
        const config = createPersonalAssistantConfig();
        config.agent.id = `load-test-agent-${i}`;
        config.agent.name = `LoadTestAgent${i}`;
        
        const agent = new ConfigurableAgent(config, resourceManager);
        agents.push(agent);
        activeAgents.push(agent);
      }
      
      // Initialize all agents concurrently
      const startTime = Date.now();
      await Promise.all(agents.map(agent => agent.initialize()));
      const initializationTime = Date.now() - startTime;
      
      console.log(`Initialized ${concurrentCount} agents in ${initializationTime}ms`);
      expect(initializationTime).toBeLessThan(30000); // Should initialize within 30 seconds
      
      // Run concurrent operations
      const operationPromises = [];
      
      for (let agentIndex = 0; agentIndex < agents.length; agentIndex++) {
        const agent = agents[agentIndex];
        
        for (let opIndex = 0; opIndex < operationsPerAgent; opIndex++) {
          const sessionId = `load-test-${agentIndex}-${opIndex}`;
          
          // Mix of different operation types
          if (opIndex % 3 === 0) {
            // Chat operation
            operationPromises.push(
              agent.receive({
                type: 'chat',
                from: 'load-test',
                content: `Load test message ${opIndex}`,
                sessionId
              })
            );
          } else if (opIndex % 3 === 1) {
            // State update operation
            operationPromises.push(
              agent.receive({
                type: 'state_update',
                from: 'load-test',
                updates: { 
                  loadTestCounter: opIndex,
                  operationType: 'state_update',
                  timestamp: Date.now()
                }
              })
            );
          } else {
            // Tool operation
            operationPromises.push(
              agent.receive({
                type: 'tool_request',
                from: 'load-test',
                tool: 'add',
        operation: 'add',
                params: { a: opIndex, b: agentIndex },
                sessionId
              })
            );
          }
        }
      }
      
      // Execute all operations concurrently and measure time
      const operationStartTime = Date.now();
      const results = await Promise.allSettled(operationPromises);
      const operationTime = Date.now() - operationStartTime;
      
      console.log(`Completed ${operationPromises.length} operations in ${operationTime}ms`);
      console.log(`Average operation time: ${operationTime / operationPromises.length}ms`);
      
      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`Successful operations: ${successful}, Failed operations: ${failed}`);
      
      expect(successful).toBeGreaterThan(operationPromises.length * 0.95); // At least 95% success rate
      expect(operationTime / operationPromises.length).toBeLessThan(5000); // Average under 5 seconds per operation
      
    }, 180000);

    it('should manage memory efficiently with large state histories', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const config = createCustomerServiceAgentConfig();
      config.agent.state.maxHistorySize = 100; // Reasonable limit for testing
      config.agent.state.pruneStrategy = 'sliding';
      
      const agent = new ConfigurableAgent(config, resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const sessionId = 'memory-management-test';
      const messageCount = 150; // Exceeds maxHistorySize to test pruning
      
      console.log(`Sending ${messageCount} messages to test memory management`);
      
      // Measure initial memory usage (approximate)
      const initialMemory = process.memoryUsage();
      
      // Send many messages to build up history
      const messagePromises = [];
      for (let i = 0; i < messageCount; i++) {
        messagePromises.push(
          agent.receive({
            type: 'chat',
            from: 'memory-test',
            content: `Memory test message ${i} with some content to use memory. This message contains repeated data to test memory usage patterns and efficiency of the state management system.`,
            sessionId
          })
        );
        
        // Add some state updates to increase memory usage
        if (i % 10 === 0) {
          messagePromises.push(
            agent.receive({
              type: 'state_update',
              from: 'memory-test',
              updates: {
                messageCount: i,
                testData: `Test data for message ${i}`,
                timestamp: Date.now(),
                largeArray: new Array(100).fill(`item-${i}`)
              }
            })
          );
        }
      }
      
      await Promise.all(messagePromises);
      
      // Check final memory usage
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Memory increase: ${memoryIncrease / 1024 / 1024}MB`);
      console.log(`Heap used: ${finalMemory.heapUsed / 1024 / 1024}MB`);
      
      // Export state to verify pruning worked
      const stateExport = await agent.receive({
        type: 'export_state',
        from: 'memory-test'
      });
      
      expect(stateExport.success).toBe(true);
      expect(stateExport.data.state.conversationHistory.length).toBeLessThanOrEqual(100);
      
      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
    }, 120000);

    it('should handle rapid sequential operations without degradation', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const agent = new ConfigurableAgent(createPersonalAssistantConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const operationCount = 50;
      const sessionId = 'rapid-operations-test';
      
      console.log(`Testing ${operationCount} rapid sequential operations`);
      
      // Measure response times for rapid operations
      const responseTimes = [];
      
      for (let i = 0; i < operationCount; i++) {
        const operationStart = Date.now();
        
        const response = await agent.receive({
          type: 'chat',
          from: 'rapid-test',
          content: `Rapid operation ${i}`,
          sessionId: `${sessionId}-${i}`
        });
        
        const operationTime = Date.now() - operationStart;
        responseTimes.push(operationTime);
        
        expect(response.type).toBe('chat_response');
        expect(response.content).toBeDefined();
      }
      
      // Analyze response time patterns
      const averageTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxTime = Math.max(...responseTimes);
      const minTime = Math.min(...responseTimes);
      
      console.log(`Response time stats: avg=${averageTime}ms, min=${minTime}ms, max=${maxTime}ms`);
      
      // Response times should remain consistent (no significant degradation)
      const firstHalfAverage = responseTimes.slice(0, operationCount / 2).reduce((a, b) => a + b, 0) / (operationCount / 2);
      const secondHalfAverage = responseTimes.slice(operationCount / 2).reduce((a, b) => a + b, 0) / (operationCount / 2);
      
      const degradationRatio = secondHalfAverage / firstHalfAverage;
      console.log(`Performance degradation ratio: ${degradationRatio}`);
      
      expect(degradationRatio).toBeLessThan(2.0); // Second half shouldn't be more than 2x slower
      expect(averageTime).toBeLessThan(10000); // Average response under 10 seconds
      
    }, 150000);

    it('should efficiently manage ResourceManager singleton access', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      const { ResourceManager } = await import('@legion/resource-manager');
      
      const agentCount = 10;
      const accessCount = 20;
      
      console.log(`Testing ResourceManager singleton access with ${agentCount} agents`);
      
      // Create multiple agents to test ResourceManager singleton efficiency
      const agents = [];
      for (let i = 0; i < agentCount; i++) {
        const config = createPersonalAssistantConfig();
        config.agent.id = `resource-test-agent-${i}`;
        
        const agent = new ConfigurableAgent(config, resourceManager);
        agents.push(agent);
        activeAgents.push(agent);
      }
      
      await Promise.all(agents.map(agent => agent.initialize()));
      
      // Test concurrent ResourceManager access
      const accessPromises = [];
      
      for (let i = 0; i < accessCount; i++) {
        accessPromises.push(
          (async () => {
            const startTime = Date.now();
            
            // Multiple agents accessing ResourceManager simultaneously
            const resourceAccess = await Promise.all(
              agents.map(async (agent) => {
                const rm = await ResourceManager.getInstance();
                const llmClient = await rm.get('llmClient');
                return { agent: agent.config.id, hasLlmClient: !!llmClient };
              })
            );
            
            const accessTime = Date.now() - startTime;
            
            return {
              iteration: i,
              accessTime,
              allAgentsHaveLlm: resourceAccess.every(r => r.hasLlmClient)
            };
          })()
        );
      }
      
      const accessResults = await Promise.all(accessPromises);
      
      // Analyze ResourceManager access performance
      const accessTimes = accessResults.map(r => r.accessTime);
      const averageAccessTime = accessTimes.reduce((a, b) => a + b, 0) / accessTimes.length;
      const maxAccessTime = Math.max(...accessTimes);
      
      console.log(`ResourceManager access: avg=${averageAccessTime}ms, max=${maxAccessTime}ms`);
      
      // All access attempts should succeed
      expect(accessResults.every(r => r.allAgentsHaveLlm)).toBe(true);
      
      // ResourceManager access should be fast (singleton pattern efficiency)
      expect(averageAccessTime).toBeLessThan(100); // Under 100ms average
      expect(maxAccessTime).toBeLessThan(1000); // Under 1 second maximum
      
    }, 90000);

    it('should handle large configuration objects efficiently', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      // Create a large, complex configuration
      const largeConfig = createCustomerServiceAgentConfig();
      
      // Add many context variables
      for (let i = 0; i < 50; i++) {
        largeConfig.agent.state.contextVariables[`dynamicVar${i}`] = {
          type: 'string',
          persistent: true,
          description: `Dynamic variable ${i} for load testing purposes`
        };
      }
      
      // Add many capabilities
      for (let i = 0; i < 10; i++) {
        largeConfig.agent.capabilities.push({
          module: `test-module-${i}`,
          tools: [`tool1-${i}`, `tool2-${i}`, `tool3-${i}`],
          permissions: { read: true, write: true, execute: true },
          description: `Test module ${i} for configuration load testing`
        });
      }
      
      // Add many prompt formats
      for (let i = 0; i < 20; i++) {
        largeConfig.agent.prompts.responseFormats[`format${i}`] = {
          template: `Format ${i} template with {placeholder${i}}`,
          requiredContext: [`context${i}`],
          tone: 'professional',
          description: `Response format ${i} for testing`
        };
      }
      
      console.log('Testing agent creation with large configuration...');
      
      // Test agent creation and initialization with large config
      const startTime = Date.now();
      
      const agent = new ConfigurableAgent(largeConfig, resourceManager);
      activeAgents.push(agent);
      
      const creationTime = Date.now() - startTime;
      console.log(`Agent creation time: ${creationTime}ms`);
      
      const initStartTime = Date.now();
      await agent.initialize();
      const initializationTime = Date.now() - initStartTime;
      
      console.log(`Agent initialization time: ${initializationTime}ms`);
      
      expect(agent.initialized).toBe(true);
      expect(creationTime).toBeLessThan(1000); // Creation under 1 second
      expect(initializationTime).toBeLessThan(15000); // Initialization under 15 seconds
      
      // Test operations with large configuration
      const operationStartTime = Date.now();
      
      const response = await agent.receive({
        type: 'chat',
        from: 'load-test',
        content: 'Test with large configuration',
        sessionId: 'large-config-test'
      });
      
      const operationTime = Date.now() - operationStartTime;
      console.log(`Operation time with large config: ${operationTime}ms`);
      
      expect(response.type).toBe('chat_response');
      expect(operationTime).toBeLessThan(10000); // Operation under 10 seconds
      
    }, 90000);

    it('should maintain performance during extended operation periods', async () => {
      const { ConfigurableAgent } = await import('../../src/core/ConfigurableAgent.js');
      
      const agent = new ConfigurableAgent(createCustomerServiceAgentConfig(), resourceManager);
      activeAgents.push(agent);
      await agent.initialize();
      
      const testDuration = 30000; // 30 seconds
      const operationInterval = 1000; // 1 second between operations
      const expectedOperations = Math.floor(testDuration / operationInterval);
      
      console.log(`Testing sustained performance over ${testDuration}ms (${expectedOperations} operations)`);
      
      const performanceData = [];
      const startTime = Date.now();
      let operationCount = 0;
      
      while (Date.now() - startTime < testDuration) {
        const operationStart = Date.now();
        
        const response = await agent.receive({
          type: 'chat',
          from: 'endurance-test',
          content: `Endurance test operation ${operationCount}`,
          sessionId: `endurance-${operationCount}`
        });
        
        const operationTime = Date.now() - operationStart;
        const currentTime = Date.now() - startTime;
        
        performanceData.push({
          operation: operationCount,
          time: currentTime,
          responseTime: operationTime,
          memoryUsage: process.memoryUsage().heapUsed
        });
        
        expect(response.type).toBe('chat_response');
        operationCount++;
        
        // Wait for next interval
        await new Promise(resolve => setTimeout(resolve, Math.max(0, operationInterval - operationTime)));
      }
      
      console.log(`Completed ${operationCount} operations over ${Date.now() - startTime}ms`);
      
      // Analyze performance trends
      if (performanceData.length >= 2) {
        const firstQuarter = performanceData.slice(0, Math.floor(performanceData.length / 4));
        const lastQuarter = performanceData.slice(-Math.floor(performanceData.length / 4));
        
        const firstQuarterAvgTime = firstQuarter.reduce((sum, op) => sum + op.responseTime, 0) / firstQuarter.length;
        const lastQuarterAvgTime = lastQuarter.reduce((sum, op) => sum + op.responseTime, 0) / lastQuarter.length;
        
        const performanceDegradation = lastQuarterAvgTime / firstQuarterAvgTime;
        
        console.log(`Performance degradation ratio: ${performanceDegradation}`);
        console.log(`First quarter avg: ${firstQuarterAvgTime}ms, Last quarter avg: ${lastQuarterAvgTime}ms`);
        
        expect(performanceDegradation).toBeLessThan(1.5); // No more than 50% degradation
        expect(operationCount).toBeGreaterThan(expectedOperations * 0.8); // At least 80% of expected operations
      }
      
    }, 60000);
  });
});