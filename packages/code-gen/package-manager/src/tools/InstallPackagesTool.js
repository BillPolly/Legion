/**
 * InstallPackagesTool - Batch install multiple npm packages
 * 
 * Installs multiple packages efficiently with proper error handling,
 * progress tracking, and support for both production and dev dependencies.
 */

import { Tool, ToolResult } from '@legion/module-loader';
import { z } from 'zod';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export class InstallPackagesTool extends Tool {
  constructor() {
    super();
    this.name = 'install_packages';
    this.description = 'Install multiple npm packages in batch';
    this.inputSchema = z.object({
        packages: z.array(z.union([
          z.string(),
          z.object({
            name: z.string(),
            version: z.string().optional(),
            isDev: z.boolean().optional().default(false)
          })
        ])).describe('Array of packages to install (string names or package objects)'),
        projectPath: z.string().describe('Path to the project directory'),
        dev: z.boolean().optional().describe('Install all packages as dev dependencies (overrides individual isDev flags)'),
        registry: z.string().optional().describe('Custom npm registry URL'),
        timeout: z.number().optional().default(300000).describe('Installation timeout in milliseconds'),
        skipIfExists: z.boolean().optional().default(true).describe('Skip packages that are already installed'),
        exact: z.boolean().optional().default(false).describe('Install exact versions (--save-exact)')
      });
    this.outputSchema = z.object({
        results: z.array(z.object({
          packageName: z.string(),
          status: z.enum(['installed', 'already-installed', 'failed', 'skipped']),
          version: z.string().optional(),
          installationTime: z.number().optional(),
          error: z.string().optional()
        })).describe('Installation results for each package'),
        summary: z.object({
          total: z.number(),
          successful: z.number(),
          failed: z.number(), 
          skipped: z.number(),
          totalTime: z.number()
        }).describe('Summary of installation results')
      });
  }

  
  /**
   * Returns the tool description in standard function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.inputSchema,
        output: this.outputSchema || {
          success: {
            type: 'object',
            properties: {
              result: { type: 'any', description: 'Tool execution result' }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string', description: 'Error message' },
              details: { type: 'object', description: 'Error details' }
            }
          }
        }
      }
    };
  }

  async invoke(toolCall) {
    // Parse arguments from the tool call
    let args;
    try {
      args = typeof toolCall.function.arguments === 'string' 
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch (error) {
      return ToolResult.failure(error.message || 'Tool execution failed', {
        toolName: this.name,
        error: error.toString(),
        stack: error.stack
      });
    }
  }

  async _validateProjectPath(projectPath) {
    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        return ToolResult.failure(`Project path is not a directory: ${projectPath}`, { toolName: this.name });
      }

      // Check if package.json exists
      const packageJsonPath = path.join(projectPath, 'package.json');
      try {
        await fs.access(packageJsonPath);
      } catch (error) {
        return ToolResult.failure(`No package.json found in project directory: ${projectPath}`, { toolName: this.name });
      }
    } catch (error) {
      return ToolResult.failure(`Invalid project path: ${error.message}`, { toolName: this.name });
    }
  }

  _normalizePackages(packages, globalDev) {
    return packages.map(pkg => {
      if (typeof pkg === 'string') {
        return ToolResult.success({
          name: pkg,
          version: undefined,
          isDev: globalDev || false
        });
      }
      
      return ToolResult.success({
        name: pkg.name,
        version: pkg.version,
        isDev: globalDev !== undefined ? globalDev : (pkg.isDev || false)
      });
    });
  }

  async _installPackageBatch(packages, projectPath, isDev, options) {
    if (packages.length === 0) return [];

    // Check for existing packages if skipIfExists is enabled
    let packagesToInstall = packages;
    if (options.skipIfExists) {
      packagesToInstall = await this._filterExistingPackages(packages, projectPath);
    }

    if (packagesToInstall.length === 0) {
      return packages.map(pkg => ({
        packageName: pkg.name,
        status: 'already-installed',
        version: pkg.version || 'latest',
        installationTime: 0
      }));
    }

    // Build npm install command
    const packageSpecs = packagesToInstall.map(pkg => {
      if (pkg.version) {
        return `${pkg.name}@${pkg.version}`;
      }
      return pkg.name;
    });

    const args = ['install', ...packageSpecs];
    
    if (isDev) {
      args.push('--save-dev');
    }
    
    if (options.exact) {
      args.push('--save-exact');
    }
    
    if (options.registry) {
      args.push('--registry', options.registry);
    }

    // Execute npm install
    const startTime = Date.now();
    
    try {
      await this._executeNpmCommand(args, projectPath, options.timeout);
      const installationTime = Date.now() - startTime;

      // Return success results for all packages in this batch
      return packagesToInstall.map(pkg => ({
        packageName: pkg.name,
        status: 'installed',
        version: pkg.version || 'latest',
        installationTime: installationTime / packagesToInstall.length // Average time per package
      }));

    } catch (error) {
      // Return failed results for all packages in this batch
      return packagesToInstall.map(pkg => ({
        packageName: pkg.name,
        status: 'failed',
        version: pkg.version || 'latest',
        installationTime: 0,
        error: error.message
      }));
    }
  }

  async _filterExistingPackages(packages, projectPath) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);

      const installedPackages = new Set([
        ...Object.keys(packageJson.dependencies || {}),
        ...Object.keys(packageJson.devDependencies || {})
      ]);

      return packages.filter(pkg => !installedPackages.has(pkg.name));
    } catch (error) {
      // If we can't read package.json, install all packages
      return packages;
    }
  }

  async _executeNpmCommand(args, cwd, timeout) {
    return new Promise((resolve, reject) => {
      const child = spawn('npm', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`npm install timed out after ${timeout}ms`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code === 0) {
          resolve({ output, errorOutput });
        } else {
          reject(new Error(`npm install failed with exit code ${code}: ${errorOutput}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to start npm process: ${error.message}`));
      });
    });
  }

  _generateSummary(results, totalTime) {
    const summary = {
      total: results.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      totalTime
    };

    results.forEach(result => {
      switch (result.status) {
        case 'installed':
          summary.successful++;
          break;
        case 'failed':
          summary.failed++;
          break;
        case 'already-installed':
        case 'skipped':
          summary.skipped++;
          break;
      }
    });

    return summary;
  }
}