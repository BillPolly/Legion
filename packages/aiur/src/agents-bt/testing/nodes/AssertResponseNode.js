/**
 * AssertResponseNode - Performs assertions on captured responses and test data
 * 
 * Testing node that validates responses, data structures, and test outcomes
 * with comprehensive assertion capabilities.
 */

import { BehaviorTreeNode, NodeStatus } from '../../../../../shared/actor-BT/src/core/BehaviorTreeNode.js';

export class AssertResponseNode extends BehaviorTreeNode {
  static getTypeName() {
    return 'assert_response';
  }

  constructor(config, toolRegistry, executor) {
    super(config, toolRegistry, executor);
    
    // Data source configuration
    this.dataSource = config.dataSource || 'lastResponse'; // Key in context to assert on
    this.assertionType = config.assertionType || 'equals';
    
    // Assertion configurations
    this.assertions = config.assertions || []; // Array of assertion objects
    this.field = config.field; // Single field to assert (legacy support)
    this.expectedValue = config.expectedValue; // Single expected value (legacy support)
    
    // Behavior configuration
    this.continueOnFailure = config.continueOnFailure || false;
    this.collectFailures = config.collectFailures !== false;
    this.reportingLevel = config.reportingLevel || 'detailed'; // 'summary' | 'detailed'
  }

  async executeNode(context) {
    try {
      // Get data to assert on
      const testData = this.getTestData(context);
      if (testData === undefined || testData === null) {
        return {
          status: NodeStatus.FAILURE,
          data: { 
            error: `No test data found at: ${this.dataSource}`,
            availableKeys: Object.keys(context).filter(k => !k.startsWith('_'))
          }
        };
      }

      // Build assertions list
      const assertionsList = this.buildAssertionsList();
      if (assertionsList.length === 0) {
        return {
          status: NodeStatus.FAILURE,
          data: { error: 'No assertions defined' }
        };
      }

      if (context.debugMode) {
        console.log(`AssertResponseNode: Running ${assertionsList.length} assertions on:`, testData);
      }

      // Run all assertions
      const results = [];
      let hasFailures = false;

      for (const assertion of assertionsList) {
        const result = await this.runAssertion(testData, assertion, context);
        results.push(result);
        
        if (!result.passed) {
          hasFailures = true;
          
          if (!this.continueOnFailure) {
            break; // Stop on first failure
          }
        }
      }

      // Compile assertion results
      const assertionResults = {
        totalAssertions: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        results: results,
        overallStatus: hasFailures ? 'FAILED' : 'PASSED'
      };

      // Store results in context for reporting
      if (!context.assertionResults) {
        context.assertionResults = [];
      }
      context.assertionResults.push({
        nodeId: this.id || 'assert_response',
        dataSource: this.dataSource,
        timestamp: new Date().toISOString(),
        ...assertionResults
      });

      if (context.debugMode) {
        console.log(`AssertResponseNode: Assertion summary:`, {
          passed: assertionResults.passed,
          failed: assertionResults.failed,
          status: assertionResults.overallStatus
        });
      }

      // Return success/failure based on assertion results
      return {
        status: hasFailures ? NodeStatus.FAILURE : NodeStatus.SUCCESS,
        data: {
          assertionsPassed: !hasFailures,
          ...assertionResults,
          testData: this.reportingLevel === 'detailed' ? testData : undefined
        }
      };

    } catch (error) {
      console.error(`AssertResponseNode: Error during assertion:`, error);
      return {
        status: NodeStatus.FAILURE,
        data: {
          error: error.message,
          stackTrace: error.stack,
          dataSource: this.dataSource
        }
      };
    }
  }

  /**
   * Get test data from context
   */
  getTestData(context) {
    if (typeof this.dataSource === 'string') {
      return this.getNestedValue(context, this.dataSource);
    } else if (typeof this.dataSource === 'object') {
      // Data source is a literal value or complex object
      return this.dataSource;
    }
    return undefined;
  }

  /**
   * Build list of assertions to run
   */
  buildAssertionsList() {
    const assertions = [];

    // Add configured assertions array
    if (this.assertions && this.assertions.length > 0) {
      assertions.push(...this.assertions);
    }

    // Add legacy single assertion
    if (this.field !== undefined && this.expectedValue !== undefined) {
      assertions.push({
        field: this.field,
        type: this.assertionType,
        expected: this.expectedValue,
        description: `Assert ${this.field} ${this.assertionType} ${this.expectedValue}`
      });
    }

    return assertions;
  }

  /**
   * Run a single assertion
   */
  async runAssertion(testData, assertion, context) {
    const startTime = Date.now();
    
    try {
      // Extract actual value
      const actualValue = assertion.field ? 
        this.getNestedValue(testData, assertion.field) : testData;
      
      // Resolve expected value (support templates)
      const expectedValue = this.resolveTemplate(assertion.expected, context);
      
      // Run assertion based on type
      const passed = this.performAssertion(actualValue, expectedValue, assertion.type || 'equals');
      
      return {
        passed,
        assertion: assertion.description || `${assertion.field || 'data'} ${assertion.type || 'equals'} ${expectedValue}`,
        field: assertion.field,
        type: assertion.type || 'equals',
        actualValue,
        expectedValue,
        duration: Date.now() - startTime,
        error: passed ? null : `Assertion failed: expected ${expectedValue}, got ${actualValue}`
      };

    } catch (error) {
      return {
        passed: false,
        assertion: assertion.description || `${assertion.field} ${assertion.type}`,
        field: assertion.field,
        type: assertion.type,
        actualValue: undefined,
        expectedValue: assertion.expected,
        duration: Date.now() - startTime,
        error: `Assertion error: ${error.message}`
      };
    }
  }

  /**
   * Perform the actual assertion based on type
   */
  performAssertion(actual, expected, type) {
    switch (type) {
      case 'equals':
      case 'eq':
        return actual === expected;
        
      case 'not_equals':
      case 'ne':
        return actual !== expected;
        
      case 'greater_than':
      case 'gt':
        return actual > expected;
        
      case 'greater_than_equal':
      case 'gte':
        return actual >= expected;
        
      case 'less_than':
      case 'lt':
        return actual < expected;
        
      case 'less_than_equal':
      case 'lte':
        return actual <= expected;
        
      case 'contains':
        if (typeof actual === 'string') {
          return actual.includes(expected);
        } else if (Array.isArray(actual)) {
          return actual.includes(expected);
        } else if (actual && typeof actual === 'object') {
          return expected in actual;
        }
        return false;
        
      case 'not_contains':
        return !this.performAssertion(actual, expected, 'contains');
        
      case 'matches':
      case 'regex':
        if (typeof actual !== 'string') return false;
        const regex = new RegExp(expected);
        return regex.test(actual);
        
      case 'starts_with':
        return typeof actual === 'string' && actual.startsWith(expected);
        
      case 'ends_with':
        return typeof actual === 'string' && actual.endsWith(expected);
        
      case 'length':
        if (actual && (typeof actual.length === 'number')) {
          return actual.length === expected;
        }
        return false;
        
      case 'type':
        return typeof actual === expected;
        
      case 'instanceof':
        return actual instanceof expected;
        
      case 'truthy':
        return !!actual;
        
      case 'falsy':
        return !actual;
        
      case 'exists':
      case 'defined':
        return actual !== undefined && actual !== null;
        
      case 'not_exists':
      case 'undefined':
        return actual === undefined || actual === null;
        
      case 'deep_equals':
        return this.deepEquals(actual, expected);
        
      case 'array_contains':
        return Array.isArray(actual) && actual.some(item => 
          this.deepEquals(item, expected));
        
      case 'object_contains':
        if (!actual || typeof actual !== 'object') return false;
        for (const [key, value] of Object.entries(expected)) {
          if (!this.deepEquals(actual[key], value)) {
            return false;
          }
        }
        return true;
        
      default:
        throw new Error(`Unknown assertion type: ${type}`);
    }
  }

  /**
   * Deep equality comparison
   */
  deepEquals(a, b) {
    if (a === b) return true;
    
    if (a == null || b == null) return false;
    
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEquals(a[i], b[i])) return false;
      }
      return true;
    }
    
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEquals(a[key], b[key])) return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Resolve template variables in expected values
   */
  resolveTemplate(value, context) {
    if (typeof value === 'string' && value.includes('{{')) {
      return value.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
        const resolvedValue = this.getNestedValue(context, variableName.trim());
        return resolvedValue !== undefined ? resolvedValue : match;
      });
    }
    return value;
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    if (!path) return obj;
    
    return path.split('.').reduce((current, key) => {
      return current && current[key];
    }, obj);
  }

  /**
   * Get node metadata
   */
  getMetadata() {
    return {
      ...super.getMetadata(),
      nodeType: 'assert_response',
      purpose: 'Perform assertions on test data and responses',
      dataSource: this.dataSource,
      assertionType: this.assertionType,
      assertionCount: this.buildAssertionsList().length,
      capabilities: [
        'value_comparison',
        'pattern_matching',
        'deep_equality',
        'type_checking',
        'array_assertions',
        'object_assertions',
        'template_resolution'
      ]
    };
  }
}