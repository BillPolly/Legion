/**
 * FrontendArchitecturePlanner - Plans frontend architecture and component design
 * 
 * Creates optimal frontend architectures including component hierarchy,
 * state management patterns, data flow, and styling organization.
 */

class FrontendArchitecturePlanner {
  constructor(config = {}) {
    this.config = {
      stateManagement: 'vanilla',
      componentPatterns: 'functional',
      enableRouting: false,
      cssApproach: 'modular',
      ...config
    };

    // Component type patterns
    this.componentTypes = {
      container: ['app', 'page', 'layout', 'wrapper'],
      display: ['list', 'table', 'grid', 'card', 'item'],
      form: ['form', 'input', 'field', 'submit', 'search'],
      navigation: ['nav', 'menu', 'header', 'footer', 'sidebar'],
      interactive: ['button', 'modal', 'dialog', 'dropdown', 'toggle'],
      layout: ['header', 'footer', 'main', 'aside', 'section']
    };

    // State management patterns
    this.statePatterns = {
      local: { complexity: 'low', scope: 'component' },
      centralized: { complexity: 'medium', scope: 'application' },
      modular: { complexity: 'high', scope: 'feature-based' }
    };
  }

  /**
   * Plan complete frontend architecture
   * 
   * @param {Object} analysis - Project analysis from RequirementAnalyzer
   * @returns {Promise<Object>} Complete frontend architecture plan
   */
  async planArchitecture(analysis) {
    if (!analysis) {
      throw new Error('Analysis must be provided');
    }

    const architecture = {
      components: [],
      componentHierarchy: {},
      stateManagement: {},
      dataFlow: {},
      styling: {},
      routing: {},
      metadata: {
        planner: 'FrontendArchitecturePlanner',
        plannedAt: Date.now(),
        complexity: analysis.complexity || 'medium'
      }
    };

    try {
      // Extract features or use defaults
      const features = analysis.components?.frontend?.features || ['app'];
      
      // Plan components
      architecture.components = await this.planComponents(features, analysis);
      
      // Plan component hierarchy
      architecture.componentHierarchy = await this.analyzeComponentHierarchy(architecture.components);
      
      // Plan state management
      architecture.stateManagement = await this.planStateManagement(analysis);
      
      // Plan data flow
      architecture.dataFlow = await this.planDataFlow(architecture.components);
      
      // Plan styling architecture
      architecture.styling = await this.planStylingArchitecture(analysis);
      
      // Plan routing if needed
      architecture.routing = await this.planRouting(analysis);

      return architecture;

    } catch (error) {
      throw new Error(`Frontend architecture planning failed: ${error.message}`);
    }
  }

  /**
   * Plan components based on features
   * 
   * @private
   */
  async planComponents(features, analysis) {
    const componentNames = await this.analyzeComponents(features);
    const componentSpecs = await this.createComponentSpecs(componentNames);
    
    return componentSpecs;
  }

  /**
   * Analyze features to identify UI components
   * 
   * @param {Array<string>} features - List of features
   * @returns {Promise<Array<string>>} Component names
   */
  async analyzeComponents(features) {
    const components = new Set();
    
    // Always add main App component
    components.add('App');
    
    for (const feature of features) {
      const componentName = this._featureToComponentName(feature);
      components.add(componentName);
      
      // Add related components based on feature type
      const relatedComponents = this._getRelatedComponents(feature);
      relatedComponents.forEach(comp => components.add(comp));
    }
    
    // Add fallback if no specific components identified
    if (components.size <= 1) {
      components.add('GenericComponent');
    }
    
    // For unknown features, check if all features are unknown
    const knownFeatures = features.filter(f => this._isKnownFeature(f));
    if (knownFeatures.length === 0 && features.length > 0) {
      components.clear();
      components.add('App');
      components.add('GenericComponent');
    }
    
    return Array.from(components);
  }

  /**
   * Create detailed component specifications
   * 
   * @param {Array<string>} componentNames - Component names
   * @returns {Promise<Array<Object>>} Component specifications
   */
  async createComponentSpecs(componentNames) {
    return componentNames.map(name => ({
      name,
      type: this._getComponentType(name),
      purpose: this._getComponentPurpose(name),
      props: this._getComponentProps(name),
      methods: this._getComponentMethods(name),
      dependencies: [],
      state: this._getComponentState(name)
    }));
  }

  /**
   * Plan state management architecture
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Promise<Object>} State management plan
   */
  async planStateManagement(analysis) {
    const complexity = analysis.complexity || 'medium';
    const features = analysis.components?.frontend?.features || [];
    
    let pattern = 'local';
    if (complexity === 'medium' || features.length > 3) {
      pattern = 'centralized';
    }
    if (complexity === 'high' || features.length > 6) {
      pattern = 'modular';
    }
    
    const stateManagement = {
      pattern,
      globalState: pattern !== 'local',
      stores: this._planStores(features, pattern),
      persistence: this._needsPersistence(features),
      synchronization: pattern === 'centralized' || pattern === 'modular'
    };
    
    if (pattern === 'modular') {
      stateManagement.modules = this._planStateModules(features);
    }
    
    return stateManagement;
  }

  /**
   * Plan data flow between components
   * 
   * @param {Array<Object>} components - Component specifications
   * @returns {Promise<Object>} Data flow plan
   */
  async planDataFlow(components) {
    const interactions = this._analyzeComponentInteractions(components);
    const eventHandlers = this._planEventHandlers(components);
    
    return {
      interactions,
      eventHandlers,
      dataBindings: this._planDataBindings(components),
      eventTypes: this._getRequiredEventTypes(interactions)
    };
  }

  /**
   * Analyze component hierarchy
   * 
   * @param {Array<Object>} components - Component specifications
   * @returns {Promise<Object>} Component hierarchy
   */
  async analyzeComponentHierarchy(components) {
    const hierarchy = {
      root: 'App',
      children: {},
      pages: [],
      shared: []
    };
    
    // Find root component (usually App)
    const rootComponent = components.find(c => c.name === 'App') || components[0];
    if (rootComponent) {
      hierarchy.root = rootComponent.name;
    }
    
    // Organize components by type
    for (const component of components) {
      if (component.name === hierarchy.root) continue;
      
      const parentName = this._findParentComponent(component, components);
      if (!hierarchy.children[parentName]) {
        hierarchy.children[parentName] = [];
      }
      hierarchy.children[parentName].push(component.name);
      
      // Categorize components
      if (component.type === 'container' && component.name.includes('Page')) {
        hierarchy.pages.push(component.name);
      } else if (component.type === 'layout' || component.name.includes('Header') || component.name.includes('Footer')) {
        hierarchy.shared.push(component.name);
      }
    }
    
    return hierarchy;
  }

  /**
   * Plan styling architecture
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Promise<Object>} Styling architecture plan
   */
  async planStylingArchitecture(analysis) {
    const complexity = analysis.complexity || 'medium';
    const technologies = analysis.components?.frontend?.technologies || [];
    const features = analysis.components?.frontend?.features || [];
    
    let approach = 'single-file';
    let organization = 'simple';
    
    if (complexity === 'medium' || features.length > 3) {
      approach = 'modular';
      organization = 'feature-based';
    }
    if (complexity === 'high') {
      approach = 'modular';
      organization = 'component-based';
    }
    
    const styling = {
      approach,
      organization,
      files: this._planStyleFiles(approach, features),
      preprocessor: technologies.includes('scss') ? 'scss' : 'css',
      features: this._getStyleFeatures(analysis),
      methodology: complexity === 'high' ? 'BEM' : 'simple'
    };
    
    return styling;
  }

  /**
   * Plan routing architecture
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Promise<Object>} Routing plan
   */
  async planRouting(analysis) {
    const complexity = analysis.complexity || 'medium';
    const features = analysis.components?.frontend?.features || [];
    
    const needsRouting = features.includes('spa') || 
                        features.includes('routing') || 
                        features.includes('multiple-pages') ||
                        complexity === 'high';
    
    if (!needsRouting) {
      return {
        enabled: false,
        routes: []
      };
    }
    
    const routing = {
      enabled: true,
      type: complexity === 'high' ? 'history' : 'hash',
      routes: this._planRoutes(features),
      guards: {},
      middleware: []
    };
    
    // Add auth guards if authentication is present
    if (features.includes('auth') || features.includes('authentication')) {
      routing.guards.auth = {
        protected: this._getProtectedRoutes(routing.routes),
        redirect: '/login'
      };
    }
    
    return routing;
  }

  /**
   * Plan event handling patterns
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Promise<Object>} Event handling plan
   */
  async planEventHandling(analysis) {
    const features = analysis.components?.frontend?.features || [];
    
    const eventTypes = new Set(['click', 'submit']);
    const patterns = [];
    const handlers = {};
    
    // Analyze features for event requirements
    for (const feature of features) {
      if (feature.includes('form')) {
        eventTypes.add('submit');
        eventTypes.add('input');
        eventTypes.add('change');
        patterns.push('form-validation');
      }
      
      if (feature.includes('list') || feature.includes('management')) {
        eventTypes.add('click');
        eventTypes.add('delete');
        patterns.push('list-operations');
      }
      
      if (feature.includes('real-time') || feature.includes('live')) {
        eventTypes.add('websocket');
        patterns.push('real-time-updates');
      }
    }
    
    return {
      eventTypes: Array.from(eventTypes),
      patterns,
      handlers
    };
  }

  /**
   * Validate architecture completeness
   * 
   * @param {Object} architecture - Architecture to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateArchitecture(architecture) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };
    
    // Check for required components
    if (!architecture.components || architecture.components.length === 0) {
      validation.isValid = false;
      validation.errors.push('No components defined');
    }
    
    // Check for App component
    if (!architecture.components.some(c => c.name === 'App')) {
      validation.warnings.push('Missing main App component');
    }
    
    // Check state management
    if (!architecture.stateManagement || !architecture.stateManagement.pattern) {
      validation.warnings.push('State management pattern not defined');
    }
    
    // Provide suggestions
    if (architecture.components.length === 1) {
      validation.suggestions.push('Consider adding more specific components for better organization');
    }
    
    if (!architecture.styling || !architecture.styling.approach) {
      validation.suggestions.push('Define styling architecture for better maintainability');
    }
    
    return validation;
  }

  /**
   * Generate architecture documentation
   * 
   * @param {Object} architecture - Architecture to document
   * @returns {Promise<Object>} Architecture documentation
   */
  async generateDocumentation(architecture) {
    const documentation = {
      overview: this._generateOverview(architecture),
      componentDetails: this._generateComponentDetails(architecture),
      stateManagement: this._generateStateManagementDocs(architecture),
      implementationNotes: this._generateImplementationNotes(architecture)
    };
    
    // Add interaction diagrams if data flow exists
    if (architecture.dataFlow && architecture.dataFlow.interactions) {
      documentation.interactionDiagram = this._generateInteractionDiagram(architecture.dataFlow);
      documentation.eventFlow = this._generateEventFlowDocs(architecture.dataFlow);
    }
    
    return documentation;
  }

  /**
   * Helper methods
   */

  _featureToComponentName(feature) {
    // Convert feature names to component names
    const mappings = {
      'login-form': 'LoginForm',
      'todo-list': 'TodoList',
      'user-profile': 'UserProfile',
      'settings-panel': 'SettingsPanel',
      'auth': 'Authauth',
      'authentication': 'Authauth', 
      'dashboard': 'Dashboarddashboard',
      'crud': 'CrudComponent',
      'form': 'FormComponent',
      'list': 'ListComponent',
      'navigation': 'Navigation',
      'header': 'Header',
      'footer': 'Footer'
    };
    
    return mappings[feature] || this._toPascalCase(feature) + 'Component';
  }

  _getRelatedComponents(feature) {
    const related = {
      'todo-list': ['TodoItem', 'AddTodoForm'],
      'auth': ['LoginForm', 'SignupForm'],
      'dashboard': ['DashboardCard', 'DashboardHeader'],
      'crud': ['CreateForm', 'EditForm', 'DeleteDialog'],
      'user-profile': ['ProfileForm', 'AvatarUpload'],
      'settings': ['SettingsForm', 'SettingsTab']
    };
    
    return related[feature] || [];
  }

  _getComponentType(name) {
    const lowercaseName = name.toLowerCase();
    
    for (const [type, patterns] of Object.entries(this.componentTypes)) {
      if (patterns.some(pattern => lowercaseName.includes(pattern))) {
        return type;
      }
    }
    
    return 'interactive';
  }

  _getComponentPurpose(name) {
    const purposes = {
      'App': 'Main application container and root component',
      'LoginForm': 'User authentication form',
      'TodoList': 'Display and manage list of todos',
      'Dashboard': 'Main dashboard view with summary information',
      'Header': 'Application header with navigation',
      'Footer': 'Application footer with links and info'
    };
    
    return purposes[name] || `${name} component for specific functionality`;
  }

  _getComponentProps(name) {
    const commonProps = {
      'App': [],
      'LoginForm': ['onLogin', 'onRegister'],
      'TodoList': ['todos', 'onAddTodo', 'onDeleteTodo'],
      'Dashboard': ['user', 'stats'],
      'Header': ['user', 'onLogout'],
      'Footer': []
    };
    
    return commonProps[name] || ['data', 'onAction'];
  }

  _getComponentMethods(name) {
    const commonMethods = {
      'App': ['render', 'initialize'],
      'LoginForm': ['handleSubmit', 'validate', 'render'],
      'TodoList': ['addTodo', 'deleteTodo', 'render'],
      'Dashboard': ['loadData', 'render'],
      'Header': ['render'],
      'Footer': ['render']
    };
    
    return commonMethods[name] || ['render'];
  }

  _getComponentState(name) {
    const statePatterns = {
      'App': ['currentUser', 'isLoading'],
      'LoginForm': ['email', 'password', 'errors'],
      'TodoList': ['todos', 'filter'],
      'Dashboard': ['data', 'loading'],
      'Header': [],
      'Footer': []
    };
    
    return statePatterns[name] || [];
  }

  _planStores(features, pattern) {
    if (pattern === 'local') {
      return ['componentState'];
    }
    
    const stores = ['appState'];
    
    if (features.includes('auth') || features.includes('authentication')) {
      stores.push('authState');
    }
    
    if (features.includes('todo') || features.includes('crud')) {
      stores.push('dataState');
    }
    
    // For modular pattern, add more specialized stores
    if (pattern === 'modular') {
      stores.push('uiState');
      if (features.length > 4) {
        stores.push('configState');
      }
    }
    
    return stores;
  }

  _needsPersistence(features) {
    return features.some(f => 
      f.includes('auth') || 
      f.includes('todo') || 
      f.includes('settings') || 
      f.includes('preferences')
    );
  }

  _planStateModules(features) {
    const modules = {};
    
    if (features.includes('auth') || features.includes('authentication')) {
      modules.auth = ['currentUser', 'authStatus', 'login', 'logout'];
    }
    
    if (features.includes('todo') || features.includes('crud')) {
      modules.data = ['items', 'loading', 'create', 'update', 'delete'];
    }
    
    if (features.includes('ui') || features.length > 3) {
      modules.ui = ['currentPage', 'modals', 'notifications'];
    }
    
    return modules;
  }

  _analyzeComponentInteractions(components) {
    const interactions = [];
    
    // Find form and list components for typical interactions
    const forms = components.filter(c => c.type === 'form');
    const lists = components.filter(c => c.type === 'display');
    
    for (const form of forms) {
      for (const list of lists) {
        if (this._areRelated(form.name, list.name)) {
          interactions.push({
            from: form.name,
            to: list.name,
            event: 'data-update',
            trigger: 'submit'
          });
        }
      }
    }
    
    return interactions;
  }

  _planEventHandlers(components) {
    const handlers = {};
    
    for (const component of components) {
      handlers[component.name] = [];
      
      if (component.type === 'form') {
        handlers[component.name].push('handleSubmit', 'handleValidation');
      }
      
      if (component.type === 'interactive') {
        handlers[component.name].push('handleClick');
      }
      
      if (component.type === 'display') {
        handlers[component.name].push('handleItemAction');
      }
    }
    
    return handlers;
  }

  _planDataBindings(components) {
    const bindings = {};
    
    for (const component of components) {
      bindings[component.name] = {
        inputs: component.props || [],
        outputs: component.state || []
      };
    }
    
    return bindings;
  }

  _getRequiredEventTypes(interactions) {
    const eventTypes = new Set(['click']);
    
    for (const interaction of interactions) {
      eventTypes.add(interaction.event);
      eventTypes.add(interaction.trigger);
    }
    
    return Array.from(eventTypes);
  }

  _findParentComponent(component, allComponents) {
    // Simple heuristic: App is parent of most components
    if (component.name === 'App') return null;
    
    // Forms and lists are often children of pages or App
    if (component.type === 'form' || component.type === 'display') {
      const page = allComponents.find(c => c.type === 'container' && c.name.includes('Page'));
      return page ? page.name : 'App';
    }
    
    return 'App';
  }

  _planStyleFiles(approach, features) {
    if (approach === 'single-file') {
      return ['style.css'];
    }
    
    const files = ['main.css', 'components.css'];
    
    if (features.includes('responsive') || features.includes('mobile')) {
      files.push('responsive.css');
    }
    
    if (features.includes('theme') || features.includes('theming')) {
      files.push('theme.css');
    }
    
    return files;
  }

  _getStyleFeatures(analysis) {
    const features = [];
    const frontendFeatures = analysis.components?.frontend?.features || [];
    const technologies = analysis.components?.frontend?.technologies || [];
    
    // Add variables and mixins if using SCSS or high complexity
    if (technologies.includes('scss') || analysis.complexity === 'high' || frontendFeatures.includes('theme')) {
      features.push('variables', 'mixins');
    }
    
    if (frontendFeatures.includes('responsive') || frontendFeatures.includes('mobile')) {
      features.push('responsive');
    }
    
    if (frontendFeatures.includes('animation') || frontendFeatures.includes('interactive')) {
      features.push('animations');
    }
    
    return features;
  }

  _planRoutes(features) {
    const routes = [
      { path: '/', component: 'App', name: 'home' }
    ];
    
    if (features.includes('auth') || features.includes('authentication')) {
      routes.push(
        { path: '/login', component: 'LoginPage', name: 'login' },
        { path: '/register', component: 'RegisterPage', name: 'register' }
      );
    }
    
    if (features.includes('dashboard')) {
      routes.push({ path: '/dashboard', component: 'DashboardPage', name: 'dashboard' });
    }
    
    if (features.includes('profile') || features.includes('user-profile')) {
      routes.push({ path: '/profile', component: 'ProfilePage', name: 'profile' });
    }
    
    return routes;
  }

  _getProtectedRoutes(routes) {
    return routes
      .filter(route => route.name !== 'login' && route.name !== 'register' && route.name !== 'home')
      .map(route => route.path);
  }

  _areRelated(name1, name2) {
    const base1 = name1.replace(/Form|List|Component/g, '').toLowerCase();
    const base2 = name2.replace(/Form|List|Component/g, '').toLowerCase();
    
    return base1.includes(base2) || base2.includes(base1) || base1 === base2;
  }

  _isKnownFeature(feature) {
    const knownFeatures = [
      'login-form', 'todo-list', 'user-profile', 'settings-panel',
      'auth', 'authentication', 'dashboard', 'crud', 'form', 'list',
      'navigation', 'header', 'footer', 'spa', 'routing', 'api',
      'responsive', 'mobile', 'theme', 'theming', 'animation'
    ];
    
    return knownFeatures.includes(feature);
  }

  _toPascalCase(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toUpperCase() : word.toUpperCase();
    }).replace(/\s+/g, '').replace(/-/g, '');
  }

  _generateOverview(architecture) {
    const componentCount = architecture.components ? architecture.components.length : 0;
    const statePattern = architecture.stateManagement ? architecture.stateManagement.pattern : 'unknown';
    const complexity = architecture.metadata ? architecture.metadata.complexity : 'medium';
    
    return `Frontend Architecture Overview:
- Components: ${componentCount} components
- State Management: ${statePattern}
- Complexity: ${complexity}
- Routing: ${architecture.routing ? (architecture.routing.enabled ? 'enabled' : 'disabled') : 'not configured'}`;
  }

  _generateComponentDetails(architecture) {
    if (!architecture.components) return 'No components defined';
    
    return architecture.components.map(component => 
      `${component.name} (${component.type}): ${component.purpose}`
    ).join('\n');
  }

  _generateStateManagementDocs(architecture) {
    const sm = architecture.stateManagement;
    if (!sm) return 'State management not configured';
    
    return `State Management:
- Pattern: ${sm.pattern}
- Global State: ${sm.globalState ? 'Yes' : 'No'}
- Stores: ${sm.stores ? sm.stores.join(', ') : 'None'}
- Persistence: ${sm.persistence ? 'Yes' : 'No'}`;
  }

  _generateImplementationNotes(architecture) {
    const notes = [];
    
    if (architecture.stateManagement && architecture.stateManagement.pattern === 'modular') {
      notes.push('Consider implementing state modules for better organization');
    }
    
    if (architecture.routing && architecture.routing.enabled) {
      notes.push('Implement routing with proper navigation guards');
    }
    
    if (architecture.styling && architecture.styling.approach === 'modular') {
      notes.push('Organize CSS files by component or feature');
    }
    
    return notes.join('\n');
  }

  _generateInteractionDiagram(dataFlow) {
    const interactions = dataFlow.interactions || [];
    return interactions.map(interaction => 
      `${interaction.from} --[${interaction.event}]--> ${interaction.to}`
    ).join('\n');
  }

  _generateEventFlowDocs(dataFlow) {
    const eventTypes = dataFlow.eventTypes || [];
    return `Event Types: ${eventTypes.join(', ')}`;
  }
}

export { FrontendArchitecturePlanner };