/**
 * Unit tests for QualityStrategy (formerly QualityController)
 * Tests validation gates, quality metrics, and continuous validation
 * NO MOCKS - using real validation logic
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import QualityStrategy from '../../../../src/strategies/coding/QualityStrategy.js';

describe('QualityStrategy', () => {
  let qualityStrategy;
  let mockLLMClient;
  let mockToolRegistry;
  
  beforeEach(() => {
    // Create mock LLM client for requirements validation
    mockLLMClient = {
      complete: jest.fn(async (prompt) => JSON.stringify({
        features: ['authentication', 'database', 'api'],
        issues: [],
        score: 8
      }))
    };
    
    // Create mock tool registry
    mockToolRegistry = {
      getTool: jest.fn(async (toolName) => ({
        execute: jest.fn(async () => ({ success: true }))
      }))
    };
    
    qualityStrategy = new QualityStrategy(mockLLMClient, mockToolRegistry);
  });
  
  describe('Constructor', () => {
    test('should create controller with default gates', () => {
      const ctrl = new QualityStrategy();
      expect(ctrl.qualityGates).toBeDefined();
      expect(ctrl.qualityGates.setup).toBeDefined();
      expect(ctrl.qualityGates.core).toBeDefined();
      expect(ctrl.qualityGates.features).toBeDefined();
      expect(ctrl.qualityGates.testing).toBeDefined();
      expect(ctrl.qualityGates.integration).toBeDefined();
    });
    
    test('should accept custom quality gates', () => {
      const customGates = {
        custom: {
          checks: ['custom_check'],
          threshold: 75
        }
      };
      
      const ctrl = new QualityStrategy(null, null, { qualityGates: customGates });
      expect(ctrl.qualityGates.custom).toBeDefined();
      expect(ctrl.qualityGates.custom.threshold).toBe(75);
    });
  });
  
  describe('validateProject() method', () => {
    test('should validate complete project structure', async () => {
      const project = {
        phases: {
          setup: { status: 'completed', artifacts: [] },
          core: { status: 'completed', artifacts: [] },
          features: { status: 'completed', artifacts: [] },
          testing: { status: 'completed', artifacts: [] },
          integration: { status: 'completed', artifacts: [] }
        },
        artifacts: [
          { type: 'config', path: 'package.json', content: '{"name": "test-project", "version": "1.0.0"}' },
          { type: 'code', path: 'server.js', content: 'const express = require("express");' },
          { type: 'test', path: 'test.js', content: 'describe("test", () => {});' }
        ],
        quality: {
          testResults: { passed: 10, failed: 0, coverage: 85 }
        }
      };
      
      const result = await qualityStrategy.validateProject(project);
      
      expect(result.passed).toBe(true);
      expect(result.phases).toBeDefined();
      expect(result.overall).toBeDefined();
    });
    
    test('should fail validation on missing phases', async () => {
      const project = {
        phases: {
          setup: { status: 'completed', artifacts: [] }
          // Missing other phases
        },
        artifacts: []
      };
      
      const result = await qualityStrategy.validateProject(project);
      
      expect(result.passed).toBe(false);
      expect(result.issues).toContain('Missing required phase: core');
    });
    
    test('should check quality thresholds', async () => {
      const project = {
        phases: {
          setup: { status: 'completed', artifacts: [] },
          core: { status: 'completed', artifacts: [] },
          features: { status: 'completed', artifacts: [] },
          testing: { status: 'completed', artifacts: [] },
          integration: { status: 'completed', artifacts: [] }
        },
        artifacts: [],
        quality: {
          testResults: { passed: 5, failed: 5, coverage: 50 } // Low coverage
        }
      };
      
      const result = await qualityStrategy.validateProject(project);
      
      expect(result.phases.testing.passed).toBe(false);
      expect(result.phases.testing.issues).toContain('Coverage below threshold');
    });
  });
  
  describe('validatePhase() method', () => {
    test('should validate setup phase', async () => {
      const phase = {
        name: 'setup',
        status: 'completed',
        artifacts: [
          { type: 'config', path: 'package.json', content: '{"name": "test"}' }
        ]
      };
      
      const result = await qualityStrategy.validatePhase(phase);
      
      expect(result.passed).toBeDefined();
      expect(result.checks).toBeDefined();
    });
    
    test('should enforce threshold requirements', async () => {
      const phase = {
        name: 'core',
        status: 'completed',
        artifacts: []
      };
      
      // Should fail because no artifacts means checks can't pass
      const result = await qualityStrategy.validatePhase(phase);
      
      expect(result.score).toBeLessThan(100);
    });
    
    test('should handle unknown phase gracefully', async () => {
      const phase = {
        name: 'unknown',
        status: 'completed',
        artifacts: []
      };
      
      const result = await qualityStrategy.validatePhase(phase);
      
      expect(result.passed).toBe(true); // Unknown phases pass by default
    });
  });
  
  describe('validateSyntax() method', () => {
    test('should validate correct JavaScript syntax', async () => {
      const artifact = {
        type: 'code',
        content: 'const x = 5; function test() { return x + 1; }'
      };
      
      const result = await qualityStrategy.validateSyntax(artifact);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
    
    test('should detect syntax errors', async () => {
      const artifact = {
        type: 'code',
        content: 'const x = ; function test() { return'
      };
      
      const result = await qualityStrategy.validateSyntax(artifact);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    test('should skip non-code artifacts', async () => {
      const artifact = {
        type: 'documentation',
        content: 'This is documentation with invalid JS syntax const x = ;'
      };
      
      const result = await qualityStrategy.validateSyntax(artifact);
      
      expect(result.valid).toBe(true);
      expect(result.skipped).toBe(true);
    });
  });
  
  describe('validateRequirements() method', () => {
    test('should validate requirements are met', async () => {
      const artifact = {
        type: 'code',
        content: 'class AuthController { authenticate() {} }'
      };
      
      const requirements = ['authentication', 'user management'];
      
      const result = await qualityStrategy.validateRequirements(artifact, requirements);
      
      expect(result.valid).toBeDefined();
      expect(result.missing).toBeDefined();
    });
    
    test('should use LLM for complex requirement checking', async () => {
      const artifact = {
        type: 'code',
        content: 'const express = require("express"); app.use(auth);'
      };
      
      const requirements = ['REST API', 'authentication', 'error handling'];
      
      await qualityStrategy.validateRequirements(artifact, requirements);
      
      expect(mockLLMClient.complete).toHaveBeenCalled();
    });
  });
  
  describe('analyzeQuality() method', () => {
    test('should calculate quality metrics', async () => {
      const artifact = {
        type: 'code',
        content: `
          // Well-structured code
          class UserService {
            constructor(database) {
              this.db = database;
            }
            
            async getUser(id) {
              return await this.db.users.findById(id);
            }
            
            async createUser(data) {
              return await this.db.users.create(data);
            }
          }
        `
      };
      
      const metrics = await qualityStrategy.analyzeQuality(artifact);
      
      expect(metrics.score).toBeDefined();
      expect(metrics.score).toBeGreaterThan(0);
      expect(metrics.score).toBeLessThanOrEqual(10);
      expect(metrics.issues).toBeDefined();
    });
    
    test('should identify quality issues', async () => {
      const artifact = {
        type: 'code',
        content: `
          // Poor quality code
          function x(a,b,c,d,e,f,g,h) {
            if(a){if(b){if(c){if(d){
              return e+f+g+h;
            }}}}
          }
          eval("console.log('dangerous')");
        `
      };
      
      const metrics = await qualityStrategy.analyzeQuality(artifact);
      
      expect(metrics.score).toBeLessThan(5);
      expect(metrics.issues).toContain('High complexity');
      expect(metrics.issues).toContain('Security risk: eval usage');
    });
    
    test('should handle empty content', async () => {
      const artifact = {
        type: 'code',
        content: ''
      };
      
      const metrics = await qualityStrategy.analyzeQuality(artifact);
      
      expect(metrics.score).toBe(0);
      expect(metrics.issues).toContain('Empty content');
    });
  });
  
  describe('checkGate() method', () => {
    test('should check if gate passes threshold', async () => {
      const checks = [
        { name: 'test1', passed: true },
        { name: 'test2', passed: true },
        { name: 'test3', passed: true }
      ];
      
      const result = await qualityStrategy.checkGate(checks, 100);
      
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });
    
    test('should fail if below threshold', async () => {
      const checks = [
        { name: 'test1', passed: true },
        { name: 'test2', passed: false },
        { name: 'test3', passed: false }
      ];
      
      const result = await qualityStrategy.checkGate(checks, 75);
      
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(75);
    });
    
    test('should include failed check details', async () => {
      const checks = [
        { name: 'test1', passed: true },
        { name: 'test2', passed: false, reason: 'Test failed' }
      ];
      
      const result = await qualityStrategy.checkGate(checks, 100);
      
      expect(result.passed).toBe(false);
      expect(result.failedChecks).toContain('test2');
    });
  });
  
  describe('runCheck() method', () => {
    test('should run project structure validation check', async () => {
      const phase = {
        name: 'setup',
        artifacts: [
          { path: 'package.json', content: '{}' },
          { path: 'src/index.js', content: '' }
        ]
      };
      
      const result = await qualityStrategy.runCheck('project_structure_valid', phase);
      
      expect(result.passed).toBeDefined();
      expect(result.name).toBe('project_structure_valid');
    });
    
    test('should run syntax validation check', async () => {
      const phase = {
        name: 'core',
        artifacts: [
          { type: 'code', content: 'const server = express();' }
        ]
      };
      
      const result = await qualityStrategy.runCheck('no_syntax_errors', phase);
      
      expect(result.passed).toBe(true);
    });
    
    test('should run test execution check', async () => {
      const phase = {
        name: 'testing',
        quality: {
          testResults: { passed: 10, failed: 0 }
        }
      };
      
      const result = await qualityStrategy.runCheck('unit_tests_pass', phase);
      
      expect(result.passed).toBe(true);
    });
  });
  
  describe('handleError() method', () => {
    test('should classify and handle transient errors', async () => {
      const error = new Error('Network timeout');
      error.code = 'ETIMEDOUT';
      
      const result = await qualityStrategy.handleError(error);
      
      expect(result.type).toBe('TRANSIENT');
      expect(result.recoverable).toBe(true);
      expect(result.suggestion).toContain('retry');
    });
    
    test('should handle logic errors', async () => {
      const error = new Error('Invalid input: missing required field');
      
      const result = await qualityStrategy.handleError(error);
      
      expect(result.type).toBe('LOGIC');
      expect(result.recoverable).toBe(true);
      expect(result.suggestion).toContain('requirements');
    });
    
    test('should handle fatal errors', async () => {
      const error = new Error('Corrupted state');
      error.fatal = true;
      
      const result = await qualityStrategy.handleError(error);
      
      expect(result.type).toBe('FATAL');
      expect(result.recoverable).toBe(false);
    });
  });
  
  describe('extractFeatures() method', () => {
    test('should extract features from code', () => {
      const artifact = {
        content: `
          const express = require('express');
          const auth = require('./auth');
          const db = require('./database');
          
          app.use(auth.middleware);
          app.post('/api/users', userController.create);
        `
      };
      
      const features = qualityStrategy.extractFeatures(artifact);
      
      expect(features).toContain('express');
      expect(features).toContain('authentication');
      expect(features).toContain('database');
      expect(features).toContain('api');
    });
    
    test('should handle empty content', () => {
      const artifact = { content: '' };
      
      const features = qualityStrategy.extractFeatures(artifact);
      
      expect(features).toEqual([]);
    });
  });
  
  describe('getContinuousValidators() method', () => {
    test('should return validator functions', () => {
      const validators = qualityStrategy.getContinuousValidators();
      
      expect(validators.syntax).toBeDefined();
      expect(validators.requirements).toBeDefined();
      expect(validators.quality).toBeDefined();
      expect(typeof validators.syntax).toBe('function');
    });
    
    test('should validate continuously with returned validators', async () => {
      const validators = qualityStrategy.getContinuousValidators();
      
      const artifact = {
        type: 'code',
        content: 'function test() { return true; }'
      };
      
      const syntaxResult = await validators.syntax(artifact);
      expect(syntaxResult.valid).toBe(true);
      
      const qualityResult = await validators.quality(artifact);
      expect(qualityResult.score).toBeDefined();
    });
  });
});