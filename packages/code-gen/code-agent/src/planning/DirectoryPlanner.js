/**
 * DirectoryPlanner - Plans project directory structures
 * 
 * Creates optimal directory structures based on project requirements,
 * complexity, and technology stack. Supports various architectural patterns.
 */

class DirectoryPlanner {
  constructor(config = {}) {
    this.config = {
      createGitignore: true,
      createReadme: true,
      createPackageJson: true,
      supportCustomStructures: true,
      customStructures: {},
      ...config
    };

    // Predefined structure templates
    this.templates = {
      frontend: {
        simple: {
          directories: ['.'],
          files: ['index.html', 'style.css', 'script.js']
        },
        modular: {
          directories: ['css', 'js', 'components', 'services'],
          files: ['index.html']
        },
        layered: {
          directories: ['assets', 'components', 'views', 'services', 'utils', 'config'],
          files: ['index.html']
        }
      },
      backend: {
        simple: {
          directories: ['.'],
          files: ['server.js', 'package.json']
        },
        modular: {
          directories: ['routes', 'models', 'utils'],
          files: ['server.js', 'package.json']
        },
        layered: {
          directories: ['controllers', 'services', 'models', 'repositories', 'middleware', 'utils', 'config'],
          files: ['server.js', 'package.json']
        }
      },
      fullstack: {
        simple: {
          directories: ['frontend', 'backend'],
          files: ['package.json']
        },
        modular: {
          directories: ['frontend', 'backend', 'shared'],
          files: ['package.json']
        },
        layered: {
          directories: ['frontend', 'backend', 'shared', 'docs', 'scripts'],
          files: ['package.json']
        }
      }
    };
  }

  /**
   * Plan directory structure based on analysis
   * 
   * @param {Object} analysis - Project analysis from RequirementAnalyzer
   * @returns {Promise<Object>} Directory structure plan
   */
  async planDirectoryStructure(analysis) {
    if (!analysis) {
      throw new Error('Analysis must be provided');
    }

    if (!analysis.projectType) {
      throw new Error('Project type must be specified');
    }

    const structure = {
      directories: [],
      files: [],
      descriptions: {},
      warnings: [],
      isValid: true,
      metadata: {
        planner: 'DirectoryPlanner',
        plannedAt: Date.now(),
        projectType: analysis.projectType,
        complexity: analysis.complexity || 'medium'
      }
    };

    try {
      // Use custom pattern if specified
      if (analysis.customPattern && this.config.customStructures[analysis.customPattern]) {
        this._applyCustomStructure(structure, analysis.customPattern);
      } else {
        // Apply base structure based on project type and complexity
        this._applyBaseStructure(structure, analysis);
      }

      // Add feature-specific directories
      this._addFeatureSpecificDirectories(structure, analysis);

      // Add technology-specific directories and files
      this._addTechnologySpecificStructure(structure, analysis);

      // Add configuration files
      this._addConfigurationFiles(structure, analysis);

      // Add common files (README, .gitignore, etc.)
      this._addCommonFiles(structure, analysis);

      // Generate descriptions for directories
      this._generateDescriptions(structure, analysis);

      // Validate and clean up structure
      this._validateStructure(structure, analysis);

      return structure;

    } catch (error) {
      structure.isValid = false;
      structure.warnings.push(`Planning failed: ${error.message}`);
      
      // Return minimal fallback structure
      this._applyFallbackStructure(structure, analysis);
      return structure;
    }
  }

  /**
   * Apply base directory structure based on project type and complexity
   * 
   * @private
   */
  _applyBaseStructure(structure, analysis) {
    const { projectType, complexity = 'medium' } = analysis;
    
    // Map complexity to template pattern
    const patternMap = {
      low: 'simple',
      medium: 'modular',
      high: 'layered'
    };
    
    const pattern = patternMap[complexity] || 'modular';
    const template = this.templates[projectType]?.[pattern] || this.templates.frontend.simple;

    structure.directories.push(...template.directories);
    structure.files.push(...template.files);
  }

  /**
   * Apply custom directory structure
   * 
   * @private
   */
  _applyCustomStructure(structure, customPattern) {
    const customStructure = this.config.customStructures[customPattern];
    
    for (const item of customStructure) {
      if (item.endsWith('/')) {
        structure.directories.push(item.slice(0, -1));
      } else {
        structure.files.push(item);
      }
    }
  }

  /**
   * Add directories based on detected features
   * 
   * @private
   */
  _addFeatureSpecificDirectories(structure, analysis) {
    const allFeatures = [
      ...(analysis.components?.frontend?.features || []),
      ...(analysis.components?.backend?.features || [])
    ];

    // Testing features
    if (allFeatures.some(f => ['testing', 'test'].includes(f))) {
      if (!structure.directories.includes('tests')) {
        structure.directories.push('tests');
      }
      if (!structure.directories.includes('__tests__')) {
        structure.directories.push('__tests__');
      }
    }

    // Documentation features
    if (allFeatures.includes('documentation') || analysis.complexity === 'high') {
      if (!structure.directories.includes('docs')) {
        structure.directories.push('docs');
      }
    }

    // Media/assets features
    if (allFeatures.some(f => ['gallery', 'media', 'images', 'assets'].includes(f))) {
      if (!structure.directories.includes('assets')) {
        structure.directories.push('assets');
      }
      if (allFeatures.includes('gallery') || allFeatures.includes('images')) {
        structure.directories.push('images');
      }
    }

    // Authentication features
    if (allFeatures.includes('auth') || allFeatures.includes('authentication')) {
      if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
        structure.directories.push('auth');
      }
    }

    // API features
    if (allFeatures.includes('api') || allFeatures.includes('rest-api')) {
      if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
        if (!structure.directories.includes('routes')) {
          structure.directories.push('routes');
        }
        if (!structure.directories.includes('controllers')) {
          structure.directories.push('controllers');
        }
      }
    }
  }

  /**
   * Add technology-specific structure
   * 
   * @private
   */
  _addTechnologySpecificStructure(structure, analysis) {
    const allTechnologies = [
      ...(analysis.components?.frontend?.technologies || []),
      ...(analysis.components?.backend?.technologies || [])
    ];

    // TypeScript
    if (allTechnologies.includes('typescript')) {
      if (!structure.directories.includes('src')) {
        structure.directories.push('src');
      }
      if (!structure.directories.includes('dist')) {
        structure.directories.push('dist');
      }
      if (!structure.files.includes('tsconfig.json')) {
        structure.files.push('tsconfig.json');
      }
    }

    // Database technologies
    if (allTechnologies.some(t => ['mongodb', 'mysql', 'postgresql', 'database'].includes(t))) {
      if (!structure.directories.includes('models')) {
        structure.directories.push('models');
      }
      if (!structure.directories.includes('schemas')) {
        structure.directories.push('schemas');
      }
    }

    // WebSocket/Realtime
    if (allTechnologies.includes('websocket') || 
        (analysis.components?.backend?.features || []).includes('realtime')) {
      structure.directories.push('sockets');
      structure.directories.push('events');
    }

    // Docker
    if (allTechnologies.includes('docker')) {
      structure.files.push('Dockerfile');
      structure.files.push('docker-compose.yml');
    }
  }

  /**
   * Add configuration files
   * 
   * @private
   */
  _addConfigurationFiles(structure, analysis) {
    // Package.json for Node.js projects
    if (this.config.createPackageJson && 
        (analysis.projectType === 'backend' || 
         analysis.projectType === 'fullstack' ||
         (analysis.components?.backend?.technologies || []).includes('nodejs'))) {
      if (!structure.files.includes('package.json')) {
        structure.files.push('package.json');
      }
    }

    // Environment files
    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      structure.files.push('.env.example');
    }

    // ESLint configuration
    if (analysis.complexity !== 'low') {
      structure.files.push('.eslintrc.js');
    }

    // Jest configuration
    if ((analysis.components?.frontend?.features || []).includes('testing') ||
        (analysis.components?.backend?.features || []).includes('testing')) {
      structure.files.push('jest.config.js');
    }
  }

  /**
   * Add common files like README and .gitignore
   * 
   * @private
   */
  _addCommonFiles(structure, analysis) {
    // README.md
    if (this.config.createReadme && !structure.files.includes('README.md')) {
      structure.files.push('README.md');
    }

    // .gitignore
    if (this.config.createGitignore && !structure.files.includes('.gitignore')) {
      structure.files.push('.gitignore');
    }

    // License file for open source projects
    if (analysis.complexity === 'high') {
      structure.files.push('LICENSE');
    }
  }

  /**
   * Generate descriptions for directories
   * 
   * @private
   */
  _generateDescriptions(structure, analysis) {
    const descriptions = {
      // Common directories
      'src': 'Source code directory',
      'dist': 'Built/compiled output directory',
      'tests': 'Test files and test utilities',
      '__tests__': 'Jest test files',
      'docs': 'Project documentation',
      'assets': 'Static assets (images, fonts, etc.)',
      'images': 'Image files and graphics',
      'config': 'Configuration files and settings',
      'utils': 'Utility functions and helpers',
      
      // Frontend directories
      'css': 'Stylesheets and CSS files',
      'js': 'JavaScript files',
      'components': 'Reusable UI components',
      'views': 'Page views and templates',
      'services': 'API services and data layer',
      
      // Backend directories
      'routes': 'API route definitions',
      'controllers': 'Request handlers and business logic',
      'models': 'Data models and schemas',
      'repositories': 'Data access layer',
      'middleware': 'Express middleware functions',
      'auth': 'Authentication and authorization',
      'sockets': 'WebSocket handlers',
      'events': 'Event handlers and emitters',
      'schemas': 'Database schemas',
      
      // Fullstack directories
      'frontend': 'Frontend application code',
      'backend': 'Backend server code',
      'shared': 'Shared utilities and types',
      'scripts': 'Build and deployment scripts'
    };

    // Only include descriptions for directories that exist in the structure
    for (const dir of structure.directories) {
      if (descriptions[dir]) {
        structure.descriptions[dir] = descriptions[dir];
      }
    }
  }

  /**
   * Validate structure and add warnings if needed
   * 
   * @private
   */
  _validateStructure(structure, analysis) {
    // Remove duplicates
    structure.directories = [...new Set(structure.directories)];
    structure.files = [...new Set(structure.files)];

    // Sort for consistency
    structure.directories.sort();
    structure.files.sort();

    // Check for potential issues
    if (structure.directories.length === 0) {
      structure.warnings.push('No directories planned - this may indicate a configuration issue');
    }

    if (structure.files.length === 0) {
      structure.warnings.push('No files planned - this may indicate a configuration issue');
    }

    // Project type specific validation
    if (analysis.projectType === 'frontend' && !structure.files.includes('index.html')) {
      structure.warnings.push('Frontend project missing index.html file');
    }

    if (analysis.projectType === 'backend' && !structure.files.includes('server.js') && !structure.files.includes('index.js')) {
      structure.warnings.push('Backend project missing main server file');
    }

    if ((analysis.projectType === 'backend' || analysis.projectType === 'fullstack') && 
        !structure.files.includes('package.json')) {
      structure.warnings.push('Node.js project missing package.json file');
    }
  }

  /**
   * Apply fallback structure for error cases
   * 
   * @private
   */
  _applyFallbackStructure(structure, analysis) {
    structure.directories = ['.'];
    structure.files = ['README.md'];
    
    if (analysis.projectType === 'frontend') {
      structure.files.push('index.html', 'style.css', 'script.js');
    } else if (analysis.projectType === 'backend') {
      structure.files.push('server.js', 'package.json');
    }

    if (this.config.createGitignore) {
      structure.files.push('.gitignore');
    }
  }

  /**
   * Get available structure templates
   * 
   * @returns {Object} Available templates
   */
  getAvailableTemplates() {
    return {
      projectTypes: Object.keys(this.templates),
      complexityLevels: ['low', 'medium', 'high'],
      customStructures: Object.keys(this.config.customStructures)
    };
  }

  /**
   * Preview structure without applying it
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Promise<Object>} Structure preview
   */
  async previewStructure(analysis) {
    const structure = await this.planDirectoryStructure(analysis);
    return {
      directoryCount: structure.directories.length,
      fileCount: structure.files.length,
      hasWarnings: structure.warnings.length > 0,
      complexity: structure.metadata.complexity,
      preview: {
        directories: structure.directories.slice(0, 10),
        files: structure.files.slice(0, 10)
      }
    };
  }
}

export { DirectoryPlanner };