/**
 * DependencyPlanner - Plans package dependencies and module relationships
 * 
 * Handles package dependency detection, import/export planning,
 * and module dependency management for development projects.
 */

class DependencyPlanner {
  constructor(config = {}) {
    this.config = {
      includeDevDependencies: true,
      autoDetectVersions: true,
      packageManager: 'npm',
      moduleSystem: 'auto', // 'auto', 'commonjs', 'es6'
      versionStrategy: 'latest-stable',
      ...config
    };

    // Dependency mappings for different technologies and features
    this.dependencyMappings = {
      frontend: {
        technologies: {
          html: [],
          css: [],
          javascript: [],
          typescript: ['typescript', '@types/node'],
          react: ['react', 'react-dom'],
          vue: ['vue'],
          angular: ['@angular/core', '@angular/common']
        },
        features: {
          form: ['validator'],
          validation: ['joi', 'yup'],
          routing: ['react-router-dom', 'vue-router'],
          state: ['redux', 'vuex', 'zustand'],
          styling: ['styled-components', 'emotion'],
          testing: ['jest', '@testing-library/react', '@testing-library/jest-dom'],
          bundling: ['webpack', 'vite', 'parcel'],
          linting: ['eslint', 'prettier']
        }
      },
      backend: {
        technologies: {
          nodejs: ['node'],
          express: ['express'],
          fastify: ['fastify'],
          koa: ['koa'],
          typescript: ['typescript', '@types/node'],
          mongodb: ['mongodb', 'mongoose'],
          mysql: ['mysql2'],
          postgresql: ['pg'],
          redis: ['redis'],
          websocket: ['ws', 'socket.io']
        },
        features: {
          api: ['cors', 'helmet'],
          auth: ['jsonwebtoken', 'bcrypt', 'passport'],
          validation: ['joi', 'express-validator'],
          logging: ['winston', 'morgan'],
          testing: ['jest', 'supertest'],
          docs: ['swagger-jsdoc', 'swagger-ui-express'],
          database: ['dotenv'],
          cache: ['node-cache'],
          upload: ['multer'],
          email: ['nodemailer']
        }
      },
      development: {
        common: ['nodemon', 'concurrently'],
        typescript: ['ts-node', '@types/jest'],
        testing: ['jest', 'mocha', 'chai'],
        linting: ['eslint', 'prettier'],
        bundling: ['webpack', 'rollup', 'esbuild'],
        git: ['husky', 'lint-staged']
      }
    };

    // Version mappings for stable versions
    this.stableVersions = {
      'express': '^4.18.0',
      'mongodb': '^5.0.0',
      'mongoose': '^7.0.0',
      'react': '^18.0.0',
      'vue': '^3.0.0',
      'typescript': '^5.0.0',
      'jest': '^29.0.0',
      'eslint': '^8.0.0',
      'prettier': '^2.8.0',
      'nodemon': '^2.0.0',
      'jsonwebtoken': '^9.0.0',
      'bcrypt': '^5.1.0',
      'cors': '^2.8.0',
      'helmet': '^6.0.0',
      'joi': '^17.0.0',
      'winston': '^3.8.0'
    };
  }

  /**
   * Detect package dependencies based on project analysis
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Object} Dependencies object with runtime and development deps
   */
  detectPackageDependencies(analysis) {
    if (!analysis) {
      throw new Error('Analysis is required');
    }

    if (!analysis.projectType) {
      throw new Error('Project type is required');
    }

    const dependencies = {
      runtime: new Set(),
      development: new Set(),
      peer: new Set(),
      optional: new Set()
    };

    // Add technology-based dependencies
    this._addTechnologyDependencies(dependencies, analysis);

    // Add feature-based dependencies
    this._addFeatureDependencies(dependencies, analysis);

    // Add development dependencies
    if (this.config.includeDevDependencies) {
      this._addDevelopmentDependencies(dependencies, analysis);
    }

    // Convert sets to arrays
    return {
      runtime: Array.from(dependencies.runtime),
      development: Array.from(dependencies.development),
      peer: Array.from(dependencies.peer),
      optional: Array.from(dependencies.optional)
    };
  }

  /**
   * Plan import/export statements for modules
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Object} Import/export plan
   */
  planImportExports(analysis) {
    const moduleSystem = this._determineModuleSystem(analysis);
    
    const plan = {
      moduleSystem,
      imports: [],
      exports: [],
      typeImports: [],
      componentImports: [],
      serviceImports: []
    };

    // Plan basic imports based on technologies
    this._planTechnologyImports(plan, analysis);

    // Plan component imports for modular structures
    if (analysis.complexity !== 'low') {
      this._planComponentImports(plan, analysis);
    }

    // Plan service imports for API integration
    this._planServiceImports(plan, analysis);

    // Plan type imports for TypeScript
    if (this._usesTypeScript(analysis)) {
      this._planTypeImports(plan, analysis);
    }

    return plan;
  }

  /**
   * Plan module dependencies and relationships
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Object} Module dependency graph
   */
  planModuleDependencies(analysis) {
    const nodes = [];
    const edges = [];

    // Create nodes for each component/module
    const components = this._extractComponents(analysis);
    
    for (const component of components) {
      nodes.push({
        id: component.name,
        type: component.type,
        dependencies: component.dependencies || []
      });

      // Create edges for dependencies
      for (const dep of component.dependencies || []) {
        edges.push({
          from: component.name,
          to: dep,
          type: 'dependency'
        });
      }
    }

    return {
      nodes,
      edges,
      loadOrder: this.generateLoadOrder(nodes),
      circularDependencies: this.detectCircularDependencies(nodes)
    };
  }

  /**
   * Detect circular dependencies in modules
   * 
   * @param {Array} modules - Array of modules with dependencies
   * @returns {Object} Circular dependency detection result
   */
  detectCircularDependencies(modules) {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (moduleName, path) => {
      if (recursionStack.has(moduleName)) {
        // Found a cycle
        const cycleStart = path.indexOf(moduleName);
        cycles.push(path.slice(cycleStart));
        return true;
      }

      if (visited.has(moduleName)) {
        return false;
      }

      visited.add(moduleName);
      recursionStack.add(moduleName);

      const module = modules.find(m => m.name === moduleName);
      if (module && module.dependencies) {
        for (const dep of module.dependencies) {
          if (dfs(dep, [...path, moduleName])) {
            return true;
          }
        }
      }

      recursionStack.delete(moduleName);
      return false;
    };

    for (const module of modules) {
      if (!visited.has(module.name)) {
        dfs(module.name, []);
      }
    }

    return {
      hasCircularDependencies: cycles.length > 0,
      cycles,
      affectedModules: [...new Set(cycles.flat())]
    };
  }

  /**
   * Generate optimal load order for modules
   * 
   * @param {Array} modules - Array of modules with dependencies
   * @returns {Array} Ordered array of module names
   */
  generateLoadOrder(modules) {
    const visited = new Set();
    const loadOrder = [];

    const visit = (moduleName) => {
      if (visited.has(moduleName)) {
        return;
      }

      const module = modules.find(m => m.name === moduleName);
      if (module && module.dependencies) {
        for (const dep of module.dependencies) {
          visit(dep);
        }
      }

      visited.add(moduleName);
      loadOrder.push(moduleName);
    };

    for (const module of modules) {
      visit(module.name);
    }

    return loadOrder;
  }

  /**
   * Plan lazy loading strategy for complex projects
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Object} Lazy loading plan
   */
  planLazyLoading(analysis) {
    if (analysis.complexity !== 'high') {
      return {
        lazyModules: [],
        loadingStrategy: 'eager',
        reason: 'Project complexity does not warrant lazy loading'
      };
    }

    const features = [
      ...(analysis.components?.frontend?.features || []),
      ...(analysis.components?.backend?.features || [])
    ];

    const lazyModules = [];
    
    // Features that benefit from lazy loading
    const lazyFeatures = ['dashboard', 'admin', 'charts', 'reports', 'settings'];
    
    for (const feature of features) {
      if (lazyFeatures.includes(feature)) {
        lazyModules.push({
          name: `${feature}Module`,
          trigger: 'route',
          priority: 'low'
        });
      }
    }

    return {
      lazyModules,
      loadingStrategy: 'dynamic',
      preloadStrategy: 'intersection-observer',
      chunkNames: lazyModules.map(m => m.name)
    };
  }

  /**
   * Plan code splitting strategy
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Object} Code splitting plan
   */
  planCodeSplitting(analysis) {
    if (analysis.complexity === 'low') {
      return {
        chunks: ['main'],
        strategy: 'single-bundle',
        reason: 'Simple project does not need code splitting'
      };
    }

    const chunks = ['vendor', 'common', 'main'];
    
    const features = [
      ...(analysis.components?.frontend?.features || []),
      ...(analysis.components?.backend?.features || [])
    ];

    // Create feature-based chunks for complex projects
    if (analysis.complexity === 'high') {
      const featureChunks = ['auth', 'dashboard', 'admin', 'forms'];
      
      for (const feature of features) {
        if (featureChunks.includes(feature)) {
          chunks.push(feature);
        }
      }
    }

    return {
      chunks,
      strategy: analysis.complexity === 'high' ? 'feature-based' : 'layer-based',
      splitPoints: chunks.filter(c => !['vendor', 'common', 'main'].includes(c)),
      optimization: {
        splitChunks: true,
        minimize: true,
        treeshaking: true
      }
    };
  }

  /**
   * Generate package.json based on analysis
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Object} Package.json object
   */
  generatePackageJson(analysis) {
    const dependencies = this.detectPackageDependencies(analysis);
    
    const packageJson = {
      name: this._generateProjectName(analysis),
      version: '1.0.0',
      description: analysis.task || 'Generated project',
      main: this._getMainFile(analysis),
      scripts: this._generateScripts(analysis),
      keywords: this._generateKeywords(analysis),
      author: '',
      license: 'MIT',
      dependencies: {},
      devDependencies: {}
    };

    // Add runtime dependencies with versions
    for (const dep of dependencies.runtime) {
      packageJson.dependencies[dep] = this._getVersion(dep);
    }

    // Add development dependencies with versions
    for (const dep of dependencies.development) {
      packageJson.devDependencies[dep] = this._getVersion(dep);
    }

    // Add type field for ES modules
    if (this._usesESModules(analysis)) {
      packageJson.type = 'module';
    }

    return packageJson;
  }

  /**
   * Suggest compatible versions for dependencies
   * 
   * @param {Array} dependencies - Array of dependency names
   * @returns {Object} Dependency versions map
   */
  suggestVersions(dependencies) {
    const versions = {};
    
    for (const dep of dependencies) {
      versions[dep] = this._getVersion(dep);
    }

    return versions;
  }

  /**
   * Resolve version conflicts between dependencies
   * 
   * @param {Array} dependencies - Array of dependency objects with version conflicts
   * @returns {Object} Conflict resolution result
   */
  resolveVersionConflicts(dependencies) {
    const conflicts = new Map();
    const resolutions = {};

    // Group dependencies by name
    for (const dep of dependencies) {
      if (!conflicts.has(dep.name)) {
        conflicts.set(dep.name, []);
      }
      conflicts.get(dep.name).push(dep);
    }

    // Identify conflicts
    const hasConflicts = Array.from(conflicts.values()).some(deps => 
      new Set(deps.map(d => d.version)).size > 1
    );

    // Resolve conflicts by choosing highest compatible version
    for (const [name, deps] of conflicts) {
      if (deps.length > 1) {
        const versions = deps.map(d => d.version);
        resolutions[name] = this._resolveVersionConflict(versions);
      }
    }

    return {
      hasConflicts,
      conflicts: Array.from(conflicts.entries()).filter(([_, deps]) => deps.length > 1),
      resolutions
    };
  }

  /**
   * Suggest peer dependencies based on technologies
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Array} Suggested peer dependencies
   */
  suggestPeerDependencies(analysis) {
    const peerDeps = [];
    const technologies = [
      ...(analysis.components?.frontend?.technologies || []),
      ...(analysis.components?.backend?.technologies || [])
    ];

    // React peer dependencies
    if (technologies.includes('react')) {
      peerDeps.push('react', 'react-dom');
    }

    // TypeScript peer dependencies
    if (technologies.includes('typescript')) {
      peerDeps.push('typescript');
    }

    return peerDeps;
  }

  /**
   * Generate install commands for different package managers
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Object} Install commands
   */
  generateInstallCommands(analysis) {
    const dependencies = this.detectPackageDependencies(analysis);
    
    const runtimeDeps = dependencies.runtime.join(' ');
    const devDeps = dependencies.development.join(' ');

    return {
      npm: {
        install: `npm install ${runtimeDeps}`,
        installDev: `npm install --save-dev ${devDeps}`,
        combined: `npm install ${runtimeDeps} && npm install --save-dev ${devDeps}`
      },
      yarn: {
        install: `yarn add ${runtimeDeps}`,
        installDev: `yarn add --dev ${devDeps}`,
        combined: `yarn add ${runtimeDeps} && yarn add --dev ${devDeps}`
      },
      pnpm: {
        install: `pnpm add ${runtimeDeps}`,
        installDev: `pnpm add --save-dev ${devDeps}`,
        combined: `pnpm add ${runtimeDeps} && pnpm add --save-dev ${devDeps}`
      }
    };
  }

  /**
   * Generate lockfile recommendations
   * 
   * @param {Object} analysis - Project analysis
   * @returns {Object} Lockfile recommendations
   */
  generateLockfileRecommendations(analysis) {
    const recommendations = {
      'package-lock.json': {
        packageManager: 'npm',
        pros: ['Built-in with npm', 'Widely supported'],
        cons: ['Slower than alternatives']
      },
      'yarn.lock': {
        packageManager: 'yarn',
        pros: ['Faster installs', 'Better workspace support'],
        cons: ['Additional tool dependency']
      },
      'pnpm-lock.yaml': {
        packageManager: 'pnpm',
        pros: ['Disk space efficient', 'Fast installs'],
        cons: ['Less widespread adoption']
      }
    };

    // Default recommendation based on project complexity
    const recommended = analysis.complexity === 'high' ? 'yarn.lock' : 'package-lock.json';

    return {
      recommended,
      reasoning: analysis.complexity === 'high' 
        ? 'Complex project benefits from Yarn\'s workspace and performance features'
        : 'Standard npm lockfile is sufficient for this project',
      options: recommendations
    };
  }

  // Private helper methods

  /**
   * Add technology-based dependencies
   * @private
   */
  _addTechnologyDependencies(dependencies, analysis) {
    const allTechnologies = [
      ...(analysis.components?.frontend?.technologies || []),
      ...(analysis.components?.backend?.technologies || [])
    ];

    for (const tech of allTechnologies) {
      // Frontend technologies
      if (this.dependencyMappings.frontend.technologies[tech]) {
        for (const dep of this.dependencyMappings.frontend.technologies[tech]) {
          if (dep === 'typescript' || dep.startsWith('@types/')) {
            dependencies.development.add(dep);
          } else {
            dependencies.runtime.add(dep);
          }
        }
      }

      // Backend technologies
      if (this.dependencyMappings.backend.technologies[tech]) {
        for (const dep of this.dependencyMappings.backend.technologies[tech]) {
          if (dep === 'typescript' || dep.startsWith('@types/')) {
            dependencies.development.add(dep);
          } else {
            dependencies.runtime.add(dep);
          }
        }
      }
    }
  }

  /**
   * Add feature-based dependencies
   * @private
   */
  _addFeatureDependencies(dependencies, analysis) {
    const allFeatures = [
      ...(analysis.components?.frontend?.features || []),
      ...(analysis.components?.backend?.features || [])
    ];

    for (const feature of allFeatures) {
      // Frontend features
      if (this.dependencyMappings.frontend.features[feature]) {
        for (const dep of this.dependencyMappings.frontend.features[feature]) {
          if (feature === 'testing' || dep.includes('test') || dep.includes('jest')) {
            dependencies.development.add(dep);
          } else {
            dependencies.runtime.add(dep);
          }
        }
      }

      // Backend features
      if (this.dependencyMappings.backend.features[feature]) {
        for (const dep of this.dependencyMappings.backend.features[feature]) {
          if (feature === 'testing' || dep.includes('test') || dep.includes('jest')) {
            dependencies.development.add(dep);
          } else {
            dependencies.runtime.add(dep);
          }
        }
      }
    }
  }

  /**
   * Add development dependencies
   * @private
   */
  _addDevelopmentDependencies(dependencies, analysis) {
    // Always add nodemon for backend projects
    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      dependencies.development.add('nodemon');
    }

    // Add TypeScript development dependencies
    if (this._usesTypeScript(analysis)) {
      dependencies.development.add('typescript');
      dependencies.development.add('@types/node');
      dependencies.development.add('ts-node');
    }

    // Add common development tools
    dependencies.development.add('eslint');
    dependencies.development.add('prettier');
  }

  /**
   * Determine module system based on analysis
   * @private
   */
  _determineModuleSystem(analysis) {
    if (this.config.moduleSystem !== 'auto') {
      return this.config.moduleSystem;
    }

    // TypeScript and modern frontend typically use ES6
    if (this._usesTypeScript(analysis) || analysis.projectType === 'frontend') {
      return 'es6';
    }

    // Backend Node.js typically uses CommonJS
    return 'commonjs';
  }

  /**
   * Check if project uses TypeScript
   * @private
   */
  _usesTypeScript(analysis) {
    const allTechnologies = [
      ...(analysis.components?.frontend?.technologies || []),
      ...(analysis.components?.backend?.technologies || [])
    ];
    return allTechnologies.includes('typescript');
  }

  /**
   * Check if project uses ES modules
   * @private
   */
  _usesESModules(analysis) {
    return this._determineModuleSystem(analysis) === 'es6';
  }

  /**
   * Plan technology-specific imports
   * @private
   */
  _planTechnologyImports(plan, analysis) {
    const moduleSystem = plan.moduleSystem;
    
    if (moduleSystem === 'es6') {
      plan.imports.push('import express from \'express\';');
      plan.imports.push('import cors from \'cors\';');
    } else {
      plan.imports.push('const express = require(\'express\');');
      plan.imports.push('const cors = require(\'cors\');');
    }
  }

  /**
   * Plan component imports
   * @private
   */
  _planComponentImports(plan, analysis) {
    const features = analysis.components?.frontend?.features || [];
    
    for (const feature of features) {
      if (['form', 'navigation', 'auth'].includes(feature)) {
        const componentName = this._capitalizeFirst(feature) + 'Component';
        if (plan.moduleSystem === 'es6') {
          plan.componentImports.push(`import ${componentName} from './components/${componentName}.js';`);
        } else {
          plan.componentImports.push(`const ${componentName} = require('./components/${componentName}');`);
        }
      }
    }
  }

  /**
   * Plan service imports
   * @private
   */
  _planServiceImports(plan, analysis) {
    const frontendFeatures = analysis.components?.frontend?.features || [];
    const backendFeatures = analysis.components?.backend?.features || [];
    
    if (analysis.projectType === 'fullstack' || 
        frontendFeatures.includes('api-client') ||
        backendFeatures.includes('api')) {
      if (plan.moduleSystem === 'es6') {
        plan.serviceImports.push('import ApiService from \'./services/api/ApiService.js\';');
      } else {
        plan.serviceImports.push('const ApiService = require(\'./services/api/ApiService\');');
      }
    }
  }

  /**
   * Plan TypeScript type imports
   * @private
   */
  _planTypeImports(plan, analysis) {
    plan.typeImports.push('import type { Request, Response } from \'express\';');
    plan.typeImports.push('import type { User, ApiResponse } from \'./types/index.js\';');
  }

  /**
   * Extract components from analysis
   * @private
   */
  _extractComponents(analysis) {
    const components = [];
    const features = [
      ...(analysis.components?.frontend?.features || []),
      ...(analysis.components?.backend?.features || [])
    ];

    for (const feature of features) {
      components.push({
        name: this._capitalizeFirst(feature) + 'Component',
        type: analysis.projectType.includes('frontend') ? 'component' : 'module',
        dependencies: this._getComponentDependencies(feature)
      });
    }

    return components;
  }

  /**
   * Get dependencies for a component
   * @private
   */
  _getComponentDependencies(feature) {
    const dependencyMap = {
      auth: ['FormComponent'],
      dashboard: ['AuthComponent'],
      admin: ['AuthComponent'],
      form: [],
      navigation: []
    };

    return dependencyMap[feature] || [];
  }

  /**
   * Generate project name from analysis
   * @private
   */
  _generateProjectName(analysis) {
    if (analysis.task) {
      return analysis.task.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
    return 'my-project';
  }

  /**
   * Get main file based on project type
   * @private
   */
  _getMainFile(analysis) {
    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      return this._usesTypeScript(analysis) ? 'dist/server.js' : 'server.js';
    }
    return 'index.js';
  }

  /**
   * Generate scripts for package.json
   * @private
   */
  _generateScripts(analysis) {
    const scripts = {};

    if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
      scripts.start = 'node server.js';
      scripts.dev = 'nodemon server.js';
    }

    if (this._usesTypeScript(analysis)) {
      scripts.build = 'tsc';
      scripts['type-check'] = 'tsc --noEmit';
    }

    const hasTestingFeature = [
      ...(analysis.components?.frontend?.features || []),
      ...(analysis.components?.backend?.features || [])
    ].includes('testing');

    if (hasTestingFeature) {
      scripts.test = 'jest';
      scripts['test:watch'] = 'jest --watch';
    }

    scripts.lint = 'eslint .';
    scripts['lint:fix'] = 'eslint . --fix';

    return scripts;
  }

  /**
   * Generate keywords for package.json
   * @private
   */
  _generateKeywords(analysis) {
    const keywords = [analysis.projectType];
    
    const allFeatures = [
      ...(analysis.components?.frontend?.features || []),
      ...(analysis.components?.backend?.features || [])
    ];

    keywords.push(...allFeatures);
    
    const allTechnologies = [
      ...(analysis.components?.frontend?.technologies || []),
      ...(analysis.components?.backend?.technologies || [])
    ];

    keywords.push(...allTechnologies);

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Get version for a dependency
   * @private
   */
  _getVersion(dependency) {
    return this.stableVersions[dependency] || '^1.0.0';
  }

  /**
   * Resolve version conflict by choosing highest version
   * @private
   */
  _resolveVersionConflict(versions) {
    // Simple implementation - in real world, would use semver comparison
    return versions.sort((a, b) => b.localeCompare(a))[0];
  }

  /**
   * Capitalize first letter
   * @private
   */
  _capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export { DependencyPlanner };