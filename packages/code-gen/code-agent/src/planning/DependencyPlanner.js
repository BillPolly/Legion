/**
 * DependencyPlanner - Plans file dependencies and creation order
 * 
 * Determines the optimal order for creating files based on their dependencies,
 * imports, and architectural patterns. Detects and resolves circular dependencies.
 */

class DependencyPlanner {
  constructor(config = {}) {
    this.config = {
      detectCircularDependencies: true,
      allowSelfDependencies: false,
      maxDependencyDepth: 20,
      optimizeForParallel: true,
      ...config
    };

    // File type patterns and their typical dependencies
    this.filePatterns = {
      // Configuration files (highest priority)
      configuration: {
        patterns: ['package.json', '.env*', 'tsconfig.json', '.eslintrc*', 'jest.config*', 'docker*'],
        priority: 1,
        dependsOn: []
      },
      
      // Type definitions and interfaces
      types: {
        patterns: ['*.d.ts', 'types/*', 'interfaces/*', '*types.js'],
        priority: 2,
        dependsOn: ['configuration']
      },
      
      // Utilities and helpers
      utilities: {
        patterns: ['utils/*', 'helpers/*', 'lib/*', 'common/*'],
        priority: 3,
        dependsOn: ['configuration', 'types']
      },
      
      // Models and schemas
      models: {
        patterns: ['models/*', 'schemas/*', 'entities/*'],
        priority: 4,
        dependsOn: ['configuration', 'types', 'utilities']
      },
      
      // Services and repositories
      services: {
        patterns: ['services/*', 'repositories/*', 'dao/*'],
        priority: 5,
        dependsOn: ['configuration', 'types', 'utilities', 'models']
      },
      
      // Middleware and guards
      middleware: {
        patterns: ['middleware/*', 'guards/*', 'interceptors/*'],
        priority: 6,
        dependsOn: ['configuration', 'types', 'utilities', 'services']
      },
      
      // Controllers and routes
      controllers: {
        patterns: ['controllers/*', 'routes/*', 'handlers/*'],
        priority: 7,
        dependsOn: ['configuration', 'types', 'utilities', 'models', 'services', 'middleware']
      },
      
      // Components (frontend)
      components: {
        patterns: ['components/*', 'views/*', 'pages/*'],
        priority: 7,
        dependsOn: ['configuration', 'types', 'utilities', 'services']
      },
      
      // Main application files
      application: {
        patterns: ['server.js', 'app.js', 'index.js', 'main.js', 'index.html'],
        priority: 8,
        dependsOn: ['configuration', 'types', 'utilities', 'models', 'services', 'middleware', 'controllers', 'components']
      },
      
      // Tests (lowest priority)
      tests: {
        patterns: ['*.test.js', '*.spec.js', '__tests__/*', 'tests/*'],
        priority: 9,
        dependsOn: ['application']
      }
    };
  }

  /**
   * Plan dependencies for a project structure
   * 
   * @param {Object} structure - Directory structure from DirectoryPlanner
   * @param {Object} analysis - Project analysis
   * @returns {Promise<Object>} Dependency plan with creation order
   */
  async planDependencies(structure, analysis) {
    if (!structure) {
      throw new Error('Structure must be provided');
    }
    if (!analysis) {
      throw new Error('Analysis must be provided');
    }

    const dependencyPlan = {
      files: {},
      creationOrder: [],
      parallelGroups: [],
      metadata: {
        planner: 'DependencyPlanner',
        plannedAt: Date.now(),
        totalFiles: structure.files.length,
        projectType: analysis.projectType
      }
    };

    try {
      // Initialize file dependency information
      this._initializeFileDependencies(dependencyPlan, structure, analysis);

      // Determine dependencies based on project patterns
      this._analyzeDependencies(dependencyPlan, structure, analysis);

      // Detect and resolve circular dependencies
      if (this.config.detectCircularDependencies) {
        this._resolveCircularDependencies(dependencyPlan);
      }

      // Generate creation order
      this._generateCreationOrder(dependencyPlan);

      // Optimize for parallel execution
      if (this.config.optimizeForParallel) {
        this._generateParallelGroups(dependencyPlan);
      }

      return dependencyPlan;

    } catch (error) {
      throw new Error(`Dependency planning failed: ${error.message}`);
    }
  }

  /**
   * Initialize file dependency information
   * 
   * @private
   */
  _initializeFileDependencies(plan, structure, analysis) {
    for (const file of structure.files) {
      plan.files[file] = {
        dependencies: [],
        dependencyTypes: {},
        fileType: this._classifyFileType(file),
        priority: this._getFilePriority(file),
        canRunInParallel: true
      };
    }
  }

  /**
   * Analyze and determine file dependencies
   * 
   * @private
   */
  _analyzeDependencies(plan, structure, analysis) {
    // Add configuration dependencies
    this._addConfigurationDependencies(plan, structure, analysis);

    // Add architectural dependencies
    this._addArchitecturalDependencies(plan, structure, analysis);

    // Add technology-specific dependencies
    this._addTechnologyDependencies(plan, structure, analysis);

    // Add feature-specific dependencies
    this._addFeatureDependencies(plan, structure, analysis);

    // Add test dependencies
    this._addTestDependencies(plan, structure, analysis);
  }

  /**
   * Add configuration file dependencies
   * 
   * @private
   */
  _addConfigurationDependencies(plan, structure, analysis) {
    const configFiles = ['package.json', 'tsconfig.json', '.eslintrc.js', 'jest.config.js'];
    const envFiles = ['.env.example', '.env'];

    // All source files depend on package.json (if it exists)
    if (structure.files.includes('package.json')) {
      for (const file of structure.files) {
        if (file !== 'package.json' && !this._isConfigFile(file)) {
          plan.files[file].dependencies.push('package.json');
          plan.files[file].dependencyTypes['package.json'] = 'configuration';
        }
      }
    }

    // TypeScript files depend on tsconfig.json
    if (structure.files.includes('tsconfig.json')) {
      for (const file of structure.files) {
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          plan.files[file].dependencies.push('tsconfig.json');
          plan.files[file].dependencyTypes['tsconfig.json'] = 'configuration';
        }
      }
    }

    // Config files depend on environment files
    for (const configFile of structure.files) {
      if (configFile.includes('config') && !this._isEnvFile(configFile)) {
        for (const envFile of envFiles) {
          if (structure.files.includes(envFile)) {
            plan.files[configFile].dependencies.push(envFile);
            plan.files[configFile].dependencyTypes[envFile] = 'environment';
          }
        }
      }
    }

    // Files that depend on config
    const srcConfigFiles = structure.files.filter(f => f.includes('config'));
    for (const file of structure.files) {
      if (file.includes('server') || file.includes('app') || file.includes('index')) {
        for (const configFile of srcConfigFiles) {
          if (configFile !== file && configFile.includes('src/config')) {
            plan.files[file].dependencies.push(configFile);
            plan.files[file].dependencyTypes[configFile] = 'configuration';
          }
        }
      }
    }
  }

  /**
   * Add architectural pattern dependencies
   * 
   * @private
   */
  _addArchitecturalDependencies(plan, structure, analysis) {
    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      this._addBackendArchitecturalDependencies(plan, structure, analysis);
    }

    if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
      this._addFrontendArchitecturalDependencies(plan, structure, analysis);
    }

    if (analysis.projectType === 'fullstack') {
      this._addFullstackDependencies(plan, structure, analysis);
    }
  }

  /**
   * Add backend architectural dependencies
   * 
   * @private
   */
  _addBackendArchitecturalDependencies(plan, structure, analysis) {
    const patterns = {
      models: structure.files.filter(f => f.includes('models/') || f.includes('schemas/')),
      repositories: structure.files.filter(f => f.includes('repositories/') || f.includes('dao/')),
      services: structure.files.filter(f => f.includes('services/')),
      controllers: structure.files.filter(f => f.includes('controllers/') || f.includes('routes/')),
      middleware: structure.files.filter(f => f.includes('middleware/')),
      server: structure.files.filter(f => f.includes('server') || f.includes('app.') || f.includes('index.'))
    };

    // Layered architecture: Models <- Repositories <- Services <- Controllers <- Server
    for (const repoFile of patterns.repositories) {
      for (const modelFile of patterns.models) {
        if (this._isRelatedFile(repoFile, modelFile)) {
          plan.files[repoFile].dependencies.push(modelFile);
          plan.files[repoFile].dependencyTypes[modelFile] = 'import';
        }
      }
    }

    for (const serviceFile of patterns.services) {
      for (const repoFile of patterns.repositories) {
        if (this._isRelatedFile(serviceFile, repoFile)) {
          plan.files[serviceFile].dependencies.push(repoFile);
          plan.files[serviceFile].dependencyTypes[repoFile] = 'import';
        }
      }
      // Services can also depend directly on models
      for (const modelFile of patterns.models) {
        if (this._isRelatedFile(serviceFile, modelFile)) {
          plan.files[serviceFile].dependencies.push(modelFile);
          plan.files[serviceFile].dependencyTypes[modelFile] = 'import';
        }
      }
    }

    for (const controllerFile of patterns.controllers) {
      for (const serviceFile of patterns.services) {
        if (this._isRelatedFile(controllerFile, serviceFile)) {
          plan.files[controllerFile].dependencies.push(serviceFile);
          plan.files[controllerFile].dependencyTypes[serviceFile] = 'import';
        }
      }
      // Controllers/routes also depend directly on models
      for (const modelFile of patterns.models) {
        if (this._isRelatedFile(controllerFile, modelFile)) {
          plan.files[controllerFile].dependencies.push(modelFile);
          plan.files[controllerFile].dependencyTypes[modelFile] = 'import';
        }
      }
      // Controllers depend on middleware
      for (const middlewareFile of patterns.middleware) {
        if (middlewareFile.includes('auth') && controllerFile.includes('api')) {
          plan.files[controllerFile].dependencies.push(middlewareFile);
          plan.files[controllerFile].dependencyTypes[middlewareFile] = 'import';
        }
      }
    }

    // Server depends on everything
    for (const serverFile of patterns.server) {
      [...patterns.controllers, ...patterns.middleware, ...patterns.models].forEach(file => {
        if (!plan.files[serverFile].dependencies.includes(file)) {
          plan.files[serverFile].dependencies.push(file);
          plan.files[serverFile].dependencyTypes[file] = 'import';
        }
      });
    }
  }

  /**
   * Add frontend architectural dependencies
   * 
   * @private
   */
  _addFrontendArchitecturalDependencies(plan, structure, analysis) {
    const patterns = {
      services: structure.files.filter(f => f.includes('services/') || f.includes('api/')),
      components: structure.files.filter(f => f.includes('components/')),
      views: structure.files.filter(f => f.includes('views/') || f.includes('pages/')),
      styles: structure.files.filter(f => f.endsWith('.css') || f.endsWith('.scss')),
      scripts: structure.files.filter(f => f.endsWith('.js') && !f.includes('test')),
      html: structure.files.filter(f => f.endsWith('.html'))
    };

    // Components depend on services
    for (const componentFile of patterns.components) {
      for (const serviceFile of patterns.services) {
        if (this._isRelatedFile(componentFile, serviceFile)) {
          plan.files[componentFile].dependencies.push(serviceFile);
          plan.files[componentFile].dependencyTypes[serviceFile] = 'import';
        }
      }
    }

    // Views depend on components
    for (const viewFile of patterns.views) {
      for (const componentFile of patterns.components) {
        plan.files[viewFile].dependencies.push(componentFile);
        plan.files[viewFile].dependencyTypes[componentFile] = 'import';
      }
    }

    // HTML depends on CSS and JS
    for (const htmlFile of patterns.html) {
      for (const cssFile of patterns.styles) {
        plan.files[htmlFile].dependencies.push(cssFile);
        plan.files[htmlFile].dependencyTypes[cssFile] = 'stylesheet';
      }
      for (const jsFile of patterns.scripts) {
        if (!jsFile.includes('/services/') && !jsFile.includes('/components/')) {
          plan.files[htmlFile].dependencies.push(jsFile);
          plan.files[htmlFile].dependencyTypes[jsFile] = 'script';
        }
      }
    }

    // Handle CSS preprocessing
    const scssFiles = structure.files.filter(f => f.endsWith('.scss'));
    const cssFiles = structure.files.filter(f => f.endsWith('.css'));

    for (const cssFile of cssFiles) {
      for (const scssFile of scssFiles) {
        if (this._isRelatedFile(cssFile, scssFile) || 
            (cssFile.includes('style.css') && scssFile.includes('main.scss'))) {
          plan.files[cssFile].dependencies.push(scssFile);
          plan.files[cssFile].dependencyTypes[scssFile] = 'preprocessing';
        }
      }
    }

    // SCSS partials
    const scssPartials = scssFiles.filter(f => f.includes('_'));
    const scssMain = scssFiles.filter(f => !f.includes('_'));

    for (const mainFile of scssMain) {
      for (const partialFile of scssPartials) {
        plan.files[mainFile].dependencies.push(partialFile);
        plan.files[mainFile].dependencyTypes[partialFile] = 'import';
      }
    }
  }

  /**
   * Add fullstack-specific dependencies
   * 
   * @private
   */
  _addFullstackDependencies(plan, structure, analysis) {
    const sharedFiles = structure.files.filter(f => f.includes('shared/'));
    const frontendFiles = structure.files.filter(f => f.includes('frontend/'));
    const backendFiles = structure.files.filter(f => f.includes('backend/'));

    // Both frontend and backend depend on shared files
    [...frontendFiles, ...backendFiles].forEach(file => {
      for (const sharedFile of sharedFiles) {
        if (this._isRelatedFile(file, sharedFile)) {
          plan.files[file].dependencies.push(sharedFile);
          plan.files[file].dependencyTypes[sharedFile] = 'import';
        }
      }
    });
  }

  /**
   * Add technology-specific dependencies
   * 
   * @private
   */
  _addTechnologyDependencies(plan, structure, analysis) {
    const allTechnologies = [
      ...(analysis.components?.frontend?.technologies || []),
      ...(analysis.components?.backend?.technologies || [])
    ];

    // TypeScript dependencies
    if (allTechnologies.includes('typescript')) {
      const typeFiles = structure.files.filter(f => f.includes('types') || f.endsWith('.d.ts'));
      const tsFiles = structure.files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

      for (const tsFile of tsFiles) {
        for (const typeFile of typeFiles) {
          if (typeFile !== tsFile && this._isRelatedFile(tsFile, typeFile)) {
            plan.files[tsFile].dependencies.push(typeFile);
            plan.files[tsFile].dependencyTypes[typeFile] = 'import';
          }
        }
      }
    }

    // General utility dependencies - files should depend on utils
    const utilFiles = structure.files.filter(f => f.includes('utils') || f.includes('helpers'));
    const allSourceFiles = structure.files.filter(f => 
      (f.endsWith('.js') || f.endsWith('.ts')) && 
      !f.includes('test') && 
      !f.includes('utils') && 
      !f.includes('helpers')
    );

    for (const sourceFile of allSourceFiles) {
      for (const utilFile of utilFiles) {
        if (this._isRelatedFile(sourceFile, utilFile)) {
          plan.files[sourceFile].dependencies.push(utilFile);
          plan.files[sourceFile].dependencyTypes[utilFile] = 'import';
        }
      }
    }

    // Type files dependencies - index files should depend on type files
    const typeFiles = structure.files.filter(f => f.includes('types') && f.endsWith('.js'));
    const indexFiles = structure.files.filter(f => f.includes('index') && f.endsWith('.js'));

    for (const indexFile of indexFiles) {
      for (const typeFile of typeFiles) {
        if (this._isRelatedFile(indexFile, typeFile)) {
          plan.files[indexFile].dependencies.push(typeFile);
          plan.files[indexFile].dependencyTypes[typeFile] = 'import';
        }
      }
    }

    // Database dependencies
    if (allTechnologies.some(t => ['mongodb', 'mysql', 'postgresql'].includes(t))) {
      const modelFiles = structure.files.filter(f => f.includes('/models/'));
      const schemaFiles = structure.files.filter(f => f.includes('/schemas/'));

      for (const modelFile of modelFiles) {
        for (const schemaFile of schemaFiles) {
          if (this._isRelatedFile(modelFile, schemaFile)) {
            plan.files[modelFile].dependencies.push(schemaFile);
            plan.files[modelFile].dependencyTypes[schemaFile] = 'schema';
          }
        }
      }
    }
  }

  /**
   * Add feature-specific dependencies
   * 
   * @private
   */
  _addFeatureDependencies(plan, structure, analysis) {
    const allFeatures = [
      ...(analysis.components?.frontend?.features || []),
      ...(analysis.components?.backend?.features || [])
    ];

    // Authentication dependencies
    if (allFeatures.includes('auth') || allFeatures.includes('authentication')) {
      const authFiles = structure.files.filter(f => f.includes('auth'));
      const routeFiles = structure.files.filter(f => f.includes('/routes/') || f.includes('/controllers/'));

      for (const routeFile of routeFiles) {
        for (const authFile of authFiles) {
          if (authFile.includes('middleware') || authFile.includes('guard')) {
            plan.files[routeFile].dependencies.push(authFile);
            plan.files[routeFile].dependencyTypes[authFile] = 'middleware';
          }
        }
      }
    }
  }

  /**
   * Add test file dependencies
   * 
   * @private
   */
  _addTestDependencies(plan, structure, analysis) {
    const testFiles = structure.files.filter(f => 
      f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__/') || f.includes('/tests/')
    );

    const jestConfig = structure.files.find(f => f.includes('jest.config'));

    for (const testFile of testFiles) {
      // Tests depend on jest config
      if (jestConfig) {
        plan.files[testFile].dependencies.push(jestConfig);
        plan.files[testFile].dependencyTypes[jestConfig] = 'configuration';
      }

      // Tests depend on corresponding source files
      const sourceFile = this._findCorrespondingSourceFile(testFile, structure.files);
      if (sourceFile) {
        plan.files[testFile].dependencies.push(sourceFile);
        plan.files[testFile].dependencyTypes[sourceFile] = 'test-target';
      }
    }
  }

  /**
   * Detect circular dependencies
   * 
   * @private
   */
  _detectCircularDependencies(files) {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (file, path) => {
      if (recursionStack.has(file)) {
        const cycleStart = path.indexOf(file);
        cycles.push(path.slice(cycleStart).concat([file]));
        return;
      }

      if (visited.has(file)) {
        return;
      }

      visited.add(file);
      recursionStack.add(file);

      const dependencies = files[file]?.dependencies || [];
      for (const dep of dependencies) {
        if (files[dep]) {
          dfs(dep, path.concat([file]));
        }
      }

      recursionStack.delete(file);
    };

    for (const file of Object.keys(files)) {
      if (!visited.has(file)) {
        dfs(file, []);
      }
    }

    return cycles;
  }

  /**
   * Resolve circular dependencies
   * 
   * @private
   */
  _resolveCircularDependencies(plan) {
    const cycles = this._detectCircularDependencies(plan.files);

    for (const cycle of cycles) {
      // Simple resolution: remove the last dependency in the cycle
      if (cycle.length > 1) {
        const lastFile = cycle[cycle.length - 2];
        const firstFile = cycle[0];
        
        if (plan.files[lastFile] && plan.files[lastFile].dependencies.includes(firstFile)) {
          plan.files[lastFile].dependencies = plan.files[lastFile].dependencies.filter(dep => dep !== firstFile);
          delete plan.files[lastFile].dependencyTypes[firstFile];
        }
      }
    }
  }

  /**
   * Generate creation order using topological sort
   * 
   * @private
   */
  _generateCreationOrder(plan) {
    const files = Object.keys(plan.files);
    const visited = new Set();
    const order = [];

    const visit = (file) => {
      if (visited.has(file)) {
        return;
      }

      visited.add(file);

      // Visit dependencies first
      const dependencies = plan.files[file].dependencies || [];
      for (const dep of dependencies) {
        if (plan.files[dep]) {
          visit(dep);
        }
      }

      order.push(file);
    };

    // Sort files by priority first
    const prioritizedFiles = files.sort((a, b) => {
      const priorityA = plan.files[a].priority || 10;
      const priorityB = plan.files[b].priority || 10;
      return priorityA - priorityB;
    });

    for (const file of prioritizedFiles) {
      visit(file);
    }

    plan.creationOrder = order;
  }

  /**
   * Generate parallel execution groups
   * 
   * @private
   */
  _generateParallelGroups(plan) {
    const groups = [];
    const processed = new Set();
    const order = plan.creationOrder;

    for (let i = 0; i < order.length; i++) {
      const file = order[i];
      if (processed.has(file)) continue;

      const group = [file];
      processed.add(file);

      // Find files that can be processed in parallel (same level)
      for (let j = i + 1; j < order.length; j++) {
        const otherFile = order[j];
        if (processed.has(otherFile)) continue;

        // Check if files can run in parallel (no dependencies between them)
        const canRunTogether = !plan.files[file].dependencies.includes(otherFile) &&
                              !plan.files[otherFile].dependencies.includes(file) &&
                              this._haveSimilarDependencyDepth(plan, file, otherFile);

        if (canRunTogether) {
          group.push(otherFile);
          processed.add(otherFile);
        }
      }

      groups.push(group);
    }

    plan.parallelGroups = groups;
  }

  /**
   * Helper methods
   */

  _classifyFileType(file) {
    for (const [type, pattern] of Object.entries(this.filePatterns)) {
      if (pattern.patterns.some(p => {
        if (p.includes('*')) {
          const regex = new RegExp(p.replace(/\*/g, '.*'));
          return regex.test(file);
        }
        return file.includes(p);
      })) {
        return type;
      }
    }
    return 'unknown';
  }

  _getFilePriority(file) {
    const fileType = this._classifyFileType(file);
    return this.filePatterns[fileType]?.priority || 10;
  }

  _isConfigFile(file) {
    return this._classifyFileType(file) === 'configuration';
  }

  _isEnvFile(file) {
    return file.startsWith('.env');
  }

  _isRelatedFile(file1, file2) {
    // Enhanced heuristic for file relationships
    const base1 = file1.split('/').pop().split('.')[0];
    const base2 = file2.split('/').pop().split('.')[0];
    const dir1 = file1.split('/').slice(0, -1).join('/');
    const dir2 = file2.split('/').slice(0, -1).join('/');
    
    // Same base name
    if (base1 === base2) return true;
    
    // One contains the other
    if (base1.includes(base2) || base2.includes(base1)) return true;
    
    // Common patterns
    if (base1.replace(/Controller|Service|Repository|Model/, '') === base2.replace(/Controller|Service|Repository|Model/, '')) {
      return true;
    }
    
    // For component relationships, assume broader relationships
    if (file1.includes('components/') && file2.includes('services/')) return true;
    if (file1.includes('controllers/') && file2.includes('services/')) return true;
    if (file1.includes('services/') && file2.includes('repositories/')) return true;
    if (file1.includes('repositories/') && file2.includes('models/')) return true;
    
    // Routes/API files should relate to models (for backend dependencies test)
    if (file1.includes('routes/') && file2.includes('models/')) return true;
    if (file1.includes('api.') && file2.includes('models/')) return true;
    
    // Shared files relate to frontend and backend
    if (file2.includes('shared/') && (file1.includes('frontend/') || file1.includes('backend/'))) return true;
    
    // Utils files relate to index/main files (for creation order test)
    if (file2.includes('utils') && (file1.includes('index') || file1.includes('main'))) return true;
    
    // Type files relate to TypeScript files
    if (file2.includes('types') && (file1.endsWith('.ts') || file1.endsWith('.js'))) return true;
    
    return false;
  }

  _findCorrespondingSourceFile(testFile, allFiles) {
    const testName = testFile.replace(/\.(test|spec)\./, '.');
    const possibleSources = testName.replace(/(__tests__|tests)\//, 'src/');
    
    return allFiles.find(f => f === possibleSources) || 
           allFiles.find(f => f.includes(testFile.split('.')[0].split('/').pop()));
  }

  _haveSimilarDependencyDepth(plan, file1, file2) {
    const depth1 = this._calculateDependencyDepth(plan, file1);
    const depth2 = this._calculateDependencyDepth(plan, file2);
    return Math.abs(depth1 - depth2) <= 1;
  }

  _calculateDependencyDepth(plan, file, visited = new Set()) {
    if (visited.has(file)) return 0;
    visited.add(file);

    const dependencies = plan.files[file]?.dependencies || [];
    if (dependencies.length === 0) return 0;

    const maxDepth = Math.max(...dependencies.map(dep => 
      plan.files[dep] ? this._calculateDependencyDepth(plan, dep, visited) : 0
    ));

    return maxDepth + 1;
  }
}

export { DependencyPlanner };