/**
 * ScriptAnalyzer - Intelligent script detection and execution strategy builder
 * Analyzes any given path and determines the best way to run it with monitoring injection
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export class ScriptAnalyzer {
  constructor(options = {}) {
    this.agentPath = options.agentPath || path.join(path.dirname(import.meta.url.replace('file://', '')), 'sidewinder-agent.cjs');
    this.defaultOptions = options;
  }

  /**
   * Analyzes a given path and returns execution strategy
   * @param {string} targetPath - File or directory path
   * @param {object} options - Additional options (sessionId, wsAgentPort, etc.)
   * @returns {ExecutionStrategy} - How to run the target with monitoring
   */
  async analyze(targetPath, options = {}) {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      const stats = await fs.stat(targetPath);
      
      if (stats.isDirectory()) {
        return await this.analyzeDirectory(targetPath, opts);
      } else if (stats.isFile()) {
        return await this.analyzeFile(targetPath, opts);
      }
      
      throw new Error(`Path is neither file nor directory: ${targetPath}`);
    } catch (error) {
      throw new Error(`Failed to analyze path ${targetPath}: ${error.message}`);
    }
  }

  /**
   * Analyze a directory (likely a project)
   */
  async analyzeDirectory(dirPath, options) {
    // Check for package.json (Node.js project)
    const packageJsonPath = path.join(dirPath, 'package.json');
    if (await this.exists(packageJsonPath)) {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return await this.analyzeNodeProject(dirPath, packageJson, options);
    }

    // Check for deno.json (Deno project)
    if (await this.exists(path.join(dirPath, 'deno.json'))) {
      return this.analyzeDenoProject(dirPath, options);
    }

    // Check for requirements.txt (Python project)
    if (await this.exists(path.join(dirPath, 'requirements.txt'))) {
      return this.analyzePythonProject(dirPath, options);
    }

    // Look for common entry point files
    const entryPoint = await this.findEntryPoint(dirPath);
    if (entryPoint) {
      return this.analyzeFile(entryPoint, options);
    }

    throw new Error(`Cannot determine how to run directory: ${dirPath}`);
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(filePath, options) {
    const ext = path.extname(filePath).toLowerCase();
    const dir = path.dirname(filePath);
    
    switch (ext) {
      case '.js':
      case '.mjs':
        return this.buildNodeStrategy(filePath, dir, options);
      
      case '.ts':
      case '.mts':
        return this.buildTypeScriptStrategy(filePath, dir, options);
      
      case '.py':
        return this.buildPythonStrategy(filePath, dir, options);
      
      case '.sh':
        return this.buildShellStrategy(filePath, dir, options);
      
      default:
        // Try to detect from shebang
        const shebang = await this.detectShebang(filePath);
        if (shebang) {
          return this.buildShebangStrategy(filePath, dir, shebang, options);
        }
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  /**
   * Analyze a Node.js project with package.json
   */
  async analyzeNodeProject(dirPath, packageJson, options) {
    const scripts = packageJson.scripts || {};
    
    // Find the appropriate start script
    const startScript = scripts.start || scripts.dev || scripts['start:dev'] || scripts.serve;
    
    if (!startScript) {
      // No start script, look for main entry point
      const main = packageJson.main || 'index.js';
      const mainPath = path.join(dirPath, main);
      if (await this.exists(mainPath)) {
        return this.analyzeFile(mainPath, options);
      }
      throw new Error('No start script or main entry point found in package.json');
    }

    // Parse the start script to understand execution requirements
    const parsed = this.parseStartScript(startScript);
    
    // Check if it's a simple node script that we can intercept
    if (parsed.isSimpleNode) {
      const entryFile = path.join(dirPath, parsed.entryFile);
      
      // Check if the entry file uses ts-node internally
      const usesInternalTsNode = await this.checkForInternalTsNode(entryFile);
      
      if (usesInternalTsNode) {
        // The script internally uses ts-node, so we need to inject before it
        return {
          type: 'node',
          command: 'node',
          args: ['--require', this.agentPath, entryFile],
          cwd: dirPath,
          env: this.buildEnvironment(options),
          requiresAgent: true,
          injectionMethod: 'require',
          metadata: {
            hasTypeScript: true,
            entryPoint: parsed.entryFile,
            framework: await this.detectFramework(packageJson),
            detectsPort: await this.detectPort(dirPath, parsed.entryFile),
            packageManager: await this.detectPackageManager(dirPath),
            originalScript: startScript
          }
        };
      }
    }

    // Handle TypeScript projects
    if (parsed.usesTsNode || parsed.entryFile?.endsWith('.ts')) {
      return {
        type: 'ts-node',
        command: 'npx',
        args: ['ts-node', '--require', this.agentPath, parsed.entryFile],
        cwd: dirPath,
        env: this.buildEnvironment(options),
        requiresAgent: true,
        injectionMethod: 'require',
        metadata: {
          hasTypeScript: true,
          entryPoint: parsed.entryFile,
          framework: await this.detectFramework(packageJson),
          detectsPort: await this.detectPort(dirPath, parsed.entryFile),
          packageManager: await this.detectPackageManager(dirPath),
          originalScript: startScript
        }
      };
    }

    // Handle build tools (webpack, vite, etc.)
    if (parsed.usesWebpack || parsed.usesVite || parsed.usesParcel) {
      // These tools spawn their own processes, so we need NODE_OPTIONS
      return {
        type: 'npm',
        command: 'npm',
        args: ['run', 'start'],
        cwd: dirPath,
        env: {
          ...this.buildEnvironment(options),
          NODE_OPTIONS: `--require ${this.agentPath} ${process.env.NODE_OPTIONS || ''}`.trim()
        },
        requiresAgent: true,
        injectionMethod: 'node_options',
        metadata: {
          hasBuildStep: true,
          buildTool: parsed.buildTool,
          framework: await this.detectFramework(packageJson),
          detectsPort: await this.detectPort(dirPath, null),
          packageManager: await this.detectPackageManager(dirPath),
          originalScript: startScript
        }
      };
    }

    // Handle nodemon
    if (parsed.usesNodemon) {
      return {
        type: 'nodemon',
        command: 'npx',
        args: ['nodemon', '--require', this.agentPath, parsed.entryFile],
        cwd: dirPath,
        env: this.buildEnvironment(options),
        requiresAgent: true,
        injectionMethod: 'require',
        metadata: {
          entryPoint: parsed.entryFile,
          framework: await this.detectFramework(packageJson),
          detectsPort: await this.detectPort(dirPath, parsed.entryFile),
          packageManager: await this.detectPackageManager(dirPath),
          originalScript: startScript
        }
      };
    }

    // Default: run with node and require flag
    if (parsed.entryFile) {
      return {
        type: 'node',
        command: 'node',
        args: ['--require', this.agentPath, parsed.entryFile],
        cwd: dirPath,
        env: this.buildEnvironment(options),
        requiresAgent: true,
        injectionMethod: 'require',
        metadata: {
          entryPoint: parsed.entryFile,
          framework: await this.detectFramework(packageJson),
          detectsPort: await this.detectPort(dirPath, parsed.entryFile),
          packageManager: await this.detectPackageManager(dirPath),
          originalScript: startScript
        }
      };
    }

    // Fallback: Use NODE_OPTIONS with npm run
    return {
      type: 'npm',
      command: 'npm',
      args: ['run', 'start'],
      cwd: dirPath,
      env: {
        ...this.buildEnvironment(options),
        NODE_OPTIONS: `--require ${this.agentPath} ${process.env.NODE_OPTIONS || ''}`.trim()
      },
      requiresAgent: true,
      injectionMethod: 'node_options',
      metadata: {
        framework: await this.detectFramework(packageJson),
        detectsPort: await this.detectPort(dirPath, null),
        packageManager: await this.detectPackageManager(dirPath),
        originalScript: startScript
      }
    };
  }

  /**
   * Parse npm start script to understand execution requirements
   */
  parseStartScript(script) {
    const result = {
      usesTsNode: false,
      usesNodemon: false,
      usesWebpack: false,
      usesVite: false,
      usesParcel: false,
      isSimpleNode: false,
      entryFile: null,
      buildTool: null,
      originalCommand: script
    };

    // Check for TypeScript
    if (script.includes('ts-node')) {
      result.usesTsNode = true;
      const match = script.match(/ts-node(?:\/register)?\s+([^\s]+)/);
      if (match) result.entryFile = match[1];
    }

    // Check for simple node command
    if (script.match(/^node\s+([^\s]+)/)) {
      result.isSimpleNode = true;
      const match = script.match(/^node\s+([^\s]+)/);
      if (match) result.entryFile = match[1];
    }

    // Check for nodemon
    if (script.includes('nodemon')) {
      result.usesNodemon = true;
      const match = script.match(/nodemon\s+([^\s]+)/);
      if (match) result.entryFile = match[1];
    }

    // Check for build tools
    if (script.includes('webpack')) {
      result.usesWebpack = true;
      result.buildTool = 'webpack';
    }
    if (script.includes('vite')) {
      result.usesVite = true;
      result.buildTool = 'vite';
    }
    if (script.includes('parcel')) {
      result.usesParcel = true;
      result.buildTool = 'parcel';
    }

    // Try to extract entry file from various patterns
    if (!result.entryFile) {
      const patterns = [
        /node\s+([^\s]+)/,
        /ts-node\s+([^\s]+)/,
        /nodemon\s+([^\s]+)/,
        /^([^\s]+\.m?[jt]s)$/
      ];
      
      for (const pattern of patterns) {
        const match = script.match(pattern);
        if (match) {
          result.entryFile = match[1];
          break;
        }
      }
    }

    return result;
  }

  /**
   * Check if a Node.js file internally uses ts-node
   */
  async checkForInternalTsNode(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.includes("require('ts-node/register')") || 
             content.includes('require("ts-node/register")');
    } catch {
      return false;
    }
  }

  /**
   * Build execution strategy for Node.js files
   */
  buildNodeStrategy(filePath, cwd, options) {
    return {
      type: 'node',
      command: 'node',
      args: ['--require', this.agentPath, filePath],
      cwd,
      env: this.buildEnvironment(options),
      requiresAgent: true,
      injectionMethod: 'require',
      metadata: {
        entryPoint: path.basename(filePath),
        hasTypeScript: false
      }
    };
  }

  /**
   * Build execution strategy for TypeScript files
   */
  buildTypeScriptStrategy(filePath, cwd, options) {
    return {
      type: 'ts-node',
      command: 'npx',
      args: ['ts-node', '--require', this.agentPath, filePath],
      cwd,
      env: this.buildEnvironment(options),
      requiresAgent: true,
      injectionMethod: 'require',
      metadata: {
        entryPoint: path.basename(filePath),
        hasTypeScript: true
      }
    };
  }

  /**
   * Build execution strategy for Python files
   */
  buildPythonStrategy(filePath, cwd, options) {
    // Python doesn't support our Node.js agent
    return {
      type: 'python',
      command: 'python',
      args: [filePath],
      cwd,
      env: this.buildEnvironment(options),
      requiresAgent: false,
      injectionMethod: 'none',
      metadata: {
        entryPoint: path.basename(filePath),
        language: 'python'
      }
    };
  }

  /**
   * Build execution strategy for shell scripts
   */
  buildShellStrategy(filePath, cwd, options) {
    return {
      type: 'shell',
      command: 'sh',
      args: [filePath],
      cwd,
      env: this.buildEnvironment(options),
      requiresAgent: false,
      injectionMethod: 'none',
      metadata: {
        entryPoint: path.basename(filePath),
        language: 'shell'
      }
    };
  }

  /**
   * Build execution strategy based on shebang
   */
  buildShebangStrategy(filePath, cwd, shebang, options) {
    const interpreter = shebang.split(/\s+/)[0];
    
    if (interpreter.includes('node')) {
      return this.buildNodeStrategy(filePath, cwd, options);
    }
    if (interpreter.includes('python')) {
      return this.buildPythonStrategy(filePath, cwd, options);
    }
    if (interpreter.includes('sh') || interpreter.includes('bash')) {
      return this.buildShellStrategy(filePath, cwd, options);
    }
    
    // Generic shebang execution
    return {
      type: 'shebang',
      command: interpreter,
      args: [filePath],
      cwd,
      env: this.buildEnvironment(options),
      requiresAgent: false,
      injectionMethod: 'none',
      metadata: {
        entryPoint: path.basename(filePath),
        interpreter
      }
    };
  }

  /**
   * Build environment variables for Sidewinder agent
   */
  buildEnvironment(options) {
    return {
      SIDEWINDER_SESSION_ID: options.sessionId || 'default',
      SIDEWINDER_WS_PORT: options.wsAgentPort || '9901',
      SIDEWINDER_WS_HOST: options.wsHost || 'localhost',
      SIDEWINDER_DEBUG: options.debug ? 'true' : 'false'
    };
  }

  /**
   * Detect the framework used in a project
   */
  async detectFramework(packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps['next']) return 'nextjs';
    if (deps['express']) return 'express';
    if (deps['fastify']) return 'fastify';
    if (deps['koa']) return 'koa';
    if (deps['hapi'] || deps['@hapi/hapi']) return 'hapi';
    if (deps['@nestjs/core']) return 'nestjs';
    if (deps['@angular/core']) return 'angular';
    if (deps['vue']) return 'vue';
    if (deps['react']) return 'react';
    if (deps['svelte']) return 'svelte';
    
    return null;
  }

  /**
   * Detect the port the application will use
   */
  async detectPort(dirPath, entryFile) {
    // First check environment files
    const envPort = await this.checkEnvFiles(dirPath);
    if (envPort) return envPort;
    
    // If we have an entry file, scan it for port patterns
    if (entryFile) {
      try {
        const fullPath = path.isAbsolute(entryFile) ? entryFile : path.join(dirPath, entryFile);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        // Common port patterns
        const patterns = [
          /\.listen\((\d+)/,
          /PORT['"]\s*:\s*(\d+)/,
          /PORT\s*=\s*(\d+)/,
          /port:\s*(\d+)/i,
          /PORT\s*\|\|\s*(\d+)/,
          /process\.env\.PORT\s*\|\|\s*(\d+)/
        ];
        
        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match) return parseInt(match[1]);
        }
      } catch {
        // Ignore read errors
      }
    }
    
    return null;
  }

  /**
   * Check environment files for PORT configuration
   */
  async checkEnvFiles(dirPath) {
    const envFiles = ['.env', '.env.local', '.env.development'];
    
    for (const envFile of envFiles) {
      try {
        const envPath = path.join(dirPath, envFile);
        const content = await fs.readFile(envPath, 'utf-8');
        const match = content.match(/^PORT=(\d+)/m);
        if (match) return parseInt(match[1]);
      } catch {
        // File doesn't exist, continue
      }
    }
    
    return null;
  }

  /**
   * Detect the package manager used in a project
   */
  async detectPackageManager(dirPath) {
    if (await this.exists(path.join(dirPath, 'yarn.lock'))) return 'yarn';
    if (await this.exists(path.join(dirPath, 'pnpm-lock.yaml'))) return 'pnpm';
    if (await this.exists(path.join(dirPath, 'package-lock.json'))) return 'npm';
    if (await this.exists(path.join(dirPath, 'bun.lockb'))) return 'bun';
    return 'npm'; // Default
  }

  /**
   * Find common entry point files in a directory
   */
  async findEntryPoint(dirPath) {
    const commonEntryPoints = [
      'index.js',
      'index.ts',
      'main.js',
      'main.ts',
      'app.js',
      'app.ts',
      'server.js',
      'server.ts',
      'start.js',
      'start.ts'
    ];
    
    for (const entry of commonEntryPoints) {
      const fullPath = path.join(dirPath, entry);
      if (await this.exists(fullPath)) {
        return fullPath;
      }
    }
    
    // Check src directory
    const srcDir = path.join(dirPath, 'src');
    if (await this.exists(srcDir)) {
      for (const entry of commonEntryPoints) {
        const fullPath = path.join(srcDir, entry);
        if (await this.exists(fullPath)) {
          return fullPath;
        }
      }
    }
    
    return null;
  }

  /**
   * Detect shebang in a file
   */
  async detectShebang(filePath) {
    try {
      const fd = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(100);
      await fd.read(buffer, 0, 100, 0);
      await fd.close();
      
      const content = buffer.toString('utf-8');
      if (content.startsWith('#!')) {
        const newlineIndex = content.indexOf('\n');
        return content.substring(2, newlineIndex > 0 ? newlineIndex : undefined).trim();
      }
    } catch {
      // Ignore errors
    }
    
    return null;
  }

  /**
   * Check if a file/directory exists
   */
  async exists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Analyze Deno project
   */
  analyzeDenoProject(dirPath, options) {
    // Deno doesn't support Node.js require, so no agent injection
    return {
      type: 'deno',
      command: 'deno',
      args: ['run', '--allow-all', 'main.ts'],
      cwd: dirPath,
      env: this.buildEnvironment(options),
      requiresAgent: false,
      injectionMethod: 'none',
      metadata: {
        runtime: 'deno',
        hasTypeScript: true
      }
    };
  }

  /**
   * Analyze Python project
   */
  analyzePythonProject(dirPath, options) {
    return {
      type: 'python',
      command: 'python',
      args: ['main.py'],
      cwd: dirPath,
      env: this.buildEnvironment(options),
      requiresAgent: false,
      injectionMethod: 'none',
      metadata: {
        language: 'python'
      }
    };
  }
}