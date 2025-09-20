/**
 * TaskTypeRegistry - Data-driven task type system
 * Loads task definitions from data and manages specialized prompts/behaviors
 */

import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class TaskTypeRegistry {
  constructor() {
    this.taskTypes = new Map();
    this.resourceManager = null;
    this.llmClient = null;
  }

  async initialize() {
    this.resourceManager = await ResourceManager.getInstance();
    this.llmClient = await this.resourceManager.get('llmClient');
    
    // Load task types from data
    await this.loadTaskTypes();
  }

  /**
   * Load task type definitions from JSON files
   */
  async loadTaskTypes() {
    const taskTypesDir = path.join(__dirname, '../../data/task-types');
    
    try {
      await fs.mkdir(taskTypesDir, { recursive: true });
      
      // Create default task types if they don't exist
      await this.ensureDefaultTaskTypes(taskTypesDir);
      
      // Load all task type definitions
      const files = await fs.readdir(taskTypesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(taskTypesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const taskType = JSON.parse(content);
          
          this.taskTypes.set(taskType.id, taskType);
          console.log(`📋 Loaded task type: ${taskType.name}`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load task types:', error);
      throw error;
    }
  }

  /**
   * Ensure default task types exist
   */
  async ensureDefaultTaskTypes(dir) {
    // Chat task type
    const chatTaskType = {
      id: 'chat',
      name: 'Chat',
      description: 'Conversational interaction',
      systemPrompt: 'You are ROMA, a helpful AI assistant. Engage naturally in conversation, answer questions, and help users understand what tasks you can perform.',
      responseFormat: 'text',
      requiresContext: true,
      examples: [
        { input: 'Hi there!', output: 'Hello! I\'m ROMA, your AI assistant. I can help you with various tasks like creating code, analyzing problems, and breaking down complex projects. What would you like to work on today?' },
        { input: 'What can you do?', output: 'I can help you with:\n- Writing and debugging code\n- Creating documentation\n- Breaking down complex projects into manageable tasks\n- Analyzing and solving problems\n- And much more! Just describe what you need.' }
      ]
    };

    // Task execution type (ROMA)
    const romaTaskType = {
      id: 'roma_execution',
      name: 'Task Execution',
      description: 'Recursive task decomposition and execution',
      systemPrompt: 'You are a task execution agent. Analyze the given task and determine if it should be executed directly with tools or decomposed into subtasks.',
      responseFormat: 'structured',
      schema: {
        type: 'object',
        properties: {
          classification: {
            type: 'string',
            enum: ['SIMPLE', 'COMPLEX']
          },
          reasoning: { type: 'string' },
          action: {
            type: 'object',
            oneOf: [
              {
                properties: {
                  type: { const: 'execute' },
                  toolCalls: { type: 'array' }
                }
              },
              {
                properties: {
                  type: { const: 'decompose' },
                  subtasks: { type: 'array' }
                }
              }
            ]
          }
        }
      },
      requiresTools: true
    };

    // Code generation task type
    const codeGenTaskType = {
      id: 'code_generation',
      name: 'Code Generation',
      description: 'Generate code with specific requirements',
      systemPrompt: 'You are an expert programmer. Generate clean, well-commented code that follows best practices.',
      responseFormat: 'code',
      parameters: {
        language: { type: 'string', required: true },
        framework: { type: 'string', required: false },
        style: { type: 'string', default: 'clean' }
      },
      outputFormat: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          language: { type: 'string' },
          explanation: { type: 'string' },
          dependencies: { type: 'array' }
        }
      }
    };

    // Analysis task type
    const analysisTaskType = {
      id: 'analysis',
      name: 'Analysis',
      description: 'Analyze and provide insights',
      systemPrompt: 'You are an analytical expert. Provide thorough analysis with clear insights and recommendations.',
      responseFormat: 'structured',
      outputFormat: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          findings: { type: 'array' },
          recommendations: { type: 'array' },
          confidence: { type: 'number', min: 0, max: 1 }
        }
      }
    };

    // Save default task types if they don't exist
    const defaultTypes = [chatTaskType, romaTaskType, codeGenTaskType, analysisTaskType];
    
    for (const taskType of defaultTypes) {
      const filePath = path.join(dir, `${taskType.id}.json`);
      try {
        await fs.access(filePath);
        // File exists, skip
      } catch {
        // File doesn't exist, create it
        await fs.writeFile(filePath, JSON.stringify(taskType, null, 2));
        console.log(`✅ Created default task type: ${taskType.name}`);
      }
    }
  }

  /**
   * Get a task type by ID
   */
  getTaskType(id) {
    return this.taskTypes.get(id);
  }

  /**
   * Get all task types
   */
  getAllTaskTypes() {
    return Array.from(this.taskTypes.values());
  }

  /**
   * Execute a task with the appropriate type
   */
  async executeWithType(typeId, input, context = {}) {
    const taskType = this.getTaskType(typeId);
    if (!taskType) {
      throw new Error(`Unknown task type: ${typeId}`);
    }

    // Build prompt based on task type
    const prompt = this.buildPrompt(taskType, input, context);
    
    // Execute with LLM
    const response = await this.llmClient.sendMessage(prompt, {
      temperature: taskType.temperature || 0.7,
      responseFormat: taskType.responseFormat
    });

    // Validate and format response based on task type
    return this.formatResponse(taskType, response);
  }

  /**
   * Build prompt for a specific task type
   */
  buildPrompt(taskType, input, context) {
    let prompt = taskType.systemPrompt + '\n\n';
    
    // Add examples if available
    if (taskType.examples && taskType.examples.length > 0) {
      prompt += 'Examples:\n';
      for (const example of taskType.examples) {
        prompt += `Input: ${example.input}\nOutput: ${example.output}\n\n`;
      }
    }
    
    // Add context if required
    if (taskType.requiresContext && context.history) {
      prompt += 'Previous context:\n';
      prompt += context.history.slice(-3).join('\n') + '\n\n';
    }
    
    // Add the actual input
    prompt += `Current request: ${input}`;
    
    return prompt;
  }

  /**
   * Format response based on task type
   */
  formatResponse(taskType, response) {
    if (taskType.responseFormat === 'structured' && taskType.schema) {
      // Validate against schema
      try {
        // Here we would use the schema validator
        return JSON.parse(response);
      } catch (error) {
        console.error('Failed to parse structured response:', error);
        return { error: 'Invalid response format', raw: response };
      }
    }
    
    return response;
  }

  /**
   * Register a new task type
   */
  async registerTaskType(taskType) {
    // Validate task type structure
    if (!taskType.id || !taskType.name || !taskType.systemPrompt) {
      throw new Error('Invalid task type: missing required fields');
    }
    
    // Save to file
    const taskTypesDir = path.join(__dirname, '../../data/task-types');
    const filePath = path.join(taskTypesDir, `${taskType.id}.json`);
    
    await fs.writeFile(filePath, JSON.stringify(taskType, null, 2));
    
    // Add to registry
    this.taskTypes.set(taskType.id, taskType);
    
    console.log(`✅ Registered new task type: ${taskType.name}`);
  }
}