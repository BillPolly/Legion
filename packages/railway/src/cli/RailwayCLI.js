import { spawn, execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * RailwayCLI - Wrapper for Railway CLI commands
 * Provides a Node.js interface to the Railway CLI tool
 */
class RailwayCLI {
  constructor(options = {}) {
    this.apiKey = options.apiKey;
    this.projectPath = options.projectPath || process.cwd();
    this.debug = options.debug || false;
    this.railwayPath = null;
  }

  /**
   * Check if Railway CLI is installed and install if needed
   */
  async ensureInstalled() {
    try {
      // Check if railway is in PATH
      this.railwayPath = execSync('which railway', { encoding: 'utf8' }).trim();
      if (this.debug) console.log(`Railway CLI found at: ${this.railwayPath}`);
      return true;
    } catch (error) {
      // Check common locations
      const commonPaths = [
        '/opt/homebrew/bin/railway',
        '/usr/local/bin/railway',
        '/usr/bin/railway'
      ];
      
      for (const path of commonPaths) {
        try {
          await fs.access(path);
          this.railwayPath = path;
          if (this.debug) console.log(`Railway CLI found at: ${this.railwayPath}`);
          return true;
        } catch {
          // Continue checking
        }
      }
      
      console.log('Railway CLI not found in PATH. Installing...');
      return await this.install();
    }
  }

  /**
   * Install Railway CLI
   */
  async install() {
    try {
      const platform = os.platform();
      const arch = os.arch();
      
      console.log(`Installing Railway CLI for ${platform} ${arch}...`);
      
      if (platform === 'darwin') {
        // macOS - use Homebrew if available
        try {
          execSync('which brew', { stdio: 'ignore' });
          console.log('Installing via Homebrew...');
          execSync('brew install railway', { stdio: 'inherit' });
        } catch {
          // Fallback to direct download
          console.log('Installing via direct download...');
          execSync('curl -fsSL https://railway.app/install.sh | sh', { stdio: 'inherit' });
        }
      } else if (platform === 'linux') {
        // Linux - use install script
        execSync('curl -fsSL https://railway.app/install.sh | sh', { stdio: 'inherit' });
      } else if (platform === 'win32') {
        // Windows - use PowerShell
        execSync('powershell -Command "irm https://railway.app/install.ps1 | iex"', { stdio: 'inherit' });
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      
      // Verify installation
      this.railwayPath = execSync('which railway', { encoding: 'utf8' }).trim();
      console.log('✅ Railway CLI installed successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to install Railway CLI:', error.message);
      console.error('Please install Railway CLI manually: https://docs.railway.app/develop/cli');
      return false;
    }
  }

  /**
   * Execute a Railway CLI command
   */
  async execute(command, args = [], options = {}) {
    // Ensure Railway is installed
    if (!this.railwayPath) {
      const installed = await this.ensureInstalled();
      if (!installed) {
        throw new Error('Railway CLI is not installed and could not be installed automatically');
      }
    }

    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      
      // Add API key to environment if provided
      if (this.apiKey) {
        env.RAILWAY_TOKEN = this.apiKey;
      }
      
      // Merge any additional env vars from options
      if (options.env) {
        Object.assign(env, options.env);
      }

      const spawnOptions = {
        cwd: options.cwd || this.projectPath,
        env,
        ...options
      };

      if (this.debug) {
        console.log(`Executing: railway ${command} ${args.join(' ')}`);
      }

      const railwayCmd = this.railwayPath || 'railway';
      const child = spawn(railwayCmd, [command, ...args], spawnOptions);
      
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        if (this.debug || options.stream) {
          process.stdout.write(output);
        }
      });

      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        if (this.debug || options.stream) {
          process.stderr.write(output);
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to execute railway command: ${error.message}`));
      });

      // Handle stdin if provided
      if (options.input) {
        child.stdin.write(options.input);
        child.stdin.end();
      }

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            code
          });
        } else {
          // Don't reject, just return with success: false
          resolve({
            success: false,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            code,
            error: stderr || stdout || `Command failed with code ${code}`
          });
        }
      });
    });
  }

  /**
   * Login to Railway with API token
   */
  async login() {
    if (!this.apiKey) {
      throw new Error('API key is required for login');
    }

    try {
      // Use the token directly via environment variable
      const result = await this.execute('whoami', [], {
        env: { ...process.env, RAILWAY_TOKEN: this.apiKey }
      });
      
      console.log('✅ Logged in to Railway');
      return result;
    } catch (error) {
      throw new Error(`Failed to login to Railway: ${error.message}`);
    }
  }

  /**
   * Interactive login to Railway (opens browser)
   */
  async loginInteractive() {
    console.log('🌐 Opening browser for Railway login...');
    console.log('Please complete the login in your browser.');
    
    return new Promise((resolve, reject) => {
      const child = spawn(this.railwayPath || 'railway', ['login'], {
        stdio: 'inherit', // Allow interaction with terminal
        env: process.env
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to run railway login: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: 'Login successful'
          });
        } else {
          resolve({
            success: false,
            error: `Login failed with code ${code}`
          });
        }
      });
    });
  }

  /**
   * List projects
   */
  async listProjects() {
    try {
      const result = await this.execute('list', ['--json']);
      
      // Parse JSON output
      try {
        const projects = JSON.parse(result.stdout);
        return {
          success: true,
          projects: Array.isArray(projects) ? projects : []
        };
      } catch (parseError) {
        // If not JSON, return raw output
        return {
          success: true,
          raw: result.stdout,
          projects: []
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a new project
   */
  async createProject(name, workspaceIndex = 0) {
    // Try using expect-style automation
    const script = `
#!/usr/bin/expect -f
set timeout 30
spawn ${this.railwayPath || 'railway'} init
expect "Select a workspace"
send "${workspaceIndex}\\r"
expect "Enter project name"
send "${name}\\r"
expect eof
`;
    
    // Write script to temp file
    const tempScript = `/tmp/railway-init-${Date.now()}.expect`;
    try {
      await fs.writeFile(tempScript, script, { mode: 0o755 });
      
      // Execute the expect script
      const output = execSync(`expect ${tempScript}`, { 
        encoding: 'utf8',
        env: { ...process.env, RAILWAY_TOKEN: this.apiKey }
      });
      
      // Extract project ID from output
      const projectIdMatch = output.match(/project\s+([a-f0-9-]+)/i);
      const projectId = projectIdMatch ? projectIdMatch[1] : null;
      
      return {
        success: true,
        output,
        projectId
      };
    } catch (error) {
      // Fallback to direct execution with flags
      if (this.debug) console.log('Expect failed, trying direct execution...');
      
      try {
        // Try to link to an existing project ID instead
        const listOutput = execSync(`${this.railwayPath || 'railway'} list`, {
          encoding: 'utf8',
          env: { ...process.env, RAILWAY_TOKEN: this.apiKey }
        });
        
        if (this.debug) console.log('Existing projects:', listOutput);
        
        return {
          success: false,
          error: 'Cannot create project non-interactively. Use existing project ID or create via web/API.',
          existingProjects: listOutput
        };
      } catch (listError) {
        return {
          success: false,
          error: error.message
        };
      }
    } finally {
      // Clean up temp script
      try {
        await fs.unlink(tempScript);
      } catch {}
    }
  }

  /**
   * Link to an existing project
   */
  async linkProject(projectId, options = {}) {
    const args = [];
    
    if (projectId) {
      args.push('-p', projectId);
    }
    
    if (options.environment) {
      args.push('-e', options.environment);
    }
    
    if (options.service) {
      args.push('-s', options.service);
    }
    
    if (options.team) {
      args.push('-t', options.team);
    }
    
    const result = await this.execute('link', args);
    
    return {
      success: result.success,
      output: result.stdout,
      error: result.error
    };
  }

  /**
   * Deploy current directory or GitHub repo
   */
  async deploy(options = {}) {
    const args = [];
    
    if (options.githubRepo) {
      // For GitHub deployments, we need to use a different approach
      // Railway CLI doesn't support --repo flag, we need to deploy from a git repo
      console.log('Note: Railway CLI deploys from the current git repository');
      console.log('For GitHub deployments, consider cloning the repo first');
    }
    
    if (options.serviceName) {
      args.push('--service', options.serviceName);
    }
    
    if (options.detach) {
      args.push('--detach');
    }

    const result = await this.execute('up', args, {
      stream: true // Stream output for deploy progress
    });
    
    if (!result.success) {
      return result;
    }
    
    // Extract deployment URL from output
    const urlMatch = result.stdout.match(/https:\/\/[\w-]+\.up\.railway\.app/);
    const url = urlMatch ? urlMatch[0] : null;
    
    return {
      success: true,
      output: result.stdout,
      url
    };
  }

  /**
   * Get deployment logs
   */
  async logs(options = {}) {
    try {
      const args = [];
      
      if (options.serviceName) {
        args.push('--service', options.serviceName);
      }
      
      if (options.deployment) {
        args.push('--deployment', options.deployment);
      }
      
      if (options.lines) {
        args.push('--lines', options.lines.toString());
      }
      
      if (options.follow) {
        args.push('--follow');
      }

      const result = await this.execute('logs', args, {
        stream: options.follow
      });
      
      return {
        success: true,
        logs: result.stdout
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get service status
   */
  async status() {
    try {
      const result = await this.execute('status', ['--json']);
      
      // Parse JSON output
      try {
        const status = JSON.parse(result.stdout);
        return {
          success: true,
          status
        };
      } catch (parseError) {
        // If not JSON, return raw output
        return {
          success: true,
          raw: result.stdout
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Open project in browser
   */
  async open() {
    try {
      const result = await this.execute('open');
      
      return {
        success: true,
        output: result.stdout
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Set environment variables
   */
  async setEnvVars(vars) {
    try {
      const args = [];
      
      // Convert object to KEY=value pairs
      Object.entries(vars).forEach(([key, value]) => {
        args.push(`${key}=${value}`);
      });

      const result = await this.execute('variables', ['set', ...args]);
      
      return {
        success: true,
        output: result.stdout
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get environment variables
   */
  async getEnvVars() {
    try {
      const result = await this.execute('variables');
      
      return {
        success: true,
        variables: result.stdout
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Run a command in the Railway environment
   */
  async run(command, args = []) {
    try {
      const result = await this.execute('run', [command, ...args], {
        stream: true
      });
      
      return {
        success: true,
        output: result.stdout
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a service or project
   */
  async delete(options = {}) {
    try {
      const args = [];
      
      if (options.serviceName) {
        args.push('--service', options.serviceName);
      }
      
      if (options.yes) {
        args.push('--yes');
      }

      const result = await this.execute('delete', args);
      
      return {
        success: true,
        output: result.stdout
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default RailwayCLI;