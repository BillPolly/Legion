/**
 * ValidationUtils - Deterministic validation utilities for autonomous app generation
 * 
 * Provides fast, reliable validation checks for code compilation, test execution,
 * JSON parsing, database connectivity, and API endpoint validation.
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class ValidationUtils {
  constructor() {
    this.validationResults = new Map();
  }

  /**
   * Check if JavaScript code compiles without syntax errors
   * @param {string} filePath - Path to JavaScript file
   * @returns {Promise<{valid: boolean, errors: string[], details: object}>}
   */
  async checkCompilation(filePath) {
    try {
      const absolutePath = path.resolve(filePath);
      const { stdout, stderr } = await execAsync(`node --check "${absolutePath}"`);
      
      if (stderr) {
        // Parse compilation errors
        const errors = stderr.split('\n')
          .filter(line => line.trim())
          .map(line => ({
            type: 'syntax',
            message: line,
            fixable: true
          }));

        return {
          valid: false,
          errors: errors.map(e => e.message),
          details: {
            type: 'compilation',
            file: filePath,
            errors
          }
        };
      }

      return {
        valid: true,
        errors: [],
        details: {
          type: 'compilation',
          file: filePath,
          status: 'passed'
        }
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        details: {
          type: 'compilation',
          file: filePath,
          error: error.message,
          fixable: true
        }
      };
    }
  }

  /**
   * Execute tests and parse failures
   * @param {string} projectPath - Path to project directory
   * @returns {Promise<{valid: boolean, errors: string[], details: object}>}
   */
  async executeTests(projectPath) {
    try {
      const originalCwd = process.cwd();
      process.chdir(projectPath);

      try {
        const { stdout, stderr } = await execAsync('npm test', {
          env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' },
          timeout: 30000
        });

        // Parse Jest output for test results
        const testResults = this.parseJestOutput(stdout + stderr);

        process.chdir(originalCwd);

        if (testResults.failed > 0) {
          return {
            valid: false,
            errors: testResults.failures.map(f => f.message),
            details: {
              type: 'tests',
              passed: testResults.passed,
              failed: testResults.failed,
              failures: testResults.failures,
              fixable: true
            }
          };
        }

        return {
          valid: true,
          errors: [],
          details: {
            type: 'tests',
            passed: testResults.passed,
            failed: 0,
            status: 'all_passed'
          }
        };
      } finally {
        process.chdir(originalCwd);
      }
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        details: {
          type: 'tests',
          error: error.message,
          fixable: true
        }
      };
    }
  }

  /**
   * Validate JSON structure and parsing
   * @param {string} jsonString - JSON string to validate
   * @param {object} schema - Optional schema to validate against
   * @returns {Promise<{valid: boolean, errors: string[], details: object}>}
   */
  async validateJSON(jsonString, schema = null) {
    try {
      const parsed = JSON.parse(jsonString);

      if (schema) {
        const schemaValidation = this.validateAgainstSchema(parsed, schema);
        if (!schemaValidation.valid) {
          return {
            valid: false,
            errors: schemaValidation.errors,
            details: {
              type: 'schema',
              violations: schemaValidation.violations,
              fixable: true
            }
          };
        }
      }

      return {
        valid: true,
        errors: [],
        details: {
          type: 'json',
          status: 'valid',
          parsed
        }
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        details: {
          type: 'json',
          error: error.message,
          position: this.extractJSONErrorPosition(error.message),
          fixable: true
        }
      };
    }
  }

  /**
   * Test database connectivity
   * @param {string} connectionUrl - MongoDB connection URL
   * @param {string} dbName - Database name
   * @returns {Promise<{valid: boolean, errors: string[], details: object}>}
   */
  async testDatabaseConnection(connectionUrl = 'mongodb://localhost:27017', dbName = 'test_db') {
    try {
      const { MongoClient } = await import('mongodb');
      const client = new MongoClient(connectionUrl);
      
      await client.connect();
      const db = client.db(dbName);
      
      // Test basic operations
      await db.admin().ping();
      await client.close();

      return {
        valid: true,
        errors: [],
        details: {
          type: 'database',
          status: 'connected',
          url: connectionUrl,
          database: dbName
        }
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        details: {
          type: 'database',
          error: error.message,
          url: connectionUrl,
          fixable: false // Database issues require external fixes
        }
      };
    }
  }

  /**
   * Validate API endpoints by testing HTTP responses
   * @param {string} baseUrl - Base URL for API
   * @param {Array} endpoints - Array of endpoint definitions
   * @returns {Promise<{valid: boolean, errors: string[], details: object}>}
   */
  async validateAPIEndpoints(baseUrl, endpoints) {
    const results = [];
    const errors = [];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint.path}`, {
          method: endpoint.method || 'GET',
          headers: endpoint.headers || {},
          body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
        });

        const isValid = endpoint.expectedStatus ? 
          response.status === endpoint.expectedStatus :
          response.status < 400;

        if (!isValid) {
          errors.push(`${endpoint.method} ${endpoint.path} returned ${response.status}, expected ${endpoint.expectedStatus || 'success'}`);
        }

        results.push({
          path: endpoint.path,
          method: endpoint.method,
          status: response.status,
          valid: isValid
        });
      } catch (error) {
        errors.push(`${endpoint.method} ${endpoint.path}: ${error.message}`);
        results.push({
          path: endpoint.path,
          method: endpoint.method,
          error: error.message,
          valid: false
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      details: {
        type: 'api',
        endpoints: results,
        baseUrl,
        fixable: true
      }
    };
  }

  /**
   * Parse Jest test output to extract test results
   * @private
   */
  parseJestOutput(output) {
    const results = {
      passed: 0,
      failed: 0,
      failures: []
    };

    // Parse Jest output patterns
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    
    if (passedMatch) results.passed = parseInt(passedMatch[1]);
    if (failedMatch) results.failed = parseInt(failedMatch[1]);

    // Extract failure details
    const failurePattern = /● (.+)\n\s+(.+)\n/g;
    let match;
    while ((match = failurePattern.exec(output)) !== null) {
      results.failures.push({
        test: match[1],
        message: match[2],
        fixable: true
      });
    }

    return results;
  }

  /**
   * Validate object against schema
   * @private
   */
  validateAgainstSchema(obj, schema) {
    const violations = [];

    for (const [key, expectedType] of Object.entries(schema)) {
      if (!(key in obj)) {
        violations.push(`Missing required property: ${key}`);
      } else if (typeof obj[key] !== expectedType) {
        violations.push(`Property ${key} should be ${expectedType}, got ${typeof obj[key]}`);
      }
    }

    return {
      valid: violations.length === 0,
      errors: violations,
      violations
    };
  }

  /**
   * Extract position information from JSON parsing errors
   * @private
   */
  extractJSONErrorPosition(errorMessage) {
    const positionMatch = errorMessage.match(/position (\d+)/i);
    return positionMatch ? parseInt(positionMatch[1]) : null;
  }

  /**
   * Get cached validation result
   */
  getCachedResult(key) {
    return this.validationResults.get(key);
  }

  /**
   * Cache validation result
   */
  setCachedResult(key, result) {
    this.validationResults.set(key, {
      ...result,
      timestamp: new Date().toISOString()
    });
  }
}