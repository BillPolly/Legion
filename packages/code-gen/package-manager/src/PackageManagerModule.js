/**
 * PackageManagerModule - Legion module for Node.js package management
 * 
 * Provides tools for npm operations, dependency analysis, and package.json management
 */

import { Module } from '@legion/module-loader';
import { InstallPackageTool } from './tools/InstallPackageTool.js';
import { CreatePackageJsonTool } from './tools/CreatePackageJsonTool.js';

export class PackageManagerModule extends Module {
  constructor(dependencies = {}) {
    super('PackageManagerModule', dependencies);
    this.description = 'Node.js package management tools for npm operations, dependency analysis, and package.json management';
    this.version = '1.0.0';
  }

  /**
   * Static async factory method following the Async Resource Manager Pattern
   */
  static async create(resourceManager) {
    const dependencies = {
      resourceManager: resourceManager
    };

    const module = new PackageManagerModule(dependencies);
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    if (this.initialized) return;

    // Initialize tools
    this.tools = [
      new InstallPackageTool(),
      new CreatePackageJsonTool()
      // TODO: Add remaining tools (install_packages, validate_package_json, analyze_dependencies, etc.)
    ];

    await super.initialize();
  }

  /**
   * Get all tools provided by this module
   */
  getTools() {
    if (!this.initialized) {
      throw new Error('PackageManagerModule must be initialized before getting tools');
    }

    return this.tools;
  }

  /**
   * Get tool by name
   */
  getTool(name) {
    return this.tools.find(tool => tool.name === name);
  }

  /**
   * Setup complete Node.js project
   * Convenience method that orchestrates multiple tools
   */
  async setupProject(projectSpec) {
    const results = {
      packageJson: null,
      installations: [],
      scripts: []
    };

    try {
      // Create package.json
      if (projectSpec.packageJson) {
        const packageResult = await this.getTool('create_package_json').execute(projectSpec.packageJson);
        results.packageJson = packageResult;
      }

      // Install dependencies
      if (projectSpec.dependencies && projectSpec.dependencies.length > 0) {
        const installTool = this.getTool('install_package');
        
        for (const dep of projectSpec.dependencies) {
          const depConfig = {
            ...dep,
            projectPath: projectSpec.projectPath || projectSpec.packageJson?.projectPath
          };
          
          const installResult = await installTool.execute(depConfig);
          results.installations.push(installResult);
        }
      }

      return {
        success: true,
        results,
        summary: {
          packageJsonCreated: results.packageJson?.created || false,
          packagesInstalled: results.installations.filter(r => r.status === 'installed').length,
          packagesFailed: results.installations.filter(r => r.status === 'error').length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }

  /**
   * Cleanup the module
   */
  async cleanup() {
    this.tools = [];
    await super.cleanup();
  }

  /**
   * Get module metadata
   */
  getMetadata() {
    return {
      name: this.name,
      description: this.description,
      version: this.version,
      author: 'Legion Team',
      tools: this.getTools().length,
      capabilities: [
        'npm package installation',
        'Package.json generation and management',
        'Dependency analysis and conflict detection',
        'Security vulnerability scanning',
        'npm script management',
        'Package validation and integrity checks'
      ],
      supportedFeatures: [
        'Single and batch package installation',
        'Dev and production dependencies',
        'Custom npm registries',
        'Semver version validation',
        'Package.json presets',
        'Dependency tree analysis',
        'Security audit integration',
        'npm script execution'
      ]
    };
  }
}

export default PackageManagerModule;