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
 * Get SimplePromptClient through ResourceManager
 * @returns {Promise<Object>} SimplePromptClient instance
 */
export async function getSimplePromptClient() {
  const resourceManager = await getResourceManager();
  return await resourceManager.get('simplePromptClient');
}

/**
 * @deprecated Use getSimplePromptClient() instead
 */
export async function getLLMClient() {
  console.warn('getLLMClient() is deprecated, use getSimplePromptClient() instead');
  return await getSimplePromptClient();
}