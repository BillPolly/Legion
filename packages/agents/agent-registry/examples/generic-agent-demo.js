/**
 * Generic Agent Creation Demo
 * 
 * This demonstrates the proper way to use Legion's AgentDesigner 
 * for creating ANY type of agent from natural language requirements.
 * 
 * Unlike hardcoded agents, this uses the framework's capabilities:
 * - AgentDesigner for generating agent configurations
 * - Tool discovery and semantic search
 * - Planning and execution capabilities
 * - ConfigurableAgent for runtime execution
 */

import { ResourceManager } from '../../../resource-manager/src/index.js';
import { AgentDesigner } from '../../agent-designer/src/index.js';
import { ConfigurableAgent } from '../../configurable-agent/src/index.js';
import { AgentRegistry } from '../src/index.js';

async function demonstrateGenericAgentCreation() {
  console.log('🚀 Legion Generic Agent Creation Demo');
  console.log('=====================================\n');

  try {
    // Initialize ResourceManager
    console.log('📋 Step 1: Initialize ResourceManager...');
    const resourceManager = await ResourceManager.getInstance();
    console.log('✅ ResourceManager initialized\n');

    // Initialize AgentDesigner
    console.log('📋 Step 2: Initialize AgentDesigner...');
    const agentDesigner = new AgentDesigner(resourceManager);
    await agentDesigner.initialize();
    console.log('✅ AgentDesigner ready\n');

    // Initialize AgentRegistry
    console.log('📋 Step 3: Initialize AgentRegistry...');
    const agentRegistry = new AgentRegistry(resourceManager);
    await agentRegistry.initialize();
    console.log('✅ AgentRegistry ready\n');

    // Demo 1: Create a Creative Agent for Writing Sci-Fi Stories
    console.log('🎨 Demo 1: Creating a Creative Writing Agent');
    console.log('--------------------------------------------');
    const sciFiWriterRequirements = {
      purpose: 'Create engaging science fiction stories and generate creative sci-fi content',
      taskType: 'creative',
      capabilities: [
        'generate sci-fi stories',
        'create futuristic scenarios',
        'develop alien characters',
        'write space adventures'
      ],
      constraints: {
        temperature: 0.8,
        maxTokens: 1000
      },
      llmProvider: 'anthropic',
      llmModel: 'claude-3-5-sonnet-20241022'
    };

    const sciFiWriterResult = await agentDesigner.designAgent(sciFiWriterRequirements);
    if (sciFiWriterResult.success) {
      console.log('✅ Sci-Fi Writer Agent designed successfully!');
      console.log(`   Name: ${sciFiWriterResult.agentConfig.agent.name}`);
      console.log(`   Type: ${sciFiWriterResult.agentConfig.agent.type}`);
      console.log(`   Tools: ${sciFiWriterResult.agentConfig.capabilities?.tools?.join(', ') || 'None'}`);
      
      // Create the agent instance
      const sciFiWriterAgent = new ConfigurableAgent(sciFiWriterResult.agentConfig, resourceManager);
      await sciFiWriterAgent.initialize();
      
      // Test the agent
      const sciFiResponse = await sciFiWriterAgent.receive({
        type: 'chat',
        content: 'Write a short story about a cat exploring a space station in the year 3024',
        sessionId: 'demo-scifi-1'
      });
      
      console.log('📖 Agent Response:');
      const responseText = typeof sciFiResponse.content === 'string' 
        ? sciFiResponse.content 
        : (typeof sciFiResponse.content === 'object' && sciFiResponse.content.content)
        ? sciFiResponse.content.content
        : JSON.stringify(sciFiResponse.content || 'No content');
      console.log(`   ${responseText.substring(0, 200)}...\n`);
    } else {
      console.error('❌ Failed to design Sci-Fi Writer Agent:', sciFiWriterResult.error);
    }

    // Demo 2: Create an Analytical Agent for Data Analysis
    console.log('📊 Demo 2: Creating a Data Analysis Agent');
    console.log('------------------------------------------');
    const dataAnalystRequirements = {
      purpose: 'Analyze data patterns, generate insights, and create comprehensive reports',
      taskType: 'analytical',
      capabilities: [
        'data analysis',
        'statistical analysis',
        'pattern recognition',
        'report generation'
      ],
      constraints: {
        temperature: 0.3,
        maxTokens: 800
      }
    };

    const dataAnalystResult = await agentDesigner.designAgent(dataAnalystRequirements);
    if (dataAnalystResult.success) {
      console.log('✅ Data Analyst Agent designed successfully!');
      console.log(`   Name: ${dataAnalystResult.agentConfig.agent.name}`);
      console.log(`   Type: ${dataAnalystResult.agentConfig.agent.type}`);
      
      const dataAnalystAgent = new ConfigurableAgent(dataAnalystResult.agentConfig, resourceManager);
      await dataAnalystAgent.initialize();
      
      const analysisResponse = await dataAnalystAgent.receive({
        type: 'chat',
        content: 'Analyze the trend in user engagement: Week 1: 100 users, Week 2: 150 users, Week 3: 120 users, Week 4: 180 users',
        sessionId: 'demo-analysis-1'
      });
      
      console.log('📈 Agent Response:');
      const analysisText = typeof analysisResponse.content === 'string' 
        ? analysisResponse.content 
        : (typeof analysisResponse.content === 'object' && analysisResponse.content.content)
        ? analysisResponse.content.content
        : JSON.stringify(analysisResponse.content || 'No content');
      console.log(`   ${analysisText.substring(0, 200)}...\n`);
    } else {
      console.error('❌ Failed to design Data Analyst Agent:', dataAnalystResult.error);
    }

    // Demo 3: Create a Task Agent for File Organization
    console.log('📁 Demo 3: Creating a File Organization Agent');
    console.log('---------------------------------------------');
    const fileOrganizerRequirements = {
      purpose: 'Organize files and directories, manage file structures, and maintain clean workspaces',
      taskType: 'task',
      capabilities: [
        'file organization',
        'directory management',
        'file analysis',
        'cleanup tasks'
      ],
      constraints: {
        temperature: 0.4,
        maxTokens: 600
      }
    };

    const fileOrganizerResult = await agentDesigner.designAgent(fileOrganizerRequirements);
    if (fileOrganizerResult.success) {
      console.log('✅ File Organizer Agent designed successfully!');
      console.log(`   Name: ${fileOrganizerResult.agentConfig.agent.name}`);
      console.log(`   Type: ${fileOrganizerResult.agentConfig.agent.type}`);
      console.log(`   Tools: ${fileOrganizerResult.agentConfig.capabilities?.tools?.join(', ') || 'None'}`);
      
      const fileOrganizerAgent = new ConfigurableAgent(fileOrganizerResult.agentConfig, resourceManager);
      await fileOrganizerAgent.initialize();
      
      const organizationResponse = await fileOrganizerAgent.receive({
        type: 'chat',
        content: 'How would you organize a project directory with code files, documentation, tests, and assets?',
        sessionId: 'demo-organize-1'
      });
      
      console.log('🗂️ Agent Response:');
      const organizationText = typeof organizationResponse.content === 'string' 
        ? organizationResponse.content 
        : (typeof organizationResponse.content === 'object' && organizationResponse.content.content)
        ? organizationResponse.content.content
        : JSON.stringify(organizationResponse.content || 'No content');
      console.log(`   ${organizationText.substring(0, 200)}...\n`);
    } else {
      console.error('❌ Failed to design File Organizer Agent:', fileOrganizerResult.error);
    }

    // Demo 4: Create a Conversational Agent for Customer Support
    console.log('💬 Demo 4: Creating a Customer Support Agent');
    console.log('---------------------------------------------');
    const supportAgentRequirements = {
      purpose: 'Provide friendly customer support and resolve user issues with empathy and professionalism',
      taskType: 'conversational',
      capabilities: [
        'customer support',
        'issue resolution',
        'product guidance',
        'empathetic communication'
      ],
      constraints: {
        temperature: 0.6,
        maxTokens: 700
      }
    };

    const supportAgentResult = await agentDesigner.designAgent(supportAgentRequirements);
    if (supportAgentResult.success) {
      console.log('✅ Customer Support Agent designed successfully!');
      console.log(`   Name: ${supportAgentResult.agentConfig.agent.name}`);
      console.log(`   Type: ${supportAgentResult.agentConfig.agent.type}`);
      
      const supportAgent = new ConfigurableAgent(supportAgentResult.agentConfig, resourceManager);
      await supportAgent.initialize();
      
      const supportResponse = await supportAgent.receive({
        type: 'chat',
        content: 'I\'m having trouble with my account login. It keeps saying my password is incorrect but I\'m sure it\'s right.',
        sessionId: 'demo-support-1'
      });
      
      console.log('🎧 Agent Response:');
      const supportText = typeof supportResponse.content === 'string' 
        ? supportResponse.content 
        : (typeof supportResponse.content === 'object' && supportResponse.content.content)
        ? supportResponse.content.content
        : JSON.stringify(supportResponse.content || 'No content');
      console.log(`   ${supportText.substring(0, 200)}...\n`);
    } else {
      console.error('❌ Failed to design Customer Support Agent:', supportAgentResult.error);
    }

    // Demo 5: Register agents and list them
    console.log('📝 Demo 5: Registering Agents');
    console.log('------------------------------');
    if (sciFiWriterResult.success) {
      const registration = await agentRegistry.registerAgent(sciFiWriterResult.agentConfig);
      console.log(`✅ Sci-Fi Writer Agent registered with ID: ${registration.id}`);
    }
    if (dataAnalystResult.success) {
      const registration = await agentRegistry.registerAgent(dataAnalystResult.agentConfig);
      console.log(`✅ Data Analyst Agent registered with ID: ${registration.id}`);
    }

    // List all registered agents
    const allAgents = await agentRegistry.listAgents();
    console.log(`\n📋 Total registered agents: ${allAgents.length}`);
    allAgents.forEach(agent => {
      console.log(`   • ${agent.name} (${agent.type}) - ${agent.description?.substring(0, 50)}...`);
    });

    console.log('\n🎉 Generic Agent Creation Demo Complete!');
    console.log('=========================================');
    console.log('✅ Successfully demonstrated:');
    console.log('   • Creating agents from natural language requirements');
    console.log('   • Using AgentDesigner for ANY type of agent');
    console.log('   • Framework tool discovery and configuration');
    console.log('   • Agent registration and management');
    console.log('   • Runtime agent execution and testing');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateGenericAgentCreation().catch(console.error);
}

export { demonstrateGenericAgentCreation };