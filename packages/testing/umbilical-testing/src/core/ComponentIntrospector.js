/**
 * ComponentIntrospector - Analyzes components and extracts their descriptions
 * Provides introspection capabilities for self-describing components
 */
import { ComponentDescriptor } from './ComponentDescriptor.js';

export class ComponentIntrospector {
  /**
   * Introspect a component and extract its description
   * @param {Object|Function} ComponentClass - Component class or factory
   * @returns {Object} Component description
   */
  static introspect(ComponentClass) {
    const descriptor = new ComponentDescriptor();
    
    try {
      // Handle different component patterns
      if (typeof ComponentClass === 'function') {
        // Standard component class with static describe method
        if (ComponentClass.describe) {
          ComponentClass.describe(descriptor);
        } else {
          throw new Error('Component must have a static describe method');
        }
      } else if (ComponentClass && typeof ComponentClass.describe === 'function') {
        // Component object with describe method
        ComponentClass.describe(descriptor);
      } else {
        throw new Error('Component must have a describe method');
      }

      // Validate the description
      const validation = descriptor.validate();
      if (!validation.valid) {
        throw new Error(`Invalid component description: ${validation.errors.join(', ')}`);
      }

      return this.parseDescription(descriptor);
    } catch (error) {
      throw new Error(`Failed to introspect component: ${error.message}`);
    }
  }

  /**
   * Parse and normalize component description
   * @param {ComponentDescriptor} descriptor - Component descriptor
   * @returns {Object} Parsed description
   */
  static parseDescription(descriptor) {
    const description = descriptor.getDescription();
    
    const dependencies = this.analyzeDependencies(description.dependencies);
    const domStructure = this.analyzeDOMStructure(description.domStructure);
    const stateProperties = this.analyzeStateProperties(description.stateProperties);
    const events = this.analyzeEvents(description.events);
    const userInteractions = this.analyzeUserInteractions(description.userInteractions);
    const actorCommunication = this.analyzeActorCommunication(description.actorCommunication);
    const userFlows = this.analyzeUserFlows(description.userFlows);
    const invariants = this.analyzeInvariants(description.invariants);
    const contracts = this.analyzeContracts(description.contracts);
    
    return {
      // Summary
      summary: {
        name: description.name || 'UnnamedComponent',
        description: description.description || 'No description provided',
        totalCapabilities: dependencies.total + domStructure.total + stateProperties.total + 
                          events.total + userInteractions.total + actorCommunication.total +
                          userFlows.total + invariants.total + contracts.total,
        complexity: this.calculateComplexity(description)
      },
      
      // Core metadata
      metadata: this.extractMetadata(description),
      
      // Dependency analysis
      dependencies,
      
      // DOM structure analysis
      domStructure,
      
      // State management analysis
      stateProperties,
      
      // Event system analysis
      events,
      
      // User interaction analysis
      userInteractions,
      
      // Actor communication analysis
      actorCommunication,
      
      // User flow analysis
      userFlows,
      
      // Invariant analysis
      invariants,
      
      // Contract analysis
      contracts,
      
      // Validation results
      validation: descriptor.validate()
    };
  }

  /**
   * Extract component metadata
   * @param {Object} description - Raw description
   * @returns {Object} Metadata
   */
  static extractMetadata(description) {
    return {
      hasDepedencies: description.dependencies.length > 0,
      hasDOMStructure: description.domStructure.length > 0,
      hasState: description.stateProperties.length > 0,
      hasEvents: description.events.length > 0,
      hasUserInteractions: description.userInteractions.length > 0,
      hasActorCommunication: description.actorCommunication.length > 0,
      hasUserFlows: description.userFlows.length > 0,
      hasInvariants: description.invariants.length > 0,
      hasContracts: description.contracts.length > 0,
      complexity: this.calculateComplexity(description)
    };
  }

  /**
   * Calculate component complexity score
   * @param {Object} description - Component description
   * @returns {number} Complexity score
   */
  static calculateComplexity(description) {
    let complexity = 0;
    
    // Base complexity factors
    complexity += description.dependencies.length;
    complexity += description.domStructure.length;
    complexity += description.stateProperties.length;
    complexity += description.events.length;
    complexity += description.userInteractions.length;
    complexity += description.actorCommunication.length;
    complexity += description.invariants.length;
    
    // User flows add more complexity
    complexity += description.userFlows.reduce((sum, flow) => sum + flow.steps.length, 0);
    
    return complexity;
  }

  /**
   * Analyze component dependencies
   * @param {Array} dependencies - Dependency declarations
   * @returns {Object} Dependency analysis
   */
  static analyzeDependencies(dependencies) {
    const required = dependencies.filter(dep => dep.required);
    const optional = dependencies.filter(dep => !dep.required);
    
    return {
      total: dependencies.length,
      required: required.length,
      optional: optional.length,
      types: [...new Set(dependencies.map(dep => dep.type))],
      byType: this.groupBy(dependencies, 'type'),
      hasDefaults: optional.filter(dep => dep.default !== undefined).length,
      dependencies: dependencies.map(dep => ({
        name: dep.name,
        type: dep.type,
        required: dep.required,
        hasDefault: dep.default !== undefined,
        description: dep.description
      }))
    };
  }

  /**
   * Analyze DOM structure
   * @param {Array} domStructure - DOM structure declarations
   * @returns {Object} DOM analysis
   */
  static analyzeDOMStructure(domStructure) {
    const creates = domStructure.filter(dom => dom.type === 'creates');
    const contains = domStructure.filter(dom => dom.type === 'contains');
    
    return {
      total: domStructure.length,
      creates: creates.length,
      contains: contains.length,
      selectors: domStructure.map(dom => dom.selector),
      hasAttributes: domStructure.filter(dom => dom.attributes).length,
      hasHierarchy: domStructure.filter(dom => dom.within).length,
      elements: domStructure.map(dom => ({
        type: dom.type,
        selector: dom.selector,
        attributes: dom.attributes || {},
        within: dom.within,
        description: dom.description
      }))
    };
  }

  /**
   * Analyze state properties
   * @param {Array} stateProperties - State property declarations
   * @returns {Object} State analysis
   */
  static analyzeStateProperties(stateProperties) {
    return {
      total: stateProperties.length,
      types: [...new Set(stateProperties.map(prop => prop.type))],
      hasDefaults: stateProperties.filter(prop => prop.default !== undefined).length,
      hasConstraints: stateProperties.filter(prop => prop.constraints).length,
      byType: this.groupBy(stateProperties, 'type'),
      properties: stateProperties.map(prop => ({
        property: prop.property,
        type: prop.type,
        hasDefault: prop.default !== undefined,
        hasConstraints: !!prop.constraints,
        description: prop.description
      }))
    };
  }

  /**
   * Analyze events
   * @param {Array} events - Event declarations
   * @returns {Object} Event analysis
   */
  static analyzeEvents(events) {
    const emits = events.filter(event => event.type === 'emits');
    const listens = events.filter(event => event.type === 'listens');
    
    return {
      total: events.length,
      emits: emits.length,
      listens: listens.length,
      payloadTypes: [...new Set(events.map(event => event.payloadType))],
      eventNames: [...new Set(events.map(event => event.event))],
      byType: {
        emits: emits.map(e => ({ event: e.event, payloadType: e.payloadType })),
        listens: listens.map(e => ({ event: e.event, payloadType: e.payloadType }))
      }
    };
  }

  /**
   * Analyze user interactions
   * @param {Array} userInteractions - User interaction declarations
   * @returns {Object} Interaction analysis
   */
  static analyzeUserInteractions(userInteractions) {
    return {
      total: userInteractions.length,
      interactions: [...new Set(userInteractions.map(ui => ui.interaction))],
      hasValidators: userInteractions.filter(ui => typeof ui.validator === 'function').length,
      details: userInteractions.map(ui => ({
        interaction: ui.interaction,
        hasValidator: typeof ui.validator === 'function'
      }))
    };
  }

  /**
   * Analyze actor communication
   * @param {Array} actorCommunication - Actor communication declarations
   * @returns {Object} Actor communication analysis
   */
  static analyzeActorCommunication(actorCommunication) {
    const sends = actorCommunication.filter(comm => comm.type === 'sends');
    const receives = actorCommunication.filter(comm => comm.type === 'receives');
    
    return {
      total: actorCommunication.length,
      sends: sends.length,
      receives: receives.length,
      actors: [...new Set(actorCommunication.map(comm => comm.actorId))],
      messageTypes: [...new Set(actorCommunication.map(comm => comm.messageType))],
      byActor: this.groupBy(actorCommunication, 'actorId'),
      byType: {
        sends: sends.map(s => ({ actorId: s.actorId, messageType: s.messageType })),
        receives: receives.map(r => ({ actorId: r.actorId, messageType: r.messageType }))
      }
    };
  }

  /**
   * Analyze user flows
   * @param {Array} userFlows - User flow declarations
   * @returns {Object} User flow analysis
   */
  static analyzeUserFlows(userFlows) {
    return {
      total: userFlows.length,
      totalSteps: userFlows.reduce((sum, flow) => sum + flow.steps.length, 0),
      averageSteps: userFlows.length > 0 ? 
        Math.round(userFlows.reduce((sum, flow) => sum + flow.steps.length, 0) / userFlows.length) : 0,
      stepTypes: this.extractStepTypes(userFlows),
      flows: userFlows.map(flow => ({
        name: flow.name,
        stepCount: flow.steps.length,
        stepTypes: [...new Set(flow.steps.map(step => step.type))]
      }))
    };
  }

  /**
   * Extract unique step types from user flows
   * @param {Array} userFlows - User flows
   * @returns {Array} Step types
   */
  static extractStepTypes(userFlows) {
    const stepTypes = new Set();
    userFlows.forEach(flow => {
      flow.steps.forEach(step => {
        stepTypes.add(step.type);
      });
    });
    return [...stepTypes];
  }

  /**
   * Analyze invariants
   * @param {Array} invariants - Invariant declarations
   * @returns {Object} Invariant analysis
   */
  static analyzeInvariants(invariants) {
    return {
      total: invariants.length,
      hasCheckers: invariants.filter(inv => typeof inv.checker === 'function').length,
      names: invariants.map(inv => inv.name),
      details: invariants.map(inv => ({
        name: inv.name,
        hasChecker: typeof inv.checker === 'function'
      }))
    };
  }

  /**
   * Analyze contracts
   * @param {Array} contracts - Contract declarations
   * @returns {Object} Contract analysis
   */
  static analyzeContracts(contracts) {
    return {
      total: contracts.length,
      interfaces: contracts.filter(contract => contract.type === 'interface').map(c => c.name),
      byType: this.groupBy(contracts, 'type')
    };
  }

  /**
   * Group array of objects by property
   * @param {Array} array - Array to group
   * @param {string} property - Property to group by
   * @returns {Object} Grouped object
   */
  static groupBy(array, property) {
    return array.reduce((groups, item) => {
      const key = item[property];
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});
  }

  /**
   * Validate component against expected patterns
   * @param {Object} description - Parsed description
   * @returns {Object} Validation result
   */
  static validateComponent(description) {
    const issues = [];
    const recommendations = [];

    // Check for MVVM pattern compliance
    if (description.metadata.hasState && !description.metadata.hasEvents) {
      issues.push('Component has state but no events - may violate MVVM pattern');
    }

    // Check for actor communication without dependencies
    if (description.metadata.hasActorCommunication && !description.dependencies.dependencies.some(dep => dep.type === 'ActorSpace')) {
      issues.push('Component communicates with actors but does not require ActorSpace');
    }

    // Check for DOM manipulation without DOM dependency
    if (description.metadata.hasDOMStructure && !description.dependencies.dependencies.some(dep => dep.type === 'HTMLElement')) {
      recommendations.push('Component creates DOM elements - consider requiring HTMLElement dependency');
    }

    // Check for user interactions without events
    if (description.metadata.hasUserInteractions && !description.metadata.hasEvents) {
      recommendations.push('Component handles user interactions but emits no events');
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations
    };
  }
}