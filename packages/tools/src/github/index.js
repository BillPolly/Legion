import { Tool, ToolResult } from '@jsenvoy/modules';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

class GitHub extends Tool {
  constructor() {
    super();
    this.name = 'github';
    this.description = 'Creates GitHub repositories and manages git operations';
    this.githubApiBase = 'api.github.com';
  }

  /**
   * Returns all tool functions in standard function calling format
   */
  getAllToolDescriptions() {
    return [
      {
        type: 'function',
        function: {
          name: 'github_create_repo',
          description: 'Create a new GitHub repository',
          parameters: {
            type: 'object',
            properties: {
              repoName: {
                type: 'string',
                description: 'Name of the repository to create'
              },
              description: {
                type: 'string',
                description: 'Description of the repository'
              },
              private: {
                type: 'boolean',
                description: 'Whether the repository should be private (default: false)'
              },
              autoInit: {
                type: 'boolean',
                description: 'Whether to initialize with a README (default: false)'
              }
            },
            required: ['repoName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'github_push_to_repo',
          description: 'Push current repository to a GitHub repository',
          parameters: {
            type: 'object',
            properties: {
              repoUrl: {
                type: 'string',
                description: 'The GitHub repository URL (e.g., "https://github.com/username/repo.git")'
              },
              branch: {
                type: 'string',
                description: 'Branch name to push to (default: "main")'
              },
              force: {
                type: 'boolean',
                description: 'Whether to force push (default: false)'
              }
            },
            required: ['repoUrl']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'github_create_and_push',
          description: 'Create a new GitHub repository and push the current code to it',
          parameters: {
            type: 'object',
            properties: {
              repoName: {
                type: 'string',
                description: 'Name of the repository to create'
              },
              description: {
                type: 'string',
                description: 'Description of the repository'
              },
              private: {
                type: 'boolean',
                description: 'Whether the repository should be private (default: false)'
              },
              branch: {
                type: 'string',
                description: 'Branch name to push to (default: "main")'
              }
            },
            required: ['repoName']
          }
        }
      }
    ];
  }

  /**
   * Returns the primary tool function description
   */
  getToolDescription() {
    return this.getAllToolDescriptions()[0];
  }

  /**
   * Invokes the GitHub tool with the given tool call
   */
  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      let result;

      switch (toolCall.function.name) {
        case 'github_create_repo':
          this.validateRequiredParameters(args, ['repoName']);
          result = await this.createRepo(
            args.repoName,
            args.description,
            args.private,
            args.autoInit
          );
          break;
        case 'github_push_to_repo':
          this.validateRequiredParameters(args, ['repoUrl']);
          result = await this.pushToRepo(
            args.repoUrl,
            args.branch || 'main',
            args.force || false
          );
          break;
        case 'github_create_and_push':
          this.validateRequiredParameters(args, ['repoName']);
          result = await this.createAndPush(
            args.repoName,
            args.description,
            args.private,
            args.branch || 'main'
          );
          break;
        default:
          throw new Error(`Unknown function: ${toolCall.function.name}`);
      }

      return ToolResult.success(result);
    } catch (error) {
      return ToolResult.failure(
        error.message || 'GitHub operation failed',
        {
          operation: toolCall.function.name,
          errorType: 'execution_error'
        }
      );
    }
  }

  /**
   * Get GitHub credentials from environment
   */
  async getCredentials() {
    // Try to read from .env file
    const envPath = path.join(process.cwd(), '.env');
    try {
      const envContent = await fs.readFile(envPath, 'utf8');
      const patMatch = envContent.match(/GITHUB_PAT=(.+)/);
      if (patMatch) {
        return { token: patMatch[1].trim() };
      }
    } catch (error) {
      // .env file not found or not readable
    }

    // Fallback to environment variable
    if (process.env.GITHUB_PAT) {
      return { token: process.env.GITHUB_PAT };
    }

    throw new Error('GitHub PAT not found. Please set GITHUB_PAT in .env file or environment variable.');
  }

  /**
   * Get GitHub username from git config or API
   */
  async getGitHubUsername(token) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.githubApiBase,
        path: '/user',
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'jsEnvoy-GitHub-Tool',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const user = JSON.parse(data);
            resolve(user.login);
          } else {
            reject(new Error(`Failed to get user info: ${res.statusCode} ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Create a new GitHub repository
   */
  async createRepo(repoName, description = '', isPrivate = false, autoInit = false) {
    console.log(`Creating GitHub repository: ${repoName}`);
    
    const { token } = await this.getCredentials();
    
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        name: repoName,
        description: description,
        private: isPrivate,
        auto_init: autoInit
      });

      const options = {
        hostname: this.githubApiBase,
        path: '/user/repos',
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'jsEnvoy-GitHub-Tool',
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          const parsed = JSON.parse(responseData);
          
          if (res.statusCode === 201) {
            console.log(`Repository created successfully: ${parsed.html_url}`);
            resolve({
              success: true,
              name: parsed.name,
              url: parsed.html_url,
              cloneUrl: parsed.clone_url,
              sshUrl: parsed.ssh_url,
              private: parsed.private
            });
          } else {
            reject(new Error(`Failed to create repository: ${parsed.message || responseData}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * Push current repository to GitHub
   */
  async pushToRepo(repoUrl, branch = 'main', force = false) {
    console.log(`Pushing to repository: ${repoUrl}`);
    
    try {
      // Check if we're in a git repository
      await execAsync('git rev-parse --git-dir');
      
      // Get current branch
      const { stdout: currentBranch } = await execAsync('git branch --show-current');
      const sourceBranch = currentBranch.trim() || 'main';
      
      // Add remote if it doesn't exist
      const remoteName = 'github-push';
      try {
        await execAsync(`git remote remove ${remoteName}`);
      } catch (e) {
        // Remote doesn't exist, that's fine
      }
      
      await execAsync(`git remote add ${remoteName} ${repoUrl}`);
      
      // Push to the repository
      const forceFlag = force ? '--force' : '';
      const { stdout, stderr } = await execAsync(
        `git push ${remoteName} ${sourceBranch}:${branch} ${forceFlag}`
      );
      
      // Remove the temporary remote
      await execAsync(`git remote remove ${remoteName}`);
      
      console.log('Push completed successfully');
      
      return {
        success: true,
        sourceBranch: sourceBranch,
        targetBranch: branch,
        repoUrl: repoUrl,
        forced: force,
        output: stdout + stderr
      };
    } catch (error) {
      throw new Error(`Failed to push to repository: ${error.message}`);
    }
  }

  /**
   * Create a new repository and push current code to it
   */
  async createAndPush(repoName, description = '', isPrivate = false, branch = 'main') {
    console.log(`Creating repository and pushing code: ${repoName}`);
    
    try {
      // First, ensure we're in a git repository
      try {
        await execAsync('git rev-parse --git-dir');
      } catch (error) {
        // Not a git repo, initialize it
        console.log('Initializing git repository...');
        await execAsync('git init');
        
        // Add all files and create initial commit
        await execAsync('git add .');
        await execAsync('git commit -m "Initial commit"');
      }
      
      // Create the repository
      const repoInfo = await this.createRepo(repoName, description, isPrivate, false);
      
      // Get credentials and username
      const { token } = await this.getCredentials();
      const username = await this.getGitHubUsername(token);
      
      // Construct the authenticated URL
      const authenticatedUrl = repoInfo.cloneUrl.replace(
        'https://github.com',
        `https://${username}:${token}@github.com`
      );
      
      // Push to the new repository
      const pushResult = await this.pushToRepo(authenticatedUrl, branch, false);
      
      return {
        success: true,
        repository: repoInfo,
        push: pushResult,
        message: `Successfully created repository and pushed code to ${repoInfo.url}`
      };
    } catch (error) {
      throw new Error(`Failed to create and push: ${error.message}`);
    }
  }
}

export default GitHub;