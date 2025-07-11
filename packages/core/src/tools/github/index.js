const { Tool } = require("../base/base-tool");
const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class GitHubTool extends Tool {
  constructor() {
    super();
    this.name = "GitHub Repository Tool";
    this.identifier = "github_tool";
    this.abilities = [
      "Create new GitHub repositories",
      "Push code to GitHub repositories",
      "Create and push in one operation"
    ];
    this.instructions = [
      "Use createRepo to create a new repository",
      "Use pushToRepo to push to an existing repository",
      "Use createAndPush to do both operations at once"
    ];
    this.functions = [
      {
        name: "createRepo",
        purpose: "Create a new GitHub repository",
        arguments: [
          {
            name: "repoName",
            description: "Name of the repository to create",
            dataType: "string"
          },
          {
            name: "description",
            description: "Description of the repository",
            dataType: "string"
          },
          {
            name: "isPrivate",
            description: "Whether the repository should be private",
            dataType: "boolean"
          }
        ],
        response: "Repository creation result with URLs"
      },
      {
        name: "pushToRepo",
        purpose: "Push current repository to GitHub",
        arguments: [
          {
            name: "repoUrl",
            description: "The GitHub repository URL",
            dataType: "string"
          },
          {
            name: "branch",
            description: "Branch name to push to",
            dataType: "string"
          }
        ],
        response: "Push operation result"
      },
      {
        name: "createAndPush",
        purpose: "Create a new repository and push code to it",
        arguments: [
          {
            name: "repoName",
            description: "Name of the repository to create",
            dataType: "string"
          },
          {
            name: "description",
            description: "Description of the repository",
            dataType: "string"
          }
        ],
        response: "Combined operation result"
      }
    ];
    
    this.functionMap = {
      'createRepo': this.createRepo.bind(this),
      'pushToRepo': this.pushToRepo.bind(this),
      'createAndPush': this.createAndPush.bind(this)
    };
  }

  async getCredentials() {
    const envPath = path.join(process.cwd(), '.env');
    try {
      const envContent = await fs.readFile(envPath, 'utf8');
      const patMatch = envContent.match(/GITHUB_PAT=(.+)/);
      if (patMatch) {
        return { token: patMatch[1].trim() };
      }
    } catch (error) {
      // .env file not found
    }

    if (process.env.GITHUB_PAT) {
      return { token: process.env.GITHUB_PAT };
    }

    throw new Error('GitHub PAT not found. Please set GITHUB_PAT in .env file or environment variable.');
  }

  async getGitHubUsername(token) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
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
            reject(new Error(`Failed to get user info: ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  async createRepo(repoName, description = '', isPrivate = false) {
    const { token } = await this.getCredentials();
    
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        name: repoName,
        description: description,
        private: isPrivate,
        auto_init: false
      });

      const options = {
        hostname: 'api.github.com',
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
            resolve({
              success: true,
              name: parsed.name,
              url: parsed.html_url,
              cloneUrl: parsed.clone_url
            });
          } else {
            reject(new Error(`Failed to create repository: ${parsed.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async pushToRepo(repoUrl, branch = 'main') {
    await execAsync('git rev-parse --git-dir');
    
    const { stdout: currentBranch } = await execAsync('git branch --show-current');
    const sourceBranch = currentBranch.trim() || 'main';
    
    const remoteName = 'github-push';
    try {
      await execAsync(`git remote remove ${remoteName}`);
    } catch (e) {
      // Remote doesn't exist
    }
    
    await execAsync(`git remote add ${remoteName} ${repoUrl}`);
    await execAsync(`git push ${remoteName} ${sourceBranch}:${branch}`);
    await execAsync(`git remote remove ${remoteName}`);
    
    return {
      success: true,
      sourceBranch: sourceBranch,
      targetBranch: branch,
      repoUrl: repoUrl
    };
  }

  async createAndPush(repoName, description = '') {
    try {
      await execAsync('git rev-parse --git-dir');
    } catch (error) {
      await execAsync('git init');
      await execAsync('git add .');
      await execAsync('git commit -m "Initial commit"');
    }
    
    const repoInfo = await this.createRepo(repoName, description, false);
    const { token } = await this.getCredentials();
    const username = await this.getGitHubUsername(token);
    
    const authenticatedUrl = repoInfo.cloneUrl.replace(
      'https://github.com',
      `https://${username}:${token}@github.com`
    );
    
    const pushResult = await this.pushToRepo(authenticatedUrl, 'main');
    
    return {
      success: true,
      repository: repoInfo,
      push: pushResult
    };
  }
}

const githubTool = new GitHubTool();

module.exports = { GitHubTool, githubTool };