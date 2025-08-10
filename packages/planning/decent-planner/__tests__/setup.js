/**
 * Test setup for decent-planner
 * Ensures .env is loaded and common setup is done
 */

import { jest } from '@jest/globals';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find Legion root .env (4 levels up from __tests__)
const legionRoot = path.resolve(__dirname, '../../../../');
const envPath = path.join(legionRoot, '.env');

// Load environment variables
config({ path: envPath });

// Verify critical environment variables are loaded
const requiredEnvVars = ['ANTHROPIC_API_KEY', 'MONGODB_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
  console.warn(`   Some tests may be skipped. Check ${envPath}`);
}

// Set test timeout for live tests
if (process.env.LIVE_TESTS === 'true') {
  jest.setTimeout(60000); // 60 seconds for live LLM tests
} else {
  jest.setTimeout(10000); // 10 seconds for unit tests
}

// Suppress console.log in tests unless DEBUG is set
if (process.env.DEBUG !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  };
}