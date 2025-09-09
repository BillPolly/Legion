/**
 * ResourceManager access utilities for Gemini Compatible Agent
 * 
 * Provides access to Legion's ResourceManager singleton
 */

import { ResourceManager } from '@legion/resource-manager';

/**
 * Get ResourceManager instance
 * @returns {Promise<ResourceManager>} ResourceManager singleton instance
 */
export async function getResourceManager() {
  return await ResourceManager.getInstance();
}

/**
 * Get environment variable through ResourceManager
 * @param {string} key - Environment variable key
 * @param {*} defaultValue - Default value if not found
 * @returns {Promise<*>} Environment variable value
 */
export async function getEnvVar(key, defaultValue = null) {
  const resourceManager = await getResourceManager();
  return resourceManager.get(`env.${key}`, defaultValue);
}

/**
 * Get LLM client through ResourceManager
 * @returns {Promise<Object>} LLM client instance
 */
export async function getLLMClient() {
  const resourceManager = await getResourceManager();
  return await resourceManager.get('llmClient');
}