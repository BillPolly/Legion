/**
 * CodePlanner - Concrete planner for code generation projects
 * 
 * Extends BasePlanner to provide specialized planning for software development
 * projects including frontend, backend, and fullstack applications.
 */

import { BasePlanner } from '../core/BasePlanner.js';
import { PlanStep } from '../models/PlanStep.js';
import { PlanAction } from '../models/PlanAction.js';

class CodePlanner extends BasePlanner {
  constructor(config = {}) {
    super({
      projectTypes: ['frontend', 'backend', 'fullstack'],
      analysisDepth: 'standard',
      ...config
    });

    // Feature keywords mapping
    this.featureKeywords = {
      frontend: {
        form: ['form', 'input', 'submit', 'field', 'validation'],
        list: ['list', 'display', 'show', 'table', 'grid'],
        auth: ['login', 'logout', 'authentication', 'signin', 'signup'],
        navigation: ['navbar', 'menu', 'navigation', 'sidebar', 'header'],
        ui: ['button', 'modal', 'dropdown', 'accordion', 'tabs', 'carousel'],
        data: ['chart', 'graph', 'visualization', 'dashboard'],
        media: ['gallery', 'image', 'video', 'zoom', 'slider']
      },
      backend: {
        api: ['api', 'rest', 'restful', 'endpoint', 'route'],
        database: ['database', 'mongodb', 'mysql', 'postgres', 'storage'],
        auth: ['authentication', 'jwt', 'token', 'session', 'oauth'],
        crud: ['crud', 'create', 'read', 'update', 'delete'],
        realtime: ['websocket', 'realtime', 'real-time', 'socket', 'live'],
        file: ['file', 'upload', 'download', 'storage', 'filesystem']
      }
    };

    // Technology mappings
    this.technologyMappings = {
      frontend: ['html', 'css', 'javascript', 'dom'],
      backend: ['nodejs', 'express', 'http'],
      database: ['mongodb', 'mysql', 'postgresql', 'sqlite'],
      realtime: ['websocket', 'socket.io']
    };
  }

  /**
   * Analyze code project requirements
   * @param {Object} requirements - The requirements to analyze
   * @param {Object} context - The planning context
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeRequirements(requirements, context) {
    // Validate requirements (let BasePlanner handle basic validation)
    if (!requirements || typeof requirements !== 'object') {
      throw new Error('Requirements must be provided as an object');
    }

    if (!requirements.task) {
      throw new Error('Requirements must include a task description');
    }

    // Initialize analysis structure
    const analysis = {
      task: requirements.task,
      projectType: this._determineProjectType(requirements),
      components: {},
      complexity: 'low',
      timestamp: Date.now()
    };

    // Analyze frontend requirements
    if (requirements.requirements?.frontend) {
      analysis.components.frontend = this._analyzeFrontendRequirements(
        requirements.requirements.frontend
      );
    }

    // Analyze backend requirements
    if (requirements.requirements?.backend) {
      analysis.components.backend = this._analyzeBackendRequirements(
        requirements.requirements.backend
      );
    }

    // If no specific requirements, analyze from task description
    if (!requirements.requirements || Object.keys(requirements.requirements).length === 0) {
      analysis.components.frontend = this._analyzeFromTaskDescription(requirements.task);
    }

    // Determine API interface for fullstack and backend projects
    if (analysis.projectType === 'fullstack' || analysis.projectType === 'backend') {
      analysis.apiInterface = this._analyzeApiInterface(analysis.components, requirements);
    }

    // Analyze security requirements
    analysis.security = this._analyzeSecurityRequirements(requirements, analysis.components);

    // Analyze special features
    analysis.features = this._analyzeSpecialFeatures(requirements, analysis.components);

    // Determine complexity
    analysis.complexity = this._determineComplexity(analysis);

    // Suggest architecture
    analysis.suggestedArchitecture = this._suggestArchitecture(analysis);

    // Update context with analysis results
    context.projectType = analysis.projectType;
    if (analysis.components.frontend?.technologies) {
      for (const tech of analysis.components.frontend.technologies) {
        context.addTechnology('frontend', tech);
      }
    }
    if (analysis.components.backend?.technologies) {
      for (const tech of analysis.components.backend.technologies) {
        context.addTechnology('backend', tech);
      }
    }

    return analysis;
  }

  /**
   * Generate plan structure based on analysis
   * @param {Object} analysis - The requirements analysis
   * @param {Object} context - The planning context
   * @returns {Promise<Object>} Plan structure
   */
  async generatePlanStructure(analysis, context) {
    const steps = [];

    // 1. Project Setup Step
    steps.push(this._createProjectSetupStep(analysis));

    // 2. Frontend Steps
    if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
      steps.push(...this._createFrontendSteps(analysis));
    }

    // 3. Backend Steps
    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      steps.push(...this._createBackendSteps(analysis));
    }

    // 4. Integration Steps (for fullstack)
    if (analysis.projectType === 'fullstack') {
      steps.push(this._createIntegrationStep(analysis));
    }

    // 5. Testing and Documentation
    steps.push(this._createTestingStep(analysis));
    steps.push(this._createDocumentationStep(analysis));

    // Set execution order
    const executionOrder = steps.map(step => step.id);

    return {
      steps,
      executionOrder,
      metadata: {
        generatedAt: Date.now(),
        analysisUsed: analysis,
        plannerType: 'CodePlanner'
      }
    };
  }

  /**
   * Validate the generated plan
   * @param {Object} plan - The plan to validate
   * @param {Object} context - The planning context
   * @returns {Promise<Object>} Validation result
   */
  async validatePlan(plan, context) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check required steps
    const requiredSteps = ['project-setup'];
    for (const stepType of requiredSteps) {
      if (!plan.steps.some(step => step.id === stepType)) {
        validation.isValid = false;
        validation.errors.push(`Missing required step: ${stepType}`);
      }
    }

    // Validate step dependencies
    for (const step of plan.steps) {
      for (const depId of step.dependencies || []) {
        if (!plan.steps.some(s => s.id === depId)) {
          validation.isValid = false;
          validation.errors.push(`Step ${step.id} depends on non-existent step: ${depId}`);
        }
      }
    }

    // Check for frontend-specific requirements
    if (context.projectType === 'frontend' || context.projectType === 'fullstack') {
      if (!plan.steps.some(step => step.id === 'frontend-setup')) {
        validation.warnings.push('No frontend implementation steps found');
      }
    }

    // Check for backend-specific requirements
    if (context.projectType === 'backend' || context.projectType === 'fullstack') {
      if (!plan.steps.some(step => step.id === 'backend-setup')) {
        validation.warnings.push('No backend implementation steps found');
      }
    }

    return validation;
  }

  /**
   * Refine the plan based on validation results
   * @param {Object} plan - The plan to refine
   * @param {Object} validationResult - The validation result
   * @param {Object} context - The planning context
   * @returns {Promise<Object>} Refined plan
   */
  async refinePlan(plan, validationResult, context) {
    // Add missing required steps
    for (const error of validationResult.errors) {
      if (error.includes('Missing required step: project-setup')) {
        const setupStep = this._createProjectSetupStep(plan.metadata.analysis || {});
        plan.steps.unshift(setupStep);
      }
    }

    // Fix dependency issues by reordering steps
    const orderedSteps = this._topologicalSort(plan.steps);
    plan.steps = orderedSteps;
    plan.executionOrder = orderedSteps.map(step => step.id);

    return plan;
  }

  /**
   * Check if this planner supports a project type
   * @param {string} projectType - The project type
   * @returns {boolean} Whether supported
   */
  supportsProjectType(projectType) {
    return this.config.projectTypes.includes(projectType);
  }

  /**
   * Get supported project types
   * @returns {Array<string>} Supported project types
   */
  getSupportedProjectTypes() {
    return [...this.config.projectTypes];
  }

  // Private helper methods

  _determineProjectType(requirements) {
    if (requirements.requirements) {
      const hasFrontend = !!requirements.requirements.frontend;
      const hasBackend = !!requirements.requirements.backend;

      if (hasFrontend && hasBackend) {
        return 'fullstack';
      } else if (hasBackend) {
        return 'backend';
      }
    }

    return 'frontend'; // Default to frontend
  }

  _extractFeatures(text) {
    if (!text || text.trim() === '') {
      return [];
    }

    const features = new Set();
    const lowerText = text.toLowerCase();

    // Check frontend features
    for (const [feature, keywords] of Object.entries(this.featureKeywords.frontend)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          if (keyword === 'validation') {
            features.add('validation');
          } else if (feature === 'auth' && keyword === 'login') {
            features.add('login');
          } else {
            features.add(feature === 'ui' ? keyword : feature);
          }
        }
      }
    }

    // Check backend features
    for (const [feature, keywords] of Object.entries(this.featureKeywords.backend)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          if (feature === 'api' && (keyword === 'rest' || keyword === 'restful')) {
            features.add('rest-api');
          } else if (feature === 'auth' && keyword === 'authentication') {
            features.add('authentication');
          } else {
            features.add(feature);
          }
        }
      }
    }

    return Array.from(features);
  }

  _analyzeFrontendRequirements(frontendReq) {
    const features = this._extractFeatures(frontendReq);
    const technologies = ['html', 'javascript'];
    
    // Add CSS if any styling-related features
    if (features.some(f => ['form', 'table', 'gallery', 'modal', 'navbar'].includes(f))) {
      technologies.push('css');
    }

    return {
      features,
      technologies
    };
  }

  _analyzeBackendRequirements(backendReq) {
    const features = this._extractFeatures(backendReq);
    const technologies = ['nodejs', 'express'];
    
    const result = {
      features,
      technologies
    };

    // Detect storage type
    const lowerReq = backendReq.toLowerCase();
    if (lowerReq.includes('mongodb')) {
      result.storage = 'mongodb';
    } else if (lowerReq.includes('file-based')) {
      result.storage = 'file-based';
    }

    return result;
  }

  _analyzeFromTaskDescription(task) {
    const features = this._extractFeatures(task);
    return {
      features: features.length > 0 ? features : ['webpage'],
      technologies: ['html', 'javascript', 'css']
    };
  }

  _analyzeApiInterface(components, requirements) {
    const apiInterface = {
      endpoints: []
    };

    if (components.backend?.features.includes('api')) {
      apiInterface.endpoints.push('/api');
    }

    return apiInterface;
  }

  _analyzeSecurityRequirements(requirements, components) {
    const allText = JSON.stringify(requirements).toLowerCase();
    
    if (allText.includes('auth') || allText.includes('login')) {
      return { authentication: true };
    }

    return {};
  }

  _analyzeSpecialFeatures(requirements, components) {
    const allText = JSON.stringify(requirements).toLowerCase();
    const features = {};

    if (allText.includes('real-time') || allText.includes('websocket')) {
      features.realtime = true;
    }

    return Object.keys(features).length > 0 ? features : {};
  }

  _determineComplexity(analysis) {
    let score = 0;

    if (analysis.components.frontend?.features) {
      score += analysis.components.frontend.features.length;
    }

    if (analysis.components.backend?.features) {
      score += analysis.components.backend.features.length * 1.5;
    }

    if (analysis.security?.authentication) {
      score += 3;
    }

    return score <= 4 ? 'low' : score <= 10 ? 'medium' : 'high';
  }

  _suggestArchitecture(analysis) {
    return {
      pattern: analysis.complexity === 'low' ? 'simple' : 'modular',
      structure: {
        frontend: analysis.complexity === 'low' ? ['index.html', 'style.css', 'script.js'] : ['index.html', 'css/', 'js/'],
        backend: analysis.complexity === 'low' ? ['server.js'] : ['server.js', 'routes/', 'models/']
      }
    };
  }

  _createProjectSetupStep(analysis) {
    return new PlanStep({
      id: 'project-setup',
      name: 'Project Setup',
      description: 'Initialize project structure and configuration',
      type: 'setup',
      actions: [
        new PlanAction({
          type: 'create-directory',
          path: '.'
        }),
        new PlanAction({
          type: 'create-file',
          path: 'README.md',
          content: `# ${analysis.task}\n\nGenerated project structure.`
        })
      ],
      dependencies: [],
      estimatedTime: 10
    });
  }

  _createFrontendSteps(analysis) {
    const steps = [];

    steps.push(new PlanStep({
      id: 'frontend-setup',
      name: 'Frontend Setup',
      description: 'Create frontend structure and base files',
      type: 'implementation',
      actions: [
        new PlanAction({
          type: 'create-file',
          path: 'index.html',
          content: '<!DOCTYPE html>\n<html>\n<head>\n    <title>App</title>\n    <link rel="stylesheet" href="style.css">\n</head>\n<body>\n    <div id="app"></div>\n    <script src="script.js"></script>\n</body>\n</html>'
        }),
        new PlanAction({
          type: 'create-file',
          path: 'style.css',
          content: 'body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }'
        }),
        new PlanAction({
          type: 'create-file',
          path: 'script.js',
          content: 'document.addEventListener("DOMContentLoaded", () => {\n    console.log("App loaded");\n});'
        })
      ],
      dependencies: ['project-setup'],
      estimatedTime: 20
    }));

    return steps;
  }

  _createBackendSteps(analysis) {
    const steps = [];

    steps.push(new PlanStep({
      id: 'backend-setup',
      name: 'Backend Setup',
      description: 'Create backend server and configuration',
      type: 'implementation',
      actions: [
        new PlanAction({
          type: 'create-file',
          path: 'server.js',
          content: 'const express = require("express");\nconst app = express();\nconst PORT = 3000;\n\napp.get("/", (req, res) => {\n    res.send("Hello World!");\n});\n\napp.listen(PORT, () => {\n    console.log(`Server running on port ${PORT}`);\n});'
        }),
        new PlanAction({
          type: 'create-file',
          path: 'package.json',
          content: '{\n  "name": "app",\n  "version": "1.0.0",\n  "main": "server.js",\n  "dependencies": {\n    "express": "^4.18.0"\n  }\n}'
        })
      ],
      dependencies: ['project-setup'],
      estimatedTime: 30
    }));

    return steps;
  }

  _createIntegrationStep(analysis) {
    return new PlanStep({
      id: 'integration',
      name: 'Frontend-Backend Integration',
      description: 'Connect frontend and backend components',
      type: 'integration',
      actions: [
        new PlanAction({
          type: 'update-file',
          path: 'script.js',
          content: 'document.addEventListener("DOMContentLoaded", () => {\n    console.log("App loaded");\n    // API integration code here\n});'
        })
      ],
      dependencies: ['frontend-setup', 'backend-setup'],
      estimatedTime: 25
    });
  }

  _createTestingStep(analysis) {
    return new PlanStep({
      id: 'testing',
      name: 'Testing Setup',
      description: 'Add testing framework and basic tests',
      type: 'testing',
      actions: [
        new PlanAction({
          type: 'create-file',
          path: 'test.html',
          content: '<!DOCTYPE html>\n<html>\n<head><title>Tests</title></head>\n<body>\n    <h1>Tests</h1>\n    <div id="test-results"></div>\n</body>\n</html>'
        })
      ],
      dependencies: ['frontend-setup'],
      estimatedTime: 15
    });
  }

  _createDocumentationStep(analysis) {
    return new PlanStep({
      id: 'documentation',
      name: 'Documentation',
      description: 'Create project documentation',
      type: 'validation',
      actions: [
        new PlanAction({
          type: 'update-file',
          path: 'README.md',
          content: `# ${analysis.task}\n\nGenerated project structure.\n\n## Usage\n\nOpen index.html in your browser.`
        })
      ],
      dependencies: ['testing'],
      estimatedTime: 10
    });
  }

  _topologicalSort(steps) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (step) => {
      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected: ${step.id}`);
      }
      if (visited.has(step.id)) {
        return;
      }

      visiting.add(step.id);
      
      for (const depId of step.dependencies || []) {
        const depStep = steps.find(s => s.id === depId);
        if (depStep) {
          visit(depStep);
        }
      }

      visiting.delete(step.id);
      visited.add(step.id);
      sorted.push(step);
    };

    for (const step of steps) {
      visit(step);
    }

    return sorted;
  }
}

export { CodePlanner };