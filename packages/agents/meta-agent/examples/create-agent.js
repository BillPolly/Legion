#!/usr/bin/env node

/**
 * Example: Creating an agent using MetaAgent
 * 
 * This example demonstrates how to use the MetaAgent to create,
 * test, and register a new configurable agent.
 */

import { MetaAgent } from '../src/MetaAgent.js';
import { ResourceManager } from '@legion/resource-manager';

async function createCustomAgent() {
  console.log('🤖 MetaAgent Example: Creating a Custom Agent\n');
  console.log('=' + '='.repeat(50) + '\n');

  try {
    // Initialize ResourceManager
    console.log('📦 Initializing ResourceManager...');
    const resourceManager = await ResourceManager.getInstance();
    console.log('✅ ResourceManager ready\n');

    // Create MetaAgent
    console.log('🔧 Creating MetaAgent...');
    const metaAgent = new MetaAgent({
      agent: {
        id: 'meta-agent-example',
        name: 'Example Meta Agent',
        description: 'Meta agent for creating custom agents'
      }
    }, resourceManager);

    console.log('✅ MetaAgent created\n');

    // Define requirements for the new agent
    const requirements = {
      purpose: 'Create a customer support agent that can help users with technical questions',
      type: 'conversational',
      
      // Behavioral requirements
      behavior: {
        responseStyle: 'friendly and helpful',
        patience: 'high',
        technicalLevel: 'adaptable to user knowledge'
      },
      
      // Capability requirements
      capabilities: {
        mustHave: [
          'answer technical questions',
          'provide step-by-step instructions',
          'escalate complex issues'
        ],
        niceToHave: [
          'search knowledge base',
          'track conversation context'
        ]
      },
      
      // Performance requirements
      performance: {
        maxResponseTime: 1000,  // milliseconds
        minAccuracy: 0.85,
        maxTokens: 500
      },
      
      // Test requirements
      minPassRate: 0.8,
      
      // Custom test cases
      testCases: [
        {
          name: 'Greeting Test',
          input: 'Hello, I need help',
          expectedPatterns: ['hello', 'help', 'assist', 'support']
        },
        {
          name: 'Technical Question',
          input: 'How do I reset my password?',
          expectedPatterns: ['password', 'reset', 'steps', 'click']
        },
        {
          name: 'Escalation Test',
          input: 'I need to speak with a human',
          expectedPatterns: ['transfer', 'agent', 'representative', 'escalate']
        }
      ]
    };

    console.log('📋 Agent Requirements:');
    console.log(`  Purpose: ${requirements.purpose}`);
    console.log(`  Type: ${requirements.type}`);
    console.log(`  Min Pass Rate: ${requirements.minPassRate * 100}%`);
    console.log(`  Performance: Response time < ${requirements.performance.maxResponseTime}ms`);
    console.log('\n');

    // Note: In a real scenario, you would need to:
    // 1. Initialize the MetaAgent (which requires actual component implementations)
    // 2. Call metaAgent.createAgent(requirements)
    
    console.log('📝 Note: This example shows the structure for creating agents.');
    console.log('   In production, you would need to implement the supporting');
    console.log('   components (AgentDesigner, PromptTester, etc.) and then call:');
    console.log('\n   await metaAgent.initialize();');
    console.log('   const result = await metaAgent.createAgent(requirements);');
    console.log('\n');

    // Example of what the result would look like
    const exampleResult = {
      success: true,
      agentId: 'support-agent-xyz',
      agentName: 'Customer Support Agent',
      testsPassed: true,
      registrationId: 'reg-123456',
      
      // The created agent configuration
      agentConfig: {
        agent: {
          id: 'support-agent-xyz',
          name: 'Customer Support Agent',
          type: 'conversational',
          description: 'AI agent for technical customer support',
          version: '1.0.0'
        },
        
        prompts: {
          system: `You are a friendly and knowledgeable customer support agent.
Your role is to help users with technical questions and issues.
Be patient, clear, and provide step-by-step instructions when needed.
If a problem is beyond your capability, politely offer to escalate to a human agent.`,
          
          examples: [
            {
              input: 'How do I reset my password?',
              output: `I'd be happy to help you reset your password! Here are the steps:

1. Go to the login page
2. Click on "Forgot Password?" below the login button
3. Enter your email address
4. Check your email for a reset link
5. Click the link and follow the instructions to create a new password

Let me know if you encounter any issues with these steps!`
            }
          ]
        },
        
        behavior: {
          temperature: 0.7,
          creativity: 0.3,
          responseStyle: 'friendly',
          verbosity: 'balanced'
        },
        
        capabilities: {
          tools: [
            'knowledge_search',
            'ticket_creation',
            'escalation'
          ]
        }
      }
    };

    console.log('🎯 Example Result Structure:');
    console.log(JSON.stringify(exampleResult, null, 2));
    console.log('\n');

    console.log('✨ MetaAgent Capabilities:');
    console.log('  • Automated agent design based on requirements');
    console.log('  • Prompt optimization and testing');
    console.log('  • Comprehensive testing and validation');
    console.log('  • Performance benchmarking');
    console.log('  • Agent registration and versioning');
    console.log('  • Continuous refinement based on test results');
    console.log('\n');

    console.log('🚀 Next Steps:');
    console.log('  1. Implement the supporting component packages');
    console.log('  2. Set up MongoDB for agent persistence');
    console.log('  3. Configure LLM client for agent testing');
    console.log('  4. Deploy and monitor created agents');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the example
createCustomAgent().catch(console.error);