/**
 * Git Module
 * Provides Git operations as tools
 */

import simpleGit from 'simple-git';
import { ModuleDefinition } from './ModuleDefinition.js';
import { ModuleInstance } from './ModuleInstance.js';
import { Tool } from './Tool.js';
import { generateHandle } from '../utils/HandleManager.js';

/**
 * GitModuleDefinition
 */
export class GitModuleDefinition extends ModuleDefinition {
  static async create(config) {
    // Use provided simple-git or create new instance
    const git = config.simpleGit ? config.simpleGit(config.repoPath) : simpleGit(config.repoPath);
    
    // Create module instance
    const instance = new GitModuleInstance(this, config, git);
    await instance.initialize();
    
    return instance;
  }

  static getMetadata() {
    return {
      name: 'GitModule',
      description: 'Git operations module',
      version: '1.0.0',
      tools: {
        init: {
          description: 'Initialize repository',
          input: { bare: 'boolean?' },
          output: { success: 'boolean', message: 'string' }
        },
        clone: {
          description: 'Clone repository',
          input: { url: 'string', path: 'string?', options: 'object?' },
          output: { success: 'boolean', handle: 'string', type: 'string' }
        },
        status: {
          description: 'Get repository status',
          input: {},
          output: { current: 'string', modified: 'Array<string>', not_added: 'Array<string>' }
        },
        add: {
          description: 'Add files to staging',
          input: { files: 'Array<string>' },
          output: { success: 'boolean' }
        },
        commit: {
          description: 'Commit changes',
          input: { message: 'string', files: 'Array<string>?', options: 'object?' },
          output: { success: 'boolean' }
        },
        push: {
          description: 'Push to remote',
          input: { remote: 'string?', branch: 'string?', options: 'object?' },
          output: { success: 'boolean' }
        },
        pull: {
          description: 'Pull from remote',
          input: { remote: 'string?', branch: 'string?', options: 'object?' },
          output: { success: 'boolean' }
        },
        fetch: {
          description: 'Fetch from remote',
          input: { remote: 'string?', options: 'object?' },
          output: { success: 'boolean' }
        },
        branch: {
          description: 'List branches',
          input: { remote: 'boolean?' },
          output: { branches: 'Array<string>' }
        },
        checkout: {
          description: 'Checkout branch',
          input: { branch: 'string', createNew: 'boolean?' },
          output: { success: 'boolean' }
        },
        merge: {
          description: 'Merge branches',
          input: { from: 'string', options: 'object?' },
          output: { success: 'boolean' }
        },
        rebase: {
          description: 'Rebase branch',
          input: { branch: 'string' },
          output: { success: 'boolean' }
        },
        log: {
          description: 'Get commit log',
          input: { maxCount: 'number?' },
          output: { commits: 'Array<object>' }
        },
        diff: {
          description: 'Show diff',
          input: { options: 'Array<string>?' },
          output: { diff: 'string' }
        },
        diffSummary: {
          description: 'Get diff summary',
          input: { options: 'Array<string>?' },
          output: { changed: 'number', insertions: 'number', deletions: 'number' }
        },
        stash: {
          description: 'Stash operations',
          input: { command: 'string', message: 'string?' },
          output: { success: 'boolean', stashes: 'Array<string>?' }
        },
        tag: {
          description: 'Tag operations',
          input: { command: 'string', name: 'string?', message: 'string?' },
          output: { success: 'boolean', tags: 'Array<string>?' }
        },
        remote: {
          description: 'Remote operations',
          input: { command: 'string', name: 'string?', url: 'string?' },
          output: { success: 'boolean', remotes: 'Array<object>?' }
        },
        reset: {
          description: 'Reset changes',
          input: { mode: 'string?', ref: 'string?' },
          output: { success: 'boolean' }
        },
        revert: {
          description: 'Revert commit',
          input: { commit: 'string' },
          output: { success: 'boolean' }
        },
        show: {
          description: 'Show file contents',
          input: { ref: 'string' },
          output: { content: 'string' }
        },
        blame: {
          description: 'Show blame information',
          input: { file: 'string' },
          output: { lines: 'Array<object>' }
        }
      }
    };
  }
}

/**
 * GitModuleInstance
 */
export class GitModuleInstance extends ModuleInstance {
  constructor(moduleDefinition, config, git) {
    super(moduleDefinition, config);
    this.git = git;
    this.repositories = new Map();
  }

  async initialize() {
    this.createTools();
  }

  createTools() {
    // Initialize repository
    this.tools.init = new Tool({
      name: 'init',
      execute: async (input) => {
        try {
          await this.git.init(input.bare || false);
          return {
            success: true,
            message: 'Repository initialized'
          };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'INIT_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.init
    });

    // Clone repository
    this.tools.clone = new Tool({
      name: 'clone',
      execute: async (input) => {
        try {
          await this.git.clone(input.url, input.path, input.options);
          
          // Create handle for cloned repository
          const handle = generateHandle('repository', {
            url: input.url,
            path: input.path || '.'
          });
          this.repositories.set(handle._id, { url: input.url, path: input.path });
          
          return {
            success: true,
            handle: handle._id,
            type: 'repository'
          };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'CLONE_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.clone
    });

    // Get status
    this.tools.status = new Tool({
      name: 'status',
      execute: async (input) => {
        try {
          const status = await this.git.status();
          return status;
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'STATUS_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.status
    });

    // Add files
    this.tools.add = new Tool({
      name: 'add',
      execute: async (input) => {
        try {
          await this.git.add(input.files || '.');
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'ADD_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.add
    });

    // Commit changes
    this.tools.commit = new Tool({
      name: 'commit',
      execute: async (input) => {
        try {
          await this.git.commit(input.message, input.files, input.options);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'COMMIT_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.commit
    });

    // Push to remote
    this.tools.push = new Tool({
      name: 'push',
      execute: async (input) => {
        try {
          await this.git.push(input.remote, input.branch, input.options);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'PUSH_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.push
    });

    // Pull from remote
    this.tools.pull = new Tool({
      name: 'pull',
      execute: async (input) => {
        try {
          await this.git.pull(input.remote, input.branch, input.options);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'PULL_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.pull
    });

    // Fetch from remote
    this.tools.fetch = new Tool({
      name: 'fetch',
      execute: async (input) => {
        try {
          await this.git.fetch(input.remote, input.options);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'FETCH_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.fetch
    });

    // List branches
    this.tools.branch = new Tool({
      name: 'branch',
      execute: async (input) => {
        try {
          const branches = input.remote ? 
            await this.git.branch() : 
            await this.git.branchLocal();
          return { branches: branches.all };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'BRANCH_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.branch
    });

    // Checkout branch
    this.tools.checkout = new Tool({
      name: 'checkout',
      execute: async (input) => {
        try {
          if (input.createNew) {
            await this.git.checkoutBranch(input.branch, 'HEAD');
          } else {
            await this.git.checkout(input.branch);
          }
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'CHECKOUT_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.checkout
    });

    // Merge branches
    this.tools.merge = new Tool({
      name: 'merge',
      execute: async (input) => {
        try {
          const options = [];
          options.push(input.from);
          if (input.options) {
            Object.keys(input.options).forEach(key => {
              options.push(key);
            });
          }
          await this.git.merge(options);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'MERGE_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.merge
    });

    // Rebase branch
    this.tools.rebase = new Tool({
      name: 'rebase',
      execute: async (input) => {
        try {
          await this.git.rebase([input.branch]);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'REBASE_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.rebase
    });

    // Get commit log
    this.tools.log = new Tool({
      name: 'log',
      execute: async (input) => {
        try {
          const options = {};
          if (input.maxCount) options.maxCount = input.maxCount;
          
          const log = await this.git.log(options);
          return { commits: log.all };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'LOG_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.log
    });

    // Show diff
    this.tools.diff = new Tool({
      name: 'diff',
      execute: async (input) => {
        try {
          const diff = await this.git.diff(input.options || []);
          return { diff };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'DIFF_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.diff
    });

    // Get diff summary
    this.tools.diffSummary = new Tool({
      name: 'diffSummary',
      execute: async (input) => {
        try {
          const summary = await this.git.diffSummary(input.options);
          return summary;
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'DIFF_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.diffSummary
    });

    // Stash operations
    this.tools.stash = new Tool({
      name: 'stash',
      execute: async (input) => {
        try {
          switch (input.command) {
            case 'push':
              const stashArgs = ['push'];
              if (input.message) {
                stashArgs.push('-m', input.message);
              }
              await this.git.stash(stashArgs);
              return { success: true };
              
            case 'list':
              const stashList = await this.git.stashList();
              return { 
                success: true,
                stashes: stashList.all 
              };
              
            case 'pop':
              await this.git.stashPop();
              return { success: true };
              
            default:
              return {
                success: false,
                error: {
                  code: 'INVALID_COMMAND',
                  message: 'Invalid stash command'
                }
              };
          }
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'STASH_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.stash
    });

    // Tag operations
    this.tools.tag = new Tool({
      name: 'tag',
      execute: async (input) => {
        try {
          switch (input.command) {
            case 'create':
              await this.git.addTag(input.name, input.message);
              return { success: true };
              
            case 'list':
              const tags = await this.git.tags();
              return {
                success: true,
                tags: tags.all
              };
              
            default:
              return {
                success: false,
                error: {
                  code: 'INVALID_COMMAND',
                  message: 'Invalid tag command'
                }
              };
          }
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'TAG_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.tag
    });

    // Remote operations
    this.tools.remote = new Tool({
      name: 'remote',
      execute: async (input) => {
        try {
          switch (input.command) {
            case 'list':
              const remotes = await this.git.getRemotes(true);
              return {
                success: true,
                remotes
              };
              
            case 'add':
              await this.git.addRemote(input.name, input.url);
              return { success: true };
              
            case 'remove':
              await this.git.removeRemote(input.name);
              return { success: true };
              
            default:
              return {
                success: false,
                error: {
                  code: 'INVALID_COMMAND',
                  message: 'Invalid remote command'
                }
              };
          }
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'REMOTE_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.remote
    });

    // Reset changes
    this.tools.reset = new Tool({
      name: 'reset',
      execute: async (input) => {
        try {
          const args = [];
          if (input.mode) args.push(`--${input.mode}`);
          if (input.ref) args.push(input.ref);
          
          await this.git.reset(args);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'RESET_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.reset
    });

    // Revert commit
    this.tools.revert = new Tool({
      name: 'revert',
      execute: async (input) => {
        try {
          await this.git.revert(input.commit, { '--no-edit': null });
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'REVERT_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.revert
    });

    // Show file contents
    this.tools.show = new Tool({
      name: 'show',
      execute: async (input) => {
        try {
          const content = await this.git.show(input.ref);
          return { content };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'SHOW_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.show
    });

    // Blame file
    this.tools.blame = new Tool({
      name: 'blame',
      execute: async (input) => {
        try {
          const blame = await this.git.blame(input.file);
          return { lines: blame };
        } catch (error) {
          return {
            success: false,
            error: {
              code: 'BLAME_ERROR',
              message: error.message
            }
          };
        }
      },
      getMetadata: () => GitModuleDefinition.getMetadata().tools.blame
    });
  }

  async cleanup() {
    // Clean up any resources
    this.repositories.clear();
  }
}