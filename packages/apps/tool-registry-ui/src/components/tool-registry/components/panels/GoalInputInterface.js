/**
 * GoalInputInterface Component
 * Provides enhanced goal input with validation and context configuration
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

/**
 * Model - Manages goal and context state
 */
class GoalInputModel {
  constructor() {
    this.state = {
      goal: '',
      context: {
        constraints: [],
        preferences: {},
        availableTools: [],
        environment: 'development'
      },
      validation: {
        valid: false,
        errors: [],
        suggestions: []
      }
    };
    
    this.listeners = new Set();
  }

  getState(key) {
    return key ? this.state[key] : { ...this.state };
  }

  updateState(key, value) {
    this.state[key] = value;
    this.notifyListeners({ [key]: value });
  }

  setGoal(goal) {
    this.state.goal = goal;
    this.notifyListeners({ goal });
  }

  getGoal() {
    return this.state.goal;
  }

  setContext(context) {
    this.state.context = { ...this.state.context, ...context };
    this.notifyListeners({ context: this.state.context });
  }

  getContext() {
    return { ...this.state.context };
  }

  addConstraint(type, value) {
    this.state.context.constraints.push({ type, value });
    this.notifyListeners({ context: this.state.context });
  }

  removeConstraint(index) {
    this.state.context.constraints.splice(index, 1);
    this.notifyListeners({ context: this.state.context });
  }

  setPreference(key, value) {
    this.state.context.preferences[key] = value;
    this.notifyListeners({ context: this.state.context });
  }

  setAvailableTools(tools) {
    this.state.context.availableTools = tools;
    this.notifyListeners({ context: this.state.context });
  }

  setEnvironment(env) {
    this.state.context.environment = env;
    this.notifyListeners({ context: this.state.context });
  }

  clearContext() {
    this.state.context = {
      constraints: [],
      preferences: {},
      availableTools: [],
      environment: 'development'
    };
    this.notifyListeners({ context: this.state.context });
  }

  setValidation(validation) {
    this.state.validation = validation;
    this.notifyListeners({ validation });
  }

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  notifyListeners(changes) {
    this.listeners.forEach(listener => listener(changes));
  }

  reset() {
    this.state = {
      goal: '',
      context: {
        constraints: [],
        preferences: {},
        availableTools: [],
        environment: 'development'
      },
      validation: {
        valid: false,
        errors: [],
        suggestions: []
      }
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders UI and handles DOM updates
 */
class GoalInputView {
  constructor(container, viewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="goal-input-interface">
        <div class="goal-section">
          <h3>Define Your Goal</h3>
          <div class="goal-input-wrapper">
            <textarea 
              class="goal-input-textarea"
              placeholder="Describe your goal in detail. Be specific about what you want to achieve..."
              maxlength="500"
              rows="4"
            ></textarea>
            <div class="character-count">0 / 500</div>
          </div>
          <div class="validation-feedback"></div>
          
          <div class="goal-templates">
            <label>Quick Templates:</label>
            <select class="template-selector">
              <option value="">Select a template...</option>
              <option value="REST API">REST API Service</option>
              <option value="Web App">Web Application</option>
              <option value="CLI Tool">Command Line Tool</option>
              <option value="Data Pipeline">Data Processing Pipeline</option>
              <option value="Mobile App">Mobile Application</option>
            </select>
          </div>
        </div>

        <div class="context-configuration">
          <h3>Context & Constraints</h3>
          
          <div class="constraints-section">
            <h4>Technology Constraints</h4>
            <div class="constraint-input-group">
              <input 
                type="text" 
                class="constraint-input" 
                placeholder="e.g., Node.js, React, PostgreSQL"
              />
              <button class="add-constraint-button">Add</button>
            </div>
            <div class="constraints-list"></div>
          </div>

          <div class="preferences-section">
            <h4>Preferences</h4>
            <div class="preference-group">
              <label>Testing Framework:</label>
              <select class="testing-framework-select">
                <option value="">None specified</option>
                <option value="Jest">Jest</option>
                <option value="Mocha">Mocha</option>
                <option value="Vitest">Vitest</option>
                <option value="Pytest">Pytest</option>
              </select>
            </div>
            <div class="preference-group">
              <label>Code Style:</label>
              <select class="code-style-select">
                <option value="">None specified</option>
                <option value="ESLint">ESLint</option>
                <option value="Prettier">Prettier</option>
                <option value="StandardJS">StandardJS</option>
              </select>
            </div>
          </div>

          <div class="environment-section">
            <h4>Environment</h4>
            <select class="environment-select">
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
              <option value="local">Local Only</option>
            </select>
          </div>

          <div class="deadline-section">
            <h4>Timeline</h4>
            <input 
              type="date" 
              class="deadline-input"
              placeholder="Optional deadline"
            />
          </div>
        </div>

        <div class="action-buttons">
          <button class="clear-button">Clear All</button>
          <button class="submit-goal-button" disabled>Create Plan</button>
        </div>

        <div class="suggestions-panel" style="display: none;">
          <h4>Suggestions</h4>
          <ul class="suggestions-list"></ul>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }

  bindEvents() {
    // Goal input
    const textarea = this.container.querySelector('.goal-input-textarea');
    textarea.addEventListener('input', (e) => {
      this.viewModel.handleGoalInput(e.target.value);
      this.updateCharacterCount(e.target.value.length);
    });

    // Template selector
    const templateSelector = this.container.querySelector('.template-selector');
    templateSelector.addEventListener('change', (e) => {
      if (e.target.value) {
        this.viewModel.applyTemplate(e.target.value);
      }
    });

    // Constraint addition
    const constraintInput = this.container.querySelector('.constraint-input');
    const addConstraintBtn = this.container.querySelector('.add-constraint-button');
    
    const addConstraint = () => {
      const value = constraintInput.value.trim();
      if (value) {
        this.viewModel.addConstraint('technology', value);
        constraintInput.value = '';
      }
    };
    
    addConstraintBtn.addEventListener('click', addConstraint);
    constraintInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addConstraint();
      }
    });

    // Preferences
    const testingFramework = this.container.querySelector('.testing-framework-select');
    testingFramework.addEventListener('change', (e) => {
      this.viewModel.setPreference('testingFramework', e.target.value);
    });

    const codeStyle = this.container.querySelector('.code-style-select');
    codeStyle.addEventListener('change', (e) => {
      this.viewModel.setPreference('codeStyle', e.target.value);
    });

    // Environment
    const environment = this.container.querySelector('.environment-select');
    environment.addEventListener('change', (e) => {
      this.viewModel.setEnvironment(e.target.value);
    });

    // Deadline
    const deadline = this.container.querySelector('.deadline-input');
    deadline.addEventListener('change', (e) => {
      if (e.target.value) {
        this.viewModel.addConstraint('deadline', e.target.value);
      }
    });

    // Action buttons
    const clearButton = this.container.querySelector('.clear-button');
    clearButton.addEventListener('click', () => {
      this.viewModel.clearAll();
    });

    const submitButton = this.container.querySelector('.submit-goal-button');
    submitButton.addEventListener('click', () => {
      this.viewModel.submit();
    });
  }

  updateCharacterCount(count) {
    const counter = this.container.querySelector('.character-count');
    counter.textContent = `${count} / 500`;
    
    if (count > 450) {
      counter.classList.add('warning');
    } else {
      counter.classList.remove('warning');
    }
  }

  updateValidationFeedback(validation) {
    const feedback = this.container.querySelector('.validation-feedback');
    
    if (!validation.valid && validation.errors.length > 0) {
      feedback.className = 'validation-feedback error';
      feedback.innerHTML = `
        <span class="error-icon">⚠️</span>
        <span>${validation.errors[0]}</span>
      `;
    } else if (validation.valid && validation.suggestions.length > 0) {
      feedback.className = 'validation-feedback suggestion';
      feedback.innerHTML = `
        <span class="suggestion-icon">💡</span>
        <span>${validation.suggestions[0]}</span>
      `;
    } else if (validation.valid) {
      feedback.className = 'validation-feedback valid';
      feedback.innerHTML = `
        <span class="valid-icon">✓</span>
        <span>Goal is valid</span>
      `;
    } else {
      feedback.className = 'validation-feedback';
      feedback.innerHTML = '';
    }
  }

  updateSubmitButton(enabled) {
    const submitButton = this.container.querySelector('.submit-goal-button');
    submitButton.disabled = !enabled;
  }

  updateConstraintsList(constraints) {
    const list = this.container.querySelector('.constraints-list');
    
    if (constraints.length === 0) {
      list.innerHTML = '<div class="empty-constraints">No constraints added</div>';
      return;
    }
    
    list.innerHTML = constraints.map((constraint, index) => `
      <div class="constraint-item">
        <span class="constraint-type">${constraint.type}:</span>
        <span class="constraint-value">${constraint.value}</span>
        <button class="remove-constraint" data-index="${index}">×</button>
      </div>
    `).join('');
    
    // Bind remove buttons
    list.querySelectorAll('.remove-constraint').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.viewModel.removeConstraint(index);
      });
    });
  }

  updateGoalText(goal) {
    const textarea = this.container.querySelector('.goal-input-textarea');
    textarea.value = goal;
    this.updateCharacterCount(goal.length);
  }

  showSuggestions(suggestions) {
    const panel = this.container.querySelector('.suggestions-panel');
    const list = panel.querySelector('.suggestions-list');
    
    if (suggestions && suggestions.length > 0) {
      list.innerHTML = suggestions.map(s => `<li>${s}</li>`).join('');
      panel.style.display = 'block';
    } else {
      panel.style.display = 'none';
    }
  }

  clearAll() {
    const textarea = this.container.querySelector('.goal-input-textarea');
    textarea.value = '';
    this.updateCharacterCount(0);
    
    const selects = this.container.querySelectorAll('select');
    selects.forEach(select => select.value = select.options[0].value);
    
    const deadline = this.container.querySelector('.deadline-input');
    deadline.value = '';
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 */
class GoalInputViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    
    // Goal templates
    this.templates = {
      'REST API': 'Build a REST API service with the following endpoints:\n- User authentication (login, register, logout)\n- CRUD operations for [resource]\n- Data validation and error handling\n- API documentation',
      'Web App': 'Create a web application with:\n- User interface for [describe UI]\n- Backend services for [describe functionality]\n- Database integration\n- Authentication and authorization',
      'CLI Tool': 'Develop a command-line tool that:\n- Accepts input parameters for [describe inputs]\n- Processes [describe processing]\n- Outputs [describe output format]\n- Includes help documentation',
      'Data Pipeline': 'Build a data processing pipeline that:\n- Ingests data from [source]\n- Transforms data by [describe transformations]\n- Stores results in [destination]\n- Handles errors and logging',
      'Mobile App': 'Create a mobile application with:\n- User interface screens for [list screens]\n- Backend API integration\n- Local data storage\n- Push notifications'
    };
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
    
    // Expose API
    this.exposeAPI();
  }

  exposeAPI() {
    const api = {
      getGoal: this.getGoal.bind(this),
      setGoal: this.setGoal.bind(this),
      validateGoal: this.validateGoal.bind(this),
      getContext: this.getContext.bind(this),
      addConstraint: this.addConstraint.bind(this),
      removeConstraint: this.removeConstraint.bind(this),
      setPreference: this.setPreference.bind(this),
      setAvailableTools: this.setAvailableTools.bind(this),
      setEnvironment: this.setEnvironment.bind(this),
      clearContext: this.clearContext.bind(this),
      submit: this.submit.bind(this),
      analyzeComplexity: this.analyzeComplexity.bind(this),
      detectTechnologies: this.detectTechnologies.bind(this),
      getGoalTemplates: this.getGoalTemplates.bind(this),
      applyTemplate: this.applyTemplate.bind(this),
      getSuggestions: this.getSuggestions.bind(this),
      estimateComplexity: this.estimateComplexity.bind(this),
      validateConstraint: this.validateConstraint.bind(this)
    };
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(api);
    }
    
    this.api = api;
  }

  onModelChange(changes) {
    if ('validation' in changes) {
      this.view.updateValidationFeedback(changes.validation);
      this.view.updateSubmitButton(changes.validation.valid);
    }
    
    if ('context' in changes && changes.context.constraints) {
      this.view.updateConstraintsList(changes.context.constraints);
    }
    
    if ('goal' in changes) {
      if (this.umbilical.onGoalChange) {
        this.umbilical.onGoalChange(changes.goal);
      }
    }
    
    if ('context' in changes) {
      if (this.umbilical.onContextChange) {
        this.umbilical.onContextChange(changes.context);
      }
    }
  }

  handleGoalInput(goal) {
    this.model.setGoal(goal);
    const validation = this.validateGoal(goal);
    this.model.setValidation(validation);
    
    if (validation.valid && this.umbilical.onValidation) {
      this.umbilical.onValidation(validation);
    }
  }

  validateGoal(goal) {
    const errors = [];
    const suggestions = [];
    
    if (!goal || goal.trim().length === 0) {
      errors.push('Goal cannot be empty');
    } else if (goal.length < 10) {
      errors.push('Goal must be at least 10 characters');
    }
    
    // Check for vague goals
    const vagueTerms = ['website', 'app', 'system', 'platform'];
    const goalLower = goal.toLowerCase();
    if (vagueTerms.some(term => goalLower === `make a ${term}` || goalLower === `build a ${term}`)) {
      suggestions.push('Consider adding more specific features and requirements');
    }
    
    // Check for technical jargon that might need clarification
    if (goal.match(/\b(CRUD|API|REST|GraphQL|microservice)\b/i)) {
      suggestions.push('Consider adding more context about the technology stack');
    }
    
    // Check for missing target audience
    if (!goal.match(/\b(user|customer|admin|developer|team)\b/i)) {
      suggestions.push('Consider specifying the target audience');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      suggestions
    };
  }

  analyzeComplexity(goal) {
    const keywords = goal.toLowerCase().split(/\s+/);
    const complexityIndicators = {
      high: ['complete', 'full', 'entire', 'comprehensive', 'enterprise', 'scalable', 'distributed'],
      medium: ['multiple', 'several', 'integration', 'dashboard', 'management'],
      low: ['simple', 'basic', 'minimal', 'prototype', 'demo']
    };
    
    let complexity = 'MEDIUM';
    const suggestions = [];
    
    // Count feature mentions
    const featureCount = (goal.match(/,|and|with|plus/gi) || []).length + 1;
    
    if (featureCount > 5) {
      complexity = 'HIGH';
      suggestions.push('Consider breaking this down into smaller milestones');
    }
    
    // Check complexity indicators
    if (keywords.some(k => complexityIndicators.high.includes(k))) {
      complexity = 'HIGH';
    } else if (keywords.some(k => complexityIndicators.low.includes(k))) {
      complexity = 'LOW';
    }
    
    return { complexity, featureCount, suggestions };
  }

  detectTechnologies() {
    const goal = this.model.getGoal();
    const technologies = [];
    
    const techPatterns = {
      'React': /\breact\b/i,
      'Vue': /\bvue\b/i,
      'Angular': /\bangular\b/i,
      'Node.js': /\bnode(\.?js)?\b/i,
      'Python': /\bpython\b/i,
      'Django': /\bdjango\b/i,
      'Flask': /\bflask\b/i,
      'Express': /\bexpress\b/i,
      'MongoDB': /\bmongodb?\b/i,
      'PostgreSQL': /\bpostgres(ql)?\b/i,
      'MySQL': /\bmysql\b/i,
      'Docker': /\bdocker\b/i,
      'Kubernetes': /\bkubernetes|k8s\b/i,
      'AWS': /\baws|amazon\s+web\s+services\b/i,
      'Redux': /\bredux\b/i,
      'GraphQL': /\bgraphql\b/i,
      'REST': /\brest(ful)?\b/i
    };
    
    for (const [tech, pattern] of Object.entries(techPatterns)) {
      if (pattern.test(goal)) {
        technologies.push(tech);
      }
    }
    
    return technologies;
  }

  estimateComplexity() {
    const goal = this.model.getGoal();
    const analysis = this.analyzeComplexity(goal);
    
    const estimates = {
      LOW: { level: 'LOW', estimatedTasks: 5 },
      MEDIUM: { level: 'MEDIUM', estimatedTasks: 15 },
      HIGH: { level: 'HIGH', estimatedTasks: 30 }
    };
    
    return estimates[analysis.complexity];
  }

  getGoalTemplates() {
    return Object.keys(this.templates).map(name => ({
      name,
      template: this.templates[name]
    }));
  }

  applyTemplate(templateName) {
    const template = this.templates[templateName];
    if (template) {
      this.model.setGoal(template);
      this.view.updateGoalText(template);
      this.handleGoalInput(template);
    }
  }

  getSuggestions(goal) {
    const suggestions = [];
    
    if (goal.length < 20) {
      suggestions.push('Add more specific features and requirements');
    }
    
    if (!goal.match(/\b(user|customer|admin)\b/i)) {
      suggestions.push('Specify the target audience');
    }
    
    if (!goal.match(/\b(data|database|storage)\b/i)) {
      suggestions.push('Consider mentioning data storage requirements');
    }
    
    return suggestions;
  }

  validateConstraint(type, value) {
    if (type === 'deadline') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return { valid: false, error: 'Invalid date format' };
      }
      if (date < new Date()) {
        return { valid: false, error: 'Deadline cannot be in the past' };
      }
    }
    
    return { valid: true };
  }

  // Public API methods
  getGoal() {
    return this.model.getGoal();
  }

  setGoal(goal) {
    this.model.setGoal(goal);
    this.view.updateGoalText(goal);
    this.handleGoalInput(goal);
  }

  getContext() {
    return this.model.getContext();
  }

  addConstraint(type, value) {
    const validation = this.validateConstraint(type, value);
    if (validation.valid) {
      this.model.addConstraint(type, value);
    }
    return validation;
  }

  removeConstraint(index) {
    this.model.removeConstraint(index);
  }

  setPreference(key, value) {
    this.model.setPreference(key, value);
  }

  setAvailableTools(tools) {
    this.model.setAvailableTools(tools);
  }

  setEnvironment(env) {
    this.model.setEnvironment(env);
  }

  clearContext() {
    this.model.clearContext();
  }

  clearAll() {
    this.model.reset();
    this.view.clearAll();
  }

  submit() {
    const goal = this.model.getGoal();
    const validation = this.validateGoal(goal);
    
    if (validation.valid && this.umbilical.onSubmit) {
      this.umbilical.onSubmit({
        goal,
        context: this.model.getContext()
      });
    }
  }

  destroy() {
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
    this.view.container.innerHTML = '';
  }
}

/**
 * GoalInputInterface - Main component class
 */
export class GoalInputInterface {
  static async create(umbilical) {
    // Validate umbilical
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'GoalInputInterface');
    
    // Create MVVM components
    const model = new GoalInputModel();
    const view = new GoalInputView(umbilical.dom, null);
    const viewModel = new GoalInputViewModel(model, view, umbilical);
    
    // Set view's reference to viewModel
    view.viewModel = viewModel;
    
    return viewModel;
  }
}