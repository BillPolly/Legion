import { execa } from 'execa';
import fs from 'fs/promises';
import path from 'path';

/**
 * Manages NPM packages and dependencies
 */
export class PackageManager {
  constructor() {
    this.packageManagers = ['npm', 'yarn', 'pnpm', 'bun'];
  }

  /**
   * Detect which package manager to use
   */
  async detectPackageManager(cwd = process.cwd()) {
    // Check for lock files
    const lockFiles = {
      'package-lock.json': 'npm',
      'yarn.lock': 'yarn',
      'pnpm-lock.yaml': 'pnpm',
      'bun.lockb': 'bun'
    };

    for (const [lockFile, manager] of Object.entries(lockFiles)) {
      try {
        await fs.access(path.join(cwd, lockFile));
        return manager;
      } catch {
        // File doesn't exist, continue
      }
    }

    // Default to npm
    return 'npm';
  }

  /**
   * Check if package manager is available
   */
  async isPackageManagerAvailable(manager) {
    try {
      await execa(manager, ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Install dependencies
   */
  async installDependencies(options = {}) {
    const {
      cwd = process.cwd(),
      packageManager = 'auto',
      production = false,
      force = false,
      legacy = false
    } = options;

    // Detect package manager if auto
    const manager = packageManager === 'auto' 
      ? await this.detectPackageManager(cwd)
      : packageManager;

    // Check if package manager is available
    if (!await this.isPackageManagerAvailable(manager)) {
      throw new Error(`Package manager ${manager} is not available`);
    }

    // Build install command based on package manager
    let args = ['install'];
    
    switch (manager) {
      case 'npm':
        if (production) args.push('--production');
        if (force) args.push('--force');
        if (legacy) args.push('--legacy-peer-deps');
        break;
      
      case 'yarn':
        if (production) args.push('--production');
        if (force) args.push('--force');
        break;
      
      case 'pnpm':
        if (production) args.push('--prod');
        if (force) args.push('--force');
        break;
      
      case 'bun':
        if (production) args.push('--production');
        if (force) args.push('--force');
        break;
    }

    try {
      const startTime = Date.now();
      const { stdout, stderr } = await execa(manager, args, {
        cwd,
        env: {
          ...process.env,
          // Force color output
          FORCE_COLOR: '1'
        }
      });

      const duration = Date.now() - startTime;

      return {
        success: true,
        manager,
        cwd,
        duration,
        output: stdout,
        warnings: stderr
      };
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error.message}`);
    }
  }

  /**
   * Run NPM script
   */
  async runNpmScript(scriptName, options = {}) {
    const {
      cwd = process.cwd(),
      packageManager = 'auto',
      args = [],
      env = {}
    } = options;

    // Read package.json to check if script exists
    const packageJsonPath = path.join(cwd, 'package.json');
    let packageJson;
    
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read package.json: ${error.message}`);
    }

    // Check if script exists
    if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
      throw new Error(`Script "${scriptName}" not found in package.json`);
    }

    // Detect package manager if auto
    const manager = packageManager === 'auto' 
      ? await this.detectPackageManager(cwd)
      : packageManager;

    // Build run command based on package manager
    let command;
    let commandArgs = [];
    
    switch (manager) {
      case 'npm':
        command = 'npm';
        commandArgs = ['run', scriptName];
        if (args.length > 0) {
          commandArgs.push('--');
          commandArgs.push(...args);
        }
        break;
      
      case 'yarn':
        command = 'yarn';
        commandArgs = [scriptName, ...args];
        break;
      
      case 'pnpm':
        command = 'pnpm';
        commandArgs = ['run', scriptName, ...args];
        break;
      
      case 'bun':
        command = 'bun';
        commandArgs = ['run', scriptName, ...args];
        break;
    }

    try {
      const startTime = Date.now();
      const { stdout, stderr, exitCode } = await execa(command, commandArgs, {
        cwd,
        env: {
          ...process.env,
          ...env,
          FORCE_COLOR: '1'
        },
        reject: false // Don't throw on non-zero exit
      });

      const duration = Date.now() - startTime;

      return {
        success: exitCode === 0,
        script: scriptName,
        command: packageJson.scripts[scriptName],
        manager,
        cwd,
        exitCode,
        duration,
        output: stdout,
        errors: stderr
      };
    } catch (error) {
      throw new Error(`Failed to run script "${scriptName}": ${error.message}`);
    }
  }

  /**
   * Install specific package
   */
  async installPackage(packageName, options = {}) {
    const {
      cwd = process.cwd(),
      packageManager = 'auto',
      save = true,
      saveDev = false,
      global = false,
      version = 'latest'
    } = options;

    // Detect package manager if auto
    const manager = packageManager === 'auto' 
      ? await this.detectPackageManager(cwd)
      : packageManager;

    // Build install command
    let args = [];
    const packageSpec = version === 'latest' ? packageName : `${packageName}@${version}`;
    
    switch (manager) {
      case 'npm':
        args = ['install'];
        if (global) args.push('-g');
        if (save && !global) args.push('--save');
        if (saveDev && !global) args.push('--save-dev');
        args.push(packageSpec);
        break;
      
      case 'yarn':
        args = ['add'];
        if (global) args = ['global', 'add'];
        if (saveDev && !global) args.push('--dev');
        args.push(packageSpec);
        break;
      
      case 'pnpm':
        args = ['add'];
        if (global) args.push('-g');
        if (saveDev && !global) args.push('--save-dev');
        args.push(packageSpec);
        break;
      
      case 'bun':
        args = ['add'];
        if (global) args.push('-g');
        if (saveDev && !global) args.push('--dev');
        args.push(packageSpec);
        break;
    }

    try {
      const { stdout, stderr } = await execa(manager, args, {
        cwd: global ? undefined : cwd,
        env: {
          ...process.env,
          FORCE_COLOR: '1'
        }
      });

      return {
        success: true,
        package: packageName,
        version,
        manager,
        global,
        saveDev,
        output: stdout,
        warnings: stderr
      };
    } catch (error) {
      throw new Error(`Failed to install package ${packageName}: ${error.message}`);
    }
  }

  /**
   * Check package.json for information
   */
  async getPackageInfo(cwd = process.cwd()) {
    const packageJsonPath = path.join(cwd, 'package.json');
    
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      return {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        scripts: Object.keys(packageJson.scripts || {}),
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        packageManager: await this.detectPackageManager(cwd)
      };
    } catch (error) {
      throw new Error(`Failed to read package.json: ${error.message}`);
    }
  }

  /**
   * Check if Node.js is available and get version
   */
  async checkNodeVersion() {
    try {
      const { stdout } = await execa('node', ['--version']);
      return {
        available: true,
        version: stdout.trim()
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Check environment
   */
  async checkEnvironment(cwd = process.cwd()) {
    const nodeInfo = await this.checkNodeVersion();
    const packageManager = await this.detectPackageManager(cwd);
    const packageManagerAvailable = await this.isPackageManagerAvailable(packageManager);
    
    let packageInfo = null;
    try {
      packageInfo = await this.getPackageInfo(cwd);
    } catch {
      // No package.json
    }

    return {
      node: nodeInfo,
      packageManager: {
        detected: packageManager,
        available: packageManagerAvailable
      },
      packageInfo,
      cwd
    };
  }
}