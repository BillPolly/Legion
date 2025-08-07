/**
 * Configuration system demonstration
 */

import RecursivePlanner from '../src/index.js';

// Create instance of RecursivePlanner
const planner = new RecursivePlanner();

const {
  config: { ConfigManager, config },
  factories: { createPlanningAgent, createLLMProvider, createTool }
} = planner;

/**
 * Demonstrate configuration system usage
 */
async function configDemo() {
  console.log('🔧 Configuration System Demo\n');
  
  // Show configuration loading
  console.log('📋 Configuration Overview:');
  console.log('Environment:', config.get('environment'));
  console.log('LLM Provider:', config.get('llm.provider'));
  console.log('Available LLM Providers:', config.getAvailableLLMProviders());
  console.log('Database - Qdrant Host:', config.get('database.qdrant.host'));
  console.log('Database - MongoDB URL:', config.get('database.mongodb.url'));
  
  // Show feature availability
  console.log('\n🔍 Feature Availability:');
  console.log('Anthropic LLM:', config.isFeatureAvailable('llm.anthropic'));
  console.log('OpenAI LLM:', config.isFeatureAvailable('llm.openai'));
  console.log('Serper API:', config.isFeatureAvailable('apis.serper'));
  console.log('GitHub API:', config.isFeatureAvailable('apis.github'));
  
  // Show automatic LLM provider creation
  console.log('\n🤖 LLM Provider Demo:');
  const llmProvider = createLLMProvider();
  if (llmProvider) {
    console.log(`Created ${llmProvider.provider} provider with model: ${llmProvider.model}`);
    
    // Test the provider
    const response = await llmProvider.complete('Hello, how are you?');
    console.log('LLM Response:', response);
  } else {
    console.log('No LLM provider available');
  }
  
  // Show automatic agent configuration
  console.log('\n🎯 Agent Auto-Configuration:');
  const agent = createPlanningAgent({
    name: 'ConfigDemo',
    debugMode: true
  });
  
  console.log(`Agent created: ${agent.config.name}`);
  console.log(`Debug mode: ${agent.config.debugMode}`);
  console.log(`Max retries: ${agent.config.maxRetries}`);
  console.log(`Reflection enabled: ${agent.config.reflectionEnabled}`);
  console.log(`LLM configured: ${agent.llm ? 'Yes' : 'No'}`);
  
  // Show tool configuration
  console.log('\n🔧 Tool Auto-Configuration:');
  const tool = createTool(
    'demoTool',
    'A demonstration tool',
    async (input) => ({ demo: true, input })
  );
  
  console.log(`Tool timeout: ${tool.config.timeout}ms`);
  console.log(`Tool retries: ${tool.config.retries}`);
  console.log(`Tool caching: ${tool.config.cacheResults}`);
  console.log(`Tool metrics: ${tool.config.enableMetrics}`);
  
  // Show environment-specific configuration
  console.log('\n🌍 Environment Configuration:');
  const fullConfig = config.getConfig();
  console.log('Framework agent defaults:', fullConfig.framework.agent);
  console.log('Framework tool defaults:', fullConfig.framework.tool);
  console.log('Framework resource limits:', fullConfig.framework.resources);
}

/**
 * Demonstrate configuration access patterns
 */
function configurationPatterns() {
  console.log('\n📚 Configuration Access Patterns:\n');
  
  // Direct access
  console.log('1. Direct access:');
  console.log('   config.get("llm.provider") =>', config.get('llm.provider'));
  console.log('   config.get("database.qdrant.port") =>', config.get('database.qdrant.port'));
  
  // With defaults
  console.log('\n2. With defaults:');
  console.log('   config.get("nonexistent.key", "default") =>', config.get('nonexistent.key', 'default'));
  
  // Feature availability
  console.log('\n3. Feature checks:');
  console.log('   config.isFeatureAvailable("llm.anthropic") =>', config.isFeatureAvailable('llm.anthropic'));
  
  // Get full sections
  console.log('\n4. Full sections:');
  console.log('   config.get("llm") =>');
  console.log('  ', JSON.stringify(config.get('llm'), null, 2));
}

// Run the demo
async function runDemo() {
  try {
    await configDemo();
    configurationPatterns();
    
    console.log('\n✅ Configuration system working perfectly!');
    console.log('\n💡 The framework now automatically:');
    console.log('   • Loads configuration from .env file');
    console.log('   • Configures LLM providers based on available API keys');
    console.log('   • Sets sensible defaults for all components');
    console.log('   • Validates configuration on startup');
    console.log('   • Provides easy access to configuration values');
    
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error(error.stack);
  }
}

// Export for use in other files
export { configDemo, configurationPatterns };

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo();
}