/**
 * Unit tests for RequirementsAnalyzer
 * Tests requirement parsing, project type detection, and feature extraction
 * NO MOCKS - using real services where needed
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import RequirementsAnalyzer from '../../../../../src/strategies/coding/components/RequirementsAnalyzer.js';

describe('RequirementsAnalyzer', () => {
  let resourceManager;
  let llmClient;

  beforeEach(async () => {
    // Get real ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get real services
    llmClient = await resourceManager.get('llmClient');
  });

  describe('Constructor', () => {
    test('should create analyzer with LLM client', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      expect(analyzer).toBeDefined();
      expect(analyzer.llmClient).toBe(llmClient);
    });

    test('should throw error if no LLM client provided', () => {
      expect(() => new RequirementsAnalyzer()).toThrow('LLM client is required');
    });
  });

  describe('analyze() method', () => {
    test('should analyze simple API requirements', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const requirements = 'Create a REST API for managing todos with CRUD operations';
      
      const result = await analyzer.analyze(requirements);
      
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
      expect(['api', 'web', 'cli', 'library']).toContain(result.type);
      expect(Array.isArray(result.features)).toBe(true);
      expect(Array.isArray(result.technologies)).toBe(true);
    });

    test('should detect API project type', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const requirements = 'Build an Express REST API with authentication and MongoDB';
      
      const result = await analyzer.analyze(requirements);
      
      expect(result.type).toBe('api');
      expect(result.features).toEqual(expect.arrayContaining([
        expect.stringMatching(/authentication/i)
      ]));
      expect(result.technologies).toEqual(expect.arrayContaining([
        expect.stringMatching(/express/i),
        expect.stringMatching(/mongodb/i)
      ]));
    });

    test('should detect web application project type', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const requirements = 'Create a web dashboard with charts and user management';
      
      const result = await analyzer.analyze(requirements);
      
      expect(result.type).toBe('web');
      expect(result.features).toEqual(expect.arrayContaining([
        expect.stringMatching(/dashboard|charts|user/i)
      ]));
    });

    test('should detect CLI tool project type', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const requirements = 'Build a command line tool for file processing';
      
      const result = await analyzer.analyze(requirements);
      
      expect(result.type).toBe('cli');
      expect(result.features).toEqual(expect.arrayContaining([
        expect.stringMatching(/command|file|processing/i)
      ]));
    });

    test('should detect library project type', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const requirements = 'Create a utility library for date formatting';
      
      const result = await analyzer.analyze(requirements);
      
      expect(result.type).toBe('library');
      expect(result.features).toEqual(expect.arrayContaining([
        expect.stringMatching(/utility|date|formatting/i)
      ]));
    });

    test('should extract features from requirements', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const requirements = 'Build an API with user authentication, data validation, and email notifications';
      
      const result = await analyzer.analyze(requirements);
      
      expect(result.features.length).toBeGreaterThan(0);
      expect(result.features).toEqual(expect.arrayContaining([
        expect.stringMatching(/authentication/i),
        expect.stringMatching(/validation/i),
        expect.stringMatching(/email|notification/i)
      ]));
    });

    test('should identify constraints', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const requirements = 'Create a secure, scalable API that must handle 1000 requests per second';
      
      const result = await analyzer.analyze(requirements);
      
      expect(Array.isArray(result.constraints)).toBe(true);
      expect(result.constraints).toEqual(expect.arrayContaining([
        expect.stringMatching(/secure|scalable|performance/i)
      ]));
    });

    test('should suggest appropriate technology stack', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const requirements = 'Build a Node.js API with JWT authentication and PostgreSQL database';
      
      const result = await analyzer.analyze(requirements);
      
      expect(result.technologies).toEqual(expect.arrayContaining([
        expect.stringMatching(/node/i),
        expect.stringMatching(/jwt|jsonwebtoken/i),
        expect.stringMatching(/postgresql|postgres/i)
      ]));
    });

    test('should handle empty requirements', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      await expect(analyzer.analyze('')).rejects.toThrow('Requirements cannot be empty');
    });

    test('should handle null requirements', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      await expect(analyzer.analyze(null)).rejects.toThrow('Requirements must be a string');
    });

    test('should handle very long requirements', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const longRequirements = 'Create an API ' + 'with many features '.repeat(100);
      
      const result = await analyzer.analyze(longRequirements);
      
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });
  });

  describe('parseRequirements() method', () => {
    test('should parse structured requirements', async () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const requirements = {
        description: 'REST API for task management',
        features: ['CRUD operations', 'authentication'],
        constraints: ['must be secure', 'handle 100 concurrent users']
      };
      
      const result = await analyzer.parseRequirements(requirements);
      
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.features).toEqual(expect.arrayContaining(requirements.features));
      expect(result.constraints).toEqual(expect.arrayContaining(requirements.constraints));
    });
  });

  describe('extractProjectType() method', () => {
    test('should extract API type from requirements text', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const type = analyzer.extractProjectType('Create a REST API service');
      expect(type).toBe('api');
    });

    test('should extract web type from requirements text', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const type = analyzer.extractProjectType('Build a web application with React');
      expect(type).toBe('web');
    });

    test('should extract CLI type from requirements text', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const type = analyzer.extractProjectType('Create a command line interface tool');
      expect(type).toBe('cli');
    });

    test('should extract library type from requirements text', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const type = analyzer.extractProjectType('Develop a utility library for NPM');
      expect(type).toBe('library');
    });

    test('should default to api for ambiguous requirements', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const type = analyzer.extractProjectType('Build something that processes data');
      expect(type).toBe('api');
    });
  });

  describe('extractFeatures() method', () => {
    test('should extract features from text', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const text = 'API with authentication, validation, and caching';
      const features = analyzer.extractFeatures(text);
      
      expect(features).toContain('authentication');
      expect(features).toContain('validation');
      expect(features).toContain('caching');
    });

    test('should handle empty text', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const features = analyzer.extractFeatures('');
      expect(features).toEqual([]);
    });
  });

  describe('inferTechnologies() method', () => {
    test('should infer Node.js technologies for API project', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const parsed = {
        type: 'api',
        features: ['authentication', 'database'],
        constraints: []
      };
      
      const technologies = analyzer.inferTechnologies(parsed);
      
      expect(technologies).toContain('express');
      expect(technologies).toContain('nodejs');
    });

    test('should infer authentication libraries', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const parsed = {
        type: 'api',
        features: ['JWT authentication', 'user management'],
        constraints: []
      };
      
      const technologies = analyzer.inferTechnologies(parsed);
      
      expect(technologies).toEqual(expect.arrayContaining([
        expect.stringMatching(/jwt|jsonwebtoken|passport/i)
      ]));
    });

    test('should infer database technologies', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const parsed = {
        type: 'api',
        features: ['database storage', 'data persistence'],
        constraints: []
      };
      
      const technologies = analyzer.inferTechnologies(parsed);
      
      expect(technologies).toEqual(expect.arrayContaining([
        expect.stringMatching(/mongodb|postgresql|mysql/i)
      ]));
    });

    test('should infer testing frameworks', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const parsed = {
        type: 'library',
        features: ['unit tests', 'test coverage'],
        constraints: ['well-tested']
      };
      
      const technologies = analyzer.inferTechnologies(parsed);
      
      expect(technologies).toEqual(expect.arrayContaining([
        expect.stringMatching(/jest|mocha|chai/i)
      ]));
    });
  });

  describe('validateAnalysis() method', () => {
    test('should validate complete analysis', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const analysis = {
        type: 'api',
        features: ['auth', 'crud'],
        constraints: ['secure'],
        technologies: ['express', 'mongodb']
      };
      
      const isValid = analyzer.validateAnalysis(analysis);
      expect(isValid).toBe(true);
    });

    test('should reject analysis without type', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const analysis = {
        features: ['auth'],
        constraints: [],
        technologies: ['express']
      };
      
      const isValid = analyzer.validateAnalysis(analysis);
      expect(isValid).toBe(false);
    });

    test('should reject analysis with invalid type', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const analysis = {
        type: 'invalid',
        features: ['auth'],
        constraints: [],
        technologies: ['express']
      };
      
      const isValid = analyzer.validateAnalysis(analysis);
      expect(isValid).toBe(false);
    });

    test('should reject analysis without features array', () => {
      const analyzer = new RequirementsAnalyzer(llmClient);
      
      const analysis = {
        type: 'api',
        features: 'not an array',
        constraints: [],
        technologies: []
      };
      
      const isValid = analyzer.validateAnalysis(analysis);
      expect(isValid).toBe(false);
    });
  });
});