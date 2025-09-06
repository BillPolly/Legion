/**
 * PromptBuilder - Modular prompt construction for LLM operations
 * 
 * Provides clean, reusable prompt building functionality with:
 * - JSON schema validation requirements
 * - Context formatting (chat history, artifacts, operations)
 * - Template-based prompt construction
 * - Proper escaping and formatting
 * - Length management and truncation
 * 
 * Design Principles:
 * - Modular and composable
 * - Type-safe prompt construction
 * - Consistent formatting across all LLM calls
 * - Easy to test and validate
 */

export class PromptBuilder {
  constructor() {
    // Configuration for prompt limits and formatting
    this.config = {
      maxPromptLength: 100000,        // Maximum prompt length in chars
      maxContextItems: 1000,          // Maximum items in context arrays
      jsonSchemaRequired: true,       // Always require JSON schema response
      indentSize: 2                   // JSON formatting indent
    };
  }
  
  /**
   * Build chat history compression prompt with proper formatting
   * @param {Array} oldMessages - Messages to compress
   * @param {Object} currentArtifacts - Current context artifacts
   * @returns {string} Formatted prompt for LLM
   */
  buildChatCompressionPrompt(oldMessages, currentArtifacts) {
    const artifactKeys = Object.keys(currentArtifacts || {});
    
    return this.buildPrompt({
      task: 'Chat History Compression',
      instruction: `Analyze this chat history and create a concise summary that preserves essential information.`,
      
      context: {
        'OLD MESSAGES TO COMPRESS': this.formatChatHistory(oldMessages),
        'CURRENT VARIABLES': this.formatArtifactKeys(artifactKeys)
      },
      
      requirements: [
        'Key decisions and conclusions reached',
        'Important variable assignments and their purposes',
        'Failed attempts and lessons learned',
        'Context relevant to current variables',
        'User preferences and requirements mentioned'
      ],
      
      outputSchema: {
        summary: 'string - Concise summary of key information from old messages',
        keyInsights: 'array - Array of key insights extracted',
        relevantToCurrentWork: 'array - Array of items relevant to current variables'
      },
      
      examples: [{
        summary: 'User requested help setting up React project. Discussed TypeScript integration, routing with React Router, and deployment options.',
        keyInsights: ['User prefers TypeScript', 'Deployment target is Vercel'],
        relevantToCurrentWork: ['react_project_path', 'typescript_config']
      }]
    });
  }
  
  /**
   * Build artifact relevance analysis prompt
   * @param {Object} artifacts - Current artifacts to analyze
   * @param {Array} operationHistory - Recent operations for context
   * @returns {string} Formatted prompt for LLM
   */
  buildArtifactAnalysisPrompt(artifacts, operationHistory) {
    const recentOps = (operationHistory || []).slice(-10);
    const artifactCount = Object.keys(artifacts).length;
    
    // For large artifact sets, use compact format to prevent JSON truncation
    if (artifactCount > 50) {
      const artifactSummary = Object.keys(artifacts).map(key => {
        const value = artifacts[key];
        const type = typeof value;
        const preview = this.getValuePreview(value);
        return `${key} (${type}): ${preview.length > 50 ? preview.substring(0, 47) + '...' : preview}`;
      }).join('\n');

      return this.buildPrompt({
        task: 'Large Artifact Set Analysis',
        instruction: `Analyze ${artifactCount} context variables efficiently. Focus on patterns and categories rather than individual analysis.`,
        
        context: {
          'VARIABLES SUMMARY': artifactSummary,
          'RECENT OPERATIONS': this.formatOperationHistory(recentOps)
        },
        
        categories: {
          'KEEP': 'Infrastructure, recent, or actively used',
          'ARCHIVE': 'Potentially useful later',
          'DISCARD': 'No longer relevant'
        },
        
        rules: [
          'Infrastructure variables (output_directory, *_actor, *_registry, *_client) = KEEP',
          'Variables used in recent operations = KEEP',
          'Variables with "temp_", "old_", timestamps > 1 day = DISCARD',
          'Provide decisions for ALL variables - use patterns for efficiency'
        ],
        
        outputSchema: {
          summary: 'string - Overview of analysis patterns',
          keepCount: 'number - How many to keep',
          archiveCount: 'number - How many to archive', 
          discardCount: 'number - How many to discard',
          decisions: {
            'variableName': 'string - KEEP|ARCHIVE|DISCARD (provide for ALL variables)'
          }
        },
        
        examples: [{
          summary: 'Found 55 variables: 10 infrastructure (keep), 15 recent user data (keep), 20 old sessions (discard), 10 temp calculations (discard)',
          keepCount: 25,
          archiveCount: 0,
          discardCount: 30,
          decisions: {
            'output_directory': 'KEEP',
            'user_data_recent': 'KEEP',
            'old_session_123': 'DISCARD',
            'temp_calc_456': 'DISCARD'
          }
        }]
      });
    }
    
    // Standard detailed analysis for smaller sets
    return this.buildPrompt({
      task: 'Artifact Relevance Analysis',
      instruction: `Analyze these context variables and determine which are still relevant for ongoing work.`,
      
      context: {
        'CURRENT VARIABLES': this.formatArtifacts(artifacts),
        'RECENT OPERATIONS': this.formatOperationHistory(recentOps)
      },
      
      categories: {
        'KEEP': 'Actively used, referenced, or likely needed soon',
        'ARCHIVE': 'Potentially useful later but not immediately needed (will be compressed)',
        'DISCARD': 'No longer relevant or superseded by newer variables'
      },
      
      rules: [
        'NEVER categorize these special variables as anything but KEEP:',
        '- output_directory (infrastructure)',
        '- Any variable ending in _client, _actor, _registry (infrastructure)'
      ],
      
      outputSchema: {
        analysis: {
          'variableName': {
            decision: 'string - KEEP|ARCHIVE|DISCARD',
            reason: 'string - Explanation for decision'
          }
        }
      },
      
      examples: [{
        analysis: {
          'user_data': {
            decision: 'KEEP',
            reason: 'Recently accessed and used in current workflow'
          },
          'temp_calculation': {
            decision: 'ARCHIVE',
            reason: 'May be useful for reference but not actively used'
          },
          'old_session_id': {
            decision: 'DISCARD',
            reason: 'Session ended, no longer relevant'
          }
        }
      }]
    });
  }
  
  /**
   * Build operation history optimization prompt
   * @param {Array} oldOperations - Operations to optimize
   * @param {Array} currentArtifacts - Current artifacts for context
   * @returns {string} Formatted prompt for LLM
   */
  buildOperationOptimizationPrompt(oldOperations, currentArtifacts) {
    const artifactKeys = Object.keys(currentArtifacts || {});
    
    return this.buildPrompt({
      task: 'Operation History Optimization',
      instruction: `Analyze this operation history and create a summary of patterns and key learnings.`,
      
      context: {
        'OLD OPERATIONS TO SUMMARIZE': this.formatOperationHistory(oldOperations),
        'CURRENT VARIABLES THESE OPERATIONS CREATED': this.formatArtifactKeys(artifactKeys)
      },
      
      requirements: [
        'Successful operation patterns that might be repeated',
        'All failed operations with their errors (critical for learning)',
        'Operations that created current variables',
        'Unique tools discovered and their purposes',
        'Performance insights and timing patterns'
      ],
      
      outputSchema: {
        summary: 'string - Key patterns and learnings from old operations',
        successPatterns: 'array - Successful operation patterns',
        failureInsights: 'array - Insights from failed operations',
        toolsUsed: 'array - Objects with tool and purpose: [{tool: "name", purpose: "description"}]',
        variableCreators: 'array - Operations that created current variables'
      },
      
      examples: [{
        summary: 'Operations showed consistent use of data processing tools with occasional file system operations.',
        successPatterns: ['load_data → process_data → save_result sequence works reliably'],
        failureInsights: ['file_writer fails with large datasets, needs chunking'],
        toolsUsed: [{ tool: 'data_processor', purpose: 'Clean and transform data' }],
        variableCreators: ['process_data operation created current dataset variables']
      }]
    });
  }
  
  /**
   * Core prompt building method with consistent structure
   * @param {Object} config - Prompt configuration object
   * @returns {string} Formatted prompt
   * @private
   */
  buildPrompt(config) {
    const sections = [];
    
    // Task header
    if (config.task) {
      sections.push(`## Task: ${config.task}\n`);
    }
    
    // Main instruction
    if (config.instruction) {
      sections.push(`${config.instruction}\n`);
    }
    
    // Context sections
    if (config.context) {
      for (const [title, content] of Object.entries(config.context)) {
        if (content && content.length > 0) {
          sections.push(`**${title}:**\n${content}\n`);
        }
      }
    }
    
    // Categories/Rules
    if (config.categories) {
      sections.push('**Categories:**');
      for (const [category, description] of Object.entries(config.categories)) {
        sections.push(`- **${category}**: ${description}`);
      }
      sections.push('');
    }
    
    if (config.rules) {
      sections.push('**Rules:**');
      config.rules.forEach(rule => sections.push(`- ${rule}`));
      sections.push('');
    }
    
    if (config.requirements) {
      sections.push('**Requirements - Preserve:**');
      config.requirements.forEach(req => sections.push(`- ${req}`));
      sections.push('');
    }
    
    // Output schema (always JSON)
    if (config.outputSchema) {
      sections.push('**Return JSON with this exact structure:**');
      sections.push('```json');
      sections.push(this.formatJsonSchema(config.outputSchema));
      sections.push('```\n');
    }
    
    // Examples
    if (config.examples && config.examples.length > 0) {
      sections.push('**Example:**');
      sections.push('```json');
      sections.push(JSON.stringify(config.examples[0], null, this.config.indentSize));
      sections.push('```\n');
    }
    
    // JSON requirement footer
    sections.push('**CRITICAL: Response must be valid JSON only. No additional text or formatting.**');
    
    const fullPrompt = sections.join('\n');
    
    // Validate prompt length
    if (fullPrompt.length > this.config.maxPromptLength) {
      console.warn(`[PromptBuilder] Prompt length ${fullPrompt.length} exceeds maximum ${this.config.maxPromptLength}`);
    }
    
    return fullPrompt;
  }
  
  /**
   * Format chat history for inclusion in prompts
   * @param {Array} messages - Chat messages
   * @returns {string} Formatted chat history
   * @private
   */
  formatChatHistory(messages) {
    if (!messages || messages.length === 0) return 'No messages';
    
    const truncated = messages.slice(0, this.config.maxContextItems);
    
    return truncated.map((msg, index) => {
      const role = msg.role || 'unknown';
      const content = this.truncateText(msg.content || '', 500);
      const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
      return `${index + 1}. [${role}${timestamp ? ' ' + timestamp : ''}] ${content}`;
    }).join('\n');
  }
  
  /**
   * Format artifacts for inclusion in prompts
   * @param {Object} artifacts - Artifact object
   * @returns {string} Formatted artifacts
   * @private
   */
  formatArtifacts(artifacts) {
    if (!artifacts || Object.keys(artifacts).length === 0) return 'No variables';
    
    const entries = Object.entries(artifacts).slice(0, this.config.maxContextItems);
    
    return entries.map(([key, value]) => {
      const preview = this.getValuePreview(value);
      const type = typeof value;
      return `- **${key}** (${type}): ${preview}`;
    }).join('\n');
  }
  
  /**
   * Format artifact keys only (for lighter context)
   * @param {Array} keys - Array of artifact keys
   * @returns {string} Formatted key list
   * @private
   */
  formatArtifactKeys(keys) {
    if (!keys || keys.length === 0) return 'No variables';
    
    const truncated = keys.slice(0, this.config.maxContextItems);
    return JSON.stringify(truncated, null, this.config.indentSize);
  }
  
  /**
   * Format operation history for inclusion in prompts
   * @param {Array} operations - Operation history
   * @returns {string} Formatted operations
   * @private
   */
  formatOperationHistory(operations) {
    if (!operations || operations.length === 0) return 'No operations';
    
    const truncated = operations.slice(0, this.config.maxContextItems);
    
    return truncated.map((op, index) => {
      const status = op.success ? '✅' : '❌';
      const timestamp = op.timestamp ? new Date(op.timestamp).toLocaleTimeString() : '';
      const tool = op.tool || 'unknown';
      const error = op.error ? ` (Error: ${this.truncateText(op.error, 100)})` : '';
      const outputs = op.outputs ? ` → ${Object.keys(op.outputs).join(', ')}` : '';
      
      return `${index + 1}. ${status} **${tool}**${timestamp ? ' ' + timestamp : ''}${outputs}${error}`;
    }).join('\n');
  }
  
  /**
   * Get a preview of a variable value
   * @param {*} value - Variable value
   * @returns {string} Human-readable preview
   * @private
   */
  getValuePreview(value) {
    if (value === null || value === undefined) {
      return String(value);
    }
    
    const type = typeof value;
    switch (type) {
      case 'string':
        return value.length > 100 ? `"${value.substring(0, 97)}..."` : `"${value}"`;
      case 'number':
      case 'boolean':
        return String(value);
      case 'object':
        if (Array.isArray(value)) {
          return value.length < 3 ? JSON.stringify(value) : `Array(${value.length} items)`;
        } else {
          const keys = Object.keys(value);
          if (keys.length < 3) {
            try {
              const json = JSON.stringify(value);
              return json.length < 100 ? json : `Object(${keys.length} keys)`;
            } catch {
              return `Object(${keys.length} keys)`;
            }
          } else {
            return `Object(${keys.length} keys)`;
          }
        }
      default:
        return this.truncateText(String(value), 100);
    }
  }
  
  /**
   * Format JSON schema for prompt inclusion
   * @param {Object} schema - Schema object
   * @returns {string} Formatted JSON schema
   * @private
   */
  formatJsonSchema(schema) {
    try {
      return JSON.stringify(schema, null, this.config.indentSize);
    } catch (error) {
      console.error('[PromptBuilder] Failed to format JSON schema:', error);
      return '{}';
    }
  }
  
  /**
   * Truncate text to specified length with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   * @private
   */
  truncateText(text, maxLength) {
    if (!text || typeof text !== 'string') return '';
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
  }
  
  /**
   * Validate that prompt will generate valid JSON response
   * @param {string} prompt - Complete prompt
   * @returns {boolean} True if prompt is properly formatted for JSON response
   */
  validateJsonPrompt(prompt) {
    const required = [
      'json',
      'return',  // "Return JSON" or "return JSON"
      'structure' // "exact structure" or "this structure"
    ];
    
    const promptLower = prompt.toLowerCase();
    return required.every(term => promptLower.includes(term));
  }
  
  /**
   * Get prompt construction statistics
   * @param {string} prompt - Built prompt
   * @returns {Object} Statistics about the prompt
   */
  getPromptStats(prompt) {
    return {
      length: prompt.length,
      lines: prompt.split('\n').length,
      hasJsonSchema: this.validateJsonPrompt(prompt),
      estimatedTokens: Math.ceil(prompt.length / 4), // Rough approximation
      withinLimits: prompt.length <= this.config.maxPromptLength
    };
  }
}