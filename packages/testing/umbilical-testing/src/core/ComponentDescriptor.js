/**
 * ComponentDescriptor - DSL for components to describe themselves
 * Provides rich language for declaring dependencies, DOM structure, state, events, etc.
 */
export class ComponentDescriptor {
  constructor() {
    this.componentName = '';
    this.componentDescription = '';
    this.config = [];
    this.domStructure = [];
    this.stateProperties = [];
    this.events = [];
    this.userInteractions = [];
    this.actorCommunication = [];
    this.userFlows = [];
    this.invariants = [];
    this.contracts = [];
  }

  /**
   * Set component name
   * @param {string} name - Component name
   */
  name(name) {
    this.componentName = name;
    return this;
  }

  /**
   * Set component description
   * @param {string} description - Component description
   */
  description(description) {
    this.componentDescription = description;
    return this;
  }


  /**
   * Declare a required dependency
   * @param {string} name - Dependency name
   * @param {string} type - Expected type
   * @param {Object} options - Additional options
   */
  requires(name, type, options = {}) {
    this.config.push({
      name,
      type,
      required: true,
      ...options
    });
    return this;
  }

  /**
   * Declare an optional dependency
   * @param {string} name - Dependency name
   * @param {string} type - Expected type
   * @param {Object} options - Additional options including default value
   */
  optional(name, type, options = {}) {
    this.config.push({
      name,
      type,
      required: false,
      ...options
    });
    return this;
  }

  /**
   * Declare DOM elements this component creates
   * @param {string} selector - CSS selector for the element
   * @param {Object} options - Element options (attributes, within, etc.)
   */
  creates(selector, options = {}) {
    this.domStructure.push({
      type: 'creates',
      selector,
      ...options
    });
    return this;
  }

  /**
   * Declare DOM elements this component expects to find
   * @param {string} selector - CSS selector for the element
   * @param {Object} options - Element options
   */
  contains(selector, options = {}) {
    this.domStructure.push({
      type: 'contains',
      selector,
      ...options
    });
    return this;
  }

  /**
   * Declare state properties this component manages
   * @param {string} property - Property name
   * @param {string} type - Property type
   * @param {Object} options - Property options (default, constraints, etc.)
   */
  manages(property, type, options = {}) {
    this.stateProperties.push({
      property,
      type,
      ...options
    });
    return this;
  }

  /**
   * Declare events this component emits
   * @param {string} event - Event name
   * @param {string} payloadType - Payload type
   * @param {Object} options - Event options (description, when, etc.)
   */
  emits(event, payloadType, options = {}) {
    this.events.push({
      type: 'emits',
      event,
      payloadType,
      ...options
    });
    return this;
  }

  /**
   * Declare events this component listens to
   * @param {string} event - Event name
   * @param {string} payloadType - Payload type
   * @param {Object} options - Event options (from, description, etc.)
   */
  listens(event, payloadType, options = {}) {
    this.events.push({
      type: 'listens',
      event,
      payloadType,
      ...options
    });
    return this;
  }

  /**
   * Declare user interactions this component handles
   * @param {string} interaction - Interaction type
   * @param {Function} validator - Validation function
   */
  handles(interaction, validator) {
    this.userInteractions.push({
      interaction,
      validator
    });
    return this;
  }

  /**
   * Declare messages this component sends to actors
   * @param {string} actorId - Target actor ID
   * @param {string} messageType - Message type
   * @param {Object} schema - Message schema
   */
  sendsToActor(actorId, messageType, schema) {
    this.actorCommunication.push({
      type: 'sends',
      actorId,
      messageType,
      schema
    });
    return this;
  }

  /**
   * Declare messages this component receives from actors
   * @param {string} actorId - Source actor ID
   * @param {string} messageType - Message type
   * @param {Object} schema - Message schema
   */
  receivesFromActor(actorId, messageType, schema) {
    this.actorCommunication.push({
      type: 'receives',
      actorId,
      messageType,
      schema
    });
    return this;
  }

  /**
   * Declare user flow
   * @param {string} name - Flow name
   * @param {Array} steps - Flow steps
   */
  flow(name, steps) {
    this.userFlows.push({
      name,
      steps
    });
    return this;
  }

  /**
   * Declare component invariant
   * @param {string} name - Invariant name
   * @param {Function} checker - Invariant checking function
   */
  invariant(name, checker) {
    this.invariants.push({
      name,
      checker
    });
    return this;
  }

  /**
   * Declare interface implementation
   * @param {string} interfaceName - Interface name
   */
  implements(interfaceName) {
    this.contracts.push({
      type: 'interface',
      name: interfaceName
    });
    return this;
  }

  /**
   * Get complete description
   * @returns {Object} Complete component description
   */
  getDescription() {
    return {
      name: this.componentName,
      description: this.componentDescription,
      dependencies: [...this.config],
      domStructure: [...this.domStructure],
      stateProperties: [...this.stateProperties],
      events: [...this.events],
      userInteractions: [...this.userInteractions],
      actorCommunication: [...this.actorCommunication],
      userFlows: [...this.userFlows],
      invariants: [...this.invariants],
      contracts: [...this.contracts]
    };
  }

  /**
   * Validate the description for completeness and consistency
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Check for required fields
    if (this.config.length === 0) {
      warnings.push('No dependencies declared - component may not be properly isolated');
    }

    // Check for DOM structure
    if (this.domStructure.length === 0) {
      warnings.push('No DOM structure declared - component may not render anything');
    }

    // Check for event consistency
    const emittedEvents = this.events.filter(e => e.type === 'emits').map(e => e.event);
    const listenedEvents = this.events.filter(e => e.type === 'listens').map(e => e.event);
    
    // Validate invariants have checker functions
    this.invariants.forEach(invariant => {
      if (typeof invariant.checker !== 'function') {
        errors.push(`Invariant '${invariant.name}' must have a checker function`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate Component Description Language (CDL) from a description
   * @param {Object} description - Component description
   * @returns {Object} CDL representation
   */
  static generateCDL(description) {
    return {
      name: description.summary?.name || description.name || 'UnnamedComponent',
      description: description.summary?.description || description.description || 'No description provided',
      version: '1.0.0',
      architecture: 'MVVM',
      
      summary: {
        totalCapabilities: description.summary?.totalCapabilities || 0,
        complexity: description.summary?.complexity || 0,
        hasState: (description.stateProperties.total || 0) > 0,
        hasEvents: (description.events.total || 0) > 0,
        hasDOM: (description.domStructure.total || 0) > 0,
        hasDependencies: (description.dependencies.total || 0) > 0
      },
      
      dependencies: {
        required: description.dependencies.dependencies?.filter(dep => dep.required) || [],
        optional: description.dependencies.dependencies?.filter(dep => !dep.required) || [],
        total: description.dependencies.total || 0
      },
      
      domStructure: {
        creates: description.domStructure.elements?.filter(el => el.type === 'creates') || [],
        contains: description.domStructure.elements?.filter(el => el.type === 'contains') || [],
        total: description.domStructure.total || 0
      },
      
      stateProperties: {
        properties: description.stateProperties.properties || [],
        total: description.stateProperties.total || 0,
        types: description.stateProperties.properties ? [...new Set(description.stateProperties.properties.map(prop => prop.type))] : []
      },
      
      events: {
        emits: description.events.byType?.emits || [],
        listens: description.events.byType?.listens || [],
        total: description.events.total || 0
      },
      
      capabilities: {
        hasState: (description.stateProperties.total || 0) > 0,
        hasEvents: (description.events.total || 0) > 0,
        hasDOM: (description.domStructure.total || 0) > 0,
        hasDependencies: (description.dependencies.total || 0) > 0,
        complexity: this.calculateComplexityFromDescription(description)
      },
      
      metadata: {
        generatedAt: new Date().toISOString(),
        framework: 'Umbilical Testing Framework',
        version: '1.0.0'
      }
    };
  }

  /**
   * Calculate complexity from description
   * @param {Object} description - Component description
   * @returns {number} Complexity score
   */
  static calculateComplexityFromDescription(description) {
    let complexity = 0;
    complexity += description.dependencies.total || 0;
    complexity += description.domStructure.total || 0;
    complexity += description.stateProperties.total || 0;
    complexity += description.events.total || 0;
    complexity += description.userInteractions.total || 0;
    complexity += description.actorCommunication.total || 0;
    complexity += description.invariants.total || 0;
    return complexity;
  }
}