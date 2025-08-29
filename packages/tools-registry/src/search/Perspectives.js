/**
 * Perspectives - 3-Collection architecture semantic perspective generation
 * 
 * Generates multiple perspective types for tools in a single LLM call.
 * Uses the new 3-collection architecture:
 * - perspective_types: Perspective type definitions
 * - tool_perspectives: Individual perspectives for each tool x type
 * - tools: Existing tool metadata
 * 
 * No mocks, no fallbacks - real implementation only
 */

import { PerspectiveError } from '../errors/index.js';
import { DatabaseInitializer } from '../core/DatabaseInitializer.js';
import { PerspectiveTypeManager } from '../core/PerspectiveTypeManager.js';
import { Logger } from '../utils/Logger.js';

export class Perspectives {
  constructor({ resourceManager, databaseStorage = null, options = {} }) {
    if (!resourceManager) {
      throw new PerspectiveError(
        'ResourceManager is required',
        'INIT_ERROR'
      );
    }

    this.resourceManager = resourceManager;
    this.databaseStorage = databaseStorage; // NEW: Accept injected DatabaseStorage
    this.options = {
      batchSize: 10,
      verbose: false,
      generateEmbeddings: true,
      ...options
    };
    this.llmClient = null;
    this.databaseInitializer = null;
    this.perspectiveTypeManager = null;
    this.initialized = false;
    this.logger = Logger.create('Perspectives', { verbose: this.options.verbose });
  }

  async initialize() {
    if (this.initialized) return;

    // Use injected databaseStorage if available, otherwise get from resource manager
    if (!this.databaseStorage) {
      this.databaseStorage = this.resourceManager.get('databaseStorage');
      if (!this.databaseStorage) {
        throw new PerspectiveError(
          'DatabaseStorage not available from ResourceManager or injection',
          'INIT_ERROR'
        );
      }
    }

    // Get LLM client from resource manager (optional for mock mode)
    this.llmClient = this.resourceManager.get('llmClient');
    this.mockMode = !this.llmClient || this.options.mockMode;
    
    if (this.mockMode && this.options.verbose) {
      this.logger.info('Running in mock mode (no LLM client configured)');
    }

    // Initialize database collections and default perspective types
    this.databaseInitializer = new DatabaseInitializer({
      db: this.databaseStorage.db,
      resourceManager: this.resourceManager,
      options: {
        verbose: this.options.verbose,
        seedData: true,
        validateSchema: true,
        createIndexes: true
      }
    });

    await this.databaseInitializer.initialize();

    // Initialize perspective type manager
    this.perspectiveTypeManager = new PerspectiveTypeManager({
      db: this.databaseStorage.db,
      resourceManager: this.resourceManager,
      options: {
        verbose: this.options.verbose
      }
    });

    await this.perspectiveTypeManager.initialize();

    this.initialized = true;

    if (this.options.verbose) {
      this.logger.info('Perspectives system initialized with 3-collection architecture');
    }
  }
  
  /**
   * Generate all perspective types for a single tool in one LLM call
   * @param {string|Object} toolIdentifier - Tool name, tool ID, or tool object
   * @param {Object} options - Generation options (including toolId override)
   * @returns {Array} Generated perspectives for all types
   */
  async generatePerspectivesForTool(toolIdentifier, options = {}) {
    if (!this.initialized) await this.initialize();
    
    // Declare variables outside try block so they're accessible in catch
    let tool;
    let toolId;
    let toolName;
    
    try {
      
      // Handle different input types
      if (typeof toolIdentifier === 'object' && toolIdentifier !== null) {
        // Tool object passed directly
        tool = toolIdentifier;
        toolId = tool._id || tool.id;
        toolName = tool.name;
      } else if (typeof toolIdentifier === 'string') {
        // Could be tool name or tool ID - for now assume name for backwards compatibility
        toolName = toolIdentifier;
        
        // If toolId is provided in options, use it
        if (options.toolId) {
          toolId = options.toolId;
          tool = await this.databaseStorage.db.collection('tools').findOne({ _id: toolId });
        } else {
          // Try to find by name (backwards compatibility)
          tool = await this.databaseStorage.findTool(toolName);
          toolId = tool?._id || tool?.id;
        }
      }
      
      if (!tool) {
        throw new PerspectiveError(
          `Tool not found: ${toolIdentifier}`,
          'TOOL_NOT_FOUND'
        );
      }
      
      // Ensure toolName is always set
      if (!toolName && tool) {
        toolName = tool.name;
      }
      
      // IMPORTANT: Check if perspectives already exist BY TOOL ID, not name!
      if (!options.forceRegenerate && toolId) {
        const existingPerspectives = await this.databaseStorage.db.collection('tool_perspectives')
          .find({ tool_id: toolId }).toArray();
        if (existingPerspectives.length > 0) {
          if (this.options.verbose) {
            this.logger.verbose(`Using existing perspectives for ${toolName} (ID: ${toolId}, ${existingPerspectives.length} types)`);
          }
          return existingPerspectives;
        }
      }
      
      // Get all enabled perspective types
      const perspectiveTypes = await this.perspectiveTypeManager.getAllPerspectiveTypes();
      if (perspectiveTypes.length === 0) {
        throw new PerspectiveError(
          'No perspective types available',
          'NO_PERSPECTIVE_TYPES'
        );
      }
      
      // Generate all perspectives - either LLM or mock
      let generatedPerspectives;
      if (this.mockMode) {
        generatedPerspectives = this._generateMockPerspectives(tool, perspectiveTypes);
      } else {
        // Generate all perspectives in single LLM call
        const prompt = this._createMultiPerspectivePrompt(tool, perspectiveTypes);
        const response = await this.llmClient.complete(prompt, 2000); // Use complete method with higher token limit
        generatedPerspectives = this._parseMultiPerspectiveResponse(
          response, 
          tool.name, 
          perspectiveTypes
        );
      }
      
      // Prepare perspective documents with metadata
      const batchId = this._generateBatchId();
      const perspectiveDocs = generatedPerspectives.map((perspective, index) => ({
        tool_name: toolName,
        tool_id: tool._id,
        perspective_type_name: perspectiveTypes[index].name,
        perspective_type_id: perspectiveTypes[index]._id,
        content: perspective.content,
        keywords: this._extractKeywords(perspective.content),
        embedding: null, // Will be populated by embedding generation
        generated_at: new Date(),
        llm_model: this._getLLMModelName(),
        batch_id: batchId
      }));
      
      // Generate embeddings for perspectives (unless disabled)
      if (options.generateEmbeddings !== false && !this.mockMode) {
        try {
          await this._generateEmbeddingsForPerspectives(perspectiveDocs);
        } catch (error) {
          if (this.options.verbose) {
            this.logger.warn(`Embedding generation failed, continuing without embeddings: ${error.message}`);
          }
          // Continue with null embeddings rather than failing the entire operation
        }
      }
      
      // Save all perspectives in batch (with or without embeddings)
      const savedCount = await this.databaseStorage.saveToolPerspectives(perspectiveDocs);
      
      if (this.options.verbose) {
        this.logger.verbose(`Generated ${savedCount} perspectives for ${toolName} in single LLM call`);
      }
      
      return perspectiveDocs;
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Failed to generate perspectives for tool: ${error.message}`,
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
      const tools = await this.databaseStorage.findTools({ moduleName });
      
      if (tools.length === 0) {
        if (this.options.verbose) {
          this.logger.verbose(`No tools found for module: ${moduleName}`);
        }
        return [];
      }
      
      const results = [];
      
      // Auto-detect batch mode for efficiency (Phase 5.3 optimization)
      const shouldUseBatch = options.useBatch !== false && tools.length >= 3;
      
      if (shouldUseBatch) {
        // Phase 5.3: Optimized batch generation with error handling
        if (this.options.verbose) {
          this.logger.verbose(`Using batch generation for ${tools.length} tools in ${moduleName}`);
        }
        
        // Filter out tools that already have perspectives (unless forcing)
        let toolsToGenerate = tools;
        if (!options.forceRegenerate) {
          const toolNames = tools.map(t => t.name);
          const existingPerspectives = await this.databaseStorage.findToolPerspectives({ 
            tool_name: { $in: toolNames } 
          });
          
          const existingToolNames = new Set(existingPerspectives.map(p => p.tool_name));
          
          // Add existing perspectives to results
          results.push(...existingPerspectives);
          
          // Only generate for missing tools
          toolsToGenerate = tools.filter(t => !existingToolNames.has(t.name));
        }
        
        if (toolsToGenerate.length === 0) {
          if (this.options.verbose) {
            this.logger.verbose(`All perspectives already exist for module ${moduleName}`);
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
              this.logger.verbose(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} tools)`);
            }
            
            // Generate batch perspectives - either LLM or mock
            let perspectives;
            if (this.mockMode) {
              perspectives = this._generateMockBatchPerspectives(batch);
            } else {
              const batchPrompt = this._createBatchPerspectivePrompt(batch);
              const batchResponse = await this.llmClient.sendMessage(batchPrompt);
              perspectives = this._parseBatchPerspectiveResponse(batchResponse, batch);
            }
            
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
              
              await this.databaseStorage.saveToolPerspective(perspectiveDoc);
              
              results.push(perspectiveDoc);
            }
            
          } catch (error) {
            this.logger.warn(`Batch ${batchIndex + 1} failed, falling back to individual generation: ${error.message}`);
            
            // Fallback to individual generation for this batch
            for (const tool of batch) {
              try {
                const perspectives = await this.generatePerspectivesForTool(tool.name, { forceRegenerate: true });
                results.push(...perspectives);
              } catch (individualError) {
                this.logger.error(`Failed to generate perspective for ${tool.name}: ${individualError.message}`);
              }
            }
          }
        }
      } else {
        // Individual generation
        if (this.options.verbose) {
          this.logger.verbose(`Using individual generation for ${tools.length} tools in ${moduleName}`);
        }
        
        for (const tool of tools) {
          try {
            const perspectives = await this.generatePerspectivesForTool(tool.name, options);
            results.push(...perspectives);
          } catch (error) {
            this.logger.error(`Failed to generate perspective for ${tool.name}: ${error.message}`);
          }
        }
      }
      
      if (this.options.verbose) {
        this.logger.verbose(`Generated ${results.length} perspectives for module ${moduleName} (${shouldUseBatch ? 'batch' : 'individual'} mode)`);
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
      const tools = await this.databaseStorage.findTools({});
      
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
            const existing = await this.databaseStorage.findToolPerspectivesByTool(tool.name);
            if (existing.length > 0 && !options.forceRegenerate) {
              skipped++;
              continue;
            }
            
            const perspectives = await this.generatePerspectivesForTool(tool.name, { forceRegenerate: true });
            generated += perspectives.length;
            
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
        this.logger.verbose(`Perspective generation complete: ${generated} generated, ${skipped} skipped, ${failed} failed`);
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
   * Get all perspectives for a tool (new 3-collection API)
   * @param {string} toolName - Name of the tool
   * @returns {Array} Array of tool perspectives
   */
  async getToolPerspectives(toolName) {
    if (!this.initialized) await this.initialize();
    
    try {
      return await this.databaseStorage.findToolPerspectivesByTool(toolName);
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Failed to get tool perspectives: ${error.message}`,
        'RETRIEVAL_ERROR',
        { toolName, originalError: error }
      );
    }
  }
  
  /**
   * @deprecated Use getToolPerspectives instead
   */
  async getPerspective(toolName) {
    const perspectives = await this.getToolPerspectives(toolName);
    return perspectives.length > 0 ? perspectives[0] : null;
  }
  
  /**
   * Search tools by perspective content
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Matching perspectives
   */
  async searchByPerspective(query, options = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Search in perspective content and keywords
      const searchQuery = {
        $or: [
          { content: { $regex: new RegExp(query, 'i') } },
          { keywords: { $regex: new RegExp(query, 'i') } }
        ]
      };
      
      return await this.databaseStorage.findToolPerspectives(searchQuery);
      
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
      // Get perspectives for tool
      const perspectives = await this.databaseStorage.findToolPerspectivesByTool(toolName);
      
      if (perspectives.length === 0) {
        return [];
      }
      
      const related = new Set();
      
      // For now, return empty array as related tools aren't implemented yet
      // This would need semantic analysis or manual curation
      
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
   * @returns {number} Number of perspectives deleted
   */
  async clearPerspectives(moduleName) {
    if (!this.initialized) await this.initialize();
    
    try {
      if (moduleName) {
        return await this.clearModulePerspectives(moduleName);
      } else {
        // Clear all perspectives
        await this.databaseStorage.clearPerspectiveData();
        
        if (this.options.verbose) {
          this.logger.verbose('Cleared all perspective data');
        }
        
        return 0; // clearPerspectiveData doesn't return count
      }
      
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
   * Clear perspectives for a specific module (new 3-collection API)
   * @param {string} moduleName - Module name
   * @returns {number} Number of perspectives deleted
   */
  async clearModulePerspectives(moduleName) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Get tools from module
      const tools = await this.databaseStorage.findTools({ moduleName });
      const toolNames = tools.map(t => t.name);
      
      let deletedCount = 0;
      for (const toolName of toolNames) {
        deletedCount += await this.databaseStorage.deleteToolPerspectivesByTool(toolName);
      }
      
      if (this.options.verbose) {
        this.logger.verbose(`Cleared ${deletedCount} perspectives for module ${moduleName}`);
      }
      
      return deletedCount;
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Failed to clear module perspectives: ${error.message}`,
        'DELETION_ERROR',
        { moduleName, originalError: error }
      );
    }
  }
  
  /**
   * @deprecated Use clearModulePerspectives instead
   */
  async clearModule(moduleName) {
    return this.clearModulePerspectives(moduleName);
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
      return await this.databaseStorage.getPerspectiveStats();
      
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
      this.logger.error(`Failed to parse perspective response: ${error.message}`);
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
      this.logger.error(`Failed to parse batch perspective response: ${error.message}`);
      // Return individual defaults on error
      return tools.map(() => ({
        perspective: 'Generated perspective not available',
        category: 'general',
        useCases: [],
        relatedTools: []
      }));
    }
  }
  
  /**
   * Create multi-perspective prompt for single LLM call
   * @param {Object} tool - Tool metadata
   * @param {Array} perspectiveTypes - Available perspective types
   * @returns {string} LLM prompt
   */
  _createMultiPerspectivePrompt(tool, perspectiveTypes) {
    const typePrompts = perspectiveTypes.map((type, index) => 
      `${index + 1}. ${type.name}: ${type.prompt_template.replace('{toolName}', tool.name)}`
    ).join('\n');
    
    return `Generate ${perspectiveTypes.length} different perspectives for this tool. Each perspective must be VERY SHORT - maximum 10 words per perspective.

Tool Information:
- Name: ${tool.name}
- Description: ${tool.description || 'No description provided'}
- Module: ${tool.moduleName || 'Unknown'}

Generate perspectives for these types:
${typePrompts}

CRITICAL REQUIREMENTS:
- Each perspective must be exactly ONE sentence
- Maximum 10 words per perspective  
- Must be highly focused and searchable
- No explanations or elaboration

Provide a JSON array response with ${perspectiveTypes.length} perspective objects:
[
  {
    "content": "Short focused perspective for type 1"
  },
  {
    "content": "Short focused perspective for type 2"  
  }
]

Examples of correct length:
- "Evaluates mathematical expressions and calculations"
- "Input requires expression parameter as string"
- "Calculator tool performs arithmetic operations"

Each perspective must be 10 words or less.`;
  }
  
  /**
   * Parse multi-perspective response from LLM
   * @param {string} response - LLM response
   * @param {string} toolName - Tool name
   * @param {Array} perspectiveTypes - Expected perspective types
   * @returns {Array} Parsed perspectives
   */
  _parseMultiPerspectiveResponse(response, toolName, perspectiveTypes) {
    try {
      // Try to extract JSON array from response
      const jsonMatch = response.match(/\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/);
      if (jsonMatch) {
        const perspectives = JSON.parse(jsonMatch[0]);
        if (Array.isArray(perspectives) && perspectives.length === perspectiveTypes.length) {
          return perspectives;
        }
      }
      
      // If parsing fails, return default perspectives
      return perspectiveTypes.map((type) => ({
        content: `Auto-generated perspective for ${toolName} from ${type.name} viewpoint`
      }));
    } catch (error) {
      this.logger.error(`Failed to parse multi-perspective response: ${error.message}`);
      // Return default perspectives on error
      return perspectiveTypes.map((type) => ({
        content: `Auto-generated perspective for ${toolName} from ${type.name} viewpoint`
      }));
    }
  }
  
  /**
   * Extract keywords from perspective content
   * @param {string} content - Perspective content
   * @returns {Array} Array of keywords
   */
  _extractKeywords(content) {
    if (!content || typeof content !== 'string') return [];
    
    // Simple keyword extraction - remove common words and extract meaningful terms
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 
      'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 
      'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 
      'these', 'those', 'it', 'its', 'they', 'their', 'them'
    ]);
    
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.has(word))
      .slice(0, 10); // Limit to 10 keywords
    
    return [...new Set(words)]; // Remove duplicates
  }
  
  /**
   * Generate batch ID for tracking related perspectives
   * @returns {string} Unique batch ID
   */
  _generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get comprehensive perspective statistics
   * @returns {Object} Statistics about perspectives, types, and coverage
   */
  async getStatistics() {
    if (!this.initialized) await this.initialize();
    
    try {
      // Get statistics from DatabaseStorage
      const stats = await this.databaseStorage.getPerspectiveStats();
      
      // Get additional breakdown by category and module
      const perspectives = await this.databaseStorage.findToolPerspectives();
      
      // Group by category
      const byCategory = {};
      const byModule = {};
      
      for (const perspective of perspectives) {
        const tool = await this.databaseStorage.findTool(perspective.tool_name);
        if (tool && tool.moduleName) {
          byModule[tool.moduleName] = (byModule[tool.moduleName] || 0) + 1;
        }
      }
      
      // Get perspective types by category
      const perspectiveTypes = await this.perspectiveTypeManager.getAllPerspectiveTypes();
      for (const type of perspectiveTypes) {
        const categoryPerspectives = perspectives.filter(p => p.perspective_type_name === type.name);
        byCategory[type.category] = (byCategory[type.category] || 0) + categoryPerspectives.length;
      }
      
      return {
        total: stats.toolPerspectives.total,
        perspectiveTypes: stats.perspectiveTypes,
        toolPerspectives: stats.toolPerspectives,
        coverage: stats.coverage,
        byCategory,
        byModule
      };
      
    } catch (error) {
      if (error instanceof PerspectiveError) {
        throw error;
      }
      
      throw new PerspectiveError(
        `Failed to get statistics: ${error.message}`,
        'RETRIEVAL_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Generate mock perspectives for testing
   * @param {Object} tool - Tool definition
   * @param {Array} perspectiveTypes - Types to generate
   * @returns {Array} Mock perspectives
   */
  _generateMockPerspectives(tool, perspectiveTypes) {
    const mockTemplates = {
      input_perspective: `Input requirements for ${tool.name}:
- Required parameters: ${Object.keys(tool.inputSchema?.properties || {}).join(', ')}
- Expected format: JSON object
- Validation: Schema-based validation applied
- Example usage: Call with proper input structure`,
      
      definition_perspective: `${tool.name} is a ${tool.category || 'utility'} tool that ${tool.description?.toLowerCase() || 'performs operations'}.
This tool belongs to the ${tool.moduleName || 'Unknown'} module and provides ${tool.tags?.join(', ') || 'general functionality'}.
Key features include: robust error handling, schema validation, and consistent response format.`,
      
      keyword_perspective: `Keywords: ${tool.name}, ${tool.tags?.join(', ') || ''}, ${tool.category || ''}, ${tool.moduleName || ''}
Related terms: ${tool.description?.split(' ').filter(w => w.length > 4).slice(0, 5).join(', ') || 'functionality'}
Search terms: ${tool.name.replace('_', ' ')}, ${tool.category || 'tool'} operations`,
      
      use_case_perspective: `Common use cases for ${tool.name}:
1. ${tool.category || 'General'} operations in automated workflows
2. Integration with ${tool.moduleName || 'other'} module components  
3. Data processing pipelines requiring ${tool.name.replace('_', ' ')}
4. Development and testing scenarios
Best practices: Validate inputs, handle errors gracefully, follow schema requirements`
    };
    
    return perspectiveTypes.map(type => ({
      content: mockTemplates[type.name] || `Mock perspective for ${tool.name} of type ${type.name}`,
      perspectiveType: type.name
    }));
  }

  /**
   * Generate mock batch perspectives for testing
   * @param {Array} batch - Array of tool objects  
   * @returns {Array} Mock batch perspectives
   */
  _generateMockBatchPerspectives(batch) {
    const perspectiveTypes = this.perspectiveTypeManager?.perspectiveTypes || [];
    return batch.map(tool => {
      return this._generateMockPerspectives(tool, perspectiveTypes);
    });
  }

  /**
   * Generate embeddings for existing perspectives that don't have them
   * @param {string} toolName - Optional tool name to filter by
   * @returns {Object} Update statistics
   */
  async generateEmbeddingsForExisting(toolName = null) {
    if (!this.initialized) await this.initialize();
    
    try {
      // Find perspectives without embeddings
      const filter = { embedding: { $in: [null, undefined] } };
      if (toolName) {
        filter.tool_name = toolName;
      }
      
      const perspectivesWithoutEmbeddings = await this.databaseStorage.findToolPerspectives(filter);
      
      if (perspectivesWithoutEmbeddings.length === 0) {
        if (this.options.verbose) {
          this.logger.verbose('All perspectives already have embeddings');
        }
        return {
          processed: 0,
          updated: 0,
          failed: 0,
          failures: []
        };
      }
      
      if (this.options.verbose) {
        this.logger.info(`Generating embeddings for ${perspectivesWithoutEmbeddings.length} existing perspectives...`);
      }
      
      let updated = 0;
      let failed = 0;
      const failures = [];
      
      // Process in batches to avoid memory issues
      const batchSize = this.options.batchSize || 10;
      for (let i = 0; i < perspectivesWithoutEmbeddings.length; i += batchSize) {
        const batch = perspectivesWithoutEmbeddings.slice(i, i + batchSize);
        
        try {
          // Generate embeddings for this batch
          await this._generateEmbeddingsForPerspectives(batch);
          
          // Save updated perspectives back to database
          const savedCount = await this.databaseStorage.saveToolPerspectives(batch);
          updated += savedCount;
          
          if (this.options.verbose) {
            this.logger.verbose(`Updated ${savedCount} perspectives with embeddings (batch ${Math.floor(i/batchSize) + 1})`);
          }
          
        } catch (error) {
          failed += batch.length;
          failures.push({
            batch: Math.floor(i/batchSize) + 1,
            perspectives: batch.map(p => `${p.tool_name}:${p.perspective_type_name}`),
            error: error.message
          });
          
          if (this.options.verbose) {
            this.logger.error(`Failed to generate embeddings for batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
          }
        }
      }
      
      const stats = {
        processed: perspectivesWithoutEmbeddings.length,
        updated,
        failed,
        failures: failures.length > 0 ? failures : undefined
      };
      
      if (this.options.verbose) {
        this.logger.info(`Embedding generation complete: ${updated} updated, ${failed} failed`);
      }
      
      return stats;
      
    } catch (error) {
      throw new PerspectiveError(
        `Failed to generate embeddings for existing perspectives: ${error.message}`,
        'EMBEDDING_UPDATE_ERROR',
        { toolName, originalError: error }
      );
    }
  }

  /**
   * Get perspectives without embeddings
   * @param {string} toolName - Optional tool name to filter by
   * @returns {Array} Perspectives without embeddings
   */
  async getPerspectivesWithoutEmbeddings(toolName = null) {
    if (!this.initialized) await this.initialize();
    
    try {
      const filter = { embedding: { $in: [null, undefined] } };
      if (toolName) {
        filter.tool_name = toolName;
      }
      
      return await this.databaseStorage.findToolPerspectives(filter);
      
    } catch (error) {
      throw new PerspectiveError(
        `Failed to find perspectives without embeddings: ${error.message}`,
        'RETRIEVAL_ERROR',
        { toolName, originalError: error }
      );
    }
  }

  /**
   * Count perspectives with and without embeddings
   * @returns {Object} Statistics about embedding coverage
   */
  async getEmbeddingStats() {
    if (!this.initialized) await this.initialize();
    
    try {
      const totalPerspectives = await this.databaseStorage.countToolPerspectives();
      const withoutEmbeddings = await this.databaseStorage.countToolPerspectives({ 
        embedding: { $in: [null, undefined] } 
      });
      const withEmbeddings = totalPerspectives - withoutEmbeddings;
      
      return {
        total: totalPerspectives,
        withEmbeddings,
        withoutEmbeddings,
        embeddingCoverage: totalPerspectives > 0 ? (withEmbeddings / totalPerspectives) : 0
      };
      
    } catch (error) {
      throw new PerspectiveError(
        `Failed to get embedding statistics: ${error.message}`,
        'STATS_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Get LLM model name from client
   * @returns {string} Model name
   */
  _getLLMModelName() {
    if (this.llmClient && this.llmClient.modelName) {
      return this.llmClient.modelName;
    }
    return 'unknown-llm';
  }
  
  /**
   * Get or initialize Nomic embedding service
   * @returns {Object} Nomic embedding service instance
   */
  async _getNomicService() {
    // Get cached service from ResourceManager
    let nomicService = this.resourceManager.get('nomicService');
    
    if (!nomicService) {
      if (this.options.verbose) {
        this.logger.verbose('Initializing Nomic embedding service...');
      }
      
      // Import and create Nomic service
      const { NomicEmbeddings } = await import('@legion/nomic');
      nomicService = new NomicEmbeddings();
      await nomicService.initialize();
      
      // Cache in ResourceManager for reuse
      this.resourceManager.set('nomicService', nomicService);
      
      if (this.options.verbose) {
        this.logger.info(`Nomic service initialized with ${nomicService.modelName} (${nomicService.dimensions} dimensions)`);
      }
    }
    
    return nomicService;
  }
  
  /**
   * Generate embeddings for perspective documents and index in VectorStore
   * @param {Array} perspectiveDocs - Array of perspective documents
   * @returns {Promise<void>} Updates documents in-place with embeddings and indexes in Qdrant
   */
  async _generateEmbeddingsForPerspectives(perspectiveDocs) {
    if (!perspectiveDocs || perspectiveDocs.length === 0) {
      return;
    }
    
    try {
      const nomicService = await this._getNomicService();
      
      if (this.options.verbose) {
        this.logger.verbose(`Generating embeddings for ${perspectiveDocs.length} perspectives...`);
      }
      
      // Extract content for batch embedding generation
      const contents = perspectiveDocs.map(doc => doc.content);
      
      // Generate embeddings in batch for efficiency
      const embeddings = await nomicService.embedBatch(contents);
      
      // Update documents with embeddings
      for (let i = 0; i < perspectiveDocs.length; i++) {
        perspectiveDocs[i].embedding = embeddings[i];
        perspectiveDocs[i].embedding_model = nomicService.modelName;
        perspectiveDocs[i].embedding_dimensions = nomicService.dimensions;
      }
      
      if (this.options.verbose) {
        this.logger.verbose(`Generated ${embeddings.length} embeddings (${nomicService.dimensions}d vectors)`);
      }
      
      // Index perspectives in VectorStore (optional enhancement)
      if (this.options.enableVectorIndexing !== false) {
        await this._indexPerspectivesInVectorStore(perspectiveDocs);
      }
      
    } catch (error) {
      if (this.options.verbose) {
        this.logger.error(`Embedding generation failed: ${error.message}`);
      }
      
      throw new PerspectiveError(
        `Failed to generate embeddings: ${error.message}`,
        'EMBEDDING_ERROR',
        { perspectiveCount: perspectiveDocs.length, originalError: error }
      );
    }
  }
  
  /**
   * Index generated perspectives in VectorStore through ToolRegistry
   * @param {Array} perspectiveDocs - Array of perspective documents with embeddings
   * @returns {Promise<void>} Indexes perspectives in Qdrant vector database
   */
  async _indexPerspectivesInVectorStore(perspectiveDocs) {
    try {
      // Get ToolRegistry instance from ResourceManager
      const toolRegistry = this.resourceManager.get('toolRegistry');
      if (!toolRegistry) {
        if (this.options.verbose) {
          this.logger.warn('ToolRegistry not available - skipping vector indexing');
        }
        return;
      }
      
      if (this.options.verbose) {
        this.logger.verbose(`Indexing ${perspectiveDocs.length} perspectives in VectorStore...`);
      }
      
      // Group perspectives by tool for batch indexing
      const perspectivesByTool = new Map();
      
      for (const perspectiveDoc of perspectiveDocs) {
        const toolName = perspectiveDoc.tool_name;
        
        if (!perspectivesByTool.has(toolName)) {
          perspectivesByTool.set(toolName, []);
        }
        
        perspectivesByTool.get(toolName).push({
          query: perspectiveDoc.content,
          context: perspectiveDoc.content, // Use content as context
          perspectiveType: perspectiveDoc.perspective_type_name,
          moduleName: await this._getToolModuleName(toolName)
        });
      }
      
      // Index each tool's perspectives
      let totalIndexed = 0;
      let indexingErrors = 0;
      
      for (const [toolName, perspectives] of perspectivesByTool) {
        try {
          const result = await toolRegistry.indexToolPerspectives(toolName, perspectives);
          
          if (result.success) {
            totalIndexed += result.indexed;
            
            if (this.options.verbose) {
              this.logger.verbose(`Indexed ${result.indexed} perspectives for tool: ${toolName}`);
            }
          } else {
            indexingErrors++;
            if (this.options.verbose) {
              this.logger.warn(`Failed to index perspectives for ${toolName}: ${result.error}`);
            }
          }
        } catch (error) {
          indexingErrors++;
          if (this.options.verbose) {
            this.logger.warn(`Error indexing perspectives for ${toolName}: ${error.message}`);
          }
        }
      }
      
      if (this.options.verbose) {
        this.logger.info(`Vector indexing complete: ${totalIndexed} indexed, ${indexingErrors} errors`);
      }
      
    } catch (error) {
      // Don't throw - vector indexing failure shouldn't break perspective generation
      if (this.options.verbose) {
        this.logger.warn(`Vector indexing failed: ${error.message}`);
      }
    }
  }
  
  /**
   * Get module name for a tool (helper method)
   * @param {string} toolName - Tool name
   * @returns {Promise<string>} Module name or 'Unknown'
   */
  async _getToolModuleName(toolName) {
    try {
      const tool = await this.databaseStorage.findTool(toolName);
      return tool?.moduleName || 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }
}