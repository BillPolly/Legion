/**
 * Module Discovery Service
 * 
 * Comprehensive module discovery system that can find and catalog all module types
 * in the Legion framework, including class modules, JSON modules, definition modules,
 * factory modules, and legacy patterns.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export class ModuleDiscoveryService {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      maxDepth: options.maxDepth || 5,
      timeout: options.timeout || 5000,
      patterns: options.patterns || this.getDefaultPatterns(),
      excludePatterns: options.excludePatterns || this.getDefaultExcludes(),
      ...options
    };
    
    this.discoveredModules = new Map();
    this.errors = [];
  }

  /**
   * Get default file patterns to search for modules
   */
  getDefaultPatterns() {
    return {
      classModules: [
        // Module class files in tools package
        '**/packages/tools/src/**/FileModule.js',
        '**/packages/tools/src/**/CalculatorModule.js',
        '**/packages/tools/src/**/JsonModule.js',
        '**/packages/tools/src/**/AIGenerationModule.js',
        '**/packages/tools/src/**/GithubModule.js',
        '**/packages/tools/src/**/SerperModule.js',
        '**/packages/tools/src/**/SystemModule.js',
        '**/packages/tools/src/**/CommandExecutorModule.js',
        '**/packages/tools/src/**/CrawlerModule.js',
        '**/packages/tools/src/**/DatabaseModule.js',
        '**/packages/tools/src/**/EncodeModule.js',
        '**/packages/tools/src/**/FileAnalysisModule.js',
        '**/packages/tools/src/**/PageScreenshoterModule.js',
        '**/packages/tools/src/**/ServerStarterModule.js',
        '**/packages/tools/src/**/WebpageToMarkdownModule.js',
        '**/packages/tools/src/**/YoutubeTranscriptModule.js',
        // Index files that export modules
        '**/packages/tools/src/file/index.js',
        '**/packages/tools/src/calculator/index.js',
        '**/packages/tools/src/json/index.js',
        '**/packages/tools/src/ai-generation/index.js',
        '**/packages/tools/src/github/index.js',
        '**/packages/tools/src/serper/index.js',
        '**/packages/tools/src/system/index.js',
        '**/packages/tools/src/command-executor/index.js',
        '**/packages/tools/src/crawler/index.js',
        '**/packages/tools/src/database/index.js',
        '**/packages/tools/src/encode/index.js',
        '**/packages/tools/src/file-analysis/index.js',
        '**/packages/tools/src/page-screenshoter/index.js',
        '**/packages/tools/src/server-starter/index.js',
        '**/packages/tools/src/webpage-to-markdown/index.js',
        '**/packages/tools/src/youtube-transcript/index.js',
        // Modules in other packages
        '**/packages/aiur/src/modules/*.js',
        '**/packages/module-loader/src/modules/*.js',
        '**/packages/ai-sdk/src/*Module.js',
        '**/packages/llm-client/src/*Module.js',
        '**/packages/planning/*/src/*Module.js',
        '**/packages/semantic-search/src/*Module.js'
      ],
      jsonModules: [
        // Module configuration files
        '**/packages/*/module.json',
        '**/packages/*/src/module.json',
        '**/packages/tools/src/*/module.json'
      ],
      definitionModules: [
        // Module definitions
        '**/packages/*/src/*Definition.js',
        '**/packages/*/src/definitions/*.js'
      ],
      indexFiles: [
        // Index files that might export tools
        '**/packages/tools/src/*/index.js'
      ]
    };
  }

  /**
   * Get default exclusion patterns
   */
  getDefaultExcludes() {
    return [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/test/**',
      '**/__tests__/**',
      '**/*.test.js',
      '**/*.spec.js',
      '**/*.test.mjs',
      '**/*.spec.mjs',
      '**/examples/**',
      '**/docs/**',
      '**/scratch/**',
      '**/tmp/**',
      '**/temp/**',
      '**/scripts/**',
      '**/utils/**',
      '**/*Example.js',
      '**/*Test.js',
      '**/*Mock.js',
      '**/*Stub.js',
      '**/test-*.js',
      '**/mock-*.js',
      '**/discovery/**'  // Exclude the discovery system itself
    ];
  }

  /**
   * Discover all modules in a directory tree
   */
  async discoverModules(rootPath) {
    this.discoveredModules.clear();
    this.errors = [];
    
    if (this.options.verbose) {
      console.log(`🔍 Starting module discovery from: ${rootPath}`);
    }
    
    try {
      // Verify root path exists
      await fs.access(rootPath);
      
      // Discover different module types in parallel
      const [classModules, jsonModules, definitionModules] = await Promise.all([
        this.discoverClassModules(rootPath),
        this.discoverJsonModules(rootPath),
        this.discoverDefinitionModules(rootPath)
      ]);
      
      // Merge results
      const allModules = [
        ...classModules,
        ...jsonModules,
        ...definitionModules
      ];
      
      // Deduplicate and catalog
      for (const module of allModules) {
        const key = this.getModuleKey(module);
        if (!this.discoveredModules.has(key)) {
          this.discoveredModules.set(key, module);
        } else {
          // Merge metadata if module already exists
          const existing = this.discoveredModules.get(key);
          this.discoveredModules.set(key, this.mergeModuleData(existing, module));
        }
      }
      
      if (this.options.verbose) {
        console.log(`✅ Discovered ${this.discoveredModules.size} unique modules`);
        if (this.errors.length > 0) {
          console.log(`⚠️  Encountered ${this.errors.length} errors during discovery`);
        }
      }
      
    } catch (error) {
      this.errors.push({
        phase: 'discovery',
        path: rootPath,
        error: error.message
      });
      throw new Error(`Module discovery failed: ${error.message}`);
    }
    
    return Array.from(this.discoveredModules.values());
  }

  /**
   * Discover class-based modules
   */
  async discoverClassModules(rootPath) {
    const modules = [];
    
    try {
      const files = await this.findFiles(rootPath, this.options.patterns.classModules);
      
      for (const filePath of files) {
        try {
          const moduleData = await this.analyzeClassModule(filePath);
          if (moduleData) {
            modules.push(moduleData);
          }
        } catch (error) {
          this.errors.push({
            type: 'class-module',
            path: filePath,
            error: error.message
          });
        }
      }
    } catch (error) {
      this.errors.push({
        phase: 'class-discovery',
        error: error.message
      });
    }
    
    return modules;
  }

  /**
   * Discover JSON-based modules
   */
  async discoverJsonModules(rootPath) {
    const modules = [];
    
    try {
      const files = await this.findFiles(rootPath, this.options.patterns.jsonModules);
      
      for (const filePath of files) {
        try {
          const moduleData = await this.analyzeJsonModule(filePath);
          if (moduleData) {
            modules.push(moduleData);
          }
        } catch (error) {
          this.errors.push({
            type: 'json-module',
            path: filePath,
            error: error.message
          });
        }
      }
    } catch (error) {
      this.errors.push({
        phase: 'json-discovery',
        error: error.message
      });
    }
    
    return modules;
  }

  /**
   * Discover definition-based modules
   */
  async discoverDefinitionModules(rootPath) {
    const modules = [];
    
    try {
      const files = await this.findFiles(rootPath, this.options.patterns.definitionModules);
      
      for (const filePath of files) {
        try {
          const moduleData = await this.analyzeDefinitionModule(filePath);
          if (moduleData) {
            modules.push(moduleData);
          }
        } catch (error) {
          this.errors.push({
            type: 'definition-module',
            path: filePath,
            error: error.message
          });
        }
      }
    } catch (error) {
      this.errors.push({
        phase: 'definition-discovery',
        error: error.message
      });
    }
    
    return modules;
  }

  /**
   * Analyze a class module file
   */
  async analyzeClassModule(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath, path.extname(filePath));
    const dirName = path.basename(path.dirname(filePath));
    
    // Skip test files and examples that might have been missed
    if (content.includes('describe(') || content.includes('it(') || 
        content.includes('test(') || content.includes('expect(') ||
        fileName.toLowerCase().includes('test') || 
        fileName.toLowerCase().includes('example') ||
        fileName.toLowerCase().includes('mock')) {
      return null;
    }
    
    // Extract class information
    const classMatch = content.match(/export\s+(?:default\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/);
    if (!classMatch) {
      return null;
    }
    
    const className = classMatch[1];
    const baseClass = classMatch[2];
    
    // Validate it's actually a module:
    // 1. Either extends Module/BaseModule/Tool
    // 2. Or has getTools() method
    // 3. Or is explicitly a Module class
    const isValidModule = 
      (baseClass && (baseClass === 'Module' || baseClass === 'BaseModule' || baseClass === 'Tool')) ||
      content.includes('getTools()') || 
      content.includes('getTools() {') ||
      className.endsWith('Module') ||
      fileName === 'index' ||  // index.js files in module directories
      content.includes('export const tools = ') ||
      content.includes('export const getTools = ');
    
    if (!isValidModule) {
      return null;
    }
    
    // Extract JSDoc description
    const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\/\s*(?:export\s+)?(?:default\s+)?class/);
    let description = `${className} module`;
    if (jsdocMatch) {
      const descMatch = jsdocMatch[0].match(/\*\s+([^@*\n][^\n]*)/);
      if (descMatch) {
        description = descMatch[1].trim();
      }
    }
    
    // Check for factory methods
    const hasCreateMethod = content.includes(`static async create`);
    const hasGetToolsMethod = content.includes('getTools()') || content.includes('getTools() {');
    
    // Extract imports to determine dependencies
    const dependencies = this.extractDependencies(content);
    
    // Determine if it needs ResourceManager
    const needsResourceManager = hasCreateMethod || 
                                 content.includes('resourceManager') ||
                                 content.includes('ResourceManager');
    
    // Use a cleaner name (remove "Module" suffix if it's redundant)
    let moduleName = className;
    if (className.endsWith('Module') && className !== 'Module') {
      moduleName = className.replace(/Module$/, '');
    }
    
    return {
      name: moduleName,
      type: 'class',
      path: filePath,
      className,
      baseClass,
      description,
      package: this.getPackageName(filePath),
      hasFactory: hasCreateMethod,
      hasGetTools: hasGetToolsMethod,
      needsResourceManager,
      dependencies,
      metadata: {
        fileName,
        dirName,
        relativePath: this.getRelativePath(filePath)
      }
    };
  }

  /**
   * Analyze a JSON module file
   */
  async analyzeJsonModule(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const dirName = path.basename(path.dirname(filePath));
    
    try {
      const moduleConfig = JSON.parse(content);
      
      // Check if it's actually a module config
      if (!moduleConfig.name && !moduleConfig.tools) {
        return null;
      }
      
      // Validate the module.json against schema before processing
      const { ModuleJsonSchemaValidator } = await import('../validation/ModuleJsonSchemaValidator.js');
      const validator = new ModuleJsonSchemaValidator();
      const validation = validator.validate(moduleConfig);
      
      if (!validation.valid) {
        const errorMessages = validation.errors.map(err => `  ${err.path}: ${err.message}`);
        throw new Error(`Invalid module.json at ${filePath}:\n${errorMessages.join('\n')}`);
      }
      
      // Log warnings if verbose mode is enabled
      if (validation.warnings && validation.warnings.length > 0 && this.options.verbose) {
        console.warn(`⚠️  Module '${moduleConfig.name}' warnings:`);
        validation.warnings.forEach(warning => {
          console.warn(`  ${warning.path}: ${warning.message}`);
        });
      }
      
      // Find the implementation file
      let implementationPath = null;
      if (moduleConfig.package) {
        implementationPath = path.join(path.dirname(filePath), moduleConfig.package);
      } else if (moduleConfig.main) {
        implementationPath = path.join(path.dirname(filePath), moduleConfig.main);
      } else {
        // Try to find index.js in the same directory
        const indexPath = path.join(path.dirname(filePath), 'index.js');
        try {
          await fs.access(indexPath);
          implementationPath = indexPath;
        } catch {
          // No index.js found
        }
      }
      
      return {
        name: moduleConfig.name || dirName,
        type: 'json',
        path: filePath,
        implementationPath,
        description: moduleConfig.description || `${moduleConfig.name || dirName} module`,
        version: moduleConfig.version,
        package: this.getPackageName(filePath),
        initialization: moduleConfig.initialization,
        tools: moduleConfig.tools || [],
        dependencies: moduleConfig.dependencies || {},
        metadata: {
          dirName,
          relativePath: this.getRelativePath(filePath),
          config: moduleConfig
        }
      };
    } catch (error) {
      throw new Error(`Invalid JSON in module file: ${error.message}`);
    }
  }

  /**
   * Analyze a definition module file
   */
  async analyzeDefinitionModule(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Extract definition class
    const classMatch = content.match(/export\s+(?:default\s+)?class\s+(\w+Definition)(?:\s+extends\s+(\w+))?/);
    if (!classMatch) {
      return null;
    }
    
    const className = classMatch[1];
    const baseClass = classMatch[2];
    
    // Check for static methods
    const hasGetMetadata = content.includes('static getMetadata');
    const hasCreate = content.includes('static async create');
    
    // Extract metadata if present
    let metadata = null;
    const metadataMatch = content.match(/static\s+getMetadata\(\)\s*{[\s\S]*?return\s+({[\s\S]*?});/);
    if (metadataMatch) {
      try {
        // This is a simplified extraction - in production we'd use AST parsing
        metadata = eval(`(${metadataMatch[1]})`);
      } catch {
        // Could not parse metadata
      }
    }
    
    return {
      name: className.replace('Definition', ''),
      type: 'definition',
      path: filePath,
      className,
      baseClass,
      description: metadata?.description || `${className} module`,
      package: this.getPackageName(filePath),
      hasGetMetadata,
      hasCreate,
      metadata: {
        fileName,
        relativePath: this.getRelativePath(filePath),
        definitionMetadata: metadata
      }
    };
  }

  /**
   * Find files matching patterns
   */
  async findFiles(rootPath, patterns) {
    const files = new Set();
    
    for (const pattern of patterns) {
      const foundFiles = await this.glob(rootPath, pattern);
      foundFiles.forEach(file => files.add(file));
    }
    
    // Filter out excluded patterns
    return Array.from(files).filter(file => {
      return !this.options.excludePatterns.some(pattern => 
        this.matchesPattern(file, pattern)
      );
    });
  }

  /**
   * Simple glob implementation
   */
  async glob(rootPath, pattern) {
    const files = [];
    const isRecursive = pattern.includes('**');
    const filePattern = pattern.split('/').pop();
    
    async function walk(dir) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && isRecursive) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            if (matchesFilePattern(entry.name, filePattern)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Ignore directories we can't read
      }
    }
    
    function matchesFilePattern(fileName, pattern) {
      if (pattern === '*') return true;
      if (pattern.startsWith('*')) {
        return fileName.endsWith(pattern.slice(1));
      }
      if (pattern.endsWith('*')) {
        return fileName.startsWith(pattern.slice(0, -1));
      }
      if (pattern.includes('*')) {
        const parts = pattern.split('*');
        return fileName.startsWith(parts[0]) && fileName.endsWith(parts[1]);
      }
      return fileName === pattern;
    }
    
    await walk(rootPath);
    return files;
  }

  /**
   * Check if a path matches a pattern
   */
  matchesPattern(filePath, pattern) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');
    
    if (normalizedPattern.includes('**')) {
      const parts = normalizedPattern.split('**');
      return parts.every(part => normalizedPath.includes(part));
    }
    
    return normalizedPath.includes(normalizedPattern);
  }

  /**
   * Extract dependencies from code
   */
  extractDependencies(content) {
    const dependencies = new Set();
    
    // Import statements
    const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      dependencies.add(match[1]);
    }
    
    // Require statements
    const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const match of requireMatches) {
      dependencies.add(match[1]);
    }
    
    return Array.from(dependencies);
  }

  /**
   * Get package name from file path
   */
  getPackageName(filePath) {
    const parts = filePath.split(path.sep);
    const packagesIndex = parts.indexOf('packages');
    
    if (packagesIndex !== -1 && packagesIndex < parts.length - 1) {
      return `@legion/${parts[packagesIndex + 1]}`;
    }
    
    return 'unknown';
  }

  /**
   * Get relative path from packages directory
   */
  getRelativePath(filePath) {
    const parts = filePath.split(path.sep);
    const packagesIndex = parts.indexOf('packages');
    
    if (packagesIndex !== -1) {
      return parts.slice(packagesIndex).join('/');
    }
    
    return filePath;
  }

  /**
   * Get unique key for a module
   */
  getModuleKey(module) {
    return `${module.package}:${module.name}:${module.type}`;
  }

  /**
   * Merge module data from different sources
   */
  mergeModuleData(existing, newData) {
    return {
      ...existing,
      ...newData,
      metadata: {
        ...existing.metadata,
        ...newData.metadata
      },
      dependencies: [
        ...new Set([
          ...(existing.dependencies || []),
          ...(newData.dependencies || [])
        ])
      ]
    };
  }

  /**
   * Get discovery errors
   */
  getErrors() {
    return this.errors;
  }

  /**
   * Get discovered modules
   */
  getDiscoveredModules() {
    return Array.from(this.discoveredModules.values());
  }

  /**
   * Get discovery statistics
   */
  getStats() {
    const modules = this.getDiscoveredModules();
    
    return {
      total: modules.length,
      byType: {
        class: modules.filter(m => m.type === 'class').length,
        json: modules.filter(m => m.type === 'json').length,
        definition: modules.filter(m => m.type === 'definition').length
      },
      byPackage: modules.reduce((acc, m) => {
        acc[m.package] = (acc[m.package] || 0) + 1;
        return acc;
      }, {}),
      withFactory: modules.filter(m => m.hasFactory).length,
      withTools: modules.filter(m => m.hasGetTools || m.tools).length,
      needsResourceManager: modules.filter(m => m.needsResourceManager).length,
      errors: this.errors.length
    };
  }
}