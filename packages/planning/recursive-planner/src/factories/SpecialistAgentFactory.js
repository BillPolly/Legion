/**
 * Factory for creating data-driven specialist agents
 * Creates PlanningAgents with specific domain expertise that can be registered as tools
 */

import { PlanningAgent } from '../core/agents/base/PlanningAgent.js';
import { LLMPlanningStrategy } from '../core/execution/planning/strategies/index.js';
import { ValidationUtils } from '../foundation/utils/validation/ValidationUtils.js';

/**
 * Create a specialist agent definition compatible with ToolRegistry ModuleProvider
 * @param {Object} config - Agent configuration
 * @returns {Object} ModuleProvider-compatible definition
 */
export function createSpecialistAgentDefinition(config) {
  // Validate required configuration
  ValidationUtils.nonEmptyString(config.name, 'config.name');
  ValidationUtils.nonEmptyString(config.description, 'config.description');
  
  return {
    /**
     * Create the specialist agent instance
     * @param {Object} instanceConfig - Runtime configuration
     * @returns {Promise<PlanningAgent>} Configured specialist agent
     */
    async create(instanceConfig = {}) {
      const mergedConfig = {
        ...config,
        ...instanceConfig
      };

      // Create agent configuration
      const agentConfig = {
        name: mergedConfig.name,
        description: mergedConfig.description,
        debugMode: mergedConfig.debugMode || false,
        maxRetries: mergedConfig.maxRetries || 3,
        orchestration: {
          enabled: mergedConfig.orchestration?.enabled ?? true,
          maxReplanAttempts: mergedConfig.orchestration?.maxReplanAttempts || 3,
          executionStrategy: mergedConfig.orchestration?.executionStrategy || 'sequential',
          continueOnFailure: mergedConfig.orchestration?.continueOnFailure || false,
          stepTimeout: mergedConfig.orchestration?.stepTimeout || 30000
        }
      };

      // Create planning strategy
      let planningStrategy = null;
      if (mergedConfig.llmProvider) {
        planningStrategy = new LLMPlanningStrategy(mergedConfig.llmProvider, {
          examples: mergedConfig.examples || [],
          temperature: mergedConfig.temperature || 0.3,
          maxRetries: mergedConfig.maxRetries || 2,
          promptTemplate: mergedConfig.promptTemplate
        });
      } else {
        throw new Error(`LLM provider required for specialist agent: ${mergedConfig.name}`);
      }

      // Create the specialist agent
      const agent = new PlanningAgent(agentConfig, planningStrategy);

      // Set dependencies if provided
      if (mergedConfig.dependencies) {
        agent.setDependencies(mergedConfig.dependencies);
      }

      // Enhance agent with specialist-specific metadata
      const originalGetMetadata = agent.getMetadata.bind(agent);
      agent.getMetadata = () => ({
        ...originalGetMetadata(),
        domains: mergedConfig.domains || [],
        capabilities: mergedConfig.capabilities || [],
        toolDependencies: mergedConfig.toolDependencies || [],
        specialist: true,
        template: mergedConfig.promptTemplate || null
      });

      return agent;
    },

    /**
     * Get metadata for tool registry
     * @returns {Object} Tool metadata
     */
    getMetadata() {
      return {
        name: config.name,
        description: config.description,
        type: 'specialist-agent',
        domains: config.domains || [],
        capabilities: config.capabilities || [],
        toolDependencies: config.toolDependencies || [],
        parameters: config.parameters || {},
        examples: config.examples || [],
        specialist: true
      };
    }
  };
}

/**
 * Create a specialist agent from JSON configuration
 * @param {Object} jsonConfig - JSON configuration object
 * @param {Object} runtimeConfig - Runtime dependencies (llmProvider, etc.)
 * @returns {Object} ModuleProvider-compatible definition
 */
export function createSpecialistAgentFromJSON(jsonConfig, runtimeConfig = {}) {
  const config = {
    ...jsonConfig,
    ...runtimeConfig
  };

  return createSpecialistAgentDefinition(config);
}

/**
 * Create multiple specialist agents from a configuration directory
 * @param {Array<Object>} configs - Array of agent configurations
 * @param {Object} sharedConfig - Shared configuration (llmProvider, etc.)
 * @returns {Map<string, Object>} Map of agent name to definition
 */
export function createSpecialistAgentRegistry(configs, sharedConfig = {}) {
  const agentDefinitions = new Map();

  for (const config of configs) {
    const fullConfig = {
      ...config,
      ...sharedConfig
    };

    const definition = createSpecialistAgentDefinition(fullConfig);
    agentDefinitions.set(config.name, definition);
  }

  return agentDefinitions;
}

/**
 * Utility to load agent configurations from JSON files
 * @param {string} configPath - Path to JSON configuration file
 * @returns {Object} Parsed configuration
 */
export async function loadAgentConfig(configPath) {
  try {
    const fs = await import('fs/promises');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch (error) {
    throw new Error(`Failed to load agent config from ${configPath}: ${error.message}`);
  }
}

/**
 * Register specialist agents with a ToolRegistry
 * @param {ToolRegistry} toolRegistry - Target tool registry
 * @param {Array<Object>} agentConfigs - Agent configurations
 * @param {Object} sharedConfig - Shared configuration
 * @returns {Promise<void>}
 */
export async function registerSpecialistAgents(toolRegistry, agentConfigs, sharedConfig = {}) {
  const { ModuleProvider } = await import('../../tools/src/integration/ToolRegistry.js');

  for (const config of agentConfigs) {
    const fullConfig = {
      ...config,
      ...sharedConfig
    };

    // Create module definition that exposes the agent as a tool
    const moduleDefinition = {
      async create(instanceConfig = {}) {
        const agentDefinition = createSpecialistAgentDefinition({
          ...fullConfig,
          ...instanceConfig
        });
        
        const agent = await agentDefinition.create();
        
        // Return module instance with the agent as a tool
        return {
          [config.name]: agent,
          // Support both direct access and tool interface
          getTool: (name) => name === config.name ? agent : null,
          listTools: () => [config.name],
          getMetadata: () => agentDefinition.getMetadata()
        };
      },
      
      getMetadata() {
        return {
          name: config.name,
          description: config.description,
          version: '1.0.0',
          domains: config.domains || [],
          capabilities: config.capabilities || [],
          tools: {
            [config.name]: {
              name: config.name,
              description: config.description,
              parameters: config.parameters || {},
              domains: config.domains || [],
              capabilities: config.capabilities || [],
              specialist: true
            }
          }
        };
      }
    };

    const provider = new ModuleProvider({
      name: config.name,
      definition: moduleDefinition,
      config: config.instanceConfig || {},
      lazy: config.lazy || false
    });

    await toolRegistry.registerProvider(provider);

    if (sharedConfig.debugMode) {
      console.log(`[SpecialistAgentFactory] Registered specialist agent: ${config.name}`);
    }
  }
}

/**
 * Helper to create a simple specialist agent for common patterns
 * @param {string} name - Agent name
 * @param {string} description - Agent description  
 * @param {Array<string>} domains - Domain expertise
 * @param {Array<string>} capabilities - Agent capabilities
 * @param {string} promptTemplate - Prompt template (optional)
 * @param {Object} options - Additional options
 * @returns {Object} ModuleProvider-compatible definition
 */
export function createSimpleSpecialistAgent(name, description, domains, capabilities, promptTemplate = null, options = {}) {
  return createSpecialistAgentDefinition({
    name,
    description,
    domains,
    capabilities,
    promptTemplate,
    examples: options.examples || [],
    toolDependencies: options.toolDependencies || [],
    orchestration: options.orchestration || { enabled: true },
    temperature: options.temperature || 0.3,
    maxRetries: options.maxRetries || 3,
    debugMode: options.debugMode || false
  });
}