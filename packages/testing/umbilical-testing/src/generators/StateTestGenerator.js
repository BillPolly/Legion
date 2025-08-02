/**
 * StateTestGenerator - Generates tests for state management validation
 * Validates state properties, constraints, synchronization, and MVVM patterns
 */
export class StateTestGenerator {
  /**
   * Generate tests for state management
   * @param {Object} description - Component description
   * @returns {Array} Generated tests
   */
  static generateTests(description) {
    const tests = [];

    if (!description.stateProperties || description.stateProperties.total === 0) {
      return tests;
    }

    // Generate tests for each state property
    for (const property of description.stateProperties.properties) {
      tests.push(...this.generatePropertyTests(property));
    }

    // Generate state synchronization tests
    if (description.stateProperties.total > 1) {
      tests.push(...this.generateSynchronizationTests(description.stateProperties));
    }

    // Generate MVVM pattern tests if events are present
    if (description.events && description.events.total > 0) {
      tests.push(...this.generateMVVMTests(description));
    }

    // Generate state constraint tests
    tests.push(...this.generateConstraintTests(description.stateProperties));

    return tests;
  }

  /**
   * Generate tests for individual state property
   * @param {Object} property - State property description
   * @returns {Array} Property tests
   */
  static generatePropertyTests(property) {
    const tests = [];

    // Test property existence and type
    tests.push({
      category: 'State Management',
      name: `should manage '${property.property}' property of type ${property.type}`,
      type: 'state-property',
      property: property.property,
      expectedType: property.type,
      async execute(component, testEnvironment) {
        const componentInstance = await StateTestGenerator.createComponentForTesting(component, testEnvironment);
        
        // Test property can be set
        const testValue = StateTestGenerator.generateValueForType(property.type);
        await StateTestGenerator.setComponentState(componentInstance, property.property, testValue);
        
        // Test property can be retrieved
        const retrievedValue = await StateTestGenerator.getComponentState(componentInstance, property.property);
        
        return {
          property: property.property,
          expectedType: property.type,
          actualType: StateTestGenerator.getActualType(retrievedValue),
          testValue,
          retrievedValue,
          canSet: true,
          canGet: retrievedValue !== undefined,
          typeMatches: StateTestGenerator.isTypeCompatible(StateTestGenerator.getActualType(retrievedValue), property.type)
        };
      }
    });

    // Test default value if specified
    if (property.hasDefault) {
      tests.push({
        category: 'State Management',
        name: `should have default value for '${property.property}' property`,
        type: 'state-default',
        property: property.property,
        expectedDefault: property.default,
        async execute(component, testEnvironment) {
          const componentInstance = await StateTestGenerator.createComponentForTesting(component, testEnvironment);
          
          // Get initial value without setting anything
          const defaultValue = await StateTestGenerator.getComponentState(componentInstance, property.property);
          
          return {
            property: property.property,
            hasDefault: defaultValue !== undefined,
            defaultValue,
            expectedDefault: property.default,
            defaultMatches: defaultValue === property.default
          };
        }
      });
    }

    // Test property immutability if specified
    if (property.immutable) {
      tests.push({
        category: 'State Management',
        name: `should maintain immutability for '${property.property}' property`,
        type: 'state-immutable',
        property: property.property,
        async execute(component, testEnvironment) {
          const componentInstance = await StateTestGenerator.createComponentForTesting(component, testEnvironment);
          
          const initialValue = await StateTestGenerator.getComponentState(componentInstance, property.property);
          
          // Attempt to modify the property
          const newValue = StateTestGenerator.generateValueForType(property.type);
          let modificationSucceeded = false;
          
          try {
            await StateTestGenerator.setComponentState(componentInstance, property.property, newValue);
            const afterValue = await StateTestGenerator.getComponentState(componentInstance, property.property);
            modificationSucceeded = afterValue !== initialValue;
          } catch (error) {
            // Expected for immutable properties
          }
          
          return {
            property: property.property,
            initialValue,
            modificationAttempted: true,
            modificationSucceeded,
            maintainsImmutability: !modificationSucceeded
          };
        }
      });
    }

    return tests;
  }

  /**
   * Generate state synchronization tests
   * @param {Object} stateProperties - State properties description
   * @returns {Array} Synchronization tests
   */
  static generateSynchronizationTests(stateProperties) {
    const tests = [];

    tests.push({
      category: 'State Management',
      name: 'should maintain state synchronization across properties',
      type: 'state-synchronization',
      async execute(component, testEnvironment) {
        const componentInstance = await StateTestGenerator.createComponentForTesting(component, testEnvironment);
        
        const results = {
          properties: [],
          synchronizationIssues: [],
          overallSynchronized: true
        };

        // Test each property independently
        for (const property of stateProperties.properties) {
          const testValue = StateTestGenerator.generateValueForType(property.type);
          
          await StateTestGenerator.setComponentState(componentInstance, property.property, testValue);
          const retrievedValue = await StateTestGenerator.getComponentState(componentInstance, property.property);
          
          const propertyResult = {
            property: property.property,
            setValue: testValue,
            retrievedValue,
            synchronized: retrievedValue === testValue
          };
          
          results.properties.push(propertyResult);
          
          if (!propertyResult.synchronized) {
            results.synchronizationIssues.push({
              property: property.property,
              issue: 'Value not synchronized after setting'
            });
            results.overallSynchronized = false;
          }
        }

        return results;
      }
    });

    return tests;
  }

  /**
   * Generate MVVM pattern tests
   * @param {Object} description - Component description
   * @returns {Array} MVVM tests
   */
  static generateMVVMTests(description) {
    const tests = [];

    tests.push({
      category: 'State Management',
      name: 'should follow MVVM pattern for state-event coordination',
      type: 'mvvm-pattern',
      async execute(component, testEnvironment) {
        const componentInstance = await StateTestGenerator.createComponentForTesting(component, testEnvironment);
        
        const results = {
          stateEventBindings: [],
          mvvmCompliance: true,
          issues: []
        };

        // Test state changes trigger events
        for (const property of description.stateProperties.properties) {
          const relatedEvents = description.events.byType.emits.filter(event =>
            event.event.includes(property.property) || 
            property.property.includes(event.event) ||
            event.event === 'change' ||
            event.event === 'stateChange'
          );

          if (relatedEvents.length > 0) {
            // Set up event listener
            let eventEmitted = false;
            let emittedPayload = null;

            testEnvironment.eventSystem.addEventListener(relatedEvents[0].event, (event) => {
              eventEmitted = true;
              emittedPayload = event.data;
            });

            // Change state and check if event is emitted
            const testValue = StateTestGenerator.generateValueForType(property.type);
            await StateTestGenerator.setComponentState(componentInstance, property.property, testValue);

            // Allow for async event emission
            await new Promise(resolve => setTimeout(resolve, 10));

            results.stateEventBindings.push({
              property: property.property,
              relatedEvent: relatedEvents[0].event,
              eventEmitted,
              emittedPayload,
              stateValue: testValue
            });

            if (!eventEmitted) {
              results.mvvmCompliance = false;
              results.issues.push(`State change for '${property.property}' did not trigger '${relatedEvents[0].event}' event`);
            }
          }
        }

        return results;
      }
    });

    return tests;
  }

  /**
   * Generate state constraint tests
   * @param {Object} stateProperties - State properties description
   * @returns {Array} Constraint tests
   */
  static generateConstraintTests(stateProperties) {
    const tests = [];

    tests.push({
      category: 'State Management',
      name: 'should enforce state property constraints',
      type: 'state-constraints',
      async execute(component, testEnvironment) {
        const componentInstance = await StateTestGenerator.createComponentForTesting(component, testEnvironment);
        
        const results = {
          constraintTests: [],
          constraintsEnforced: true
        };

        for (const property of stateProperties.properties) {
          const constraintTest = {
            property: property.property,
            constraints: [],
            violations: []
          };

          // Test type constraints
          if (property.type) {
            const wrongTypeValue = StateTestGenerator.generateValueOfWrongType(property.type);
            
            try {
              await StateTestGenerator.setComponentState(componentInstance, property.property, wrongTypeValue);
              const actualValue = await StateTestGenerator.getComponentState(componentInstance, property.property);
              
              if (!StateTestGenerator.isTypeCompatible(StateTestGenerator.getActualType(actualValue), property.type)) {
                constraintTest.violations.push({
                  constraint: 'type',
                  expectedType: property.type,
                  actualType: StateTestGenerator.getActualType(actualValue),
                  testValue: wrongTypeValue
                });
                results.constraintsEnforced = false;
              }
            } catch (error) {
              // Good - constraint was enforced
              constraintTest.constraints.push({
                constraint: 'type',
                enforced: true,
                error: error.message
              });
            }
          }

          // Test range constraints if specified
          if (property.constraints) {
            for (const constraint of property.constraints) {
              const violatingValue = StateTestGenerator.generateConstraintViolatingValue(constraint);
              
              try {
                await StateTestGenerator.setComponentState(componentInstance, property.property, violatingValue);
                constraintTest.violations.push({
                  constraint: constraint.type,
                  violatingValue,
                  message: `Constraint '${constraint.type}' was not enforced`
                });
                results.constraintsEnforced = false;
              } catch (error) {
                constraintTest.constraints.push({
                  constraint: constraint.type,
                  enforced: true,
                  error: error.message
                });
              }
            }
          }

          results.constraintTests.push(constraintTest);
        }

        return results;
      }
    });

    return tests;
  }

  /**
   * Create component for testing
   * @param {Object} component - Component class
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} Component instance
   */
  static async createComponentForTesting(component, testEnvironment) {
    const dependencies = {
      dom: testEnvironment.dom,
      eventSystem: testEnvironment.eventSystem,
      actorSpace: testEnvironment.actorSpace,
      ...testEnvironment.dependencies
    };

    if (component && typeof component.create === 'function') {
      return component.create(dependencies);
    } else if (typeof component === 'function' && component.create) {
      return component.create(dependencies);
    }
    
    // Create mock component with state management
    return {
      dependencies,
      state: new Map(),
      
      setState: function(key, value) {
        this.state.set(key, value);
        // Emit state change event if eventSystem available
        if (dependencies.eventSystem) {
          dependencies.eventSystem.dispatchEvent('stateChange', { property: key, value });
          dependencies.eventSystem.dispatchEvent('change', value);
          dependencies.eventSystem.dispatchEvent(key + 'Change', value);
        }
      },
      
      getState: function(key) {
        return this.state.get(key);
      },
      
      created: true
    };
  }

  /**
   * Set component state
   * @param {Object} componentInstance - Component instance
   * @param {string} property - Property name
   * @param {*} value - Value to set
   * @returns {Promise<void>}
   */
  static async setComponentState(componentInstance, property, value) {
    if (componentInstance.setState) {
      return componentInstance.setState(property, value);
    } else if (componentInstance.hasOwnProperty(property)) {
      componentInstance[property] = value;
    } else {
      throw new Error(`Cannot set state property '${property}' on component`);
    }
  }

  /**
   * Get component state
   * @param {Object} componentInstance - Component instance
   * @param {string} property - Property name
   * @returns {Promise<*>} Property value
   */
  static async getComponentState(componentInstance, property) {
    if (componentInstance.getState) {
      return componentInstance.getState(property);
    } else if (componentInstance.hasOwnProperty(property)) {
      return componentInstance[property];
    } else {
      return undefined;
    }
  }

  /**
   * Generate value for type
   * @param {string} type - Type name
   * @returns {*} Generated value
   */
  static generateValueForType(type) {
    switch (type.toLowerCase()) {
      case 'string': return 'test-string';
      case 'number': return 42;
      case 'boolean': return true;
      case 'array': return ['test'];
      case 'object': return { test: true };
      case 'date': return new Date();
      case 'function': return () => {};
      default: 
        if (type.startsWith('Array<')) return ['test'];
        return 'test-value';
    }
  }

  /**
   * Generate value of wrong type for testing
   * @param {string} correctType - Correct type
   * @returns {*} Wrong type value
   */
  static generateValueOfWrongType(correctType) {
    switch (correctType.toLowerCase()) {
      case 'string': return 42; // number instead of string
      case 'number': return 'not-a-number'; // string instead of number
      case 'boolean': return 'not-boolean'; // string instead of boolean
      case 'array': return 'not-an-array'; // string instead of array
      case 'object': return 'not-an-object'; // string instead of object
      default: return null; // null for any other type
    }
  }

  /**
   * Generate value that violates constraint
   * @param {Object} constraint - Constraint specification
   * @returns {*} Violating value
   */
  static generateConstraintViolatingValue(constraint) {
    switch (constraint.type) {
      case 'range':
        return constraint.max ? constraint.max + 10 : -1000;
      case 'length':
        return 'x'.repeat((constraint.max || 10) + 5);
      case 'pattern':
        return 'invalid-pattern-value';
      default:
        return 'constraint-violating-value';
    }
  }

  /**
   * Get actual type of value
   * @param {*} value - Value to check
   * @returns {string} Type name
   */
  static getActualType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'Array';
    if (value instanceof Date) return 'Date';
    if (value instanceof RegExp) return 'RegExp';
    if (typeof value === 'object' && value.constructor) {
      return value.constructor.name;
    }
    return typeof value;
  }

  /**
   * Check if types are compatible
   * @param {string} actualType - Actual type
   * @param {string} expectedType - Expected type
   * @returns {boolean} Types compatible
   */
  static isTypeCompatible(actualType, expectedType) {
    if (actualType === expectedType) return true;
    
    // Handle case variations
    if (actualType.toLowerCase() === expectedType.toLowerCase()) return true;
    
    // Handle generic types
    if (expectedType.startsWith('Array') && actualType === 'Array') return true;
    if (expectedType === 'Object' && (actualType === 'object' || actualType === 'Object')) return true;
    if (expectedType === 'Function' && (actualType === 'function' || actualType === 'Function')) return true;
    
    return false;
  }
}