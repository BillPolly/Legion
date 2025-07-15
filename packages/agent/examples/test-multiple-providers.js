#!/usr/bin/env node

/**
 * Test script to verify the agent CLI works with multiple LLM providers
 * This demonstrates provider configuration and compatibility
 */

import { Agent } from '../src/Agent.js';
import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';

const providers = [
  {
    name: 'OpenAI',
    provider: 'openai',
    model: 'gpt-4',
    envVar: 'OPENAI_API_KEY'
  },
  {
    name: 'Anthropic',
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    envVar: 'ANTHROPIC_API_KEY'
  },
  {
    name: 'DeepSeek',
    provider: 'deepseek',
    model: 'deepseek-chat',
    envVar: 'DEEPSEEK_API_KEY'
  },
  {
    name: 'OpenRouter',
    provider: 'openrouter',
    model: 'anthropic/claude-3-sonnet',
    envVar: 'OPENROUTER_API_KEY'
  }
];

/**
 * Test agent initialization with different providers
 */
async function testProviders() {
  console.log('🧪 Testing jsEnvoy Agent with Multiple LLM Providers');
  console.log('='.repeat(60));

  const resourceManager = new ResourceManager();
  await resourceManager.initialize();

  const moduleFactory = new ModuleFactory(resourceManager);

  // Register basic resources
  resourceManager.register('basePath', process.cwd());
  resourceManager.register('encoding', 'utf8');
  resourceManager.register('createDirectories', true);
  resourceManager.register('permissions', 0o755);

  let successCount = 0;
  let totalCount = 0;

  for (const providerConfig of providers) {
    totalCount++;
    console.log(`\n🔄 Testing ${providerConfig.name} Provider`);
    console.log(`Provider: ${providerConfig.provider}`);
    console.log(`Model: ${providerConfig.model}`);
    console.log(`Environment Variable: ${providerConfig.envVar}`);

    const apiKey = process.env[providerConfig.envVar];
    
    if (!apiKey) {
      console.log(`❌ ${providerConfig.name}: API key not found in environment`);
      console.log(`   Set ${providerConfig.envVar} to test this provider`);
      continue;
    }

    try {
      // Create agent configuration
      const config = {
        name: 'Test Agent',
        bio: 'A test agent for provider validation',
        tools: [], // No tools needed for basic test
        modelConfig: {
          provider: providerConfig.provider,
          model: providerConfig.model,
          apiKey: apiKey
        },
        showToolUsage: false,
        steps: [
          'Respond with a simple greeting',
          'Keep the response short and friendly'
        ],
        _debugMode: false
      };

      // Create agent
      const agent = new Agent(config);
      
      // Test basic functionality
      const testMessage = "Hello! Please respond with a simple greeting.";
      console.log(`📤 Test message: "${testMessage}"`);
      
      const startTime = Date.now();
      const response = await agent.run(testMessage);
      const duration = Date.now() - startTime;
      
      if (response && response.message) {
        console.log(`✅ ${providerConfig.name}: Success (${duration}ms)`);
        console.log(`📝 Response: "${response.message.substring(0, 100)}${response.message.length > 100 ? '...' : ''}"`);
        successCount++;
      } else {
        console.log(`❌ ${providerConfig.name}: Invalid response format`);
        console.log(`📝 Response: ${JSON.stringify(response)}`);
      }
      
    } catch (error) {
      console.log(`❌ ${providerConfig.name}: Error - ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Provider Test Summary: ${successCount}/${totalCount} providers working`);
  
  if (successCount === 0) {
    console.log('⚠️  No providers could be tested. Please set at least one API key:');
    providers.forEach(p => {
      console.log(`   export ${p.envVar}=your-api-key-here`);
    });
  } else {
    console.log('✅ Agent CLI supports multiple LLM providers!');
  }
}

/**
 * Mock provider test (always available)
 */
async function testMockProvider() {
  console.log('\n🧪 Testing Mock Provider (always available)');
  console.log('-'.repeat(40));

  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    const config = {
      name: 'Mock Test Agent',
      bio: 'A test agent using mock provider',
      tools: [],
      modelConfig: {
        provider: 'mock',
        model: 'mock-model',
        apiKey: 'not-needed'
      },
      showToolUsage: false,
      _debugMode: false
    };

    const agent = new Agent(config);
    const response = await agent.run("Test message");
    
    if (response && response.message) {
      console.log('✅ Mock Provider: Working correctly');
      console.log(`📝 Response: "${response.message.substring(0, 100)}..."`);
    } else {
      console.log('❌ Mock Provider: Unexpected response format');
    }
    
  } catch (error) {
    console.log(`❌ Mock Provider: Error - ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await testProviders();
    await testMockProvider();
    
    console.log('\n🎉 Multi-provider testing completed!');
    console.log('💡 The agent CLI can be configured with any supported provider using:');
    console.log('   export MODEL_PROVIDER=anthropic  # or openai, deepseek, openrouter');
    console.log('   export MODEL_NAME=claude-3-sonnet-20240229  # or any supported model');
    console.log('   node src/cli.js');
    
  } catch (error) {
    console.error('❌ Testing failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testProviders, testMockProvider };