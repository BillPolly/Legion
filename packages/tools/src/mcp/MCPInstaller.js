/**
 * MCPInstaller - Handles installation of MCP servers
 * 
 * Supports multiple installation methods:
 * - NPM packages (npm install)
 * - Git repositories (git clone + npm install)
 * - Direct downloads (executables, archives)
 * 
 * Manages dependencies, build processes, and installation verification.
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';

export class MCPInstaller extends EventEmitter {
  constructor(dependencies = {}) {
    super();
    this.resourceManager = dependencies.resourceManager;
    this.installDir = dependencies.installDir || './mcp-servers';
    this.tempDir = dependencies.tempDir || './tmp/mcp-installs';
    this.timeout = dependencies.timeout || 300000; // 5 minutes
    
    this.installations = new Map(); // Track ongoing installations
  }

  /**
   * Initialize the installer
   */
  async initialize() {
    this.emit('info', 'Initializing MCP Installer');
    
    // Ensure directories exist
    await fs.mkdir(this.installDir, { recursive: true });
    await fs.mkdir(this.tempDir, { recursive: true });
    
    // Check system requirements
    await this.checkSystemRequirements();
    
    this.emit('info', `MCP Installer ready, install directory: ${this.installDir}`);
  }

  /**
   * Install MCP server from server definition
   */
  async installServer(serverDef, options = {}) {
    const { 
      force = false,
      skipBuild = false,
      version = 'latest'
    } = options;
    
    const installId = `${serverDef.id}-${Date.now()}`;
    
    if (this.installations.has(serverDef.id)) {
      throw new Error(`Installation already in progress for ${serverDef.id}`);
    }
    
    this.installations.set(serverDef.id, {
      id: installId,
      server: serverDef,
      startTime: Date.now(),
      status: 'starting'
    });
    
    try {
      this.emit('install-started', { serverId: serverDef.id, installId });
      
      // Check if already installed
      if (!force && await this.isInstalled(serverDef)) {
        const existingInfo = await this.getInstalledInfo(serverDef);
        this.emit('already-installed', { serverId: serverDef.id, info: existingInfo });
        return existingInfo;
      }
      
      // Install based on method
      let installResult;
      switch (serverDef.installation?.method) {
        case 'npm':
          installResult = await this.installFromNPM(serverDef, { version, skipBuild });
          break;
        case 'git-clone':
          installResult = await this.installFromGit(serverDef, { skipBuild });
          break;
        case 'download':
          installResult = await this.installFromDownload(serverDef);
          break;
        default:
          throw new Error(`Unsupported installation method: ${serverDef.installation?.method}`);
      }
      
      // Verify installation
      await this.verifyInstallation(serverDef, installResult);
      
      // Save installation info
      await this.saveInstallationInfo(serverDef, installResult);
      
      this.emit('install-completed', {
        serverId: serverDef.id,
        installId,
        result: installResult
      });
      
      return installResult;
      
    } catch (error) {
      this.emit('install-failed', {
        serverId: serverDef.id,
        installId,
        error: error.message
      });
      throw error;
    } finally {
      this.installations.delete(serverDef.id);
    }
  }

  /**
   * Install from NPM package
   */
  async installFromNPM(serverDef, options = {}) {
    const { version = 'latest', skipBuild = false } = options;
    
    this.emit('info', `Installing ${serverDef.name} from NPM`);
    
    const serverDir = path.join(this.installDir, serverDef.id);
    await fs.mkdir(serverDir, { recursive: true });
    
    // Create package.json for isolated installation
    const packageJson = {
      name: `mcp-server-${serverDef.id}`,
      version: '1.0.0',
      private: true,
      dependencies: {
        [serverDef.installation.package]: version
      }
    };
    
    await fs.writeFile(
      path.join(serverDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Run npm install
    await this.runCommand('npm', ['install'], { cwd: serverDir });
    
    // Find the installed package
    const packageDir = path.join(serverDir, 'node_modules', serverDef.installation.package);
    const packageInfoPath = path.join(packageDir, 'package.json');
    const packageInfo = JSON.parse(await fs.readFile(packageInfoPath, 'utf-8'));
    
    // Determine entry point
    const entryPoint = this.findEntryPoint(packageDir, packageInfo);
    
    const installResult = {
      method: 'npm',
      path: serverDir,
      packageDir,
      entryPoint,
      command: this.buildCommand(packageDir, entryPoint, serverDef),
      packageInfo,
      installedAt: new Date().toISOString()
    };
    
    return installResult;
  }

  /**
   * Install from Git repository
   */
  async installFromGit(serverDef, options = {}) {
    const { skipBuild = false } = options;
    
    this.emit('info', `Installing ${serverDef.name} from Git`);
    
    const serverDir = path.join(this.installDir, serverDef.id);
    
    // Clean existing directory
    await fs.rm(serverDir, { recursive: true, force: true });
    
    // Clone repository
    await this.runCommand('git', [
      'clone',
      serverDef.installation.url,
      serverDir
    ]);
    
    // If path is specified, use subdirectory
    let workingDir = serverDir;
    if (serverDef.installation.path) {
      workingDir = path.join(serverDir, serverDef.installation.path);
    }
    
    // Check for package.json
    const packageJsonPath = path.join(workingDir, 'package.json');
    let packageInfo = null;
    
    try {
      packageInfo = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    } catch (error) {
      throw new Error(`No package.json found in ${workingDir}`);
    }
    
    // Install dependencies
    if (!skipBuild && packageInfo.dependencies) {
      this.emit('info', `Installing dependencies for ${serverDef.name}`);
      await this.runCommand('npm', ['install'], { cwd: workingDir });
    }
    
    // Build if necessary
    if (!skipBuild && packageInfo.scripts?.build) {
      this.emit('info', `Building ${serverDef.name}`);
      await this.runCommand('npm', ['run', 'build'], { cwd: workingDir });
    }
    
    // Determine entry point
    const entryPoint = this.findEntryPoint(workingDir, packageInfo);
    
    const installResult = {
      method: 'git',
      path: serverDir,
      workingDir,
      entryPoint,
      command: this.buildCommand(workingDir, entryPoint, serverDef),
      packageInfo,
      repositoryUrl: serverDef.installation.url,
      installedAt: new Date().toISOString()
    };
    
    return installResult;
  }

  /**
   * Install from direct download
   */
  async installFromDownload(serverDef) {
    this.emit('info', `Installing ${serverDef.name} from download`);
    
    const serverDir = path.join(this.installDir, serverDef.id);
    await fs.mkdir(serverDir, { recursive: true });
    
    // Download and extract
    // Implementation depends on download type (zip, tar, executable, etc.)
    throw new Error('Download installation method not yet implemented');
  }

  /**
   * Find entry point for installed package
   */
  findEntryPoint(packageDir, packageInfo) {
    // Check package.json main field
    if (packageInfo.main) {
      const mainPath = path.resolve(packageDir, packageInfo.main);
      if (this.isValidEntryPoint(mainPath)) {
        return mainPath;
      }
    }
    
    // Check common entry points
    const commonEntryPoints = [
      'index.js',
      'dist/index.js',
      'build/index.js',
      'lib/index.js',
      'src/index.js',
      'server.js',
      'main.js'
    ];
    
    for (const entry of commonEntryPoints) {
      const entryPath = path.join(packageDir, entry);
      if (this.isValidEntryPoint(entryPath)) {
        return entryPath;
      }
    }
    
    throw new Error(`Could not find entry point for ${packageInfo.name}`);
  }

  /**
   * Check if path is a valid entry point
   */
  isValidEntryPoint(filePath) {
    try {
      return fs.access(filePath).then(() => true).catch(() => false);
    } catch {
      return false;
    }
  }

  /**
   * Build command array for executing server
   */
  buildCommand(workingDir, entryPoint, serverDef) {
    const command = ['node', entryPoint];
    
    // Add any specified arguments
    if (serverDef.installation?.args) {
      command.push(...serverDef.installation.args);
    }
    
    return {
      command: command[0],
      args: command.slice(1),
      cwd: workingDir,
      env: {
        ...process.env,
        ...serverDef.installation?.env
      }
    };
  }

  /**
   * Verify installation was successful
   */
  async verifyInstallation(serverDef, installResult) {
    this.emit('info', `Verifying installation of ${serverDef.name}`);
    
    // Check if entry point exists
    try {
      await fs.access(installResult.entryPoint);
    } catch (error) {
      throw new Error(`Entry point not found: ${installResult.entryPoint}`);
    }
    
    // Try to start server briefly to verify it works
    try {
      const testResult = await this.testServerStart(installResult.command);
      if (!testResult.success) {
        throw new Error(`Server failed to start: ${testResult.error}`);
      }
    } catch (error) {
      this.emit('warning', `Could not verify server startup: ${error.message}`);
      // Don't fail installation for startup test failures
    }
  }

  /**
   * Test if server can start
   */
  async testServerStart(command, timeout = 10000) {
    return new Promise((resolve) => {
      const proc = spawn(command.command, command.args, {
        cwd: command.cwd,
        env: command.env,
        stdio: 'pipe'
      });
      
      let output = '';
      let error = '';
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      const timer = setTimeout(() => {
        proc.kill();
        resolve({ success: true, output, error });
      }, timeout);
      
      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({ success: false, error: err.message });
      });
      
      proc.on('exit', (code) => {
        clearTimeout(timer);
        resolve({
          success: code === 0,
          output,
          error,
          exitCode: code
        });
      });
    });
  }

  /**
   * Save installation information
   */
  async saveInstallationInfo(serverDef, installResult) {
    const installInfo = {
      serverId: serverDef.id,
      serverName: serverDef.name,
      source: serverDef.source,
      ...installResult,
      serverDefinition: serverDef
    };
    
    const infoFile = path.join(this.installDir, serverDef.id, 'install-info.json');
    await fs.writeFile(infoFile, JSON.stringify(installInfo, null, 2));
    
    // Also save to global installations registry
    const globalRegistry = path.join(this.installDir, 'installed-servers.json');
    let registry = {};
    
    try {
      const content = await fs.readFile(globalRegistry, 'utf-8');
      registry = JSON.parse(content);
    } catch (error) {
      // File doesn't exist, create new registry
    }
    
    registry[serverDef.id] = {
      ...installInfo,
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(globalRegistry, JSON.stringify(registry, null, 2));
  }

  /**
   * Check if server is installed
   */
  async isInstalled(serverDef) {
    const serverDir = path.join(this.installDir, serverDef.id);
    const infoFile = path.join(serverDir, 'install-info.json');
    
    try {
      await fs.access(infoFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get installed server information
   */
  async getInstalledInfo(serverDef) {
    const infoFile = path.join(this.installDir, serverDef.id, 'install-info.json');
    
    try {
      const content = await fs.readFile(infoFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Installation info not found for ${serverDef.id}`);
    }
  }

  /**
   * Uninstall server
   */
  async uninstallServer(serverId) {
    this.emit('info', `Uninstalling server ${serverId}`);
    
    const serverDir = path.join(this.installDir, serverId);
    
    try {
      await fs.rm(serverDir, { recursive: true, force: true });
      
      // Remove from global registry
      const globalRegistry = path.join(this.installDir, 'installed-servers.json');
      try {
        const content = await fs.readFile(globalRegistry, 'utf-8');
        const registry = JSON.parse(content);
        delete registry[serverId];
        await fs.writeFile(globalRegistry, JSON.stringify(registry, null, 2));
      } catch (error) {
        // Ignore registry update errors
      }
      
      this.emit('uninstall-completed', { serverId });
      return { success: true, serverId };
    } catch (error) {
      this.emit('uninstall-failed', { serverId, error: error.message });
      throw error;
    }
  }

  /**
   * List installed servers
   */
  async listInstalled() {
    const globalRegistry = path.join(this.installDir, 'installed-servers.json');
    
    try {
      const content = await fs.readFile(globalRegistry, 'utf-8');
      const registry = JSON.parse(content);
      return Object.values(registry);
    } catch (error) {
      return [];
    }
  }

  /**
   * Update installed server
   */
  async updateServer(serverId, options = {}) {
    const installed = await this.getInstalledInfo({ id: serverId });
    if (!installed) {
      throw new Error(`Server ${serverId} is not installed`);
    }
    
    // Reinstall with force flag
    return this.installServer(installed.serverDefinition, {
      force: true,
      ...options
    });
  }

  /**
   * Run command with timeout and error handling
   */
  async runCommand(command, args, options = {}) {
    const { cwd = process.cwd(), timeout = this.timeout } = options;
    
    return new Promise((resolve, reject) => {
      this.emit('command-start', { command, args, cwd });
      
      const proc = spawn(command, args, {
        cwd,
        stdio: 'pipe',
        ...options
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        this.emit('command-output', { data: data.toString() });
      });
      
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);
      
      proc.on('error', (error) => {
        clearTimeout(timer);
        this.emit('command-error', { command, args, error: error.message });
        reject(new Error(`Command failed: ${error.message}`));
      });
      
      proc.on('exit', (code) => {
        clearTimeout(timer);
        
        if (code === 0) {
          this.emit('command-success', { command, args });
          resolve({ stdout, stderr, exitCode: code });
        } else {
          this.emit('command-failed', { command, args, exitCode: code, stderr });
          reject(new Error(`Command exited with code ${code}: ${stderr}`));
        }
      });
    });
  }

  /**
   * Check system requirements
   */
  async checkSystemRequirements() {
    const requirements = [];
    
    // Check Node.js
    try {
      await this.runCommand('node', ['--version'], { timeout: 5000 });
      requirements.push({ name: 'Node.js', available: true });
    } catch (error) {
      requirements.push({ name: 'Node.js', available: false, error: error.message });
    }
    
    // Check NPM
    try {
      await this.runCommand('npm', ['--version'], { timeout: 5000 });
      requirements.push({ name: 'NPM', available: true });
    } catch (error) {
      requirements.push({ name: 'NPM', available: false, error: error.message });
    }
    
    // Check Git
    try {
      await this.runCommand('git', ['--version'], { timeout: 5000 });
      requirements.push({ name: 'Git', available: true });
    } catch (error) {
      requirements.push({ name: 'Git', available: false, error: error.message });
    }
    
    const missing = requirements.filter(req => !req.available);
    if (missing.length > 0) {
      this.emit('warning', `Missing system requirements: ${missing.map(r => r.name).join(', ')}`);
    }
    
    return requirements;
  }

  /**
   * Get installation status
   */
  getInstallationStatus(serverId) {
    return this.installations.get(serverId) || null;
  }

  /**
   * Get all ongoing installations
   */
  getOngoingInstallations() {
    return Array.from(this.installations.values());
  }
}