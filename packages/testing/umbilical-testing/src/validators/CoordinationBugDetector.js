/**
 * CoordinationBugDetector - Detects coordination bugs between component aspects
 * Specifically designed to catch issues like [object InputEvent] parameter passing errors
 */
export class CoordinationBugDetector {
  /**
   * Detect coordination bugs in component
   * @param {Object} component - Component instance
   * @param {Object} description - Component description
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} Bug detection results
   */
  static async detectBugs(component, description, testEnvironment) {
    const results = {
      bugs: [],
      warnings: [],
      coordination: {
        parameterPassing: null,
        eventPayloads: null,
        stateSync: null,
        typeConsistency: null
      },
      success: true,
      executionTime: 0
    };

    const startTime = Date.now();

    try {
      // Create component instance for testing
      const componentInstance = await this.createTestableComponent(
        component, testEnvironment
      );

      // Detect parameter passing bugs
      if (description.events.total > 0) {
        results.coordination.parameterPassing = await this.detectParameterPassingBugs(
          componentInstance, description, testEnvironment
        );
      }

      // Detect event payload bugs
      if (description.events.total > 0) {
        results.coordination.eventPayloads = await this.detectEventPayloadBugs(
          componentInstance, description, testEnvironment
        );
      }

      // Detect state synchronization bugs
      if (description.stateProperties.total > 0) {
        results.coordination.stateSync = await this.detectStateSyncBugs(
          componentInstance, description, testEnvironment
        );
      }

      // Detect type consistency bugs
      results.coordination.typeConsistency = await this.detectTypeConsistencyBugs(
        componentInstance, description, testEnvironment
      );

      // Aggregate bug results
      this.aggregateBugResults(results);

    } catch (error) {
      results.success = false;
      results.bugs.push({
        type: 'DETECTION_ERROR',
        message: error.message,
        severity: 'ERROR',
        category: 'coordination'
      });
    } finally {
      results.executionTime = Date.now() - startTime;
    }

    return results;
  }

  /**
   * Create testable component instance
   * @param {Object} component - Component to instantiate
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} Component instance
   */
  static async createTestableComponent(component, testEnvironment) {
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
    } else if (component && typeof component.describe === 'function') {
      // Create mock component for testing
      return this.createMockComponentInstance(component, dependencies);
    }
    
    throw new Error('Unable to create testable component instance');
  }

  /**
   * Create mock component instance for testing
   * @param {Object} component - Component class
   * @param {Object} dependencies - Dependencies
   * @returns {Object} Mock component instance
   */
  static createMockComponentInstance(component, dependencies) {
    const eventHandlers = new Map();
    const stateValues = new Map();
    
    return {
      dependencies,
      eventHandlers,
      stateValues,
      
      // Mock event system
      on: (event, handler) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, []);
        }
        eventHandlers.get(event).push(handler);
      },
      
      emit: (event, payload) => {
        dependencies.eventSystem?.dispatchEvent(event, payload);
      },
      
      // Mock state management
      setState: (key, value) => {
        stateValues.set(key, value);
      },
      
      getState: (key) => {
        return stateValues.get(key);
      },
      
      // Mock input handling that could trigger [object InputEvent] bug
      onInput: (value, event) => {
        // This is where the bug would manifest - passing wrong parameter
        if (this.inputHandler) {
          this.inputHandler(value, event);
        }
      },
      
      setInputHandler: function(handler) {
        this.inputHandler = handler;
      },
      
      // Mock DOM interaction
      appendChild: (element) => {
        if (dependencies.dom && dependencies.dom.appendChild) {
          dependencies.dom.appendChild(element);
        }
      },
      
      created: true
    };
  }

  /**
   * Detect parameter passing bugs (like [object InputEvent])
   * @param {Object} componentInstance - Component instance
   * @param {Object} description - Component description
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} Parameter passing bug results
   */
  static async detectParameterPassingBugs(componentInstance, description, testEnvironment) {
    const results = {
      bugs: [],
      warnings: [],
      tests: []
    };

    try {
      // Test event parameter passing
      for (const eventDesc of description.events.byType.emits) {
        const parameterTest = await this.testEventParameterPassing(
          componentInstance, eventDesc, testEnvironment
        );
        results.tests.push(parameterTest);
        
        if (parameterTest.hasBug) {
          results.bugs.push({
            type: 'PARAMETER_PASSING_BUG',
            event: eventDesc.event,
            expectedType: eventDesc.payloadType,
            actualType: parameterTest.actualType,
            message: `Event '${eventDesc.event}' receives wrong parameter type: expected ${eventDesc.payloadType}, got ${parameterTest.actualType}`,
            severity: 'ERROR',
            category: 'coordination'
          });
        }
      }

      // Test input handler parameter passing (specific to [object InputEvent] bug)
      if (this.hasInputHandling(description)) {
        const inputTest = await this.testInputParameterPassing(
          componentInstance, testEnvironment
        );
        results.tests.push(inputTest);
        
        if (inputTest.hasBug) {
          results.bugs.push({
            type: 'INPUT_PARAMETER_BUG',
            expectedParameter: 'value (string)',
            actualParameter: inputTest.actualParameter,
            message: `Input handler receives wrong parameter: expected value string, got ${inputTest.actualParameter}`,
            severity: 'ERROR',
            category: 'coordination',
            details: 'This is the classic [object InputEvent] bug where event object is passed instead of value'
          });
        }
      }

    } catch (error) {
      results.bugs.push({
        type: 'PARAMETER_DETECTION_ERROR',
        message: error.message,
        severity: 'ERROR',
        category: 'coordination'
      });
    }

    return results;
  }

  /**
   * Test event parameter passing
   * @param {Object} componentInstance - Component instance
   * @param {Object} eventDesc - Event description
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} Parameter test result
   */
  static async testEventParameterPassing(componentInstance, eventDesc, testEnvironment) {
    const result = {
      event: eventDesc.event,
      expectedType: eventDesc.payloadType,
      actualType: null,
      hasBug: false,
      details: null
    };

    try {
      // Set up event listener to capture what's actually passed
      let capturedPayload = null;
      let capturedType = null;
      
      testEnvironment.eventSystem.addEventListener(eventDesc.event, (event) => {
        capturedPayload = event.data;
        capturedType = this.getActualType(event.data);
      });

      // Trigger event emission
      if (componentInstance.emit) {
        // Test with correct payload type
        const testPayload = this.generateTestPayload(eventDesc.payloadType);
        componentInstance.emit(eventDesc.event, testPayload);
        
        result.actualType = capturedType;
        result.hasBug = capturedType !== eventDesc.payloadType && 
                       capturedType === 'object' && 
                       capturedPayload && 
                       capturedPayload.toString() === '[object Object]';
      }

    } catch (error) {
      result.details = `Error testing parameter passing: ${error.message}`;
    }

    return result;
  }

  /**
   * Test input parameter passing (for [object InputEvent] bug)
   * @param {Object} componentInstance - Component instance
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} Input parameter test result
   */
  static async testInputParameterPassing(componentInstance, testEnvironment) {
    const result = {
      expectedParameter: 'value (string)',
      actualParameter: null,
      hasBug: false,
      details: null
    };

    try {
      // Set up input handler to capture what's passed
      let capturedParameter = null;
      let capturedType = null;
      
      if (componentInstance.setInputHandler) {
        componentInstance.setInputHandler((param) => {
          capturedParameter = param;
          capturedType = this.getActualType(param);
          
          // Check if it's the classic [object InputEvent] bug
          if (typeof param === 'object' && param && param.toString() === '[object InputEvent]') {
            result.hasBug = true;
            result.actualParameter = '[object InputEvent]';
          } else if (typeof param === 'object' && param && param.type === 'input') {
            result.hasBug = true;
            result.actualParameter = 'InputEvent object';
          }
        });
      }

      // Simulate input event
      if (componentInstance.onInput) {
        const mockInputEvent = {
          type: 'input',
          target: { value: 'test-input' },
          toString: () => '[object InputEvent]'
        };
        
        // This should pass the value, not the event
        componentInstance.onInput('test-input', mockInputEvent);
        
        if (!result.hasBug && capturedType) {
          result.actualParameter = `${capturedType}: ${capturedParameter}`;
          result.hasBug = capturedType !== 'string';
        }
      }

    } catch (error) {
      result.details = `Error testing input parameter passing: ${error.message}`;
    }

    return result;
  }

  /**
   * Detect event payload bugs
   * @param {Object} componentInstance - Component instance
   * @param {Object} description - Component description
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} Event payload bug results
   */
  static async detectEventPayloadBugs(componentInstance, description, testEnvironment) {
    const results = {
      bugs: [],
      warnings: [],
      tests: []
    };

    try {
      // Test each event for payload type consistency
      for (const eventDesc of [...description.events.byType.emits, ...description.events.byType.listens]) {
        const payloadTest = await this.testEventPayloadType(
          componentInstance, eventDesc, testEnvironment
        );
        results.tests.push(payloadTest);
        
        if (payloadTest.typeMismatch) {
          results.bugs.push({
            type: 'EVENT_PAYLOAD_TYPE_BUG',
            event: eventDesc.event,
            expectedType: eventDesc.payloadType,
            actualType: payloadTest.actualType,
            message: `Event '${eventDesc.event}' payload type mismatch: expected ${eventDesc.payloadType}, got ${payloadTest.actualType}`,
            severity: 'ERROR',
            category: 'coordination'
          });
        }
      }

    } catch (error) {
      results.bugs.push({
        type: 'PAYLOAD_DETECTION_ERROR',
        message: error.message,
        severity: 'ERROR',
        category: 'coordination'
      });
    }

    return results;
  }

  /**
   * Test event payload type
   * @param {Object} componentInstance - Component instance
   * @param {Object} eventDesc - Event description
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} Payload type test result
   */
  static async testEventPayloadType(componentInstance, eventDesc, testEnvironment) {
    const result = {
      event: eventDesc.event,
      expectedType: eventDesc.payloadType,
      actualType: null,
      typeMismatch: false
    };

    try {
      // Capture actual payload type
      testEnvironment.eventSystem.addEventListener(eventDesc.event, (event) => {
        result.actualType = this.getActualType(event.data);
        result.typeMismatch = !this.isTypeCompatible(result.actualType, eventDesc.payloadType);
      });

      // Emit test event if component can emit
      if (componentInstance.emit) {
        const testPayload = this.generateTestPayload(eventDesc.payloadType);
        componentInstance.emit(eventDesc.event, testPayload);
      }

    } catch (error) {
      result.details = `Error testing payload type: ${error.message}`;
    }

    return result;
  }

  /**
   * Detect state synchronization bugs
   * @param {Object} componentInstance - Component instance
   * @param {Object} description - Component description
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} State sync bug results
   */
  static async detectStateSyncBugs(componentInstance, description, testEnvironment) {
    const results = {
      bugs: [],
      warnings: [],
      tests: []
    };

    try {
      // Test state property synchronization
      for (const stateDesc of description.stateProperties.properties) {
        const syncTest = await this.testStateSynchronization(
          componentInstance, stateDesc, testEnvironment
        );
        results.tests.push(syncTest);
        
        if (syncTest.hasSyncBug) {
          results.bugs.push({
            type: 'STATE_SYNC_BUG',
            property: stateDesc.property,
            expectedType: stateDesc.type,
            message: `State property '${stateDesc.property}' synchronization bug detected`,
            severity: 'ERROR',
            category: 'coordination'
          });
        }
      }

    } catch (error) {
      results.bugs.push({
        type: 'STATE_DETECTION_ERROR',
        message: error.message,
        severity: 'ERROR',
        category: 'coordination'
      });
    }

    return results;
  }

  /**
   * Test state synchronization
   * @param {Object} componentInstance - Component instance
   * @param {Object} stateDesc - State property description
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} State sync test result
   */
  static async testStateSynchronization(componentInstance, stateDesc, testEnvironment) {
    const result = {
      property: stateDesc.property,
      expectedType: stateDesc.type,
      hasSyncBug: false,
      details: null
    };

    try {
      if (componentInstance.setState && componentInstance.getState) {
        // Test state setting and getting
        const testValue = this.generateTestValue(stateDesc.type);
        componentInstance.setState(stateDesc.property, testValue);
        
        const retrievedValue = componentInstance.getState(stateDesc.property);
        const retrievedType = this.getActualType(retrievedValue);
        
        result.hasSyncBug = !this.isTypeCompatible(retrievedType, stateDesc.type) ||
                           retrievedValue !== testValue;
      }

    } catch (error) {
      result.details = `Error testing state sync: ${error.message}`;
    }

    return result;
  }

  /**
   * Detect type consistency bugs
   * @param {Object} componentInstance - Component instance
   * @param {Object} description - Component description
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} Type consistency bug results
   */
  static async detectTypeConsistencyBugs(componentInstance, description, testEnvironment) {
    const results = {
      bugs: [],
      warnings: [],
      tests: []
    };

    try {
      // Check cross-cutting type consistency
      const consistencyTest = await this.testCrossCuttingTypeConsistency(
        componentInstance, description, testEnvironment
      );
      results.tests.push(consistencyTest);
      
      if (consistencyTest.hasInconsistencies) {
        results.bugs.push(...consistencyTest.inconsistencies.map(inc => ({
          type: 'TYPE_CONSISTENCY_BUG',
          aspect1: inc.aspect1,
          aspect2: inc.aspect2,
          message: inc.message,
          severity: 'WARNING',
          category: 'coordination'
        })));
      }

    } catch (error) {
      results.bugs.push({
        type: 'TYPE_CONSISTENCY_ERROR',
        message: error.message,
        severity: 'ERROR',
        category: 'coordination'
      });
    }

    return results;
  }

  /**
   * Test cross-cutting type consistency
   * @param {Object} componentInstance - Component instance
   * @param {Object} description - Component description
   * @param {Object} testEnvironment - Test environment
   * @returns {Promise<Object>} Type consistency test result
   */
  static async testCrossCuttingTypeConsistency(componentInstance, description, testEnvironment) {
    const result = {
      hasInconsistencies: false,
      inconsistencies: []
    };

    try {
      // Check event-state type consistency
      for (const event of description.events.byType.emits) {
        for (const state of description.stateProperties.properties) {
          if (event.event.includes(state.property) || state.property.includes(event.event)) {
            // Related event and state should have compatible types
            if (!this.isTypeCompatible(event.payloadType, state.type)) {
              result.inconsistencies.push({
                aspect1: `event:${event.event}`,
                aspect2: `state:${state.property}`,
                message: `Event '${event.event}' payload type '${event.payloadType}' inconsistent with state '${state.property}' type '${state.type}'`
              });
            }
          }
        }
      }

      result.hasInconsistencies = result.inconsistencies.length > 0;

    } catch (error) {
      result.details = `Error testing type consistency: ${error.message}`;
    }

    return result;
  }

  /**
   * Check if component has input handling
   * @param {Object} description - Component description
   * @returns {boolean} Has input handling
   */
  static hasInputHandling(description) {
    return description.events.byType.emits.some(e => 
      e.event === 'input' || e.event === 'change' || e.event.includes('input')
    ) || description.events.byType.listens.some(e => 
      e.event === 'input' || e.event === 'change' || e.event.includes('input')
    );
  }

  /**
   * Get actual type of value
   * @param {*} value - Value to check
   * @returns {string} Actual type
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
   * @returns {boolean} Types are compatible
   */
  static isTypeCompatible(actualType, expectedType) {
    if (actualType === expectedType) return true;
    
    // Handle generic types
    if (expectedType.startsWith('Array') && actualType === 'Array') return true;
    if (expectedType === 'Object' && (actualType === 'object' || actualType === 'Object')) return true;
    if (expectedType === 'Function' && (actualType === 'function' || actualType === 'Function')) return true;
    
    return false;
  }

  /**
   * Generate test payload for type
   * @param {string} type - Type to generate
   * @returns {*} Test payload
   */
  static generateTestPayload(type) {
    switch (type) {
      case 'string': return 'test-string';
      case 'number': return 42;
      case 'boolean': return true;
      case 'Array': return ['test'];
      case 'Object': return { test: true };
      case 'Date': return new Date();
      default: return 'test-value';
    }
  }

  /**
   * Generate test value for type
   * @param {string} type - Type to generate
   * @returns {*} Test value
   */
  static generateTestValue(type) {
    return this.generateTestPayload(type);
  }

  /**
   * Aggregate bug detection results
   * @param {Object} results - Results to aggregate
   */
  static aggregateBugResults(results) {
    const allCoordination = Object.values(results.coordination).filter(Boolean);
    const allBugs = [];
    const allWarnings = [];

    allCoordination.forEach(coordination => {
      if (coordination.bugs) {
        allBugs.push(...coordination.bugs);
      }
      if (coordination.warnings) {
        allWarnings.push(...coordination.warnings);
      }
    });

    results.bugs.push(...allBugs);
    results.warnings.push(...allWarnings);

    // Determine overall success
    results.success = results.bugs.filter(bug => 
      bug.severity === 'ERROR'
    ).length === 0;
  }
}