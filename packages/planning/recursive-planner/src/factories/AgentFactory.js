/**
 * Factory functions for creating agents
 */

import { PlanningAgent, AgentConfig } from '../core/agents/index.js';
import { SequentialPlanningStrategy } from '../core/execution/planning/index.js';
import { config } from '../runtime/config/index.js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

/**
 * Quick start factory function for creating a basic planning agent
 * @param {Object} options - Configuration options
 * @returns {PlanningAgent} Configured planning agent
 */
export function createPlanningAgent(options = {}) {
  // Get framework defaults from config
  const frameworkConfig = config.get('framework.agent', {});
  
  const agentConfig = new AgentConfig({
    name: options.name || 'QuickStartAgent',
    description: options.description || 'A quick-start planning agent',
    maxRetries: options.maxRetries ?? frameworkConfig.maxRetries ?? 2,
    reflectionEnabled: options.reflectionEnabled ?? frameworkConfig.reflectionEnabled ?? true,
    debugMode: options.debugMode ?? frameworkConfig.debugMode ?? false,
    planningTimeout: options.planningTimeout ?? frameworkConfig.planningTimeout ?? 30000,
    parallelExecution: options.parallelExecution ?? frameworkConfig.parallelExecution ?? true
  });

  const planningStrategy = options.planningStrategy || new SequentialPlanningStrategy();
  
  const agent = new PlanningAgent(agentConfig, planningStrategy);
  
  // Set up dependencies, including LLM from config if available
  const dependencies = options.dependencies || {};
  
  // Auto-configure LLM if not provided but available in config
  if (!dependencies.llm && config.getAvailableLLMProviders().length > 0) {
    try {
      dependencies.llm = createLLMProvider();
    } catch (error) {
      // Silently fail in test environments or when API keys are not available
      if (process.env.NODE_ENV !== 'test' && !options.suppressLLMErrors) {
        console.warn(`Failed to create LLM provider: ${error.message}`);
      }
    }
  }
  
  if (Object.keys(dependencies).length > 0) {
    agent.setDependencies(dependencies);
  }

  return agent;
}

/**
 * Create an LLM provider based on configuration
 * @param {string} provider - Override provider (optional)
 * @returns {Object|null} LLM provider or null if not available
 */
export function createLLMProvider(provider = null) {
  const configuredProvider = provider || config.get('llm.provider');
  const availableProviders = config.getAvailableLLMProviders();
  
  if (!availableProviders.includes(configuredProvider)) {
    console.warn(`LLM provider '${configuredProvider}' not available. Available: ${availableProviders.join(', ')}`);
    return null;
  }
  
  // Simple LLM provider implementation - will be enhanced later
  switch (configuredProvider) {
    case 'anthropic':
      return createAnthropicProvider();
    case 'openai':
      return createOpenAIProvider();
    default:
      return null;
  }
}

/**
 * Create Anthropic provider (real implementation)
 * @returns {Object} Anthropic LLM provider
 */
export function createAnthropicProvider() {
  const anthropicConfig = config.get('llm.anthropic');
  const apiKey = anthropicConfig.apiKey;
  
  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }
  
  const client = new Anthropic({
    apiKey: apiKey
  });
  
  return {
    provider: 'anthropic',
    model: anthropicConfig.model,
    client: client,
    tokenUsage: { input: 0, output: 0, total: 0 },
    
    async complete(prompt, options = {}) {
      try {
        const startTime = Date.now();
        console.log(`[Anthropic ${anthropicConfig.model}] Processing prompt (${prompt.length} chars)`);
        
        const response = await client.messages.create({
          model: anthropicConfig.model,
          max_tokens: options.maxTokens || anthropicConfig.maxTokens || 1000,
          temperature: options.temperature ?? anthropicConfig.temperature ?? 0.7,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });
        
        // Track token usage
        if (response.usage) {
          this.tokenUsage.input += response.usage.input_tokens || 0;
          this.tokenUsage.output += response.usage.output_tokens || 0;
          this.tokenUsage.total = this.tokenUsage.input + this.tokenUsage.output;
        }
        
        const duration = Date.now() - startTime;
        console.log(`[Anthropic] Response received in ${duration}ms, tokens: ${response.usage?.input_tokens || 0} in, ${response.usage?.output_tokens || 0} out`);
        
        return response.content[0].text;
        
      } catch (error) {
        console.error(`[Anthropic] API Error: ${error.message}`);
        
        // Handle rate limiting
        if (error.status === 429) {
          throw new Error(`Rate limited by Anthropic API: ${error.message}`);
        }
        
        // Handle other API errors
        if (error.status) {
          throw new Error(`Anthropic API error (${error.status}): ${error.message}`);
        }
        
        throw new Error(`Anthropic request failed: ${error.message}`);
      }
    },
    
    getTokenUsage() {
      return { ...this.tokenUsage };
    },
    
    resetTokenUsage() {
      this.tokenUsage = { input: 0, output: 0, total: 0 };
    },
    
    cleanup() {
      // No explicit cleanup needed for Anthropic client
      // But we can reset state
      this.resetTokenUsage();
    }
  };
}

/**
 * Create OpenAI provider (real implementation)
 * @returns {Object} OpenAI LLM provider
 */
export function createOpenAIProvider() {
  const openaiConfig = config.get('llm.openai');
  const apiKey = openaiConfig.apiKey;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  const client = new OpenAI({
    apiKey: apiKey
  });
  
  return {
    provider: 'openai',
    model: openaiConfig.model,
    client: client,
    tokenUsage: { input: 0, output: 0, total: 0 },
    
    async complete(prompt, options = {}) {
      try {
        const startTime = Date.now();
        console.log(`[OpenAI ${openaiConfig.model}] Processing prompt (${prompt.length} chars)`);
        
        const response = await client.chat.completions.create({
          model: openaiConfig.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: options.maxTokens || openaiConfig.maxTokens || 1000,
          temperature: options.temperature ?? openaiConfig.temperature ?? 0.7
        });
        
        // Track token usage
        if (response.usage) {
          this.tokenUsage.input += response.usage.prompt_tokens || 0;
          this.tokenUsage.output += response.usage.completion_tokens || 0;
          this.tokenUsage.total = response.usage.total_tokens || 0;
        }
        
        const duration = Date.now() - startTime;
        console.log(`[OpenAI] Response received in ${duration}ms, tokens: ${response.usage?.prompt_tokens || 0} in, ${response.usage?.completion_tokens || 0} out`);
        
        return response.choices[0].message.content;
        
      } catch (error) {
        console.error(`[OpenAI] API Error: ${error.message}`);
        
        // Handle rate limiting
        if (error.status === 429) {
          throw new Error(`Rate limited by OpenAI API: ${error.message}`);
        }
        
        // Handle quota exceeded
        if (error.status === 429 && error.code === 'insufficient_quota') {
          throw new Error(`OpenAI quota exceeded: ${error.message}`);
        }
        
        // Handle other API errors
        if (error.status) {
          throw new Error(`OpenAI API error (${error.status}): ${error.message}`);
        }
        
        throw new Error(`OpenAI request failed: ${error.message}`);
      }
    },
    
    getTokenUsage() {
      return { ...this.tokenUsage };
    },
    
    resetTokenUsage() {
      this.tokenUsage = { input: 0, output: 0, total: 0 };
    },
    
    cleanup() {
      // No explicit cleanup needed for OpenAI client
      // But we can reset state
      this.resetTokenUsage();
    }
  };
}