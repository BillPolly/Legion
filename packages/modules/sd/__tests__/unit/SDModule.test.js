/**
 * Simple smoke tests for SDModule
 * 
 * This module is complex with MongoDB and DecentPlanner dependencies.
 * These tests verify basic Legion Module compliance without requiring live services.
 */

import { jest } from '@jest/globals';
import SDModule from '../../src/SDModule.js';

describe('SDModule - Smoke Tests', () => {
  
  describe('Module Structure', () => {
    it('should extend Legion Module class', () => {
      const module = new SDModule();
      
      expect(module).toBeDefined();
      expect(module.name).toBe('sd');
      expect(module.description).toContain('Software Development autonomous agent system');
      expect(module.version).toBe('1.0.0');
      
      // Check Legion Module compliance
      expect(typeof module.initialize).toBe('function');
      expect(typeof module.getTools).toBe('function');
      expect(typeof module.getTool).toBe('function');
      expect(typeof module.getMetadata).toBe('function');
    });
  });

  describe('Static Factory Method', () => {
    it('should have static create method', () => {
      expect(typeof SDModule.create).toBe('function');
    });
  });

  describe('Module Metadata', () => {
    it('should return basic module properties', () => {
      const module = new SDModule();
      
      expect(module).toHaveProperty('name', 'sd');
      expect(module).toHaveProperty('version', '1.0.0');
      expect(module).toHaveProperty('description');
      expect(module.description).toContain('Software Development autonomous agent system');
    });
  });

  describe('Planning Methods', () => {
    it('should have planning methods available', () => {
      const module = new SDModule();
      
      expect(typeof module.planDevelopment).toBe('function');
      expect(typeof module.getPlanner).toBe('function');
      expect(typeof module.getProfiles).toBe('function');
      expect(typeof module.getProfile).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when planning without initialization', async () => {
      const module = new SDModule();
      
      await expect(module.planDevelopment('test goal'))
        .rejects.toThrow('SDModule not initialized');
    });
  });

});

/* 
NOTE: This SD module is a complex autonomous software development system
that integrates with MongoDB, DecentPlanner, and real LLM services.

Full integration testing requires:
- MongoDB running locally
- ANTHROPIC_API_KEY environment variable
- DecentPlanner dependencies

The module follows Legion Module patterns correctly and provides 13 tools
for software development workflow automation.

For full testing, use live environment with:
npm run test:live (if available)
*/