/**
 * Integration tests with live API modules (GitHub, Serper, AI Generation)
 * These tests use real API calls to validate the new inputs/outputs system
 * Modules are loaded dynamically through ModuleLoader
 */

import { PlanExecutor } from '../../src/core/PlanExecutor.js';
import { ResourceManager } from '@legion/tool-core';

describe('Live API Modules Integration with New Input/Output System', () => {
  let executor;
  let resourceManager;
  let availableTools;

  beforeAll(async () => {
    // Set up real ResourceManager and PlanExecutor
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    executor = await PlanExecutor.create(resourceManager);
    
    // The module loader automatically discovers and loads modules
    // Let's get the list of available tools
    const toolRegistry = executor.moduleLoader.toolRegistry;
    availableTools = await toolRegistry.getAllTools();
    
    console.log('📦 Available tools loaded:');
    const toolsByModule = {};
    for (const [toolName, toolInfo] of Object.entries(availableTools)) {
      const moduleId = toolInfo.moduleId || 'unknown';
      if (!toolsByModule[moduleId]) {
        toolsByModule[moduleId] = [];
      }
      toolsByModule[moduleId].push(toolName);
    }
    
    for (const [moduleId, tools] of Object.entries(toolsByModule)) {
      console.log(`  Module: ${moduleId}`);
      tools.forEach(tool => console.log(`    - ${tool}`));
    }
    
    // Check for API-related tools
    const hasGitHub = Object.keys(availableTools).some(t => t.includes('github'));
    const hasSerper = Object.keys(availableTools).some(t => t.includes('serper'));
    const hasAI = Object.keys(availableTools).some(t => t.includes('ai_') || t.includes('generate'));
    
    if (!hasGitHub) {
      console.warn('GitHub tools not available - GitHub tests will be skipped');
    }
    if (!hasSerper) {
      console.warn('Serper tools not available - Serper tests will be skipped');
    }
    if (!hasAI) {
      console.warn('AI Generation tools not available - AI tests will be skipped');
    }
    
    // Check for required API keys
    const githubPat = resourceManager.env.GITHUB_PAT;
    const serperKey = resourceManager.env.SERPER_API_KEY;
    const anthropicKey = resourceManager.env.ANTHROPIC_API_KEY;
    
    if (!githubPat) {
      console.warn('GITHUB_PAT not available - GitHub tests will be skipped');
    }
    if (!serperKey) {
      console.warn('SERPER_API_KEY not available - Serper tests will be skipped');
    }
    if (!anthropicKey) {
      console.warn('ANTHROPIC_API_KEY not available - AI Generation tests will be skipped');
    }
  }, 60000);

  describe('Tool Discovery', () => {
    test('should have loaded tools from multiple modules', () => {
      expect(Object.keys(availableTools).length).toBeGreaterThan(0);
      console.log(`✅ Loaded ${Object.keys(availableTools).length} tools total`);
    });

    test('should have file operation tools available', () => {
      const fileTools = Object.keys(availableTools).filter(t => 
        t.includes('file') || t.includes('directory')
      );
      expect(fileTools.length).toBeGreaterThan(0);
      console.log(`📁 File tools available: ${fileTools.join(', ')}`);
    });
  });

  describe('GitHub API Integration', () => {
    test('should search repositories and get details using new input/output format', async () => {
      const githubPat = resourceManager.env.GITHUB_PAT;
      const hasGitHubSearch = 'github_search_repositories' in availableTools;
      const hasGitHubRepo = 'github_get_repository' in availableTools;
      
      if (!githubPat || !hasGitHubSearch || !hasGitHubRepo) {
        console.log('Skipping GitHub test - missing requirements');
        console.log(`  API Key: ${!!githubPat}, Search tool: ${hasGitHubSearch}, Repo tool: ${hasGitHubRepo}`);
        return;
      }

      const plan = {
        id: 'github-integration-test',
        name: 'GitHub API Integration Test',
        status: 'validated',
        steps: [
          {
            id: 'search-repos',
            name: 'Search for Legion repositories',
            actions: [
              {
                id: 'search-action',
                type: 'github_search_repositories',
                inputs: {
                  query: 'Legion AI framework',
                  sort: 'stars',
                  per_page: 3
                },
                outputs: {
                  repositories: 'foundRepos',
                  total_count: 'repoCount'
                }
              }
            ]
          },
          {
            id: 'get-repo-details',
            name: 'Get repository details',
            dependencies: ['search-repos'],
            actions: [
              {
                id: 'get-first-repo',
                type: 'github_get_repository',
                inputs: {
                  owner: 'anthropic',
                  repo: 'anthropic-sdk-typescript'
                },
                outputs: {
                  name: 'repoName',
                  description: 'repoDescription',
                  language: 'primaryLanguage',
                  stars: 'starCount'
                }
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['search-repos', 'get-repo-details']);
      expect(result.failedSteps).toHaveLength(0);
      
      console.log('✅ GitHub integration test completed successfully');
      console.log(`🔍 Found ${result.context?.getVariable('repoCount')} repositories`);
      console.log(`📁 Repository: ${result.context?.getVariable('repoName')}`);
      console.log(`⭐ Stars: ${result.context?.getVariable('starCount')}`);
    }, 30000);

    test('should get user profile information', async () => {
      const githubPat = resourceManager.env.GITHUB_PAT;
      const hasGitHubUser = 'github_get_user' in availableTools;
      
      if (!githubPat || !hasGitHubUser) {
        console.log('Skipping GitHub user test - missing requirements');
        return;
      }

      const plan = {
        id: 'github-user-test',
        name: 'GitHub User Profile Test',
        status: 'validated',
        steps: [
          {
            id: 'get-user',
            name: 'Get user profile',
            actions: [
              {
                id: 'get-user-action',
                type: 'github_get_user',
                inputs: {
                  username: 'anthropic'
                },
                outputs: {
                  name: 'userName',
                  login: 'userLogin',
                  public_repos: 'repoCount',
                  followers: 'followerCount'
                }
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['get-user']);
      
      const userName = result.context?.getVariable('userName');
      const userLogin = result.context?.getVariable('userLogin');
      const repoCount = result.context?.getVariable('repoCount');
      
      expect(userLogin).toBe('anthropic');
      expect(typeof repoCount).toBe('number');
      expect(repoCount).toBeGreaterThan(0);
      
      console.log(`👤 User: ${userName} (@${userLogin})`);
      console.log(`📚 Public repositories: ${repoCount}`);
    }, 15000);
  });

  describe('Serper Search API Integration', () => {
    test('should perform web search and extract information', async () => {
      const serperKey = resourceManager.env.SERPER_API_KEY;
      const hasSerperSearch = 'serper_search' in availableTools;
      
      if (!serperKey || !hasSerperSearch) {
        console.log('Skipping Serper test - missing requirements');
        console.log(`  API Key: ${!!serperKey}, Search tool: ${hasSerperSearch}`);
        return;
      }

      const plan = {
        id: 'serper-integration-test',
        name: 'Serper Search Integration Test',
        status: 'validated',
        steps: [
          {
            id: 'web-search',
            name: 'Search for AI framework information',
            actions: [
              {
                id: 'search-action',
                type: 'serper_search',
                inputs: {
                  q: 'Legion AI agent framework open source',
                  type: 'search',
                  num: 5
                },
                outputs: {
                  organic: 'searchResults',
                  searchInformation: 'searchInfo'
                }
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['web-search']);
      
      const searchResults = result.context?.getVariable('searchResults');
      const searchInfo = result.context?.getVariable('searchInfo');
      
      expect(Array.isArray(searchResults)).toBe(true);
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchInfo).toBeDefined();
      
      console.log(`🔍 Found ${searchResults.length} search results`);
      console.log(`🔗 First result: ${searchResults[0]?.title}`);
    }, 15000);

    test('should search for images', async () => {
      const serperKey = resourceManager.env.SERPER_API_KEY;
      const hasSerperSearch = 'serper_search' in availableTools;
      
      if (!serperKey || !hasSerperSearch) {
        console.log('Skipping Serper image test - missing requirements');
        return;
      }

      const plan = {
        id: 'serper-image-test',
        name: 'Serper Image Search Test',
        status: 'validated',
        steps: [
          {
            id: 'image-search',
            name: 'Search for AI images',
            actions: [
              {
                id: 'image-search-action',
                type: 'serper_search',
                inputs: {
                  q: 'artificial intelligence robot',
                  type: 'images',
                  num: 3
                },
                outputs: {
                  images: 'imageResults',
                  searchInformation: 'imageSearchInfo'
                }
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['image-search']);
      
      const imageResults = result.context?.getVariable('imageResults');
      expect(Array.isArray(imageResults)).toBe(true);
      expect(imageResults.length).toBeGreaterThan(0);
      
      console.log(`🖼️ Found ${imageResults.length} image results`);
    }, 15000);
  });

  describe('AI Generation Integration', () => {
    test('should generate text and use output in subsequent actions', async () => {
      const anthropicKey = resourceManager.env.ANTHROPIC_API_KEY;
      const hasAIGenerate = Object.keys(availableTools).some(t => 
        t.includes('ai_generate') || t.includes('generate_text')
      );
      
      if (!anthropicKey || !hasAIGenerate) {
        console.log('Skipping AI Generation test - missing requirements');
        console.log(`  API Key: ${!!anthropicKey}, AI tools: ${hasAIGenerate}`);
        console.log(`  Available AI tools: ${Object.keys(availableTools).filter(t => t.includes('ai')).join(', ')}`);
        return;
      }

      // Find the actual AI generation tool name
      const aiToolName = Object.keys(availableTools).find(t => 
        t.includes('ai_generate_text') || t === 'generate_text'
      ) || 'ai_generate_text';

      const plan = {
        id: 'ai-generation-test',
        name: 'AI Generation Integration Test',
        status: 'validated',
        steps: [
          {
            id: 'generate-description',
            name: 'Generate project description',
            actions: [
              {
                id: 'generate-action',
                type: aiToolName,
                inputs: {
                  prompt: 'Write a concise 2-sentence description for a fictional AI agent framework called "Legion".',
                  max_tokens: 100,
                  model: 'claude-3-haiku-20240307'
                },
                outputs: {
                  generated_text: 'projectDescription',
                  token_count: 'tokensUsed'
                }
              }
            ]
          },
          {
            id: 'enhance-description',
            name: 'Enhance the description',
            dependencies: ['generate-description'],
            actions: [
              {
                id: 'enhance-action',
                type: aiToolName,
                inputs: {
                  prompt: 'Take this description and add one key technical benefit: @projectDescription',
                  max_tokens: 150,
                  model: 'claude-3-haiku-20240307'
                },
                outputs: {
                  generated_text: 'enhancedDescription',
                  token_count: 'enhanceTokensUsed'
                }
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['generate-description', 'enhance-description']);
      
      const originalDescription = result.context?.getVariable('projectDescription');
      const enhancedDescription = result.context?.getVariable('enhancedDescription');
      const tokensUsed = result.context?.getVariable('tokensUsed');
      const enhanceTokensUsed = result.context?.getVariable('enhanceTokensUsed');
      
      expect(typeof originalDescription).toBe('string');
      expect(originalDescription.length).toBeGreaterThan(10);
      expect(typeof enhancedDescription).toBe('string');
      expect(enhancedDescription.length).toBeGreaterThan(originalDescription.length);
      expect(typeof tokensUsed).toBe('number');
      expect(typeof enhanceTokensUsed).toBe('number');
      
      console.log('📝 Original description:', originalDescription);
      console.log('✨ Enhanced description:', enhancedDescription);
      console.log(`🔢 Total tokens used: ${tokensUsed + enhanceTokensUsed}`);
    }, 30000);
  });

  describe('Multi-Module Workflow Integration', () => {
    test('should combine multiple tools in a complete workflow', async () => {
      // Check what tools are actually available
      const hasFileWrite = 'file_write' in availableTools;
      const hasFileRead = 'file_read' in availableTools;
      const hasDirCreate = 'directory_create' in availableTools;
      
      if (!hasFileWrite || !hasFileRead || !hasDirCreate) {
        console.log('Skipping multi-module test - missing required tools');
        console.log(`  File write: ${hasFileWrite}, File read: ${hasFileRead}, Dir create: ${hasDirCreate}`);
        return;
      }

      const tempDir = `/tmp/plan-executor-test-${Date.now()}`;

      const plan = {
        id: 'multi-module-workflow',
        name: 'Complete Multi-Module Workflow',
        status: 'validated',
        steps: [
          {
            id: 'setup-workspace',
            name: 'Create workspace',
            actions: [
              {
                id: 'create-dir',
                type: 'directory_create',
                inputs: {
                  dirpath: tempDir,
                  operation: 'create'
                },
                outputs: {
                  dirpath: 'workspaceDir',
                  created: 'dirCreated'
                }
              }
            ]
          },
          {
            id: 'create-config',
            name: 'Create configuration file',
            dependencies: ['setup-workspace'],
            actions: [
              {
                id: 'write-config',
                type: 'file_write',
                inputs: {
                  filepath: '@workspaceDir/config.json',
                  content: {
                    project: 'Legion Test',
                    version: '1.0.0',
                    modules: ['file', 'github', 'serper'],
                    timestamp: new Date().toISOString()
                  }
                },
                outputs: {
                  filepath: 'configPath',
                  bytesWritten: 'configSize'
                }
              }
            ]
          },
          {
            id: 'verify-config',
            name: 'Verify configuration',
            dependencies: ['create-config'],
            actions: [
              {
                id: 'read-config',
                type: 'file_read',
                inputs: {
                  filepath: '@configPath'
                },
                outputs: {
                  content: 'configContent',
                  size: 'fileSize'
                }
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['setup-workspace', 'create-config', 'verify-config']);
      
      const workspaceDir = result.context?.getVariable('workspaceDir');
      const configPath = result.context?.getVariable('configPath');
      const configContent = result.context?.getVariable('configContent');
      const configSize = result.context?.getVariable('configSize');
      
      expect(workspaceDir).toBe(tempDir);
      expect(configPath).toBe(`${tempDir}/config.json`);
      expect(typeof configContent).toBe('object');
      expect(configContent.project).toBe('Legion Test');
      expect(configContent.version).toBe('1.0.0');
      expect(Array.isArray(configContent.modules)).toBe(true);
      expect(typeof configSize).toBe('number');
      expect(configSize).toBeGreaterThan(0);
      
      console.log('🌐 Complete Multi-Module Workflow Results:');
      console.log(`📁 Workspace created at: ${workspaceDir}`);
      console.log(`📄 Config file: ${configPath} (${configSize} bytes)`);
      console.log(`✅ Config content verified:`, configContent);
      
      // Clean up
      try {
        const fs = await import('fs');
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }, 30000);
  });

  describe('Error Handling with Module Loading', () => {
    test('should handle missing tool gracefully', async () => {
      const plan = {
        id: 'error-handling-test',
        name: 'Missing Tool Error Test',
        status: 'validated',
        steps: [
          {
            id: 'invalid-tool',
            name: 'Use non-existent tool',
            actions: [
              {
                id: 'bad-tool-request',
                type: 'this_tool_definitely_does_not_exist',
                inputs: {
                  param: 'value'
                },
                outputs: {
                  result: 'shouldNotExist'
                }
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan);
      
      expect(result.success).toBe(false);
      expect(result.failedSteps).toContain('invalid-tool');
      expect(result.completedSteps).toHaveLength(0);
      
      console.log('✅ Error handling test completed - missing tools handled gracefully');
    }, 15000);
  });

  describe('Tool Aliases and Resolution', () => {
    test('should list all available tools with their aliases', () => {
      console.log('\n📋 Complete Tool Inventory:');
      console.log('================================');
      
      const toolList = [];
      for (const [toolName, toolInfo] of Object.entries(availableTools)) {
        const aliases = toolInfo.aliases || [];
        toolList.push({
          name: toolName,
          module: toolInfo.moduleId || 'unknown',
          aliases: aliases.length > 0 ? aliases.join(', ') : 'none'
        });
      }
      
      // Group by module
      const byModule = {};
      toolList.forEach(tool => {
        if (!byModule[tool.module]) {
          byModule[tool.module] = [];
        }
        byModule[tool.module].push(tool);
      });
      
      for (const [module, tools] of Object.entries(byModule)) {
        console.log(`\n📦 Module: ${module}`);
        tools.forEach(tool => {
          console.log(`   🔧 ${tool.name}`);
          if (tool.aliases !== 'none') {
            console.log(`      Aliases: ${tool.aliases}`);
          }
        });
      }
      
      console.log('\n================================');
      console.log(`Total tools available: ${toolList.length}`);
      
      expect(toolList.length).toBeGreaterThan(0);
    });
  });
});