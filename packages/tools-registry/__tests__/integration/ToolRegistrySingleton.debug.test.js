/**
 * Debug version of ToolRegistrySingleton test with detailed logging
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import toolRegistry from '../../src/index.js';
import { 
  ensureMongoDBAvailable,
  resetToolRegistrySingleton,
   
} from '../utils/testHelpers.js';

console.log('🔍 DEBUG: Test file loaded');

describe('ToolRegistry Singleton Integration', () => {
  console.log('🔍 DEBUG: Describe block entered');
  
  beforeAll(async () => {
    console.log('🔍 DEBUG: beforeAll started');
    try {
      // Ensure MongoDB is running - FAIL if not
      console.log('🔍 DEBUG: Checking MongoDB...');
      await ensureMongoDBAvailable();
      console.log('✅ DEBUG: MongoDB available');
      
      console.log('🔍 DEBUG: Using production database (no cleaning needed)');
    } catch (error) {
      console.error('❌ DEBUG: beforeAll failed:', error);
      throw error;
    }
  });
  
  afterAll(async () => {
    console.log('🔍 DEBUG: afterAll started');
    try {
      await resetToolRegistrySingleton();
      console.log('✅ DEBUG: afterAll completed');
    } catch (error) {
      console.error('❌ DEBUG: afterAll failed:', error);
    }
  });
  
  describe('Singleton Pattern', () => {
    test('getInstance returns same instance', () => {
      console.log('🔍 DEBUG: Running getInstance test');
      const instance1 = ToolRegistry.getInstance();
      console.log('🔍 DEBUG: Got instance1');
      const instance2 = ToolRegistry.getInstance();
      console.log('🔍 DEBUG: Got instance2');
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ToolRegistry);
      console.log('✅ DEBUG: getInstance test passed');
    });
  });
});