/**
 * Live integration test for tool sufficiency judgment with real LLM and database
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PlanSynthesizer } from '../../src/core/PlanSynthesizer.js';
import { ToolDiscoveryBridge } from '../../src/core/ToolDiscoveryBridge.js';
import { ContextHints } from '../../src/core/ContextHints.js';
import { ResourceManager } from '@legion/resource-manager';
import { Anthropic } from '@anthropic-ai/sdk';
import { MongoClient } from 'mongodb';

describe('Live Tool Judgment Integration', () => {
  let synthesizer;
  let llmClient;
  let mongoClient;
  let toolsCollection;
  let hasLiveServices = false;
  
  beforeAll(async () => {
    // Initialize ResourceManager
    const resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Check for API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.log('Skipping live tests - no ANTHROPIC_API_KEY');
      return;
    }
    
    // Create LLM client
    const anthropic = new Anthropic({ apiKey });
    llmClient = {
      generateResponse: async (options) => {
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 500,
          temperature: 0.1,
          messages: options.messages
        });
        return {
          content: response.content[0].text
        };
      }
    };
    
    // Connect to MongoDB to get real tools
    const mongoUrl = resourceManager.get('env.MONGODB_URI') || resourceManager.get('env.MONGODB_URL');
    if (mongoUrl) {
      try {
        mongoClient = new MongoClient(mongoUrl);
        await mongoClient.connect();
        const db = mongoClient.db(resourceManager.get('env.TOOLS_DATABASE_NAME') || 'legion_tools');
        toolsCollection = db.collection('tools');
        
        const count = await toolsCollection.countDocuments();
        if (count > 0) {
          hasLiveServices = true;
          console.log(`Connected to MongoDB with ${count} tools available`);
        }
      } catch (error) {
        console.log('MongoDB connection failed:', error.message);
      }
    }
    
    if (hasLiveServices) {
      // Create synthesizer with real LLM
      synthesizer = new PlanSynthesizer({
        llmClient,
        toolDiscovery: null, // Not needed for judgment tests
        contextHints: new ContextHints()
      });
    }
  });
  
  afterAll(async () => {
    if (mongoClient) {
      await mongoClient.close();
    }
  });
  
  describe('Real Tool Judgment with Live LLM', () => {
    it('should judge file system tools as sufficient for file operations', async () => {
      if (!hasLiveServices) {
        console.log('Skipping - no live services available');
        return;
      }
      
      // Get real file system tools from database
      const fileTools = await toolsCollection.find({
        name: { $in: ['file_read', 'file_write', 'file_delete'] }
      }).toArray();
      
      expect(fileTools.length).toBeGreaterThan(0);
      
      const node = {
        id: 'file-task',
        description: 'Read a configuration file and extract settings'
      };
      
      const hints = {
        suggestedInputs: ['config_path'],
        suggestedOutputs: ['settings']
      };
      
      const judgment = await synthesizer._judgeToolSufficiency(node, fileTools, hints);
      
      expect(judgment).toBeDefined();
      expect(judgment.sufficient).toBe(true);
      expect(judgment.reason).toBeDefined();
      console.log('File tools judgment:', judgment);
    });
    
    it('should judge tools as insufficient for complex ML task', async () => {
      if (!hasLiveServices) {
        console.log('Skipping - no live services available');
        return;
      }
      
      // Get basic tools that are insufficient for ML
      const basicTools = await toolsCollection.find({
        name: { $in: ['calculator', 'file_read'] }
      }).toArray();
      
      const node = {
        id: 'ml-task',
        description: 'Train a neural network model on image data'
      };
      
      const hints = {
        suggestedInputs: ['training_data', 'model_config'],
        suggestedOutputs: ['trained_model', 'metrics']
      };
      
      const judgment = await synthesizer._judgeToolSufficiency(node, basicTools, hints);
      
      expect(judgment).toBeDefined();
      expect(judgment.sufficient).toBe(false);
      expect(judgment.reason).toBeDefined();
      expect(judgment.missing).toBeDefined();
      expect(judgment.missing.length).toBeGreaterThan(0);
      console.log('ML task judgment:', judgment);
    });
    
    it('should correctly judge GitHub tools for repository operations', async () => {
      if (!hasLiveServices) {
        console.log('Skipping - no live services available');
        return;
      }
      
      // Get GitHub tools
      const githubTools = await toolsCollection.find({
        name: { $regex: /^github_/ }
      }).limit(5).toArray();
      
      if (githubTools.length === 0) {
        console.log('No GitHub tools found in database');
        return;
      }
      
      const node = {
        id: 'github-task',
        description: 'Create a new GitHub issue with a bug report'
      };
      
      const hints = {
        suggestedInputs: ['repo_name', 'title', 'description'],
        suggestedOutputs: ['issue_url', 'issue_number']
      };
      
      const judgment = await synthesizer._judgeToolSufficiency(node, githubTools, hints);
      
      expect(judgment).toBeDefined();
      console.log('GitHub tools judgment:', judgment);
      
      // Check if the judgment makes sense
      const hasIssueCreation = githubTools.some(t => 
        t.name.includes('create_issue') || t.name.includes('issues')
      );
      
      if (hasIssueCreation) {
        expect(judgment.sufficient).toBe(true);
      }
    });
    
    it('should identify missing tools for database operations', async () => {
      if (!hasLiveServices) {
        console.log('Skipping - no live services available');
        return;
      }
      
      // Get non-database tools
      const nonDbTools = await toolsCollection.find({
        name: { $in: ['file_read', 'json_parse', 'calculator'] }
      }).toArray();
      
      const node = {
        id: 'db-task',
        description: 'Query PostgreSQL database and aggregate results'
      };
      
      const hints = {
        suggestedInputs: ['connection_string', 'query'],
        suggestedOutputs: ['aggregated_data']
      };
      
      const judgment = await synthesizer._judgeToolSufficiency(node, nonDbTools, hints);
      
      expect(judgment).toBeDefined();
      expect(judgment.sufficient).toBe(false);
      expect(judgment.missing).toBeDefined();
      console.log('Database task judgment:', judgment);
      
      // Should identify that database tools are missing
      const missingStr = judgment.missing.join(' ').toLowerCase();
      expect(
        missingStr.includes('database') || 
        missingStr.includes('sql') || 
        missingStr.includes('postgres')
      ).toBe(true);
    });
  });
  
  describe('Tool Discovery and Judgment Combined', () => {
    it('should discover tools and judge them for a real task', async () => {
      if (!hasLiveServices) {
        console.log('Skipping - no live services available');
        return;
      }
      
      // Create a tool discovery bridge with real provider
      const toolRegistryProvider = {
        listTools: async () => {
          return await toolsCollection.find({}).limit(50).toArray();
        },
        searchTools: async (query) => {
          // Simple text search
          const regex = new RegExp(query.split(' ').join('|'), 'i');
          return await toolsCollection.find({
            $or: [
              { name: regex },
              { description: regex }
            ]
          }).limit(10).toArray();
        }
      };
      
      const toolDiscovery = new ToolDiscoveryBridge(null, toolRegistryProvider);
      await toolDiscovery.initialize();
      
      // Test task
      const task = {
        id: 'test-task',
        description: 'Read a JSON file and calculate statistics from the data'
      };
      
      // Discover tools
      const discoveredTools = await toolDiscovery.discoverTools(task, { limit: 10 });
      console.log(`Discovered ${discoveredTools.length} tools:`, discoveredTools.map(t => t.name));
      
      // Judge sufficiency
      const hints = {
        suggestedInputs: ['file_path'],
        suggestedOutputs: ['statistics']
      };
      
      const judgment = await synthesizer._judgeToolSufficiency(task, discoveredTools, hints);
      
      expect(judgment).toBeDefined();
      console.log('Combined discovery and judgment:', judgment);
      
      // For this task, we need file_read, json_parse, and calculator
      if (discoveredTools.length >= 2) {
        const hasFileRead = discoveredTools.some(t => t.name.includes('file') || t.name.includes('read'));
        const hasJsonParse = discoveredTools.some(t => t.name.includes('json'));
        const hasCalculator = discoveredTools.some(t => t.name.includes('calc') || t.name.includes('stat'));
        
        console.log('Tool availability:', {
          hasFileRead,
          hasJsonParse,
          hasCalculator
        });
      }
    });
  });
});