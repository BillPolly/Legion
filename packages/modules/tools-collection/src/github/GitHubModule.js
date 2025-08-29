import { Tool, Module } from '@legion/tools-registry';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';

const execAsync = promisify(exec);

/**
 * GitHub tool that manages GitHub repositories and operations
 * Pure logic implementation - metadata comes from module.json
 */
class GitHubTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.shortName = 'gh';
    this.config = module.config || {};
    this.githubApiBase = this.config.apiBase || 'api.github.com';
    this.token = this.config.token;
    this.org = this.config.org;
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    // Emit progress event for operation start
    this.progress(`Starting GitHub operation: ${params.operation}`, 0);

    let result;
    switch (params.operation) {
      case 'create_repo':
        this.validateRequiredParameters(params, ['repoName']);
        result = await this.createRepo(
          params.repoName,
          params.description,
          params.private,
          params.autoInit
        );
        break;
      case 'push_to_repo':
        this.validateRequiredParameters(params, ['repoUrl']);
        result = await this.pushToRepo(
          params.repoUrl,
          params.branch || 'main',
          params.force || false
        );
        break;
      case 'create_and_push':
        this.validateRequiredParameters(params, ['repoName']);
        result = await this.createAndPush(
          params.repoName,
          params.description,
          params.private,
          params.branch || 'main'
        );
        break;
      case 'list_repos':
        result = await this.listRepos(params.type || 'all', params.sort || 'created', params.per_page || 100);
        break;
      case 'delete_repo':
        this.validateRequiredParameters(params, ['owner', 'repo']);
        result = await this.deleteRepo(params.owner, params.repo);
        break;
      case 'list_orgs':
        result = await this.listOrgs(params.per_page || 100);
        break;
      case 'list_org_repos':
        this.validateRequiredParameters(params, ['org']);
        result = await this.listOrgRepos(params.org, params.type || 'all', params.sort || 'created', params.per_page || 100);
        break;
      case 'get_file':
        this.validateRequiredParameters(params, ['owner', 'repo', 'path']);
        result = await this.getFile(params.owner, params.repo, params.path, params.ref);
        break;
      default:
        throw new Error(`Unknown operation: ${params.operation}`);
    }

    // Emit completion
    this.info(`GitHub operation completed successfully: ${params.operation}`);
    return result;
  }

  validateRequiredParameters(params, required) {
    for (const param of required) {
      if (!params[param]) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }

  getCredentials() {
    if (!this.token) {
      throw new Error('GitHub PAT not configured. Please provide token in config.');
    }
    return { token: this.token };
  }

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

  async createRepo(repoName, description = '', isPrivate = false, autoInit = false) {
    this.progress(`Creating GitHub repository: ${repoName}`);
    
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
            this.info(`Repository created successfully: ${parsed.html_url}`);
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
            this.error(errorMsg);
            reject(new Error(errorMsg));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async pushToRepo(repoUrl, branch = 'main', force = false) {
    this.progress(`Pushing to repository: ${repoUrl}`);
    
    try {
      await execAsync('git rev-parse --git-dir');
      
      const { stdout: currentBranch } = await execAsync('git branch --show-current');
      const sourceBranch = currentBranch.trim() || 'main';
      
      const remoteName = 'github-push';
      try {
        await execAsync(`git remote remove ${remoteName}`);
      } catch (e) {
        // Remote doesn't exist, that's fine
      }
      
      await execAsync(`git remote add ${remoteName} ${repoUrl}`);
      
      this.progress(`Pushing ${sourceBranch} to ${branch}`);
      
      const forceFlag = force ? '--force' : '';
      const { stdout, stderr } = await execAsync(
        `git push ${remoteName} ${sourceBranch}:${branch} ${forceFlag}`
      );
      
      await execAsync(`git remote remove ${remoteName}`);
      
      this.info('Push completed successfully');
      
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

  async createAndPush(repoName, description = '', isPrivate = false, branch = 'main') {
    this.progress(`Creating repository and pushing code: ${repoName}`);
    
    try {
      try {
        await execAsync('git rev-parse --git-dir');
      } catch (error) {
        this.progress('Initializing git repository');
        await execAsync('git init');
        await execAsync('git add .');
        await execAsync('git commit -m "Initial commit"');
      }
      
      const repoInfo = await this.createRepo(repoName, description, isPrivate, false);
      
      const { token } = this.getCredentials();
      const username = await this.getGitHubUsername(token);
      
      const authenticatedUrl = repoInfo.cloneUrl.replace(
        'https://github.com',
        `https://${username}:${token}@github.com`
      );
      
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

  async listRepos(type = 'all', sort = 'created', perPage = 100) {
    this.progress('Listing GitHub repositories');
    
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
            
            this.info(`Found ${formattedRepos.length} repositories`);
            
            resolve({
              success: true,
              repositories: formattedRepos,
              count: formattedRepos.length
            });
          } else {
            const error = responseData ? JSON.parse(responseData) : {};
            this.error(`Failed to list repositories: ${error.message || res.statusCode}`);
            reject(new Error(error.message || `Failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        this.error(`Request failed: ${error.message}`);
        reject(error);
      });

      req.end();
    });
  }

  async deleteRepo(owner, repo) {
    this.progress(`Deleting GitHub repository: ${owner}/${repo}`);
    
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
            this.info(`Repository deleted successfully: ${owner}/${repo}`);
            resolve({
              success: true,
              message: `Repository ${owner}/${repo} deleted successfully`
            });
          } else {
            const error = responseData ? JSON.parse(responseData) : {};
            this.error(`Failed to delete repository: ${error.message || res.statusCode}`);
            reject(new Error(error.message || `Failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        this.error(`Request failed: ${error.message}`);
        reject(error);
      });

      req.end();
    });
  }

  async listOrgs(perPage = 100) {
    this.progress(`Listing organizations for authenticated user`);
    
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
            
            this.info(`Found ${formattedOrgs.length} organizations`);
            
            resolve({
              success: true,
              organizations: formattedOrgs,
              count: formattedOrgs.length
            });
          } else {
            const error = responseData ? JSON.parse(responseData) : {};
            this.error(`Failed to list organizations: ${error.message || res.statusCode}`);
            reject(new Error(error.message || `Failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        this.error(`Request failed: ${error.message}`);
        reject(error);
      });

      req.end();
    });
  }

  async listOrgRepos(org, type = 'all', sort = 'created', perPage = 100) {
    this.progress(`Listing repositories for organization: ${org}`);
    
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
            
            this.info(`Found ${formattedRepos.length} repositories in ${org}`);
            
            resolve({
              success: true,
              repositories: formattedRepos,
              count: formattedRepos.length,
              organization: org
            });
          } else {
            const error = responseData ? JSON.parse(responseData) : {};
            this.error(`Failed to list organization repositories: ${error.message || res.statusCode}`);
            reject(new Error(error.message || `Failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        this.error(`Request failed: ${error.message}`);
        reject(error);
      });

      req.end();
    });
  }

  async getFile(owner, repo, filePath, ref = null) {
    this.progress(`Getting file contents: ${owner}/${repo}/${filePath}`);
    
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
            
            let content = '';
            if (fileData.encoding === 'base64' && fileData.content) {
              content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            } else if (fileData.content) {
              content = fileData.content;
            }
            
            this.info(`File retrieved successfully: ${filePath}`);
            
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
            this.error(`Failed to get file: ${error.message || res.statusCode}`);
            reject(new Error(error.message || `Failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        this.error(`Request failed: ${error.message}`);
        reject(error);
      });

      req.end();
    });
  }
}

/**
 * GitHubModule - metadata-driven architecture
 * Metadata comes from module.json, tools contain pure logic only
 */
class GitHubModule extends Module {
  constructor() {
    super();
    this.name = 'github';
    this.description = 'GitHub tools for repository management and operations';
    this.version = '1.0.0';
    this.metadataPath = './module.json';
  }

  getModulePath() {
    return fileURLToPath(import.meta.url);
  }

  static async create(resourceManager) {
    const module = new GitHubModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  async initialize() {
    await super.initialize();
    
    // Get GitHub configuration from ResourceManager
    const token = this.resourceManager.get('env.GITHUB_PAT');
    const org = this.resourceManager.get('env.GITHUB_ORG');
    const user = this.resourceManager.get('env.GITHUB_USER');
    const apiBase = 'api.github.com';

    // Store configuration for tools
    this.config = { token, org, user, apiBase };
    
    // Create tools using metadata
    const githubTool = this.createToolFromMetadata('github', GitHubTool);
    this.registerTool(githubTool.name, githubTool);
  }
}

export default GitHubModule;
