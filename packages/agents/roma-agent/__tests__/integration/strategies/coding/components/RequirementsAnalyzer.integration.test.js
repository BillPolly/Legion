/**
 * Integration tests for RequirementsAnalyzer with real LLM
 * NO MOCKS - using real services
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import RequirementsAnalyzer from '../../../../../src/strategies/coding/components/RequirementsAnalyzer.js';

describe('RequirementsAnalyzer Integration Tests', () => {
  let resourceManager;
  let llmClient;
  let analyzer;

  beforeAll(async () => {
    // Get real ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    analyzer = new RequirementsAnalyzer(llmClient);
  });

  test('should analyze REST API requirements', async () => {
    const requirements = 'Create a REST API for managing todos with CRUD operations, authentication, and data validation';
    
    const result = await analyzer.analyze(requirements);
    
    expect(result).toBeDefined();
    expect(result.type).toBe('api');
    expect(result.features).toEqual(expect.arrayContaining([
      expect.stringMatching(/authentication|auth/i),
      expect.stringMatching(/crud|operations/i),
      expect.stringMatching(/validation/i)
    ]));
    expect(result.technologies).toEqual(expect.arrayContaining([
      expect.stringMatching(/express|nodejs/i)
    ]));
  }, 15000); // Allow 15 seconds for LLM call

  test('should analyze web application requirements', async () => {
    const requirements = 'Build a web dashboard with charts for data visualization and user management';
    
    const result = await analyzer.analyze(requirements);
    
    expect(result.type).toBe('web');
    expect(result.features).toEqual(expect.arrayContaining([
      expect.stringMatching(/dashboard/i),
      expect.stringMatching(/chart/i)
    ]));
  }, 15000);

  test('should analyze CLI tool requirements', async () => {
    const requirements = 'Create a command line tool for file processing and batch operations';
    
    const result = await analyzer.analyze(requirements);
    
    expect(result.type).toBe('cli');
    expect(result.features).toEqual(expect.arrayContaining([
      expect.stringMatching(/file|processing/i)
    ]));
  }, 15000);

  test('should handle complex requirements', async () => {
    const requirements = `Build a scalable Node.js API with the following features:
    - JWT authentication
    - MongoDB database integration
    - Real-time updates using WebSockets
    - Comprehensive test coverage
    - API documentation
    - Rate limiting for security`;
    
    const result = await analyzer.analyze(requirements);
    
    expect(result.type).toBe('api');
    expect(result.features.length).toBeGreaterThan(3);
    expect(result.constraints).toEqual(expect.arrayContaining([
      expect.stringMatching(/scalable|security/i)
    ]));
    expect(result.technologies).toEqual(expect.arrayContaining([
      expect.stringMatching(/mongodb/i),
      expect.stringMatching(/jwt|jsonwebtoken/i)
    ]));
  }, 15000);

  test('should validate analysis structure', async () => {
    const requirements = 'Simple Express API';
    
    const result = await analyzer.analyze(requirements);
    
    // Verify complete structure
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('features');
    expect(result).toHaveProperty('constraints');
    expect(result).toHaveProperty('technologies');
    
    expect(Array.isArray(result.features)).toBe(true);
    expect(Array.isArray(result.constraints)).toBe(true);
    expect(Array.isArray(result.technologies)).toBe(true);
    expect(['api', 'web', 'cli', 'library']).toContain(result.type);
  }, 15000);
});