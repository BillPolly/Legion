import fs from 'fs/promises';
import path from 'path';

/**
 * ProjectValidator - Validates and analyzes Node.js projects for deployment
 */
class ProjectValidator {
  constructor() {
    this.frameworks = {
      express: ['express'],
      next: ['next'],
      react: ['react'],
      vue: ['vue'],
      angular: ['@angular/core'],
      fastify: ['fastify'],
      koa: ['koa'],
      nest: ['@nestjs/core']
    };

    this.testFrameworks = {
      jest: ['jest'],
      mocha: ['mocha'],
      vitest: ['vitest'],
      jasmine: ['jasmine']
    };
  }

  /**
   * Validate a project for deployment readiness
   */
  async validateProject(projectPath) {
    const result = {
      valid: false,
      type: null,
      projectInfo: {},
      errors: [],
      warnings: [],
      recommendations: []
    };

    try {
      // Check if project path exists
      const pathValid = await this.validateProjectPath(projectPath, result);
      if (!pathValid) return result;

      // Validate package.json
      const packageInfo = await this.validatePackageJson(projectPath, result);
      if (!packageInfo) return result;

      // Analyze project structure
      await this.analyzeProjectStructure(projectPath, packageInfo, result);

      // Check dependencies and frameworks
      this.analyzeDependencies(packageInfo, result);

      // Detect build configuration
      this.analyzeBuildConfiguration(packageInfo, result);

      // Check for security considerations
      await this.analyzeSecurityConfiguration(projectPath, result);

      // Generate recommendations
      this.generateRecommendations(result);

      result.valid = result.errors.length === 0;
      result.type = 'nodejs';

    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate project path exists
   */
  async validateProjectPath(projectPath, result) {
    try {
      await fs.access(projectPath);
      return true;
    } catch (error) {
      result.errors.push('Project path does not exist');
      result.valid = false;
      return false;
    }
  }

  /**
   * Validate and parse package.json
   */
  async validatePackageJson(projectPath, result) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    try {
      await fs.access(packageJsonPath);
    } catch (error) {
      result.errors.push('No package.json found');
      return null;
    }

    try {
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageInfo = JSON.parse(packageContent);

      result.projectInfo.name = packageInfo.name;
      result.projectInfo.version = packageInfo.version;
      result.projectInfo.main = packageInfo.main;
      result.projectInfo.scripts = packageInfo.scripts || {};
      result.projectInfo.dependencies = packageInfo.dependencies || {};
      result.projectInfo.devDependencies = packageInfo.devDependencies || {};

      return packageInfo;
    } catch (error) {
      result.errors.push('Invalid package.json format');
      return null;
    }
  }

  /**
   * Analyze project structure and files
   */
  async analyzeProjectStructure(projectPath, packageInfo, result) {
    // Check for start script
    result.projectInfo.hasStartScript = !!(packageInfo.scripts && packageInfo.scripts.start);
    if (!result.projectInfo.hasStartScript) {
      result.warnings.push('No start script found in package.json');
    }

    // Check for TypeScript
    await this.checkTypeScriptSupport(projectPath, result);

    // Check for Docker files
    await this.checkDockerSupport(projectPath, result);

    // Analyze main entry point
    await this.analyzeEntryPoint(projectPath, packageInfo, result);

    // Check for lock files
    await this.checkLockFiles(projectPath, result);
  }

  /**
   * Check for TypeScript support
   */
  async checkTypeScriptSupport(projectPath, result) {
    let hasTypeScriptFile = false;
    try {
      await fs.access(path.join(projectPath, 'tsconfig.json'));
      hasTypeScriptFile = true;
    } catch (error) {
      hasTypeScriptFile = false;
    }

    // Check TypeScript in dependencies
    const hasTypeScript = result.projectInfo.devDependencies.typescript ||
                         result.projectInfo.dependencies.typescript;
    
    result.projectInfo.isTypeScript = hasTypeScriptFile || !!hasTypeScript;
  }

  /**
   * Check for Docker support
   */
  async checkDockerSupport(projectPath, result) {
    try {
      await fs.access(path.join(projectPath, 'Dockerfile'));
      result.projectInfo.hasDockerfile = true;

      // Parse Dockerfile for exposed port
      const dockerfileContent = await fs.readFile(path.join(projectPath, 'Dockerfile'), 'utf8');
      const exposeMatch = dockerfileContent.match(/EXPOSE\s+(\d+)/i);
      if (exposeMatch) {
        result.projectInfo.dockerExpose = parseInt(exposeMatch[1]);
      }
    } catch (error) {
      result.projectInfo.hasDockerfile = false;
    }

    try {
      await fs.access(path.join(projectPath, '.dockerignore'));
      result.projectInfo.hasDockerignore = true;
    } catch (error) {
      result.projectInfo.hasDockerignore = false;
    }
  }

  /**
   * Analyze main entry point for port configuration
   */
  async analyzeEntryPoint(projectPath, packageInfo, result) {
    const entryPoint = packageInfo.main || 'index.js';
    const entryPath = path.join(projectPath, entryPoint);

    try {
      await fs.access(entryPath);
      const content = await fs.readFile(entryPath, 'utf8');

      // Check for port configuration
      this.analyzePortConfiguration(content, result);
    } catch (error) {
      // Entry point file doesn't exist or isn't readable
      result.warnings.push(`Entry point file '${entryPoint}' not found`);
    }
  }

  /**
   * Analyze port configuration in code
   */
  analyzePortConfiguration(content, result) {
    // Check for environment port usage
    const envPortPattern = /process\.env\.PORT/i;
    result.projectInfo.usesEnvPort = envPortPattern.test(content);

    // Check for hardcoded ports
    const portPattern = /\.listen\s*\(\s*(\d+)/g;
    const hardcodedPorts = [];
    let match;

    while ((match = portPattern.exec(content)) !== null) {
      const port = parseInt(match[1]);
      hardcodedPorts.push(port);
    }

    if (hardcodedPorts.length > 0) {
      result.projectInfo.hardcodedPorts = hardcodedPorts;
      result.warnings.push(`Hardcoded port detected (${hardcodedPorts[0]}). Consider using process.env.PORT`);
    }

    // Extract default port from || fallback
    const defaultPortPattern = /process\.env\.PORT\s*\|\|\s*(\d+)/;
    const defaultPortMatch = content.match(defaultPortPattern);
    if (defaultPortMatch) {
      result.projectInfo.defaultPort = parseInt(defaultPortMatch[1]);
    }
  }

  /**
   * Check for lock files
   */
  async checkLockFiles(projectPath, result) {
    const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    
    for (const lockFile of lockFiles) {
      try {
        await fs.access(path.join(projectPath, lockFile));
        result.projectInfo.hasLockFile = true;
        result.projectInfo.lockFileType = lockFile;
        return;
      } catch (error) {
        // Lock file doesn't exist, continue checking
      }
    }

    result.projectInfo.hasLockFile = false;
    result.warnings.push('No lock file found. Consider using npm ci or yarn install --frozen-lockfile');
  }

  /**
   * Analyze dependencies and detect frameworks
   */
  analyzeDependencies(packageInfo, result) {
    const allDeps = { 
      ...result.projectInfo.dependencies, 
      ...result.projectInfo.devDependencies 
    };

    // No dependencies check
    if (Object.keys(result.projectInfo.dependencies).length === 0) {
      result.warnings.push('No dependencies found');
    }

    // Check if has dev dependencies
    result.projectInfo.hasDevDependencies = Object.keys(result.projectInfo.devDependencies).length > 0;

    // Detect frameworks
    result.projectInfo.frameworks = [];
    for (const [framework, packages] of Object.entries(this.frameworks)) {
      if (packages.some(pkg => allDeps[pkg])) {
        result.projectInfo.frameworks.push(framework);
      }
    }

    // Detect test frameworks
    for (const [testFramework, packages] of Object.entries(this.testFrameworks)) {
      if (packages.some(pkg => allDeps[pkg])) {
        result.projectInfo.testFramework = testFramework;
        break;
      }
    }
  }

  /**
   * Analyze build configuration
   */
  analyzeBuildConfiguration(packageInfo, result) {
    const scripts = result.projectInfo.scripts;

    // Check for build script
    result.projectInfo.hasBuildScript = !!(scripts.build);
    if (result.projectInfo.hasBuildScript) {
      result.projectInfo.buildCommand = 'npm run build';
    }

    // TypeScript build recommendations
    if (result.projectInfo.isTypeScript && !result.projectInfo.hasBuildScript) {
      result.recommendations.push('Consider adding a build script for TypeScript compilation');
    }

    // Check for other common scripts
    result.projectInfo.hasTestScript = !!(scripts.test);
    result.projectInfo.hasLintScript = !!(scripts.lint);
    result.projectInfo.hasDevScript = !!(scripts.dev);
  }

  /**
   * Analyze security configuration
   */
  async analyzeSecurityConfiguration(projectPath, result) {
    // Check for .env files
    try {
      await fs.access(path.join(projectPath, '.env'));
      result.projectInfo.hasEnvFile = true;
      result.recommendations.push('Ensure .env file is not committed to version control');
    } catch (error) {
      result.projectInfo.hasEnvFile = false;
    }

    // Check for .gitignore
    try {
      await fs.access(path.join(projectPath, '.gitignore'));
      result.projectInfo.hasGitignore = true;
    } catch (error) {
      result.projectInfo.hasGitignore = false;
      result.recommendations.push('Consider adding .gitignore file');
    }
  }

  /**
   * Generate deployment recommendations
   */
  generateRecommendations(result) {
    // Security recommendations
    result.recommendations.push('Run npm audit to check for security vulnerabilities');

    // Production recommendations
    result.recommendations.push('Add NODE_ENV=production for production deployments');

    // Health check recommendations
    result.recommendations.push('Consider adding a health check endpoint (/health)');

    // Docker recommendations
    if (!result.projectInfo.hasDockerfile) {
      result.recommendations.push('Consider adding Dockerfile for containerized deployments');
    }

    // Monitoring recommendations
    result.recommendations.push('Consider adding logging and monitoring');

    // Performance recommendations
    if (result.projectInfo.frameworks.includes('express')) {
      result.recommendations.push('Consider using compression middleware for better performance');
    }
  }

  /**
   * Get deployment requirements based on project analysis
   */
  getDeploymentRequirements(validationResult) {
    const requirements = {
      nodeVersion: 'latest',
      buildRequired: validationResult.projectInfo.hasBuildScript,
      port: validationResult.projectInfo.defaultPort || 3000,
      envVariables: ['NODE_ENV'],
      healthCheckPath: '/health'
    };

    // Add framework-specific requirements
    if (validationResult.projectInfo.frameworks.includes('next')) {
      requirements.buildRequired = true;
      requirements.buildCommand = 'npm run build';
      requirements.startCommand = 'npm start';
    }

    // Add TypeScript requirements
    if (validationResult.projectInfo.isTypeScript) {
      requirements.buildRequired = true;
    }

    return requirements;
  }
}

export default ProjectValidator;