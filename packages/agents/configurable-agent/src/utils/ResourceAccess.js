/**
 * Resource access utilities
 * Provides centralized access to ResourceManager and its resources
 */

import { ResourceManager } from '@legion/resource-manager';
import { AgentError } from './ErrorHandling.js';

// Cache the singleton instance
let resourceManagerInstance = null;

/**
 * Get the ResourceManager singleton instance
 * @returns {Promise<ResourceManager>} ResourceManager instance
 */
export async function getResourceManager() {
  if (!resourceManagerInstance) {
    resourceManagerInstance = await ResourceManager.getInstance();
  }
  return resourceManagerInstance;
}

/**
 * Get the LLM client from ResourceManager
 * @returns {Promise<Object>} LLM client
 * @throws {AgentError} If LLM client is not available
 */
export async function getLLMClient() {
  const rm = await getResourceManager();
  const llmClient = await rm.get('llmClient');
  
  if (!llmClient) {
    throw new AgentError(
      'LLM client not available. Ensure ANTHROPIC_API_KEY or OPENAI_API_KEY is set.',
      'RESOURCE_NOT_AVAILABLE',
      { resource: 'llmClient' }
    );
  }
  
  return llmClient;
}

/**
 * Get the ToolRegistry from ResourceManager
 * @returns {Promise<Object>} ToolRegistry instance
 * @throws {AgentError} If ToolRegistry is not available
 */
export async function getToolRegistry() {
  const rm = await getResourceManager();
  const toolRegistry = await rm.get('toolRegistry');
  
  if (!toolRegistry) {
    throw new AgentError(
      'ToolRegistry not available. Ensure it is properly initialized in ResourceManager.',
      'RESOURCE_NOT_AVAILABLE',
      { resource: 'toolRegistry' }
    );
  }
  
  return toolRegistry;
}

/**
 * Get an environment variable from ResourceManager
 * @param {string} key - Environment variable key (without 'env.' prefix)
 * @returns {Promise<string|undefined>} Environment variable value
 */
export async function getEnvVar(key) {
  const rm = await getResourceManager();
  return rm.get(`env.${key}`);
}

/**
 * Get a configuration value from ResourceManager
 * @param {string} key - Configuration key
 * @param {*} defaultValue - Default value if not found
 * @returns {Promise<*>} Configuration value
 */
export async function getConfig(key, defaultValue = undefined) {
  const rm = await getResourceManager();
  const value = rm.get(key);
  return value !== undefined ? value : defaultValue;
}

/**
 * Check if a resource is available
 * @param {string} resourceKey - Resource key to check
 * @returns {Promise<boolean>} True if resource is available
 */
export async function hasResource(resourceKey) {
  try {
    const rm = await getResourceManager();
    const resource = await rm.get(resourceKey);
    return resource !== null && resource !== undefined;
  } catch (error) {
    return false;
  }
}

/**
 * Get MongoDB connection string
 * @returns {Promise<string>} MongoDB URL
 */
export async function getMongoDBUrl() {
  const url = await getEnvVar('MONGODB_URL');
  return url || 'mongodb://localhost:27017/legion';
}

/**
 * Get API key for a specific provider
 * @param {string} provider - Provider name ('anthropic' or 'openai')
 * @returns {Promise<string|undefined>} API key
 */
export async function getAPIKey(provider) {
  switch (provider.toLowerCase()) {
    case 'anthropic':
      return getEnvVar('ANTHROPIC_API_KEY');
    case 'openai':
      return getEnvVar('OPENAI_API_KEY');
    default:
      return undefined;
  }
}

/**
 * Initialize required resources for an agent
 * @returns {Promise<Object>} Object with initialized resources
 */
export async function initializeAgentResources() {
  const rm = await getResourceManager();
  
  // Check for required resources
  const resources = {
    resourceManager: rm,
    llmClient: null,
    toolRegistry: null,
    mongoUrl: await getMongoDBUrl()
  };
  
  // Try to get optional resources
  try {
    resources.llmClient = await getLLMClient();
  } catch (error) {
    // LLM client is optional for some tests
    console.warn('LLM client not available:', error.message);
  }
  
  try {
    resources.toolRegistry = await getToolRegistry();
  } catch (error) {
    // ToolRegistry is optional for some tests
    console.warn('ToolRegistry not available:', error.message);
  }
  
  return resources;
}