/**
 * Simple Usage Example: Basic AgentRegistry Operations
 * 
 * This example demonstrates the essential operations for getting started
 * with the AgentRegistry system.
 */

import { AgentRegistry } from '../src/AgentRegistry.js';
import { ResourceManager } from '@legion/resource-manager';

async function simpleUsageExample() {
  console.log('🎯 AgentRegistry: Simple Usage Example\n');
  
  // 1. Initialize the registry
  const resourceManager = await ResourceManager.getInstance();
  const registry = new AgentRegistry(resourceManager);
  await registry.initialize();
  
  try {
    // 2. Create a simple chat agent
    console.log('1️⃣ Creating a Chat Agent\n');
    
    const chatAgentConfig = {
      agent: {
        id: 'simple-chat-bot',
        name: 'SimpleChatBot',
        type: 'conversational',
        version: '1.0.0',
        description: 'A friendly chat bot for basic conversations',
        llm: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          temperature: 0.8,
          maxTokens: 2000
        },
        capabilities: [
          {
            module: 'conversation',
            tools: ['respond_to_user', 'maintain_context']
          }
        ],
        tags: ['chat', 'simple', 'demo']
      }
    };
    
    const result = await registry.registerAgent(chatAgentConfig);
    if (result.success) {
      console.log(`✅ Chat agent created successfully!`);
      console.log(`   Agent ID: ${result.agentId}`);
      console.log(`   Version: ${result.version}`);
    } else {
      console.log(`❌ Failed to create agent: ${result.error}`);
    }
    
    console.log('\n2️⃣ Retrieving the Agent\n');
    
    // 3. Retrieve the agent
    const retrievedAgent = await registry.getAgent('simple-chat-bot');
    if (retrievedAgent) {
      console.log(`✅ Retrieved agent: ${retrievedAgent.agent.name}`);
      console.log(`   Type: ${retrievedAgent.agent.type}`);
      console.log(`   Description: ${retrievedAgent.agent.description}`);
      console.log(`   LLM Provider: ${retrievedAgent.agent.llm.provider}`);
      console.log(`   Tags: ${retrievedAgent.agent.tags.join(', ')}`);
    }
    
    console.log('\n3️⃣ Listing All Agents\n');
    
    // 4. List all agents
    const allAgents = await registry.listAgents();
    console.log(`📋 Found ${allAgents.length} agent(s) in the registry:`);
    
    allAgents.forEach((agent, index) => {
      const agentConfig = agent.agent || agent.configuration?.agent || agent;
      console.log(`   ${index + 1}. ${agentConfig.name} (${agentConfig.type})`);
    });
    
    console.log('\n4️⃣ Getting Agent Metadata\n');
    
    // 5. Get agent metadata (lightweight info)
    const metadata = await registry.getAgentMetadata('simple-chat-bot');
    if (metadata) {
      console.log('📊 Agent Metadata:');
      console.log(`   ID: ${metadata.id}`);
      console.log(`   Name: ${metadata.name}`);
      console.log(`   Type: ${metadata.type}`);
      console.log(`   Version: ${metadata.version}`);
      console.log(`   Capabilities: ${metadata.capabilityCount} modules`);
      console.log(`   Tools: ${metadata.toolCount} total`);
      console.log(`   Registered: ${new Date(metadata.registeredAt).toLocaleDateString()}`);
    }
    
    console.log('\n5️⃣ Updating the Agent\n');
    
    // 6. Update the agent with a new version
    const updatedConfig = {
      ...chatAgentConfig,
      agent: {
        ...chatAgentConfig.agent,
        version: '1.1.0',
        description: 'An enhanced chat bot with improved conversation skills',
        capabilities: [
          {
            module: 'conversation',
            tools: ['respond_to_user', 'maintain_context', 'detect_sentiment']
          },
          {
            module: 'knowledge',
            tools: ['search_facts', 'provide_information']
          }
        ],
        tags: [...chatAgentConfig.agent.tags, 'enhanced']
      }
    };
    
    const updateResult = await registry.registerAgent(updatedConfig, { allowUpdate: true });
    if (updateResult.success) {
      console.log(`✅ Agent updated to version ${updateResult.version}`);
    }
    
    console.log('\n6️⃣ Basic Statistics\n');
    
    // 7. Get basic statistics
    const stats = await registry.getStatistics();
    console.log('📈 Registry Statistics:');
    console.log(`   Total Agents: ${stats.totalAgents}`);
    console.log('   Types:');
    Object.entries(stats.byType).forEach(([type, count]) => {
      console.log(`     ${type}: ${count}`);
    });
    
    console.log('\n7️⃣ Cleanup\n');
    
    // 8. Delete the agent (optional)
    const deleteResult = await registry.deleteAgent('simple-chat-bot');
    if (deleteResult.success) {
      console.log('✅ Agent deleted successfully');
    }
    
    console.log('\n🎉 Simple usage example completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Example failed:', error.message);
    throw error;
  } finally {
    await registry.cleanup();
  }
}

// Export for testing
export { simpleUsageExample };

// Run if called directly
if (import.meta.url === new URL(import.meta.url).href) {
  simpleUsageExample().catch(error => {
    console.error('Example failed:', error);
    process.exit(1);
  });
}