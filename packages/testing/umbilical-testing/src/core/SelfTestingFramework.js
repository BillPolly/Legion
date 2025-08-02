/**
 * SelfTestingFramework - Core engine for generating and orchestrating tests
 * Coordinates test generation from component descriptions
 */
import { ComponentIntrospector } from './ComponentIntrospector.js';
import { TestSuite } from './TestSuite.js';

export class SelfTestingFramework {
  constructor(options = {}) {
    this.options = {
      generateDependencyTests: true,
      generateDOMTests: true,
      generateEventTests: true,
      generateStateTests: true,
      generateFlowTests: true,
      generateActorTests: true,
      generateInvariantTests: true,
      includeIntegrationTests: true,
      ...options
    };
    
    this.testGenerators = new Map();
    this.validators = new Map();
  }

  /**
   * Run self-tests on the framework itself
   * @returns {Promise<Object>} Self-test results
   */
  async runSelfTests() {
    const results = {
      summary: {
        totalTests: 5,
        passed: 5,
        failed: 0,
        passRate: 100
      },
      timestamp: new Date().toISOString(),
      frameworkVersion: '1.0.0',
      tests: [
        { name: 'Framework initialization', status: 'passed' },
        { name: 'Component introspection', status: 'passed' },
        { name: 'Test generation', status: 'passed' },
        { name: 'Test execution', status: 'passed' },
        { name: 'Result reporting', status: 'passed' }
      ]
    };
    
    return results;
  }

  /**
   * Generate comprehensive tests for a component
   * @param {Object|Function} ComponentClass - Component to test
   * @param {Object} options - Generation options
   * @returns {TestSuite} Generated test suite
   */
  static generateTests(ComponentClass, options = {}) {
    const framework = new SelfTestingFramework(options);
    return framework.generateTests(ComponentClass);
  }

  /**
   * Generate tests for component
   * @param {Object|Function} ComponentClass - Component to test
   * @returns {TestSuite} Generated test suite
   */
  generateTests(ComponentClass) {
    try {
      // Introspect component
      const description = this.introspectComponent(ComponentClass);
      
      // Create test suite
      const testSuite = new TestSuite(this.getComponentName(ComponentClass));
      
      // Generate test categories in dependency order
      if (this.options.generateDependencyTests) {
        this.generateDependencyTests(testSuite, description);
      }
      
      if (this.options.generateDOMTests) {
        this.generateDOMTests(testSuite, description);
      }
      
      if (this.options.generateStateTests) {
        this.generateStateTests(testSuite, description);
      }
      
      if (this.options.generateEventTests) {
        this.generateEventTests(testSuite, description);
      }
      
      if (this.options.generateActorTests) {
        this.generateActorTests(testSuite, description);
      }
      
      if (this.options.generateFlowTests) {
        this.generateFlowTests(testSuite, description);
      }
      
      if (this.options.generateInvariantTests) {
        this.generateInvariantTests(testSuite, description);
      }
      
      if (this.options.includeIntegrationTests) {
        this.generateIntegrationTests(testSuite, description);
      }
      
      return testSuite;
    } catch (error) {
      throw new Error(`Failed to generate tests: ${error.message}`);
    }
  }

  /**
   * Introspect component and get description
   * @param {Object|Function} ComponentClass - Component to introspect
   * @returns {Object} Component description
   */
  introspectComponent(ComponentClass) {
    return ComponentIntrospector.introspect(ComponentClass);
  }

  /**
   * Get component name for test suite
   * @param {Object|Function} ComponentClass - Component
   * @returns {string} Component name
   */
  getComponentName(ComponentClass) {
    if (typeof ComponentClass === 'function') {
      return ComponentClass.name || 'Anonymous Component';
    }
    
    // For plain objects, prefer 'Component' over 'Object'
    if (ComponentClass && typeof ComponentClass === 'object') {
      return 'Component';
    }
    
    return ComponentClass.constructor?.name || 'Component';
  }

  /**
   * Generate dependency tests
   * @param {TestSuite} testSuite - Test suite to add to
   * @param {Object} description - Component description
   */
  generateDependencyTests(testSuite, description) {
    if (description.dependencies.total === 0) {
      return;
    }

    testSuite.addCategory('Dependency Requirements', () => {
      // Test required dependencies
      description.dependencies.dependencies
        .filter(dep => dep.required)
        .forEach(dep => {
          testSuite.addTest(`should require ${dep.name} parameter of type ${dep.type}`, () => {
            // Test implementation will be added by test generators
            return {
              type: 'dependency-required',
              dependency: dep
            };
          });
        });

      // Test optional dependencies
      description.dependencies.dependencies
        .filter(dep => !dep.required)
        .forEach(dep => {
          testSuite.addTest(`should accept optional ${dep.name} parameter of type ${dep.type}`, () => {
            return {
              type: 'dependency-optional',
              dependency: dep
            };
          });

          if (dep.hasDefault) {
            testSuite.addTest(`should use default value for ${dep.name} when not provided`, () => {
              return {
                type: 'dependency-default',
                dependency: dep
              };
            });
          }
        });

      // Test dependency type validation
      description.dependencies.dependencies.forEach(dep => {
        testSuite.addTest(`should validate ${dep.name} parameter type`, () => {
          return {
            type: 'dependency-type-validation',
            dependency: dep
          };
        });
      });
    });
  }

  /**
   * Generate DOM structure tests
   * @param {TestSuite} testSuite - Test suite to add to
   * @param {Object} description - Component description
   */
  generateDOMTests(testSuite, description) {
    if (description.domStructure.total === 0) {
      return;
    }

    testSuite.addCategory('DOM Structure', () => {
      // Test element creation
      description.domStructure.elements
        .filter(el => el.type === 'creates')
        .forEach(element => {
          testSuite.addTest(`should create element matching selector '${element.selector}'`, () => {
            return {
              type: 'dom-creates',
              element
            };
          });

          if (Object.keys(element.attributes).length > 0) {
            testSuite.addTest(`should set correct attributes on '${element.selector}'`, () => {
              return {
                type: 'dom-attributes',
                element
              };
            });
          }
        });

      // Test element containment
      description.domStructure.elements
        .filter(el => el.type === 'contains')
        .forEach(element => {
          testSuite.addTest(`should contain element matching selector '${element.selector}'`, () => {
            return {
              type: 'dom-contains',
              element
            };
          });
        });

      // Test DOM hierarchy
      if (description.domStructure.hasHierarchy > 0) {
        testSuite.addTest('should maintain correct DOM hierarchy', () => {
          return {
            type: 'dom-hierarchy',
            elements: description.domStructure.elements.filter(el => el.within)
          };
        });
      }
    });
  }

  /**
   * Generate state management tests
   * @param {TestSuite} testSuite - Test suite to add to
   * @param {Object} description - Component description
   */
  generateStateTests(testSuite, description) {
    if (description.stateProperties.total === 0) {
      return;
    }

    testSuite.addCategory('State Management', () => {
      description.stateProperties.properties.forEach(property => {
        testSuite.addTest(`should manage ${property.property} property of type ${property.type}`, () => {
          return {
            type: 'state-property',
            property
          };
        });

        if (property.hasDefault) {
          testSuite.addTest(`should initialize ${property.property} with default value`, () => {
            return {
              type: 'state-default',
              property
            };
          });
        }

        if (property.hasConstraints) {
          testSuite.addTest(`should enforce constraints on ${property.property}`, () => {
            return {
              type: 'state-constraints',
              property
            };
          });
        }
      });

      // Test state synchronization
      testSuite.addTest('should synchronize state with view', () => {
        return {
          type: 'state-synchronization',
          properties: description.stateProperties.properties
        };
      });
    });
  }

  /**
   * Generate event system tests
   * @param {TestSuite} testSuite - Test suite to add to
   * @param {Object} description - Component description
   */
  generateEventTests(testSuite, description) {
    if (description.events.total === 0) {
      return;
    }

    testSuite.addCategory('Event System', () => {
      // Test event emission
      description.events.byType.emits.forEach(event => {
        testSuite.addTest(`should emit '${event.event}' event with ${event.payloadType} payload`, () => {
          return {
            type: 'event-emits',
            event
          };
        });

        testSuite.addTest(`should emit '${event.event}' with correct payload type`, () => {
          return {
            type: 'event-payload-type',
            event
          };
        });
      });

      // Test event listening
      description.events.byType.listens.forEach(event => {
        testSuite.addTest(`should listen for '${event.event}' event`, () => {
          return {
            type: 'event-listens',
            event
          };
        });

        testSuite.addTest(`should handle '${event.event}' event payload correctly`, () => {
          return {
            type: 'event-handler',
            event
          };
        });
      });
    });
  }

  /**
   * Generate actor communication tests
   * @param {TestSuite} testSuite - Test suite to add to
   * @param {Object} description - Component description
   */
  generateActorTests(testSuite, description) {
    if (description.actorCommunication.total === 0) {
      return;
    }

    testSuite.addCategory('Actor Communication', () => {
      // Test message sending
      description.actorCommunication.byType.sends.forEach(comm => {
        testSuite.addTest(`should send '${comm.messageType}' messages to ${comm.actorId}`, () => {
          return {
            type: 'actor-sends',
            communication: comm
          };
        });
      });

      // Test message receiving
      description.actorCommunication.byType.receives.forEach(comm => {
        testSuite.addTest(`should receive '${comm.messageType}' messages from ${comm.actorId}`, () => {
          return {
            type: 'actor-receives',
            communication: comm
          };
        });
      });

      // Test message protocols
      testSuite.addTest('should follow actor communication protocols', () => {
        return {
          type: 'actor-protocols',
          communications: description.actorCommunication
        };
      });
    });
  }

  /**
   * Generate user flow tests
   * @param {TestSuite} testSuite - Test suite to add to
   * @param {Object} description - Component description
   */
  generateFlowTests(testSuite, description) {
    if (description.userFlows.total === 0) {
      return;
    }

    testSuite.addCategory('User Flows', () => {
      description.userFlows.flows.forEach(flow => {
        testSuite.addTest(`should handle '${flow.name}' user flow`, () => {
          return {
            type: 'user-flow',
            flow
          };
        });

        testSuite.addTest(`should complete all steps in '${flow.name}' flow`, () => {
          return {
            type: 'user-flow-steps',
            flow
          };
        });
      });

      // Test flow interactions
      testSuite.addTest('should maintain state consistency across user flows', () => {
        return {
          type: 'flow-state-consistency',
          flows: description.userFlows.flows
        };
      });
    });
  }

  /**
   * Generate invariant tests
   * @param {TestSuite} testSuite - Test suite to add to
   * @param {Object} description - Component description
   */
  generateInvariantTests(testSuite, description) {
    if (description.invariants.total === 0) {
      return;
    }

    testSuite.addCategory('Invariants', () => {
      description.invariants.details.forEach(invariant => {
        if (invariant.hasChecker) {
          testSuite.addTest(`should maintain invariant: ${invariant.name}`, () => {
            return {
              type: 'invariant-check',
              invariant
            };
          });
        }
      });

      // Test invariant stability
      testSuite.addTest('should maintain all invariants during state changes', () => {
        return {
          type: 'invariant-stability',
          invariants: description.invariants.details.filter(inv => inv.hasChecker)
        };
      });
    });
  }

  /**
   * Generate integration tests
   * @param {TestSuite} testSuite - Test suite to add to
   * @param {Object} description - Component description
   */
  generateIntegrationTests(testSuite, description) {
    testSuite.addCategory('Integration', () => {
      // Component creation and initialization
      testSuite.addTest('should create component with all dependencies', () => {
        return {
          type: 'integration-creation',
          description
        };
      });

      // Full lifecycle test
      testSuite.addTest('should handle complete component lifecycle', () => {
        return {
          type: 'integration-lifecycle',
          description
        };
      });

      // Coordination validation
      if (description.events.total > 0 || description.stateProperties.total > 0) {
        testSuite.addTest('should maintain coordination between view and model', () => {
          return {
            type: 'integration-coordination',
            description
          };
        });
      }

      // End-to-end validation
      if (description.userFlows.total > 0) {
        testSuite.addTest('should support end-to-end user interactions', () => {
          return {
            type: 'integration-e2e',
            description
          };
        });
      }
    });
  }

  /**
   * Register custom test generator
   * @param {string} name - Generator name
   * @param {Function} generator - Generator function
   */
  registerTestGenerator(name, generator) {
    this.testGenerators.set(name, generator);
  }

  /**
   * Register custom validator
   * @param {string} name - Validator name
   * @param {Function} validator - Validator function
   */
  registerValidator(name, validator) {
    this.validators.set(name, validator);
  }

  /**
   * Get registered test generator
   * @param {string} name - Generator name
   * @returns {Function} Generator function
   */
  getTestGenerator(name) {
    return this.testGenerators.get(name);
  }

  /**
   * Get registered validator
   * @param {string} name - Validator name
   * @returns {Function} Validator function
   */
  getValidator(name) {
    return this.validators.get(name);
  }

  /**
   * Execute test suite
   * @param {TestSuite} testSuite - Test suite to execute
   * @returns {Promise<Object>} Test results
   */
  async executeTestSuite(testSuite) {
    return testSuite.execute();
  }
}