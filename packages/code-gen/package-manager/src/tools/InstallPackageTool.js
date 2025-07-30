/**
 * InstallPackageTool - Install single npm packages
 * 
 * Extracted and adapted from code-agent PackageManager for Legion framework
 */

import { Tool } from '@legion/module-loader';
import { z } from 'zod';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import semver from 'semver';

export class InstallPackageTool extends Tool {
  constructor() {
    super();
    this.name = 'install_package';
    this.description = 'Install a single npm package with version and dependency type options';
    this.inputSchema = z.object({
      name: z.string().describe('Package name to install'),
      version: z.string().optional().describe('Package version or range (e.g., "1.0.0", "^1.0.0", "latest")'),
      projectPath: z.string().describe('Path to the project directory'),
      isDev: z.boolean().default(false).describe('Install as dev dependency'),
      registry: z.string().optional().describe('Custom npm registry URL')
    });
    this.outputSchema = z.object({
      packageName: z.string(),
      status: z.enum(['installed', 'already-installed', 'error']),
      version: z.string().optional(),
      installationTime: z.number(),
      isDev: z.boolean(),
      error: z.string().optional()
    });

    this.timeout = 60000; // 60 seconds default timeout
  }

  async execute(args) {
    const { name, version, projectPath, isDev = false, registry } = args;
    const startTime = Date.now();

    try {
      this.emit('progress', { percentage: 10, status: 'Validating package configuration...' });

      // Validate inputs
      this._validatePackageConfig(args);

      this.emit('progress', { percentage: 20, status: 'Checking if package is already installed...' });

      // Check if package is already installed
      const isInstalled = await this._isPackageInstalled(name, projectPath);
      if (isInstalled) {
        const installedVersion = await this._getInstalledVersion(name, projectPath);
        return {
          packageName: name,
          status: 'already-installed',
          version: installedVersion,
          installationTime: 0,
          isDev
        };
      }

      this.emit('progress', { percentage: 40, status: 'Building npm install command...' });

      // Build npm install command
      const installArgs = this._buildInstallArgs({ name, version, isDev, registry });

      this.emit('progress', { percentage: 60, status: `Installing ${name}...` });

      // Execute npm install
      const result = await this._executeCommand('npm', installArgs, {
        cwd: projectPath,
        timeout: this.timeout
      });

      const installTime = Date.now() - startTime;

      if (result.exitCode === 0) {
        this.emit('progress', { percentage: 100, status: 'Package installed successfully' });

        return {
          packageName: name,
          status: 'installed',
          version: version || 'latest',
          installationTime: installTime,
          isDev
        };
      } else {
        return {
          packageName: name,
          status: 'error',
          error: result.stderr || result.stdout || 'Installation failed',
          installationTime: installTime,
          isDev
        };
      }

    } catch (error) {
      this.emit('error', { message: error.message });
      
      return {
        packageName: name,
        status: 'error',
        error: error.message,
        installationTime: Date.now() - startTime,
        isDev
      };
    }
  }

  async _isPackageInstalled(packageName, projectPath) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      
      return !!(packageJson.dependencies?.[packageName] || packageJson.devDependencies?.[packageName]);
    } catch (error) {
      return false;
    }
  }

  async _getInstalledVersion(packageName, projectPath) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      
      return packageJson.dependencies?.[packageName] || packageJson.devDependencies?.[packageName] || null;
    } catch (error) {
      return null;
    }
  }

  _validatePackageConfig(config) {
    if (!config.name) {
      throw new Error('Package name is required');
    }
    
    if (!config.projectPath) {
      throw new Error('Project path is required');
    }
    
    if (config.version && !semver.validRange(config.version) && config.version !== 'latest') {
      throw new Error('Invalid version range');
    }
  }

  _buildInstallArgs(config) {
    const args = ['install'];
    
    if (config.name) {
      const packageSpec = config.version ? `${config.name}@${config.version}` : config.name;
      args.push(packageSpec);
    }
    
    if (config.isDev) {
      args.push('--save-dev');
    }
    
    if (config.registry) {
      args.push('--registry', config.registry);
    }
    
    return args;
  }

  async _executeCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: options.timeout || this.timeout
      });
      
      let stdout = '';
      let stderr = '';
      let timeoutId = null;
      let resolved = false;
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };
      
      const resolveOnce = (result) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(result);
        }
      };
      
      const rejectOnce = (error) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(error);
        }
      };
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolveOnce({
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });
      
      child.on('error', (error) => {
        rejectOnce(error);
      });
      
      // Handle timeout
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          child.kill();
          rejectOnce(new Error(`Command timed out after ${options.timeout}ms`));
        }, options.timeout);
      }
    });
  }
}