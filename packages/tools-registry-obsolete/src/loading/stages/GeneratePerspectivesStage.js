/**
 * GeneratePerspectivesStage - Generates text perspectives for each tool
 * 
 * Responsibilities:
 * - Generate multiple text perspectives per tool
 * - Save perspectives to MongoDB (without embeddings yet)
 * - Support resume from checkpoint
 * - Verify all tools have perspectives
 */

export class GeneratePerspectivesStage {
  constructor(dependencies) {
    this.perspectiveGenerator = dependencies.perspectiveGenerator;
    this.mongoProvider = dependencies.mongoProvider;
    this.verifier = dependencies.verifier;
    this.stateManager = dependencies.stateManager;
  }

  /**
   * Execute the perspective generation stage
   */
  async execute(options = {}) {
    console.log('📝 Starting perspective generation stage...');
    
    // Get tools to process
    const tools = await this.getToolsToProcess(options.module);
    console.log(`  Found ${tools.length} tools to process`);
    
    // Check for resume capability
    const state = await this.stateManager.getCurrentState();
    const processedIds = state?.stages?.generatePerspectives?.processed || [];
    
    if (processedIds.length > 0) {
      console.log(`  Resuming from checkpoint: ${processedIds.length} tools already processed`);
    }
    
    let perspectivesGenerated = 0;
    let toolsProcessed = 0;
    let toolsSkipped = 0;
    
    for (const tool of tools) {
      const toolIdStr = tool._id.toString();
      
      // Skip if already processed (for resume)
      if (processedIds.includes(toolIdStr)) {
        toolsSkipped++;
        continue;
      }
      
      try {
        console.log(`  Processing tool: ${tool.name}`);
        
        // Generate perspectives for this tool
        const perspectives = await this.generatePerspectivesForTool(tool);
        
        if (perspectives && perspectives.length > 0) {
          // Save perspectives to MongoDB
          await this.savePerspectives(tool, perspectives);
          perspectivesGenerated += perspectives.length;
          toolsProcessed++;
          
          console.log(`    ✓ Generated ${perspectives.length} perspectives for ${tool.name}`);
          
          // Record checkpoint
          await this.stateManager.recordCheckpoint('generatePerspectives', {
            processed: toolIdStr
          });
        } else {
          console.log(`    ⚠️ No perspectives generated for ${tool.name}`);
        }
        
      } catch (error) {
        console.error(`    ❌ Failed to process ${tool.name}: ${error.message}`);
        // Don't throw - continue with other tools
      }
    }
    
    console.log(`  Perspective generation complete:`);
    console.log(`    Tools processed: ${toolsProcessed}`);
    console.log(`    Tools skipped (already done): ${toolsSkipped}`);
    console.log(`    Total perspectives: ${perspectivesGenerated}`);
    
    // Verify
    const verificationResult = await this.verify(perspectivesGenerated);
    
    if (!verificationResult.success) {
      throw new Error(`Perspective generation verification failed: ${verificationResult.message}`);
    }
    
    return {
      ...verificationResult,
      toolsProcessed,
      toolsSkipped,
      perspectivesGenerated,
      perspectivesPerTool: toolsProcessed > 0 ? Math.round(perspectivesGenerated / toolsProcessed) : 0
    };
  }

  /**
   * Get tools to process
   */
  async getToolsToProcess(specificModule) {
    const query = {};
    
    if (specificModule) {
      query.moduleName = specificModule;
    }
    
    return await this.mongoProvider.find('tools', query);
  }

  /**
   * Generate perspectives for a single tool
   */
  async generatePerspectivesForTool(tool) {
    // Use the injected perspective generator if available
    if (this.perspectiveGenerator && typeof this.perspectiveGenerator.generatePerspectives === 'function') {
      const perspectives = await this.perspectiveGenerator.generatePerspectives(tool);
      // Ensure the returned perspectives have the right format
      return perspectives.map(p => ({
        type: p.type || p.perspectiveType || 'usage',
        text: p.text || p.perspectiveText || '',
        priority: p.priority || 100
      }));
    }
    
    // Fallback to internal logic if no generator provided
    const perspectives = [];
    
    // Load perspective types from database
    const perspectiveTypes = await this.loadPerspectiveTypes();
    
    for (const perspectiveType of perspectiveTypes) {
      // Check if condition is met for this tool
      if (!this.evaluateCondition(perspectiveType.condition, tool)) {
        continue;
      }
      
      // Special case for capability_single: create one perspective per capability
      if (perspectiveType.type === 'capability_single' && tool.capabilities) {
        for (const capability of tool.capabilities) {
          const text = this.applyTemplate(perspectiveType.textTemplate, tool, { cap: capability });
          if (text && text.length > 0) {
            perspectives.push({
              type: perspectiveType.type,
              text: text,
              priority: perspectiveType.priority || 100
            });
          }
        }
      } else {
        // Normal case: create one perspective
        const text = this.applyTemplate(perspectiveType.textTemplate, tool);
        if (text && text.length > 0) {
          perspectives.push({
            type: perspectiveType.type,
            text: text,
            priority: perspectiveType.priority || 100
          });
        }
      }
    }
    
    // If no perspectives generated, create basic ones
    if (perspectives.length === 0) {
      perspectives.push({
        type: 'name',
        text: tool.name,
        priority: 1
      });
      
      if (tool.description) {
        perspectives.push({
          type: 'description',
          text: tool.description,
          priority: 2
        });
      }
    }
    
    return perspectives;
  }

  /**
   * Load perspective types from database
   */
  async loadPerspectiveTypes() {
    const types = await this.mongoProvider.find('perspective_types', {
      enabled: true
    }, {
      sort: { priority: 1 }
    });
    
    // If no types defined, use defaults
    if (types.length === 0) {
      return this.getDefaultPerspectiveTypes();
    }
    
    return types;
  }

  /**
   * Get default perspective types if none in database
   */
  getDefaultPerspectiveTypes() {
    return [
      {
        type: 'name',
        condition: 'always',
        textTemplate: '${name}',
        priority: 1
      },
      {
        type: 'description',
        condition: 'has_description',
        textTemplate: '${description}',
        priority: 2
      },
      {
        type: 'task',
        condition: 'has_description',
        textTemplate: '${description} using ${name} tool',
        priority: 3
      },
      {
        type: 'capabilities',
        condition: 'has_capabilities',
        textTemplate: '${capabilities.join(\' \')} capability tool',
        priority: 4
      },
      {
        type: 'category',
        condition: 'always',
        textTemplate: '${category} operations ${tags.join(\' \')}',
        priority: 5
      }
    ];
  }

  /**
   * Evaluate condition for perspective generation
   */
  evaluateCondition(condition, tool) {
    switch (condition) {
      case 'always':
        return true;
      case 'has_description':
        return tool.description && tool.description.trim().length > 0;
      case 'has_capabilities':
        return tool.capabilities && Array.isArray(tool.capabilities) && tool.capabilities.length > 0;
      case 'has_examples':
        return tool.examples && Array.isArray(tool.examples) && tool.examples.length > 0;
      case 'has_input_schema':
        return tool.inputSchema && tool.inputSchema.properties && Object.keys(tool.inputSchema.properties).length > 0;
      default:
        return false;
    }
  }

  /**
   * Apply template with tool data
   */
  applyTemplate(template, tool, extraData = {}) {
    let result = template;
    
    // Replace basic placeholders
    result = result.replace(/\${name}/g, tool.name || '');
    result = result.replace(/\${description}/g, tool.description || '');
    result = result.replace(/\${category}/g, tool.category || '');
    
    // Handle array joins
    if (tool.capabilities && Array.isArray(tool.capabilities)) {
      result = result.replace(/\${capabilities\.join\('([^']*)'\)}/g, (match, separator) => {
        return tool.capabilities.join(separator);
      });
    }
    
    if (tool.tags && Array.isArray(tool.tags)) {
      result = result.replace(/\${tags\.join\('([^']*)'\)}/g, (match, separator) => {
        return tool.tags.join(separator);
      });
    } else {
      result = result.replace(/\${tags\.join\('([^']*)'\)}/g, '');
    }
    
    // Handle extra data
    Object.keys(extraData).forEach(key => {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      result = result.replace(regex, extraData[key] || '');
    });
    
    return result.trim();
  }

  /**
   * Extract capabilities from tool (if not already present)
   */
  extractCapabilities(tool) {
    if (tool.capabilities && tool.capabilities.length > 0) {
      return tool.capabilities;
    }
    
    const capabilities = [];
    const namePatterns = {
      'read': 'data reading',
      'write': 'data writing',
      'create': 'resource creation',
      'delete': 'resource deletion',
      'update': 'resource modification',
      'fetch': 'data retrieval',
      'search': 'searching',
      'analyze': 'analysis',
      'generate': 'content generation',
      'validate': 'validation'
    };
    
    const nameLower = tool.name.toLowerCase();
    for (const [pattern, capability] of Object.entries(namePatterns)) {
      if (nameLower.includes(pattern)) {
        capabilities.push(capability);
      }
    }
    
    return capabilities;
  }

  /**
   * Save perspectives to MongoDB
   */
  async savePerspectives(tool, perspectives) {
    const perspectiveDocuments = perspectives.map(perspective => ({
      toolId: tool._id,
      toolName: tool.name,
      perspectiveType: perspective.type,
      perspectiveText: perspective.text,
      priority: perspective.priority || 100,
      
      // Placeholder for embedding (will be added in next stage)
      embedding: null,
      embeddingModel: null,
      
      // Metadata
      generatedAt: new Date(),
      generationMethod: 'template',
      metadata: {
        toolCategory: tool.category,
        moduleName: tool.moduleName,
        textLength: perspective.text.length
      }
    }));
    
    if (perspectiveDocuments.length > 0) {
      await this.mongoProvider.insertMany('tool_perspectives', perspectiveDocuments);
    }
  }

  /**
   * Verify perspective generation
   */
  async verify(expectedMinimum) {
    console.log('  Verifying perspective generation...');
    
    // Check total count
    const actualCount = await this.mongoProvider.count('tool_perspectives', {});
    
    if (actualCount < expectedMinimum) {
      return {
        success: false,
        message: `Too few perspectives generated! Expected at least ${expectedMinimum}, got ${actualCount}`
      };
    }
    
    // Check all tools have perspectives
    const toolsCheck = await this.verifier.verifyAllToolsHavePerspectives();
    
    if (!toolsCheck.success) {
      return toolsCheck;
    }
    
    console.log('  ✅ Perspective generation verified successfully');
    
    return {
      success: true,
      message: `Generated ${actualCount} perspectives`,
      perspectiveCount: actualCount
    };
  }
}