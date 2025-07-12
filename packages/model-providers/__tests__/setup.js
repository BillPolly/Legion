/**
 * Jest test setup for @jsenvoy/model-providers
 */

import { jest } from '@jest/globals';
import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config({ path: '../../.env' });

// Mock console methods to reduce noise in tests (but keep warn for debugging)
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn()
};

// Global test timeout
jest.setTimeout(30000);