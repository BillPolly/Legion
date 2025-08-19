import { Tool, ToolResult } from '@legion/tools-registry';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

class GitHub extends Tool {
  constructor(config = {}) {
    super({
      name: 'github',
      description: 'Creates GitHub repositories and manages git operations',
      schema: {
        input: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: [
                'create_repo',
                'push_to_repo', 
                'create_and_push',
                'list_repos',
                'delete_repo',
                'list_orgs',
                'list_org_repos',
                'get_file'
              ],
              description: 'The GitHub operation to perform'
            },
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
            },
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
            },
            type: {
              type: 'string',
              enum: ['all', 'owner', 'public', 'private', 'member', 'forks', 'sources'],
              description: 'Type of repositories to list (default: "all")'
            },
            sort: {
              type: 'string',
              enum: ['created', 'updated', 'pushed', 'full_name'],
              description: 'Sort repositories by (default: "created")'
            },
            per_page: {
              type: 'number',
              description: 'Number of repositories per page (default: 100)'
            },
            owner: {
              type: 'string',
              description: 'Repository owner (username or organization)'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            },
            org: {
              type: 'string',
              description: 'Organization name'
            },
            path: {
              type: 'string',
              description: 'Path to the file in the repository'
            },
            ref: {
              type: 'string',
              description: 'Branch, tag, or commit to get file from (default: default branch)'
            }
          },
          required: ['operation']
        },
        output: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the operation was successful'
            },
            message: {
              type: 'string',
              description: 'Success or error message'
            },
            name: {
              type: 'string',
              description: 'Repository name'
            },
            url: {
              type: 'string',
              description: 'Repository URL'
            },
            cloneUrl: {
              type: 'string',
              description: 'Repository clone URL'
            },
            sshUrl: {
              type: 'string',
              description: 'Repository SSH URL'
            },
            repositories: {
              type: 'array',
              description: 'List of repositories'
            },
            organizations: {
              type: 'array',
              description: 'List of organizations'
            },
            file: {
              type: 'object',
              description: 'File information and content'
            },
            count: {
              type: 'number',
              description: 'Number of items returned'
            }
          },
          required: ['success']
        }
      },
      execute: async (args) => this.performOperation(args)
    });

    this.config = config;
    this.githubApiBase = config.apiBase || 'api.github.com';
    this.token = config.token;
    this.org = config.org;
  }

  async performOperation(args) {
    try {
      // Emit progress event for operation start
      this.emitProgress(`Starting GitHub operation: ${args.operation}`, {
        operation: args.operation,
        args: args
      });

      let result;
      switch (args.operation) {
        case 'create_repo':
          this.validateRequiredParameters(args, ['repoName']);
          result = await this.createRepo(
            args.repoName,
            args.description,
            args.private,
            args.autoInit
          );
          break;
        case 'push_to_repo':
          this.validateRequiredParameters(args, ['repoUrl']);
          result = await this.pushToRepo(
            args.repoUrl,
            args.branch || 'main',
            args.force || false
          );
          break;
        case 'create_and_push':
          this.validateRequiredParameters(args, ['repoName']);
          result = await this.createAndPush(
            args.repoName,
            args.description,
            args.private,
            args.branch || 'main'
          );
          break;
        case 'list_repos':
          result = await this.listRepos(args.type || 'all', args.sort || 'created', args.per_page || 100);
          break;
        case 'delete_repo':
          this.validateRequiredParameters(args, ['owner', 'repo']);
          result = await this.deleteRepo(args.owner, args.repo);
          break;
        case 'list_orgs':
          result = await this.listOrgs(args.per_page || 100);
          break;
        case 'list_org_repos':
          this.validateRequiredParameters(args, ['org']);
          result = await this.listOrgRepos(args.org, args.type || 'all', args.sort || 'created', args.per_page || 100);
          break;
        case 'get_file':
          this.validateRequiredParameters(args, ['owner', 'repo', 'path']);
          result = await this.getFile(args.owner, args.repo, args.path, args.ref);
          break;
        default:
          throw new Error(`Unknown operation: ${args.operation}`);
      }

      // Emit success event
      this.emitInfo(`GitHub operation completed successfully`, {
        operation: args.operation,
        result: result
      });

      return result;
    } catch (error) {
      // Emit error event
      this.emitError(`GitHub operation failed: ${error.message}`, {
        operation: args.operation,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Get GitHub credentials from config
   */
  getCredentials() {
    if (!this.token) {
      throw new Error('GitHub PAT not configured. Please provide token in config.');
    }
    return { token: this.token };
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
    this.emitProgress(`Creating GitHub repository: ${repoName}`, {
      repoName,
      isPrivate,
      stage: 'create_repo'
    });
    
    const { token } = this.getCredentials();
    
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
            this.emitInfo(`Repository created successfully: ${parsed.html_url}`, {
              repoName: parsed.name,
              url: parsed.html_url,
              private: parsed.private
            });
            resolve({
              success: true,
              name: parsed.name,
              url: parsed.html_url,
              cloneUrl: parsed.clone_url,
              sshUrl: parsed.ssh_url,
              private: parsed.private
            });
          } else {
            const errorMsg = `Failed to create repository: ${parsed.message || responseData}`;
            this.emitError(errorMsg, {
              statusCode: res.statusCode,
              response: parsed
            });
            reject(new Error(errorMsg));
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
    this.emitProgress(`Pushing to repository: ${repoUrl}`, {
      repoUrl,
      branch,
      force,
      stage: 'push_repo'
    });
    
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
      this.emitProgress(`Pushing ${sourceBranch} to ${branch}`, {
        sourceBranch,
        targetBranch: branch,
        force
      });
      
      const forceFlag = force ? '--force' : '';
      const { stdout, stderr } = await execAsync(
        `git push ${remoteName} ${sourceBranch}:${branch} ${forceFlag}`
      );
      
      // Remove the temporary remote
      await execAsync(`git remote remove ${remoteName}`);
      
      this.emitInfo('Push completed successfully', {
        sourceBranch,
        targetBranch: branch,
        repoUrl
      });
      
      return {
        success: true,
        sourceBranch: sourceBranch,
        targetBranch: branch,
        repoUrl: repoUrl,
        forced: force,
        output: stdout + stderr
      };
    } catch (error) {
      const errorMsg = `Failed to push to repository: ${error.message}`;
      this.emitError(errorMsg, {
        error: error.message,
        repoUrl,
        branch
      });
      throw new Error(errorMsg);
    }
  }

  /**
   * Create a new repository and push current code to it
   */
  async createAndPush(repoName, description = '', isPrivate = false, branch = 'main') {
    this.emitProgress(`Creating repository and pushing code: ${repoName}`, {
      repoName,
      description,
      isPrivate,
      branch,
      stage: 'create_and_push'
    });
    
    try {
      // First, ensure we're in a git repository
      try {
        await execAsync('git rev-parse --git-dir');
      } catch (error) {
        // Not a git repo, initialize it
        this.emitProgress('Initializing git repository', {
          stage: 'git_init'
        });
        await execAsync('git init');
        
        // Add all files and create initial commit
        await execAsync('git add .');
        await execAsync('git commit -m "Initial commit"');
      }
      
      // Create the repository
      const repoInfo = await this.createRepo(repoName, description, isPrivate, false);
      
      // Get credentials and username
      const { token } = this.getCredentials();
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

  /**
   * List repositories for the authenticated user
   */
  async listRepos(type = 'all', sort = 'created', perPage = 100) {
    this.emitProgress('Listing GitHub repositories', {
      type,
      sort,
      perPage,
      stage: 'list_repos'
    });
    
    const { token } = this.getCredentials();
    const username = await this.getGitHubUsername(token);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.githubApiBase,
        path: `/user/repos?type=${type}&sort=${sort}&per_page=${perPage}`,
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'jsEnvoy-GitHub-Tool',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const repos = JSON.parse(responseData);
            const formattedRepos = repos.map(repo => ({
              owner: repo.owner.login,
              name: repo.name,
              fullName: repo.full_name,
              private: repo.private,
              url: repo.html_url,
              createdAt: repo.created_at,
              updatedAt: repo.updated_at
            }));
            
            this.emitInfo(`Found ${formattedRepos.length} repositories`, {
              count: formattedRepos.length
            });
            
            resolve({
              success: true,
              repositories: formattedRepos,
              count: formattedRepos.length
            });
          } else {
            const error = responseData ? JSON.parse(responseData) : {};
            this.emitError(`Failed to list repositories: ${error.message || res.statusCode}`, {
              statusCode: res.statusCode,
              error: error
            });
            reject(new Error(error.message || `Failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        this.emitError(`Request failed: ${error.message}`, { error });
        reject(error);
      });

      req.end();
    });
  }

  /**
   * Delete a GitHub repository
   */
  async deleteRepo(owner, repo) {
    this.emitProgress(`Deleting GitHub repository: ${owner}/${repo}`, {
      owner,
      repo,
      stage: 'delete_repo'
    });
    
    const { token } = this.getCredentials();
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.githubApiBase,
        path: `/repos/${owner}/${repo}`,
        method: 'DELETE',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'jsEnvoy-GitHub-Tool',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          if (res.statusCode === 204) {
            this.emitInfo(`Repository deleted successfully: ${owner}/${repo}`, {
              owner,
              repo
            });
            resolve({
              success: true,
              message: `Repository ${owner}/${repo} deleted successfully`
            });
          } else {
            const error = responseData ? JSON.parse(responseData) : {};
            this.emitError(`Failed to delete repository: ${error.message || res.statusCode}`, {
              statusCode: res.statusCode,
              error: error
            });
            reject(new Error(error.message || `Failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        this.emitError(`Request failed: ${error.message}`, { error });
        reject(error);
      });

      req.end();
    });
  }

  /**
   * List organizations for the authenticated user
   */
  async listOrgs(perPage = 100) {
    this.emitProgress(`Listing organizations for authenticated user`, {
      perPage,
      stage: 'list_orgs'
    });
    
    const { token } = this.getCredentials();
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.githubApiBase,
        path: `/user/orgs?per_page=${perPage}`,
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'jsEnvoy-GitHub-Tool',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const orgs = JSON.parse(responseData);
            const formattedOrgs = orgs.map(org => ({
              login: org.login,
              id: org.id,
              url: org.url,
              reposUrl: org.repos_url,
              description: org.description,
              avatarUrl: org.avatar_url
            }));
            
            this.emitInfo(`Found ${formattedOrgs.length} organizations`, {
              count: formattedOrgs.length
            });
            
            resolve({
              success: true,
              organizations: formattedOrgs,
              count: formattedOrgs.length
            });
          } else {
            const error = responseData ? JSON.parse(responseData) : {};
            this.emitError(`Failed to list organizations: ${error.message || res.statusCode}`, {
              statusCode: res.statusCode,
              error: error
            });
            reject(new Error(error.message || `Failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        this.emitError(`Request failed: ${error.message}`, { error });
        reject(error);
      });

      req.end();
    });
  }

  /**
   * List repositories for a specific organization
   */
  async listOrgRepos(org, type = 'all', sort = 'created', perPage = 100) {
    this.emitProgress(`Listing repositories for organization: ${org}`, {
      org,
      type,
      sort,
      perPage,
      stage: 'list_org_repos'
    });
    
    const { token } = this.getCredentials();
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.githubApiBase,
        path: `/orgs/${org}/repos?type=${type}&sort=${sort}&per_page=${perPage}`,
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'jsEnvoy-GitHub-Tool',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const repos = JSON.parse(responseData);
            const formattedRepos = repos.map(repo => ({
              owner: repo.owner.login,
              name: repo.name,
              fullName: repo.full_name,
              description: repo.description,
              private: repo.private,
              url: repo.html_url,
              createdAt: repo.created_at,
              updatedAt: repo.updated_at,
              language: repo.language,
              stargazersCount: repo.stargazers_count,
              forksCount: repo.forks_count
            }));
            
            this.emitInfo(`Found ${formattedRepos.length} repositories in ${org}`, {
              count: formattedRepos.length,
              org: org
            });
            
            resolve({
              success: true,
              repositories: formattedRepos,
              count: formattedRepos.length,
              organization: org
            });
          } else {
            const error = responseData ? JSON.parse(responseData) : {};
            this.emitError(`Failed to list organization repositories: ${error.message || res.statusCode}`, {
              statusCode: res.statusCode,
              error: error,
              org: org
            });
            reject(new Error(error.message || `Failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        this.emitError(`Request failed: ${error.message}`, { error });
        reject(error);
      });

      req.end();
    });
  }

  /**
   * Get file contents from a GitHub repository
   */
  async getFile(owner, repo, filePath, ref = null) {
    this.emitProgress(`Getting file contents: ${owner}/${repo}/${filePath}`, {
      owner,
      repo,
      filePath,
      ref,
      stage: 'get_file'
    });
    
    const { token } = this.getCredentials();
    
    return new Promise((resolve, reject) => {
      const pathParam = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      const options = {
        hostname: this.githubApiBase,
        path: `/repos/${owner}/${repo}/contents/${filePath}${pathParam}`,
        method: 'GET',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'jsEnvoy-GitHub-Tool',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            const fileData = JSON.parse(responseData);
            
            // Decode content if it's base64 encoded
            let content = '';
            if (fileData.encoding === 'base64' && fileData.content) {
              content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            } else if (fileData.content) {
              content = fileData.content;
            }
            
            this.emitInfo(`File retrieved successfully: ${filePath}`, {
              owner,
              repo,
              filePath,
              size: fileData.size,
              encoding: fileData.encoding
            });
            
            resolve({
              success: true,
              file: {
                name: fileData.name,
                path: fileData.path,
                sha: fileData.sha,
                size: fileData.size,
                url: fileData.html_url,
                downloadUrl: fileData.download_url,
                content: content,
                encoding: fileData.encoding
              }
            });
          } else {
            const error = responseData ? JSON.parse(responseData) : {};
            this.emitError(`Failed to get file: ${error.message || res.statusCode}`, {
              statusCode: res.statusCode,
              error: error,
              owner,
              repo,
              filePath
            });
            reject(new Error(error.message || `Failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        this.emitError(`Request failed: ${error.message}`, { error });
        reject(error);
      });

      req.end();
    });
  }
}

export default GitHub;