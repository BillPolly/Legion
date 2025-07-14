/**
 * RequirementAnalyzer - Analyzes project requirements to create actionable development plans
 * 
 * This class is responsible for parsing natural language requirements and converting them
 * into structured analysis that can be used by other components to generate code.
 */

class RequirementAnalyzer {
  constructor(config = {}) {
    this.config = {
      projectTypes: config.projectTypes || ['frontend', 'backend', 'fullstack'],
      analysisDepth: config.analysisDepth || 'standard',
      ...config
    };

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
   * Analyze project requirements and return structured analysis
   * @param {Object} requirements - The requirements object
   * @returns {Object} Structured analysis
   */
  async analyzeRequirements(requirements) {
    if (!requirements) {
      throw new Error('Requirements must be provided');
    }

    if (!requirements.task) {
      throw new Error('Task description is required');
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
    analysis.complexity = this.determineComplexity(analysis);

    // Suggest architecture
    analysis.suggestedArchitecture = this.suggestArchitecture(analysis);

    // Generate summary
    analysis.summary = this.generateSummary(analysis);

    // Validate analysis
    if (!this.validateAnalysis(analysis)) {
      throw new Error('Invalid analysis generated');
    }

    return analysis;
  }

  /**
   * Extract features from text
   * @param {string} text - Text to analyze
   * @returns {Array} Array of features
   */
  extractFeatures(text) {
    if (!text || text.trim() === '') {
      return [];
    }

    const features = new Set();
    const lowerText = text.toLowerCase();

    // Check frontend features
    for (const [feature, keywords] of Object.entries(this.featureKeywords.frontend)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          // Special handling for specific keywords
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
          // Special handling for REST API
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

    // Extract specific UI components
    const uiComponents = ['navbar', 'dropdown', 'accordion', 'carousel', 'tabs', 'modal', 'sidebar', 'table', 'chart'];
    for (const component of uiComponents) {
      if (lowerText.includes(component)) {
        features.add(component);
      }
    }

    // Handle special UI component mappings
    if (lowerText.includes('navigation bar') || lowerText.includes('nav bar') || lowerText.includes('navigation')) {
      features.add('navbar');
    }
    if (lowerText.includes('data table') || lowerText.includes('data tables')) {
      features.add('table');
    }
    if (lowerText.includes('sidebar menu')) {
      features.add('sidebar');
    }

    // Extract operations
    const operations = ['create', 'read', 'update', 'delete', 'sorting', 'filtering', 'pagination'];
    for (const op of operations) {
      if (lowerText.includes(op)) {
        features.add(op);
      }
    }

    // Special feature mappings
    if (lowerText.includes('gallery')) {
      features.add('gallery');
    }
    if (lowerText.includes('zoom')) {
      features.add('zoom');
    }
    if (lowerText.includes('cart')) {
      features.add('cart');
    }
    if (lowerText.includes('review')) {
      features.add('reviews');
    }
    if (lowerText.includes('listing')) {
      features.add('listing');
    }
    if (lowerText.includes('view')) {
      features.add('view');
    }
    if (lowerText.includes('inventory')) {
      features.add('inventory');
    }
    if (lowerText.includes('cart-management') || lowerText.includes('cart management')) {
      features.add('cart-management');
    }

    return Array.from(features);
  }

  /**
   * Determine project complexity
   * @param {Object} analysis - Current analysis
   * @returns {string} Complexity level (low, medium, high)
   */
  determineComplexity(analysis) {
    let score = 0;

    // Count frontend features
    if (analysis.components.frontend?.features) {
      score += analysis.components.frontend.features.length;
    }

    // Count backend features
    if (analysis.components.backend?.features) {
      score += analysis.components.backend.features.length * 1.5; // Backend features add more complexity
    }

    // Add complexity for security
    if (analysis.security?.authentication) {
      score += 3;
    }

    // Add complexity for realtime features
    if (analysis.features?.realtime) {
      score += 4;
    }

    // Add complexity for multiple UI components
    if (analysis.components.frontend?.uiComponents?.length > 3) {
      score += 2;
    }

    // Determine level
    if (score <= 4) {
      return 'low';
    } else if (score <= 10) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Suggest architecture based on analysis
   * @param {Object} analysis - Current analysis
   * @returns {Object} Architecture suggestion
   */
  suggestArchitecture(analysis) {
    const architecture = {
      pattern: 'simple',
      structure: {}
    };

    if (analysis.complexity === 'low') {
      architecture.pattern = 'simple';
      if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
        architecture.structure.frontend = [
          'index.html',
          'style.css',
          'script.js'
        ];
      }
      if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
        architecture.structure.backend = [
          'server.js',
          'package.json'
        ];
      }
    } else if (analysis.complexity === 'medium') {
      architecture.pattern = 'modular';
      if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
        architecture.structure.frontend = [
          'index.html',
          'css/',
          'js/',
          'components/',
          'services/'
        ];
      }
      if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
        architecture.structure.backend = [
          'server.js',
          'routes/',
          'models/',
          'utils/',
          'package.json'
        ];
      }
    } else {
      architecture.pattern = 'layered';
      if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
        architecture.structure.frontend = [
          'index.html',
          'assets/',
          'components/',
          'views/',
          'services/',
          'utils/',
          'config/'
        ];
      }
      if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
        architecture.structure.backend = [
          'server.js',
          'controllers/',
          'services/',
          'models/',
          'repositories/',
          'middleware/',
          'utils/',
          'config/',
          'package.json'
        ];
      }
    }

    return architecture;
  }

  /**
   * Generate analysis summary
   * @param {Object} analysis - Current analysis
   * @returns {string} Summary text
   */
  generateSummary(analysis) {
    const parts = [];

    parts.push(`Project Type: ${analysis.projectType}`);
    parts.push(`Complexity: ${analysis.complexity} complexity`);

    if (analysis.components.frontend?.features?.length > 0) {
      parts.push(`Frontend: ${analysis.components.frontend.features.join(', ')}`);
    }

    if (analysis.components.backend?.features?.length > 0) {
      parts.push(`Backend: ${analysis.components.backend.features.join(', ')}`);
    }

    if (analysis.security?.authentication) {
      parts.push('Security: authentication required');
    }

    if (analysis.features?.realtime) {
      parts.push('Features: real-time communication');
    }

    return parts.join('\n');
  }

  /**
   * Validate analysis structure
   * @param {Object} analysis - Analysis to validate
   * @returns {boolean} Is valid
   */
  validateAnalysis(analysis) {
    if (!analysis || typeof analysis !== 'object') {
      return false;
    }

    if (!analysis.projectType || !this.config.projectTypes.includes(analysis.projectType)) {
      return false;
    }

    if (!analysis.components || typeof analysis.components !== 'object') {
      return false;
    }

    if (Object.keys(analysis.components).length === 0) {
      return false;
    }

    return true;
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

  _analyzeFrontendRequirements(frontendReq) {
    const features = this.extractFeatures(frontendReq);
    const technologies = ['html', 'javascript'];
    
    // Add CSS if any styling-related features
    if (features.some(f => ['form', 'table', 'gallery', 'modal', 'navbar'].includes(f))) {
      technologies.push('css');
    }

    // Extract UI components
    const uiComponentsList = ['navbar', 'sidebar', 'table', 'chart', 'modal', 'dropdown', 'accordion', 'carousel', 'tabs'];
    const uiComponents = features.filter(f => uiComponentsList.includes(f));

    // Separate non-UI features
    const nonUiFeatures = features.filter(f => !uiComponentsList.includes(f));

    const result = {
      features: nonUiFeatures,
      technologies
    };

    // Only add uiComponents if we found some
    if (uiComponents.length > 0) {
      result.uiComponents = uiComponents;
    }

    return result;
  }

  _analyzeBackendRequirements(backendReq) {
    const features = this.extractFeatures(backendReq);
    const technologies = ['nodejs', 'express'];
    
    const result = {
      features,
      technologies
    };

    // Detect storage type
    const lowerReq = backendReq.toLowerCase();
    if (lowerReq.includes('mongodb')) {
      result.storage = 'mongodb';
    } else if (lowerReq.includes('mysql')) {
      result.storage = 'mysql';
    } else if (lowerReq.includes('postgres')) {
      result.storage = 'postgresql';
    } else if (lowerReq.includes('file-based') || lowerReq.includes('file based')) {
      result.storage = 'file-based';
    }

    // Detect CRUD operations
    if (features.includes('crud')) {
      result.operations = ['create', 'read', 'update', 'delete'];
    }

    // Add websocket technology if realtime
    if (features.includes('realtime') || lowerReq.includes('websocket')) {
      technologies.push('websocket');
    }

    return result;
  }

  _analyzeFromTaskDescription(task) {
    const features = this.extractFeatures(task);
    return {
      features: features.length > 0 ? features : ['webpage'],
      technologies: ['html', 'javascript', 'css']
    };
  }

  _analyzeApiInterface(components, requirements) {
    const apiInterface = {
      endpoints: []
    };

    // Generate endpoints based on features
    if (components.backend?.features) {
      if (components.backend.features.includes('api') || components.backend.features.includes('rest-api')) {
        // Add endpoints based on frontend/backend features
        if (components.frontend?.features.includes('auth') || components.backend.features.includes('auth') || components.backend.features.includes('authentication')) {
          apiInterface.endpoints.push('/auth');
        }
        
        // Extract entity names from requirements text
        const entities = this._extractEntities(components, requirements);
        for (const entity of entities) {
          apiInterface.endpoints.push(`/${entity}`);
        }
      }
    }

    // Check for special API features (check text, not just features array)
    const allText = JSON.stringify(requirements).toLowerCase();
    if (allText.includes('versioning')) {
      apiInterface.versioning = true;
    }
    if (allText.includes('rate limiting') || allText.includes('rate-limiting')) {
      apiInterface.rateLimiting = true;
    }

    return apiInterface;
  }

  _extractEntities(components, requirements) {
    const entities = new Set();

    // Common entities
    const commonEntities = ['users', 'articles', 'products', 'comments', 'posts', 'items', 'orders'];
    
    // Check all text for entity mentions including original requirements
    const allText = (JSON.stringify(components) + JSON.stringify(requirements || {})).toLowerCase();
    
    for (const entity of commonEntities) {
      if (allText.includes(entity.slice(0, -1))) { // Check singular form
        entities.add(entity);
      }
    }

    // Default entities if none found
    if (entities.size === 0 && (components.backend?.features.includes('api') || components.backend?.features.includes('crud'))) {
      entities.add('items');
    }

    return Array.from(entities);
  }

  _analyzeSecurityRequirements(requirements, components) {
    const security = {};
    
    const allText = JSON.stringify(requirements).toLowerCase() + JSON.stringify(components).toLowerCase();

    if (allText.includes('auth') || allText.includes('login') || allText.includes('jwt')) {
      security.authentication = true;
    }

    if (allText.includes('jwt') || allText.includes('token')) {
      security.method = 'jwt';
    }

    if (allText.includes('api key') || allText.includes('apikey')) {
      security.apiKey = true;
    }

    return Object.keys(security).length > 0 ? security : undefined;
  }

  _analyzeSpecialFeatures(requirements, components) {
    const features = {};
    
    const allText = JSON.stringify(requirements).toLowerCase() + JSON.stringify(components).toLowerCase();

    if (allText.includes('real-time') || allText.includes('realtime') || allText.includes('websocket')) {
      features.realtime = true;
    }

    if (allText.includes('upload') || allText.includes('download')) {
      features.fileHandling = true;
    }

    if (allText.includes('email') || allText.includes('notification')) {
      features.notifications = true;
    }

    return Object.keys(features).length > 0 ? features : undefined;
  }
}

export { RequirementAnalyzer };