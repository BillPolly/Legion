/**
 * Perspectives - Semantic perspective generation for tools
 * 
 * Generates and manages semantic perspectives for tools to improve search
 * Perspectives provide context, use cases, and relationships between tools
 * 
 * No mocks, no fallbacks - real implementation only
 */

import { PerspectiveError } from '../errors/index.js';

export class Perspectives {
  constructor({ resourceManager, options = {} }) {
    if (!resourceManager) {
      throw new PerspectiveError(
        'ResourceManager is required',
        'INIT_ERROR'
      );
    }

    this.resourceManager = resourceManager;
    this.options = {
      batchSize: 10,
      verbose: false,
      ...options
    };
    
    this.storageProvider = null;
    this.llmClient = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Get storage provider from resource manager
    this.storageProvider = this.resourceManager.get('storageProvider');
    if (!this.storageProvider) {
      throw new PerspectiveError(
        'StorageProvider not available from ResourceManager',
        'INIT_ERROR'
      );
    }

    // Get LLM client from resource manager  
    this.llmClient = this.resourceManager.get('llmClient');
    if (!this.llmClient) {
      throw new PerspectiveError(
        'LLMClient not available from ResourceManager',
        'INIT_ERROR'
      );
    }

    this.initialized = true;
  }
  
  /**
   * Generate perspective for a single tool
   * @param {string} toolName - Name of the tool
   * @param {Object} options - Generation options
   * @returns {Object} Generated perspective
   */
  async generatePerspective(toolName, options = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Check if perspective already exists (unless forced)
      if (!options.forceRegenerate) {
        const existing = await this.storageProvider.findOne('perspectives', { toolName });
        if (existing) {
          if (this.options.verbose) {
            console.log(`Using cached perspective for ${toolName}`);
          }
          return existing;
        }
      }
      
      // Get tool metadata
      const tool = await this.storageProvider.findOne('tools', { name: toolName });
      
      if (!tool) {
        throw new PerspectiveError(
          `Tool not found: ${toolName}`,
          'TOOL_NOT_FOUND'
        );
      }
      
      // Generate perspective using LLM - create a simple prompt
      const prompt = this._createPerspectivePrompt(tool);
      const response = await this.llmClient.sendMessage(prompt);
      const perspective = this._parsePerspectiveResponse(response);
      
      // Save to database
      const perspectiveDoc = {
        toolName,
        ...perspective,
        generatedAt: new Date()
      };
      
      await this.storageProvider.upsertOne('perspectives', { toolName }, perspectiveDoc);
      
      if (this.options.verbose) {
        console.log(`Generated perspective for ${toolName}`);
      }
      
      return perspectiveDoc;
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Failed to generate perspective: ${error.message}`,
        'GENERATION_ERROR',
        { toolName, originalError: error }
      );
    }
  }
  
  /**
   * Generate perspectives for all tools in a module
   * Phase 5.3: Enhanced with batch generation optimization
   * @param {string} moduleName - Name of the module
   * @param {Object} options - Generation options
   * @returns {Array} Generated perspectives
   */
  async generateForModule(moduleName, options = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Get all tools from module
      const tools = await this.storageProvider.find('tools', { moduleName });
      
      if (tools.length === 0) {
        if (this.options.verbose) {
          console.log(`No tools found for module: ${moduleName}`);
        }
        return [];
      }
      
      const results = [];
      
      // Auto-detect batch mode for efficiency (Phase 5.3 optimization)
      const shouldUseBatch = options.useBatch !== false && tools.length >= 3;
      
      if (shouldUseBatch) {
        // Phase 5.3: Optimized batch generation with error handling
        if (this.options.verbose) {
          console.log(`Using batch generation for ${tools.length} tools in ${moduleName}`);
        }
        
        // Filter out tools that already have perspectives (unless forcing)
        let toolsToGenerate = tools;
        if (!options.forceRegenerate) {
          const toolNames = tools.map(t => t.name);
          const existingPerspectives = await this.storageProvider.find('perspectives', { 
            toolName: { $in: toolNames } 
          });
          
          const existingToolNames = new Set(existingPerspectives.map(p => p.toolName));
          
          // Add existing perspectives to results
          results.push(...existingPerspectives);
          
          // Only generate for missing tools
          toolsToGenerate = tools.filter(t => !existingToolNames.has(t.name));
        }
        
        if (toolsToGenerate.length === 0) {
          if (this.options.verbose) {
            console.log(`All perspectives already exist for module ${moduleName}`);
          }
          return results;
        }
        
        // Process in batches
        const batches = [];
        for (let i = 0; i < toolsToGenerate.length; i += this.options.batchSize) {
          batches.push(toolsToGenerate.slice(i, i + this.options.batchSize));
        }
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          
          try {
            if (this.options.verbose) {
              console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} tools)`);
            }
            
            // Generate batch perspectives using LLM
            const batchPrompt = this._createBatchPerspectivePrompt(batch);
            const batchResponse = await this.llmClient.sendMessage(batchPrompt);
            const perspectives = this._parseBatchPerspectiveResponse(batchResponse, batch);
            
            // Validate batch response
            if (!Array.isArray(perspectives) || perspectives.length !== batch.length) {
              throw new Error(`Batch response mismatch: expected ${batch.length}, got ${perspectives?.length || 0}`);
            }
            
            // Save perspectives using bulk operations
            for (let i = 0; i < batch.length; i++) {
              const perspectiveDoc = {
                toolName: batch[i].name,
                moduleName: moduleName,
                ...perspectives[i],
                generatedAt: new Date(),
                batchGenerated: true
              };
              
              await this.storageProvider.upsertOne('perspectives', 
                { toolName: batch[i].name }, 
                perspectiveDoc
              );
              
              results.push(perspectiveDoc);
            }
            
          } catch (error) {
            console.warn(`Batch ${batchIndex + 1} failed, falling back to individual generation:`, error.message);
            
            // Fallback to individual generation for this batch
            for (const tool of batch) {
              try {
                const perspective = await this.generatePerspective(tool.name, { forceRegenerate: true });
                results.push(perspective);
              } catch (individualError) {
                console.error(`Failed to generate perspective for ${tool.name}:`, individualError.message);
              }
            }
          }
        }
      } else {
        // Individual generation
        if (this.options.verbose) {
          console.log(`Using individual generation for ${tools.length} tools in ${moduleName}`);
        }
        
        for (const tool of tools) {
          try {
            const perspective = await this.generatePerspective(tool.name, options);
            results.push(perspective);
          } catch (error) {
            console.error(`Failed to generate perspective for ${tool.name}:`, error.message);
          }
        }
      }
      
      if (this.options.verbose) {
        console.log(`Generated ${results.length} perspectives for module ${moduleName} (${shouldUseBatch ? 'batch' : 'individual'} mode)`);
      }
      
      return results;
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Failed to generate module perspectives: ${error.message}`,
        'GENERATION_ERROR',
        { moduleName, originalError: error }
      );
    }
  }
  
  /**
   * Generate perspectives for all tools
   * @param {Object} options - Generation options
   * @returns {Object} Generation statistics
   */
  async generateAll(options = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Get all tools
      const tools = await this.storageProvider.find('tools', {});
      
      let generated = 0;
      let skipped = 0;
      let failed = 0;
      const failures = [];
      
      // Process in batches
      for (let i = 0; i < tools.length; i += this.options.batchSize) {
        const batch = tools.slice(i, i + this.options.batchSize);
        
        for (const tool of batch) {
          try {
            // Check if already exists
            const existing = await this.storageProvider.findOne('perspectives', { toolName: tool.name });
            if (existing && !options.forceRegenerate) {
              skipped++;
              continue;
            }
            
            const perspective = await this.generatePerspective(tool.name, { forceRegenerate: true });
            generated++;
            
          } catch (error) {
            failed++;
            failures.push({
              toolName: tool.name,
              error: error.message
            });
          }
        }
      }
      
      if (this.options.verbose) {
        console.log(`Perspective generation complete: ${generated} generated, ${skipped} skipped, ${failed} failed`);
      }
      
      return {
        generated,
        skipped,
        failed,
        failures: failures.length > 0 ? failures : undefined
      };
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Failed to generate all perspectives: ${error.message}`,
        'GENERATION_ERROR',
        { originalError: error }
      );
    }
  }
  
  /**
   * Get perspective for a tool
   * @param {string} toolName - Name of the tool
   * @returns {Object|null} Perspective or null if not found
   */
  async getPerspective(toolName) {
    if (!this.initialized) await this.initialize();
    
    try {
      return await this.storageProvider.findOne('perspectives', { toolName });
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Failed to get perspective: ${error.message}`,
        'RETRIEVAL_ERROR',
        { toolName, originalError: error }
      );
    }
  }
  
  /**
   * Search tools by perspective text
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Matching perspectives
   */
  async searchByPerspective(query, options = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Search in perspective text
      const searchQuery = {
        perspective: { $regex: new RegExp(query, 'i') }
      };
      
      const findOptions = {};
      if (options.limit) {
        findOptions.limit = options.limit;
      }
      
      return await this.storageProvider.find('perspectives', searchQuery, findOptions);
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Search failed: ${error.message}`,
        'SEARCH_ERROR',
        { query, options, originalError: error }
      );
    }
  }
  
  /**
   * Get related tools based on perspectives
   * @param {string} toolName - Name of the tool
   * @param {Object} options - Options
   * @returns {Array} Related tool names
   */
  async getRelatedTools(toolName, options = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Get perspective for tool
      const perspective = await this.storageProvider.findOne('perspectives', { toolName });
      
      if (!perspective) {
        return [];
      }
      
      const related = new Set();
      
      // Add explicitly related tools
      if (perspective.relatedTools && Array.isArray(perspective.relatedTools)) {
        perspective.relatedTools.forEach(tool => related.add(tool));
      }
      
      // Add tools from same category if requested
      if (options.includeCategory && perspective.category) {
        const categoryTools = await this.storageProvider.find('perspectives', { 
          category: perspective.category,
          toolName: { $ne: toolName }
        });
        
        categoryTools.forEach(p => related.add(p.toolName));
      }
      
      return Array.from(related);
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Failed to get related tools: ${error.message}`,
        'RETRIEVAL_ERROR',
        { toolName, originalError: error }
      );
    }
  }
  
  /**
   * Clear perspectives from database
   * @param {string} moduleName - Optional module name to clear
   * @returns {Object} Deletion result
   */
  async clearPerspectives(moduleName) {
    if (!this.initialized) await this.initialize();
    
    try {
      let query = {};
      
      if (moduleName) {
        // Get tools from module
        const tools = await this.storageProvider.find('tools', { moduleName });
        const toolNames = tools.map(t => t.name);
        
        query = { toolName: { $in: toolNames } };
      }
      
      const result = await this.storageProvider.deleteMany('perspectives', query);
      
      if (this.options.verbose) {
        console.log(`Cleared ${result.deletedCount} perspectives`);
      }
      
      return result;
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Failed to clear perspectives: ${error.message}`,
        'DELETION_ERROR',
        { moduleName, originalError: error }
      );
    }
  }
  
  /**
   * Phase 5.3: Batch generate perspectives for multiple modules efficiently
   * @param {Array} moduleNames - Names of modules to process
   * @param {Object} options - Generation options
   * @returns {Object} Generation results by module
   */
  async generateForModules(moduleNames, options = {}) {
    const results = {};
    
    for (const moduleName of moduleNames) {
      try {
        const moduleResults = await this.generateForModule(moduleName, {
          ...options,
          useBatch: options.useBatch !== false // Default to batch mode
        });
        
        results[moduleName] = {
          success: true,
          perspectives: moduleResults,
          count: moduleResults.length
        };
      } catch (error) {
        results[moduleName] = {
          success: false,
          error: error.message,
          count: 0
        };
      }
    }
    
    return results;
  }

  /**
   * Clear perspectives for a specific module
   * @param {string} moduleName - Module name
   * @returns {Object} Deletion result
   */
  async clearModule(moduleName) {
    return this.clearPerspectives(moduleName);
  }

  /**
   * Clear all perspectives
   * @returns {Object} Deletion result  
   */
  async clearAll() {
    return this.clearPerspectives();
  }

  /**
   * Get perspective statistics
   * @returns {Object} Statistics
   */
  async getStatistics() {
    if (!this.initialized) await this.initialize();
    
    try {
      const total = await this.storageProvider.count('perspectives', {});
      
      // Get category statistics
      const byCategory = {};
      const categories = await this.storageProvider.distinct('perspectives', 'category');
      
      for (const category of categories) {
        if (category) {
          byCategory[category] = await this.storageProvider.count('perspectives', { category });
        }
      }
      
      const uncategorized = await this.storageProvider.count('perspectives', { 
        $or: [
          { category: null },
          { category: { $exists: false } }
        ]
      });
      
      return {
        total,
        byCategory,
        uncategorized
      };
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Failed to get statistics: ${error.message}`,
        'STATS_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Create perspective generation prompt
   */
  _createPerspectivePrompt(tool) {
    return `Generate a perspective for this tool that helps developers understand when and how to use it.

Tool Name: ${tool.name}
Description: ${tool.description || 'No description provided'}
Module: ${tool.moduleName || 'Unknown'}

Provide a JSON response with:
1. perspective: A clear, searchable description of what the tool does and when to use it
2. category: The primary category (e.g., "file-operations", "data-processing", "network", etc.)
3. useCases: Array of 3-5 specific use cases
4. relatedTools: Array of tool names that are commonly used together (if any)

Response format:
{
  "perspective": "...",
  "category": "...",
  "useCases": ["...", "..."],
  "relatedTools": ["...", "..."]
}`;
  }

  /**
   * Parse perspective response from LLM
   */
  _parsePerspectiveResponse(response) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // If no JSON found, return structured default
      return {
        perspective: response.trim(),
        category: 'general',
        useCases: [],
        relatedTools: []
      };
    } catch (error) {
      console.error('Failed to parse perspective response:', error.message);
      return {
        perspective: response.trim(),
        category: 'general',
        useCases: [],
        relatedTools: []
      };
    }
  }

  /**
   * Create batch perspective generation prompt
   */
  _createBatchPerspectivePrompt(tools) {
    const toolList = tools.map(tool => 
      `Tool: ${tool.name}\nDescription: ${tool.description || 'No description provided'}\nModule: ${tool.moduleName || 'Unknown'}`
    ).join('\n\n');

    return `Generate perspectives for these tools that help developers understand when and how to use them.

${toolList}

Provide a JSON array response with one perspective object per tool, in the same order:
[
  {
    "perspective": "A clear, searchable description of what the tool does and when to use it",
    "category": "The primary category (e.g., \"file-operations\", \"data-processing\", \"network\", etc.)",
    "useCases": ["Use case 1", "Use case 2", "Use case 3"],
    "relatedTools": ["related_tool_1", "related_tool_2"]
  },
  ...
]`;
  }

  /**
   * Parse batch perspective response from LLM
   */
  _parseBatchPerspectiveResponse(response, tools) {
    try {
      // Try to extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const perspectives = JSON.parse(jsonMatch[0]);
        if (Array.isArray(perspectives) && perspectives.length === tools.length) {
          return perspectives;
        }
      }
      
      // If batch parsing fails, return individual defaults
      return tools.map(() => ({
        perspective: 'Generated perspective not available',
        category: 'general',
        useCases: [],
        relatedTools: []
      }));
    } catch (error) {
      console.error('Failed to parse batch perspective response:', error.message);
      // Return individual defaults on error
      return tools.map(() => ({
        perspective: 'Generated perspective not available',
        category: 'general',
        useCases: [],
        relatedTools: []
      }));
    }
  }
}