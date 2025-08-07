import { Tool, ToolResult } from '@legion/tool-system';
import { exec } from 'child_process';
import { promisify } from 'util';
import https from 'https';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

/**
 * PolyRepoManager - Tool for managing poly-repo structures
 * Extends GitHub tool to handle splitting monorepos and managing multiple repositories
 */
class PolyRepoManager extends Tool {
  constructor(config = {}) {
    super();
    this.name = 'polyrepo';
    this.description = 'Manages poly-repo structures, splits monorepos, and handles bulk repository operations';
    this.config = config;
    this.githubApiBase = config.apiBase || 'api.github.com';
    this.token = config.token;
    this.org = config.org;
  }

  /**
   * Returns all tool functions in standard function calling format
   */
  getAllToolDescriptions() {
    return [
      {
        type: 'function',
        function: {
          name: 'polyrepo_init_local_repo',
          description: 'Initialize a git repository in a specific directory with initial commit',
          parameters: {
            type: 'object',
            properties: {
              packagePath: {
                type: 'string',
                description: 'Path to the package directory'
              },
              commitMessage: {
                type: 'string',
                description: 'Initial commit message (default: "Initial commit")'
              }
            },
            required: ['packagePath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'polyrepo_create_org_repo',
          description: 'Create a repository in the specified GitHub organization',
          parameters: {
            type: 'object',
            properties: {
              orgName: {
                type: 'string',
                description: 'GitHub organization name'
              },
              repoName: {
                type: 'string',
                description: 'Repository name'
              },
              description: {
                type: 'string',
                description: 'Repository description'
              },
              private: {
                type: 'boolean',
                description: 'Whether the repository should be private (default: false)'
              }
            },
            required: ['orgName', 'repoName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'polyrepo_push_package',
          description: 'Push a package directory to a GitHub repository',
          parameters: {
            type: 'object',
            properties: {
              packagePath: {
                type: 'string',
                description: 'Path to the package directory'
              },
              orgName: {
                type: 'string',
                description: 'GitHub organization name'
              },
              repoName: {
                type: 'string',
                description: 'Repository name'
              },
              branch: {
                type: 'string',
                description: 'Branch name (default: "main")'
              }
            },
            required: ['packagePath', 'orgName', 'repoName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'polyrepo_split_monorepo',
          description: 'Split a monorepo into multiple repositories',
          parameters: {
            type: 'object',
            properties: {
              packages: {
                type: 'array',
                description: 'Array of package configurations',
                items: {
                  type: 'object',
                  properties: {
                    path: {
                      type: 'string',
                      description: 'Path to the package'
                    },
                    repoName: {
                      type: 'string',
                      description: 'Repository name for this package'
                    },
                    description: {
                      type: 'string',
                      description: 'Repository description'
                    }
                  },
                  required: ['path', 'repoName']
                }
              },
              orgName: {
                type: 'string',
                description: 'GitHub organization name'
              },
              private: {
                type: 'boolean',
                description: 'Whether repositories should be private (default: false)'
              }
            },
            required: ['packages', 'orgName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'polyrepo_add_remote',
          description: 'Add a remote to a local git repository',
          parameters: {
            type: 'object',
            properties: {
              packagePath: {
                type: 'string',
                description: 'Path to the package directory'
              },
              remoteName: {
                type: 'string',
                description: 'Name for the remote (default: "origin")'
              },
              remoteUrl: {
                type: 'string',
                description: 'URL of the remote repository'
              }
            },
            required: ['packagePath', 'remoteUrl']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'polyrepo_preserve_history',
          description: 'Extract package with git history preserved using git subtree',
          parameters: {
            type: 'object',
            properties: {
              sourcePath: {
                type: 'string',
                description: 'Path to the source monorepo'
              },
              packagePath: {
                type: 'string',
                description: 'Relative path to the package within monorepo'
              },
              targetPath: {
                type: 'string',
                description: 'Target directory for extracted package'
              }
            },
            required: ['sourcePath', 'packagePath', 'targetPath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'polyrepo_delete_repo',
          description: 'Delete a repository from GitHub organization',
          parameters: {
            type: 'object',
            properties: {
              orgName: {
                type: 'string',
                description: 'GitHub organization name'
              },
              repoName: {
                type: 'string',
                description: 'Repository name to delete'
              }
            },
            required: ['orgName', 'repoName']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'polyrepo_rename_repo',
          description: 'Rename a repository in GitHub organization',
          parameters: {
            type: 'object',
            properties: {
              orgName: {
                type: 'string',
                description: 'GitHub organization name'
              },
              oldRepoName: {
                type: 'string',
                description: 'Current repository name'
              },
              newRepoName: {
                type: 'string',
                description: 'New repository name'
              }
            },
            required: ['orgName', 'oldRepoName', 'newRepoName']
          }
        }
      }
    ];
  }

  /**
   * Invokes the PolyRepoManager tool with the given tool call
   */
  async invoke(toolCall) {
    try {
      const args = this.parseArguments(toolCall.function.arguments);
      let result;

      switch (toolCall.function.name) {
        case 'polyrepo_init_local_repo':
          this.validateRequiredParameters(args, ['packagePath']);
          result = await this.initLocalRepo(args.packagePath, args.commitMessage);
          break;
        case 'polyrepo_create_org_repo':
          this.validateRequiredParameters(args, ['orgName', 'repoName']);
          result = await this.createOrgRepo(
            args.orgName,
            args.repoName,
            args.description,
            args.private
          );
          break;
        case 'polyrepo_push_package':
          this.validateRequiredParameters(args, ['packagePath', 'orgName', 'repoName']);
          result = await this.pushPackage(
            args.packagePath,
            args.orgName,
            args.repoName,
            args.branch
          );
          break;
        case 'polyrepo_split_monorepo':
          this.validateRequiredParameters(args, ['packages', 'orgName']);
          result = await this.splitMonorepo(
            args.packages,
            args.orgName,
            args.private
          );
          break;
        case 'polyrepo_add_remote':
          this.validateRequiredParameters(args, ['packagePath', 'remoteUrl']);
          result = await this.addRemote(
            args.packagePath,
            args.remoteName || 'origin',
            args.remoteUrl
          );
          break;
        case 'polyrepo_preserve_history':
          this.validateRequiredParameters(args, ['sourcePath', 'packagePath', 'targetPath']);
          result = await this.preserveHistory(
            args.sourcePath,
            args.packagePath,
            args.targetPath
          );
          break;
        case 'polyrepo_delete_repo':
          this.validateRequiredParameters(args, ['orgName', 'repoName']);
          result = await this.deleteRepo(
            args.orgName,
            args.repoName
          );
          break;
        case 'polyrepo_rename_repo':
          this.validateRequiredParameters(args, ['orgName', 'oldRepoName', 'newRepoName']);
          result = await this.renameRepo(
            args.orgName,
            args.oldRepoName,
            args.newRepoName
          );
          break;
        default:
          throw new Error(`Unknown function: ${toolCall.function.name}`);
      }

      return ToolResult.success(result);
    } catch (error) {
      return ToolResult.failure(
        error.message || 'PolyRepo operation failed',
        {
          operation: toolCall.function.name,
          errorType: 'execution_error'
        }
      );
    }
  }

  /**
   * Get GitHub credentials from config
   */
  getCredentials() {
    if (!this.token) {
      throw new Error('GitHub PAT not configured. Please provide token in config.');
    }
    return { 
      token: this.token,
      org: this.org
    };
  }

  /**
   * Initialize a local git repository
   */
  async initLocalRepo(packagePath, commitMessage = 'Initial commit') {
    console.log(`Initializing git repository in: ${packagePath}`);
    
    try {
      // Check if already a git repo
      try {
        await execAsync('git rev-parse --git-dir', { cwd: packagePath });
        console.log('Repository already initialized');
        return {
          success: true,
          path: packagePath,
          message: 'Repository already initialized',
          alreadyExists: true
        };
      } catch {
        // Not a git repo, proceed with initialization
      }

      // Initialize repository
      await execAsync('git init', { cwd: packagePath });
      
      // Check if there are files to commit
      const { stdout: status } = await execAsync('git status --porcelain', { cwd: packagePath });
      
      if (status.trim()) {
        // Add all files
        await execAsync('git add .', { cwd: packagePath });
        
        // Create initial commit
        await execAsync(`git commit -m "${commitMessage}"`, { cwd: packagePath });
        
        console.log('Repository initialized with initial commit');
      } else {
        console.log('Repository initialized (no files to commit)');
      }

      return {
        success: true,
        path: packagePath,
        message: 'Repository initialized successfully',
        hasCommit: status.trim() !== ''
      };
    } catch (error) {
      throw new Error(`Failed to initialize repository: ${error.message}`);
    }
  }

  /**
   * Create a repository in a GitHub organization
   */
  async createOrgRepo(orgName, repoName, description = '', isPrivate = false) {
    console.log(`Creating repository ${repoName} in organization ${orgName}`);
    
    const { token } = this.getCredentials();
    
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        name: repoName,
        description: description,
        private: isPrivate,
        auto_init: false
      });

      const options = {
        hostname: this.githubApiBase,
        path: `/orgs/${orgName}/repos`,
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'jsEnvoy-PolyRepo-Tool',
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
            console.log(`Repository created: ${parsed.html_url}`);
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
   * Add a remote to a local repository
   */
  async addRemote(packagePath, remoteName, remoteUrl) {
    console.log(`Adding remote ${remoteName} to ${packagePath}`);
    
    try {
      // Check if remote already exists
      try {
        await execAsync(`git remote get-url ${remoteName}`, { cwd: packagePath });
        // Remote exists, remove it first
        await execAsync(`git remote remove ${remoteName}`, { cwd: packagePath });
      } catch {
        // Remote doesn't exist, that's fine
      }

      // Add the remote
      await execAsync(`git remote add ${remoteName} ${remoteUrl}`, { cwd: packagePath });
      
      return {
        success: true,
        remoteName,
        remoteUrl,
        path: packagePath
      };
    } catch (error) {
      throw new Error(`Failed to add remote: ${error.message}`);
    }
  }

  /**
   * Push a package to a GitHub repository
   */
  async pushPackage(packagePath, orgName, repoName, branch = 'main') {
    console.log(`Pushing ${packagePath} to ${orgName}/${repoName}`);
    
    try {
      const { token } = this.getCredentials();
      
      // Construct repository URL with authentication
      const repoUrl = `https://${token}@github.com/${orgName}/${repoName}.git`;
      
      // Add remote
      await this.addRemote(packagePath, 'origin', repoUrl);
      
      // Push to repository
      const { stdout, stderr } = await execAsync(
        `git push -u origin ${branch}`,
        { cwd: packagePath }
      );
      
      console.log(`Successfully pushed to ${orgName}/${repoName}`);
      
      return {
        success: true,
        packagePath,
        repository: `${orgName}/${repoName}`,
        branch,
        output: stdout + stderr
      };
    } catch (error) {
      throw new Error(`Failed to push package: ${error.message}`);
    }
  }

  /**
   * Split a monorepo into multiple repositories
   */
  async splitMonorepo(packages, orgName, isPrivate = false) {
    console.log(`Splitting monorepo into ${packages.length} repositories`);
    
    const results = [];
    const errors = [];

    for (const pkg of packages) {
      try {
        console.log(`\nProcessing package: ${pkg.repoName}`);
        
        // 1. Initialize local repository
        const initResult = await this.initLocalRepo(pkg.path);
        
        // 2. Create remote repository
        const repoResult = await this.createOrgRepo(
          orgName,
          pkg.repoName,
          pkg.description || '',
          isPrivate
        );
        
        // 3. Push to remote
        const pushResult = await this.pushPackage(
          pkg.path,
          orgName,
          pkg.repoName
        );
        
        results.push({
          package: pkg.repoName,
          path: pkg.path,
          repository: repoResult,
          status: 'success'
        });
      } catch (error) {
        console.error(`Failed to process ${pkg.repoName}: ${error.message}`);
        errors.push({
          package: pkg.repoName,
          path: pkg.path,
          error: error.message,
          status: 'failed'
        });
      }
    }

    return {
      success: errors.length === 0,
      processed: results.length,
      successful: results,
      failed: errors,
      summary: `Processed ${packages.length} packages: ${results.length} successful, ${errors.length} failed`
    };
  }

  /**
   * Extract package with history preserved using git subtree
   */
  async preserveHistory(sourcePath, packagePath, targetPath) {
    console.log(`Extracting ${packagePath} with history from ${sourcePath}`);
    
    try {
      // Create target directory
      await fs.mkdir(targetPath, { recursive: true });
      
      // Use git filter-branch to extract subdirectory with history
      const tempBranch = `extract-${Date.now()}`;
      
      // Clone the repository
      await execAsync(`git clone ${sourcePath} ${targetPath}`);
      
      // Change to target directory
      const commands = [
        `cd ${targetPath}`,
        `git checkout -b ${tempBranch}`,
        `git filter-branch --prune-empty --subdirectory-filter ${packagePath} ${tempBranch}`,
        `git checkout ${tempBranch}`,
        `git branch -D main || true`,
        `git branch -m ${tempBranch} main`
      ];
      
      await execAsync(commands.join(' && '));
      
      console.log(`Successfully extracted ${packagePath} with history`);
      
      return {
        success: true,
        sourcePath,
        packagePath,
        targetPath,
        message: 'Package extracted with history preserved'
      };
    } catch (error) {
      throw new Error(`Failed to extract with history: ${error.message}`);
    }
  }

  /**
   * Delete a repository from GitHub organization
   */
  async deleteRepo(orgName, repoName) {
    console.log(`Deleting repository ${repoName} from organization ${orgName}`);
    
    const { token } = this.getCredentials();
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.githubApiBase,
        path: `/repos/${orgName}/${repoName}`,
        method: 'DELETE',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'jsEnvoy-PolyRepo-Tool',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 204) {
          console.log(`Repository deleted: ${orgName}/${repoName}`);
          resolve({
            success: true,
            message: `Repository ${orgName}/${repoName} deleted successfully`
          });
        } else {
          let responseData = '';
          res.on('data', (chunk) => { responseData += chunk; });
          res.on('end', () => {
            const parsed = JSON.parse(responseData);
            reject(new Error(`Failed to delete repository: ${parsed.message || responseData}`));
          });
        }
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Rename a repository in GitHub organization
   */
  async renameRepo(orgName, oldRepoName, newRepoName) {
    console.log(`Renaming repository ${oldRepoName} to ${newRepoName} in organization ${orgName}`);
    
    const { token } = this.getCredentials();
    
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        name: newRepoName
      });

      const options = {
        hostname: this.githubApiBase,
        path: `/repos/${orgName}/${oldRepoName}`,
        method: 'PATCH',
        headers: {
          'Authorization': `token ${token}`,
          'User-Agent': 'jsEnvoy-PolyRepo-Tool',
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
          
          if (res.statusCode === 200) {
            console.log(`Repository renamed: ${orgName}/${oldRepoName} -> ${orgName}/${newRepoName}`);
            resolve({
              success: true,
              name: parsed.name,
              url: parsed.html_url,
              oldName: oldRepoName,
              newName: newRepoName,
              message: `Repository renamed successfully from ${oldRepoName} to ${newRepoName}`
            });
          } else {
            reject(new Error(`Failed to rename repository: ${parsed.message || responseData}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}

export default PolyRepoManager;