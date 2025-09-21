/**
 * SimpleNodeDebugStrategy - Strategy for debugging Node.js applications
 * 
 * Focused on identifying and fixing issues in Node.js code.
 * Uses PromptFactory for all LLM interactions with data-driven prompts.
 */

import { TaskStrategy } from '@legion/tasks';
import PromptFactory from '../../utils/PromptFactory.js';
import path from 'path';

export default class SimpleNodeDebugStrategy extends TaskStrategy {
  constructor(llmClient = null, toolRegistry = null, options = {}) {
    super();
    
    this.llmClient = llmClient;
    this.toolRegistry = toolRegistry;
    this.projectRoot = options.projectRoot || '/tmp/roma-projects';
    
    // Pre-instantiated tools
    this.tools = {
      fileRead: null,
      fileWrite: null,
      commandExecutor: null
    };
    
    // Prompts will be created during initialization
    this.prompts = null;
  }
  
  getName() {
    return 'SimpleNodeDebug';
  }
  
  /**
   * Initialize strategy components and prompts
   */
  async initialize(task) {
    const context = this._getContextFromTask(task);
    this.llmClient = this.llmClient || context.llmClient;
    this.toolRegistry = this.toolRegistry || context.toolRegistry;
    
    if (!this.llmClient) {
      throw new Error('LLM client is required');
    }
    
    if (!this.toolRegistry) {
      throw new Error('ToolRegistry is required');
    }
    
    // Load required tools
    this.tools.fileRead = await this.toolRegistry.getTool('file_read');
    this.tools.fileWrite = await this.toolRegistry.getTool('file_write');
    this.tools.commandExecutor = await this.toolRegistry.getTool('command_executor');
    
    // Create prompts using PromptFactory
    this.prompts = PromptFactory.createPrompts(
      this._getPromptDefinitions(),
      this.llmClient
    );
  }
  
  /**
   * Define all prompts as data
   */
  _getPromptDefinitions() {
    return {
      analyzeError: {
        template: `Analyze this Node.js error and identify the issue:

Error Message:
{{errorMessage}}

Stack Trace:
{{stackTrace}}

Code Context (if available):
{{codeContext}}

Analyze this specific error and return a single analysis object with:
1. Root cause
2. Error type
3. Affected code location
4. Suggested fix

Return ONE analysis object (not an array).`,
        responseSchema: PromptFactory.createJsonSchema({
          rootCause: { type: 'string' },
          errorType: { type: 'string' },
          location: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              line: { type: 'number' },
              function: { type: 'string' }
            }
          },
          suggestedFix: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
        }, ['rootCause', 'errorType', 'suggestedFix']),
        examples: [
          {
            rootCause: 'Attempting to read property of undefined variable',
            errorType: 'TypeError',
            location: {
              file: 'server.js',
              line: 42,
              function: 'handleRequest'
            },
            suggestedFix: 'Add null check before accessing object properties',
            confidence: 'high'
          },
          {
            rootCause: 'Port already in use by another process',
            errorType: 'EADDRINUSE',
            location: {
              file: 'server.js',
              line: 100,
              function: 'listen'
            },
            suggestedFix: 'Use a different port or kill the existing process',
            confidence: 'high'
          },
          {
            rootCause: 'Module not found in node_modules',
            errorType: 'MODULE_NOT_FOUND',
            location: {
              file: 'index.js',
              line: 1,
              function: 'require'
            },
            suggestedFix: 'Run npm install to install missing dependencies',
            confidence: 'medium'
          }
        ]
      },
      
      generateFix: {
        template: `Fix this Node.js code issue:

Problem: {{problem}}
Root Cause: {{rootCause}}

Original Code:
{{originalCode}}

Generate:
1. Fixed code
2. Explanation of changes
3. How to test the fix`,
        responseSchema: PromptFactory.createJsonSchema({
          fixedCode: { type: 'string' },
          explanation: { type: 'string' },
          testingSteps: { type: 'string' }  // Changed to string for delimited format
        }, ['fixedCode', 'explanation'], 'delimited'),  // Use delimited for code
        examples: [
          {
            fixedCode: `// Fixed: Added null check to prevent TypeError
function handleRequest(req, res) {
  if (!req.body || !req.body.user) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  
  const username = req.body.user.name; // Now safe to access
  // ... rest of code
}`,
            explanation: 'Added defensive checks to ensure req.body and req.body.user exist before accessing nested properties. This prevents TypeError when the request body is malformed or missing.',
            testingSteps: 'Send a request with a valid user object and verify it works. Send a request with an empty body and verify it returns 400. Send a request with body but no user field and verify error handling.'
          }
        ]
      },
      
      addDebugging: {
        template: `Add debugging statements to this Node.js code:

Code:
{{code}}

Add:
- Console.log statements at key points
- Error boundary checks
- Variable state logging
- Performance timing

Keep changes minimal and focused.`,
        responseSchema: PromptFactory.createJsonSchema({
          debugCode: { type: 'string' },
          debugPoints: { type: 'string' }  // Changed to string for delimited format
        }, ['debugCode'], 'delimited'),  // Use delimited for code
        examples: [
          {
            debugCode: `function processData(data) {
  console.log('[DEBUG] processData called with:', { dataLength: data?.length, dataType: typeof data });
  const startTime = performance.now();
  
  try {
    if (!data || !Array.isArray(data)) {
      console.error('[DEBUG] Invalid data format:', data);
      throw new Error('Data must be a non-empty array');
    }
    
    console.log('[DEBUG] Processing', data.length, 'items');
    const result = data.map((item, index) => {
      console.log(\`[DEBUG] Processing item \${index}:\`, item);
      return item * 2;
    });
    
    const elapsed = performance.now() - startTime;
    console.log(\`[DEBUG] processData completed in \${elapsed.toFixed(2)}ms\`);
    return result;
  } catch (error) {
    console.error('[DEBUG] Error in processData:', error);
    throw error;
  }
}`,
            debugPoints: 'Entry point with input validation, Performance timing start, Data validation check, Processing loop with item details, Completion timing, Error handling'
          }
        ]
      }
    };
  }
  
  /**
   * Handle parent messages
   */
  async onParentMessage(parentTask, message) {
    switch (message.type) {
      case 'start':
      case 'work':
        return await this._handleDebugging(parentTask);
      default:
        return { acknowledged: true };
    }
  }
  
  /**
   * Handle child messages (not used - leaf strategy)
   */
  async onChildMessage(childTask, message) {
    return { acknowledged: false, error: 'SimpleNodeDebugStrategy does not handle child messages' };
  }
  
  /**
   * Main debugging handler
   */
  async _handleDebugging(task) {
    try {
      console.log(`🐛 Debugging: ${task.description}`);
      
      // Initialize components
      await this.initialize(task);
      
      // Determine debug type from task
      const debugType = this._determineDebugType(task.description);
      
      let result;
      switch (debugType) {
        case 'error':
          result = await this._debugError(task);
          break;
        case 'performance':
          result = await this._debugPerformance(task);
          break;
        case 'logic':
          result = await this._debugLogic(task);
          break;
        default:
          result = await this._addDebugging(task);
      }
      
      task.complete(result);
      return result;
      
    } catch (error) {
      console.error(`❌ Debugging error:`, error);
      task.fail(error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Determine type of debugging needed
   */
  _determineDebugType(description) {
    const lower = description.toLowerCase();
    
    if (lower.includes('error') || lower.includes('exception') || lower.includes('crash')) {
      return 'error';
    }
    if (lower.includes('slow') || lower.includes('performance') || lower.includes('timeout')) {
      return 'performance';
    }
    if (lower.includes('wrong') || lower.includes('incorrect') || lower.includes('bug')) {
      return 'logic';
    }
    
    return 'general';
  }
  
  /**
   * Debug error/exception issues
   */
  async _debugError(task) {
    // Get error information from task
    const errorInfo = await this._extractErrorInfo(task);
    
    // Analyze the error
    const analysis = await PromptFactory.executePrompt(
      this.prompts.analyzeError,
      {
        errorMessage: errorInfo.message,
        stackTrace: errorInfo.stack,
        codeContext: errorInfo.code
      }
    );
    
    if (!analysis.success) {
      throw new Error(`Failed to analyze error: ${analysis.errors?.join(', ') || 'Unknown error'}`);
    }
    
    task.addConversationEntry('system', `Error type: ${analysis.data.errorType}, Cause: ${analysis.data.rootCause}`);
    
    // Generate fix if code is available
    if (errorInfo.code) {
      const fix = await PromptFactory.executePrompt(
        this.prompts.generateFix,
        {
          problem: errorInfo.message,
          rootCause: analysis.data.rootCause,
          originalCode: errorInfo.code
        }
      );
      
      if (!fix.success) {
        throw new Error(`Failed to generate fix: ${fix.errors?.join(', ') || 'Unknown error'}`);
      }
      
      // Write fixed code
      const fixedPath = await this._writeFixedCode(task, fix.data.fixedCode);
      
      task.storeArtifact('fixed_code.js', fix.data.fixedCode, 'Fixed code', 'file');
      task.storeArtifact('fix_explanation.md', fix.data.explanation, 'Fix explanation', 'text');
      
      return {
        success: true,
        message: `Fixed ${analysis.data.errorType} error`,
        analysis: analysis.data,
        fix: fix.data,
        fixedFile: fixedPath,
        artifacts: Object.values(task.getAllArtifacts())
      };
    }
    
    return {
      success: true,
      message: 'Error analyzed',
      analysis: analysis.data,
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Debug performance issues
   */
  async _debugPerformance(task) {
    const code = await this._getCodeFromTask(task);
    
    if (!code) {
      throw new Error('No code provided for performance debugging');
    }
    
    // Add performance debugging
    const result = await PromptFactory.executePrompt(
      this.prompts.addDebugging,
      { code: code }
    );
    
    if (!result.success) {
      throw new Error(`Failed to add debugging: ${result.errors?.join(', ') || 'Unknown error'}`);
    }
    
    // Write debug version
    const debugPath = await this._writeDebugCode(task, result.data.debugCode);
    
    task.storeArtifact('debug_code.js', result.data.debugCode, 'Code with performance debugging', 'file');
    
    return {
      success: true,
      message: 'Added performance debugging',
      debugPoints: result.data.debugPoints,
      debugFile: debugPath,
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Debug logic issues
   */
  async _debugLogic(task) {
    const code = await this._getCodeFromTask(task);
    
    if (!code) {
      throw new Error('No code provided for logic debugging');
    }
    
    // Add debugging statements
    const result = await PromptFactory.executePrompt(
      this.prompts.addDebugging,
      { code: code }
    );
    
    if (!result.success) {
      throw new Error(`Failed to add debugging: ${result.errors?.join(', ') || 'Unknown error'}`);
    }
    
    // Write debug version
    const debugPath = await this._writeDebugCode(task, result.data.debugCode);
    
    task.storeArtifact('debug_code.js', result.data.debugCode, 'Code with logic debugging', 'file');
    
    return {
      success: true,
      message: 'Added logic debugging',
      debugPoints: result.data.debugPoints,
      debugFile: debugPath,
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Add general debugging
   */
  async _addDebugging(task) {
    const code = await this._getCodeFromTask(task);
    
    if (!code) {
      throw new Error('No code provided for debugging');
    }
    
    const result = await PromptFactory.executePrompt(
      this.prompts.addDebugging,
      { code: code }
    );
    
    if (!result.success) {
      throw new Error(`Failed to add debugging: ${result.errors?.join(', ') || 'Unknown error'}`);
    }
    
    const debugPath = await this._writeDebugCode(task, result.data.debugCode);
    
    task.storeArtifact('debug_code.js', result.data.debugCode, 'Code with debugging', 'file');
    
    return {
      success: true,
      message: 'Added debugging statements',
      debugPoints: result.data.debugPoints,
      debugFile: debugPath,
      artifacts: Object.values(task.getAllArtifacts())
    };
  }
  
  /**
   * Extract error information from task
   */
  async _extractErrorInfo(task) {
    const artifacts = task.getAllArtifacts();
    
    // Look for error artifact
    for (const artifact of Object.values(artifacts)) {
      if (artifact.type === 'error' || artifact.name.includes('error')) {
        // Get code from error artifact if available, otherwise from task artifacts
        const codeFromError = artifact.content.code || '';
        const codeFromTask = codeFromError || await this._getCodeFromTask(task) || '';
        
        return {
          message: artifact.content.message || artifact.content,
          stack: artifact.content.stack || '',
          code: codeFromTask
        };
      }
    }
    
    // Try to extract from description
    const description = task.description;
    return {
      message: description,
      stack: '',
      code: await this._getCodeFromTask(task) || ''
    };
  }
  
  /**
   * Get code from task artifacts or file
   */
  async _getCodeFromTask(task) {
    const artifacts = task.getAllArtifacts();
    
    for (const artifact of Object.values(artifacts)) {
      if (artifact.type === 'file' && artifact.name.endsWith('.js')) {
        return artifact.content;
      }
    }
    
    return null;
  }
  
  /**
   * Write fixed code to file
   */
  async _writeFixedCode(task, code) {
    const timestamp = Date.now();
    const filename = `fixed-${timestamp}.js`;
    const filepath = path.join(this.projectRoot, filename);
    
    await this.tools.fileWrite.execute({ filepath, content: code });
    return filepath;
  }
  
  /**
   * Write debug code to file
   */
  async _writeDebugCode(task, code) {
    const timestamp = Date.now();
    const filename = `debug-${timestamp}.js`;
    const filepath = path.join(this.projectRoot, filename);
    
    await this.tools.fileWrite.execute({ filepath, content: code });
    return filepath;
  }
  
  /**
   * Extract context from task
   */
  _getContextFromTask(task) {
    return {
      llmClient: (task.lookup && task.lookup('llmClient')) || task.context?.llmClient,
      toolRegistry: (task.lookup && task.lookup('toolRegistry')) || task.context?.toolRegistry,
      workspaceDir: (task.lookup && task.lookup('workspaceDir')) || task.context?.workspaceDir || this.projectRoot
    };
  }
}