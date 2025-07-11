/**
 * Environment setup utilities for tests
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads environment variables from the root .env file
 */
export function loadTestEnvironment() {
  const rootEnvPath = path.resolve(__dirname, '../../../../.env');
  const result = config({ path: rootEnvPath });
  
  if (result.error) {
    console.warn('Warning: Could not load .env file from root directory');
    console.warn('Some integration tests may fail without proper environment variables');
  }
  
  return result;
}

/**
 * Validates that required environment variables are present
 */
export function validateEnvironmentVariables(required = []) {
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
}

/**
 * Gets environment variable with fallback
 */
export function getEnvVar(key, fallback = null) {
  return process.env[key] || fallback;
}

/**
 * Checks if integration tests can be run
 */
export function canRunIntegrationTests() {
  const requiredVars = ['SERPER', 'GITHUB_PAT'];
  try {
    validateEnvironmentVariables(requiredVars);
    return true;
  } catch (error) {
    console.warn(`Integration tests disabled: ${error.message}`);
    return false;
  }
}

/**
 * Creates test configuration for different environments
 */
export function createTestConfig() {
  return {
    serper: {
      apiKey: getEnvVar('SERPER'),
      enabled: !!getEnvVar('SERPER')
    },
    github: {
      pat: getEnvVar('GITHUB_PAT'),
      enabled: !!getEnvVar('GITHUB_PAT')
    },
    anthropic: {
      apiKey: getEnvVar('ANTHROPIC_API_KEY'),
      enabled: !!getEnvVar('ANTHROPIC_API_KEY')
    },
    openai: {
      apiKey: getEnvVar('OPENAI_API_KEY'),
      enabled: !!getEnvVar('OPENAI_API_KEY')
    }
  };
}

// Load environment on import
loadTestEnvironment();