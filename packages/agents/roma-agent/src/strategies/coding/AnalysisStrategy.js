/**
 * AnalysisStrategy - Requirements analysis strategy
 * Converted to pure prototypal pattern
 * 
 * This strategy handles requirements analysis tasks by performing analysis
 * directly within the strategy, following proper parent→child task delegation patterns.
 * 
 * Absorbs all functionality from the former RequirementsAnalyzer component.
 */

import { TaskStrategy } from '@legion/tasks';
import { EnhancedPromptRegistry, TemplatedPrompt } from '@legion/prompting-manager';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create an AnalysisStrategy prototype
 * This factory function creates the strategy with its dependencies
 */
export function createAnalysisStrategy(llmClient = null, options = {}) {
  // Create the strategy as an object that inherits from TaskStrategy
  const strategy = Object.create(TaskStrategy);
  
  // Store configuration
  const config = {
    llmClient: llmClient,
    options: {
      outputFormat: 'json',
      validateResults: true,
      ...options
    },
    prompts: {},  // Store TemplatedPrompt objects here
    promptsReady: false,
    initError: null
  };
  
  // Initialize prompt registry
  const promptsPath = path.resolve(__dirname, '../../../prompts');
  const promptRegistry = options.promptRegistry || new EnhancedPromptRegistry(promptsPath);
  
  // Define required prompts and their schemas
  const promptDefinitions = [
    {
      path: 'requirements-analysis/functional-requirements',
      schema: {
        type: 'object',
        properties: {
          requirements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                acceptance_criteria: { type: 'array', items: { type: 'string' } }
              },
              required: ['description']
            }
          }
        },
        required: ['requirements'],
        format: 'json'
      }
    },
    {
      path: 'requirements-analysis/technical-requirements',
      schema: {
        type: 'object',
        properties: {
          requirements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                description: { type: 'string' },
                category: { type: 'string' },
                specifications: { type: 'array', items: { type: 'string' } }
              },
              required: ['description']
            }
          }
        },
        required: ['requirements'],
        format: 'json'
      }
    },
    {
      path: 'requirements-analysis/component-architecture',
      schema: {
        type: 'object',
        properties: {
          components: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                responsibilities: { type: 'array', items: { type: 'string' } },
                dependencies: { type: 'array', items: { type: 'string' } }
              },
              required: ['name', 'description']
            }
          }
        },
        required: ['components'],
        format: 'json'
      }
    },
    {
      path: 'requirements-analysis/data-model',
      schema: {
        type: 'object',
        properties: {
          entities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                attributes: { type: 'array', items: { type: 'object' } },
                relationships: { type: 'array', items: { type: 'object' } }
              },
              required: ['name']
            }
          }
        },
        format: 'json'
      }
    },
    {
      path: 'requirements-analysis/api-specification',
      schema: {
        type: 'object',
        properties: {
          endpoints: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                method: { type: 'string' },
                description: { type: 'string' },
                parameters: { type: 'array', items: { type: 'object' } },
                responses: { type: 'object' }
              },
              required: ['path', 'method']
            }
          }
        },
        format: 'json'
      }
    },
    {
      path: 'requirements-analysis/dependencies',
      schema: {
        type: 'object',
        properties: {
          dependencies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                version: { type: 'string' },
                purpose: { type: 'string' }
              },
              required: ['name']
            }
          }
        },
        required: ['dependencies'],
        format: 'json'
      }
    },
    {
      path: 'requirements-analysis/constraints',
      schema: {
        type: 'object',
        properties: {
          constraints: { type: 'array', items: { type: 'string' } },
          assumptions: { type: 'array', items: { type: 'string' } }
        },
        format: 'json'
      }
    }
  ];
  
  // Create a promise that resolves when all prompts are loaded and initialized
  config.initPromise = Promise.all(
    promptDefinitions.map(def => 
      promptRegistry.load(def.path).then(promptTemplate => {
        if (!promptTemplate) {
          const error = new Error(`Required prompt missing: ${def.path} - FAIL FAST, no fallbacks!`);
          console.error(`❌ FAIL FAST: Failed to load required prompt: ${def.path}`);
          config.initError = error;
          throw error;
        }
        
        // Create a TemplatedPrompt object that handles LLM interaction
        config.prompts[def.path] = new TemplatedPrompt({
          prompt: promptTemplate,
          responseSchema: def.schema,
          llmClient: config.llmClient,
          maxRetries: 3
        });
        
        return config.prompts[def.path];
      })
    )
  ).then(() => {
    config.promptsReady = true;
    console.log(`✅ AnalysisStrategy: All ${promptDefinitions.length} prompts initialized successfully`);
  }).catch(error => {
    console.error(`❌ FAIL FAST: Failed to initialize prompts: ${error.message}`);
    config.initError = error;
    config.promptsReady = false;
  });
  
  /**
   * The only required method - handles all messages
   */
  strategy.onMessage = function onMessage(senderTask, message) {
    // 'this' is the task instance that received the message
    
    try {
      // Determine if message is from child or parent/initiator
      if (senderTask.parent === this) {
        // Message from child task
        switch (message.type) {
          case 'completed':
            console.log(`✅ Analysis task completed for ${this.description}`);
            this.send(this.parent, { type: 'child-completed', child: this });
            break;
            
          case 'failed':
            this.send(this.parent, { type: 'child-failed', child: this, error: message.error });
            break;
            
          default:
            console.log(`ℹ️ AnalysisStrategy received unhandled message from child: ${message.type}`);
        }
      } else {
        // Message from parent or initiator
        switch (message.type) {
          case 'start':
          case 'work':
            // Fire-and-forget operation - handleAnalysisRequest manages its own async operations
            handleAnalysisRequest.call(this, config);
            break;
            
          case 'abort':
            console.log(`🛑 Analysis task aborted`);
            break;
            
          default:
            console.log(`ℹ️ AnalysisStrategy received unhandled message: ${message.type}`);
        }
      }
    } catch (error) {
      // Catch any synchronous errors in message handling
      console.error(`❌ AnalysisStrategy message handler error: ${error.message}`);
      // Don't let errors escape the message handler - handle them gracefully
      try {
        if (this.addConversationEntry) {
          this.addConversationEntry('system', `Message handling error: ${error.message}`);
        }
      } catch (innerError) {
        console.error(`❌ Failed to log message handling error: ${innerError.message}`);
      }
    }
  };
  
  return strategy;
}

// Export default for backward compatibility
export default createAnalysisStrategy;

// ============================================================================
// Internal implementation functions
// These work with the task instance and strategy config
// ============================================================================

/**
 * Handle analysis request - main execution logic
 * Called with task as 'this' context
 */
function handleAnalysisRequest(config) {
  try {
    console.log(`🔍 AnalysisStrategy handling: ${this.description}`);
    
    // First ensure prompts are loaded - this is async but we handle it with promise chains
    if (!config.promptsReady && config.initPromise) {
      console.log('⏳ Waiting for prompts to load...');
      
      // Use promise chain to wait for initialization
      config.initPromise.then(() => {
        // Now continue with analysis after prompts are ready
        continueAnalysisAfterInit.call(this, config);
      }).catch(error => {
        console.error(`❌ AnalysisStrategy initialization failed: ${error.message}`);
        this.addConversationEntry('system', 
          `Analysis failed during initialization: ${error.message}`);
        this.fail(error);
        if (this.parent) {
          this.send(this.parent, { type: 'failed', error });
        }
      });
      
      // Return early - the promise chain will continue execution
      return;
    }
    
    // If prompts are ready or there was an init error, continue
    continueAnalysisAfterInit.call(this, config);
    
  } catch (error) {
    console.error(`❌ AnalysisStrategy sync error: ${error.message}`);
    
    this.addConversationEntry('system', 
      `Analysis sync error: ${error.message}`);
    
    this.fail(error);
    
    // Notify parent of failure if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
    
    // Fire-and-forget - no return value
  }
}

/**
 * Continue analysis after prompts are initialized
 * Called with task as 'this' context
 */
function continueAnalysisAfterInit(config) {
  try {
    // Check if there was an initialization error
    if (config.initError) {
      throw config.initError;
    }
    
    // Get LLM client from config or task context
    const llmClient = config.llmClient || 
      (this.lookup ? this.lookup('llmClient') : this.context?.llmClient);
    
    if (!llmClient) {
      throw new Error('LLM client is required for AnalysisStrategy');
    }
    
    // Determine task details from description
    const taskDetails = extractTaskDetails(this);
    
    // Perform requirements analysis
    console.log(`📋 Starting requirements analysis for: ${taskDetails.projectType || 'project'}`);
    
    // Perform comprehensive analysis - initiate async operation
    performAnalysis(taskDetails, this, config).then(analysis => {
      // Store the analysis as an artifact
      this.storeArtifact(
        'requirements-analysis',
        analysis,
        'Requirements analysis including functional and technical specifications',
        'analysis'
      );
      
      // Add conversation entry about completion
      this.addConversationEntry('system', 
        `Analysis completed: Found ${analysis.functionalRequirements?.length || 0} functional and ${analysis.technicalRequirements?.length || 0} technical requirements`);
      
      console.log(`✅ AnalysisStrategy completed successfully`);
      
      // Complete the task
      const result = {
        success: true,
        result: analysis,
        artifacts: ['requirements-analysis']
      };
      
      this.complete(result);
      
      // Notify parent if exists (fire-and-forget message passing)
      if (this.parent) {
        this.send(this.parent, { type: 'completed', result });
      }
    }).catch(error => {
      console.error(`❌ AnalysisStrategy failed: ${error.message}`);
      
      this.addConversationEntry('system', 
        `Analysis failed: ${error.message}`);
      
      this.fail(error);
      
      // Notify parent of failure if exists (fire-and-forget message passing)
      if (this.parent) {
        this.send(this.parent, { type: 'failed', error });
      }
    });
    
    // Fire-and-forget - no return value
    
  } catch (error) {
    console.error(`❌ AnalysisStrategy sync error: ${error.message}`);
    
    this.addConversationEntry('system', 
      `Analysis sync error: ${error.message}`);
    
    this.fail(error);
    
    // Notify parent of failure if exists (fire-and-forget message passing)
    if (this.parent) {
      this.send(this.parent, { type: 'failed', error });
    }
    
    // Fire-and-forget - no return value
  }
}

/**
 * Extract task details from the task description
 */
function extractTaskDetails(task) {
  const description = task.description.toLowerCase();
  
  // Detect project type
  let projectType = 'general';
  if (description.includes('api') || description.includes('rest')) {
    projectType = 'api';
  } else if (description.includes('web') || description.includes('website')) {
    projectType = 'webapp';
  } else if (description.includes('cli') || description.includes('command')) {
    projectType = 'cli';
  } else if (description.includes('server')) {
    projectType = 'server';
  }
  
  // Extract key components
  const components = [];
  if (description.includes('database') || description.includes('db')) {
    components.push('database');
  }
  if (description.includes('auth') || description.includes('login')) {
    components.push('authentication');
  }
  if (description.includes('api')) {
    components.push('api');
  }
  if (description.includes('ui') || description.includes('interface')) {
    components.push('ui');
  }
  
  return {
    projectType,
    components,
    description: task.description,
    context: task.context || {}
  };
}

/**
 * Perform comprehensive requirements analysis
 */
async function performAnalysis(taskDetails, task, config) {
  const analysis = {
    overview: '',
    functionalRequirements: [],
    technicalRequirements: [],
    components: [],
    dependencies: [],
    dataModel: null,
    apiSpecification: null,
    constraints: [],
    assumptions: []
  };
  
  try {
    // Step 1: Functional Requirements Analysis
    console.log('  → Analyzing functional requirements...');
    const functionalReqs = await analyzeFunctionalRequirements(
      taskDetails, config
    );
    analysis.functionalRequirements = functionalReqs;
    task.addConversationEntry('system', 
      `Identified ${functionalReqs.length} functional requirements`);
    
    // Step 2: Technical Requirements Analysis
    console.log('  → Analyzing technical requirements...');
    const technicalReqs = await analyzeTechnicalRequirements(
      taskDetails, functionalReqs, config
    );
    analysis.technicalRequirements = technicalReqs;
    task.addConversationEntry('system', 
      `Identified ${technicalReqs.length} technical requirements`);
    
    // Step 3: Component Architecture
    console.log('  → Determining component architecture...');
    const components = await analyzeComponentArchitecture(
      taskDetails, functionalReqs, technicalReqs, config
    );
    analysis.components = components;
    task.addConversationEntry('system', 
      `Identified ${components.length} system components`);
    
    // Step 4: Data Model (if needed)
    if (needsDataModel(taskDetails, functionalReqs)) {
      console.log('  → Designing data model...');
      const dataModel = await analyzeDataModel(
        taskDetails, functionalReqs, config
      );
      analysis.dataModel = dataModel;
      task.addConversationEntry('system', 
        `Designed data model with ${dataModel?.entities?.length || 0} entities`);
    }
    
    // Step 5: API Specification (if needed)
    if (needsApiSpec(taskDetails, functionalReqs)) {
      console.log('  → Defining API specification...');
      const apiSpec = await analyzeApiSpecification(
        taskDetails, functionalReqs, dataModel, config
      );
      analysis.apiSpecification = apiSpec;
      task.addConversationEntry('system', 
        `Defined ${apiSpec?.endpoints?.length || 0} API endpoints`);
    }
    
    // Step 6: Dependencies
    console.log('  → Identifying dependencies...');
    const dependencies = await analyzeDependencies(
      taskDetails, technicalReqs, components, config
    );
    analysis.dependencies = dependencies;
    
    // Step 7: Constraints and Assumptions
    console.log('  → Documenting constraints and assumptions...');
    const constraints = await analyzeConstraints(taskDetails, config);
    analysis.constraints = constraints.constraints || [];
    analysis.assumptions = constraints.assumptions || [];
    
    // Generate overview
    analysis.overview = generateAnalysisOverview(analysis);
    
    return analysis;
    
  } catch (error) {
    console.error('Analysis step failed:', error);
    throw error;
  }
}

/**
 * Analyze functional requirements
 */
async function analyzeFunctionalRequirements(taskDetails, config) {
  // Check if initialization failed
  if (config.initError) {
    throw new Error(`AnalysisStrategy initialization failed: ${config.initError.message}`);
  }
  
  const prompt = config.prompts['requirements-analysis/functional-requirements'];
  if (!prompt) {
    throw new Error('Required prompt not initialized: requirements-analysis/functional-requirements - FAIL FAST!');
  }
  
  // Execute the prompt with variables - prompt handles LLM interaction internally
  const result = await prompt.execute({
    projectDescription: taskDetails.description,
    projectType: taskDetails.projectType,
    components: JSON.stringify(taskDetails.components)
  });
  
  // Handle result
  if (result.success) {
    return result.data.requirements || [];
  } else {
    console.error('Failed to analyze functional requirements:', result.errors?.join(', '));
    return [];
  }
}

/**
 * Analyze technical requirements
 */
async function analyzeTechnicalRequirements(taskDetails, functionalReqs, config) {
  // Check if initialization failed
  if (config.initError) {
    throw new Error(`AnalysisStrategy initialization failed: ${config.initError.message}`);
  }
  
  const prompt = config.prompts['requirements-analysis/technical-requirements'];
  if (!prompt) {
    throw new Error('Required prompt not initialized: requirements-analysis/technical-requirements - FAIL FAST!');
  }
  
  // Execute the prompt with variables - prompt handles LLM interaction internally
  const result = await prompt.execute({
    projectDescription: taskDetails.description,
    projectType: taskDetails.projectType,
    functionalRequirements: JSON.stringify(functionalReqs)
  });
  
  // Handle result
  if (result.success) {
    return result.data.requirements || [];
  } else {
    console.error('Failed to analyze technical requirements:', result.errors?.join(', '));
    return [];
  }
}

/**
 * Analyze component architecture
 */
async function analyzeComponentArchitecture(taskDetails, functionalReqs, technicalReqs, config) {
  // Check if initialization failed
  if (config.initError) {
    throw new Error(`AnalysisStrategy initialization failed: ${config.initError.message}`);
  }
  
  const promptData = config.prompts['requirements-analysis/component-architecture'];
  if (!promptData) {
    throw new Error('Required prompt not loaded: requirements-analysis/component-architecture - FAIL FAST!');
  }
  
  // Use the prompt content with variables
  const promptContent = promptData.content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const variables = {
      projectDescription: taskDetails.description,
      projectType: taskDetails.projectType,
      functionalRequirements: JSON.stringify(functionalReqs),
      technicalRequirements: JSON.stringify(technicalReqs)
    };
    return variables[key] || match;
  });
  
  // Get LLM client
  const llmClient = config.llmClient;
  if (!llmClient) {
    throw new Error('LLM client is required for analysis');
  }
  
  const response = await llmClient.complete(promptContent);
  
  // Parse response
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/{[\s\S]*}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
    const data = JSON.parse(jsonStr);
    return data.components || [];
  } catch (error) {
    console.error('Failed to parse component architecture response:', error);
    return [];
  }
}

/**
 * Analyze data model
 */
async function analyzeDataModel(taskDetails, functionalReqs, config) {
  // Check if initialization failed
  if (config.initError) {
    throw new Error(`AnalysisStrategy initialization failed: ${config.initError.message}`);
  }
  
  const promptData = config.prompts['requirements-analysis/data-model'];
  if (!promptData) {
    throw new Error('Required prompt not loaded: requirements-analysis/data-model - FAIL FAST!');
  }
  
  // Use the prompt content with variables
  const promptContent = promptData.content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const variables = {
      projectDescription: taskDetails.description,
      functionalRequirements: JSON.stringify(functionalReqs)
    };
    return variables[key] || match;
  });
  
  // Get LLM client
  const llmClient = config.llmClient;
  if (!llmClient) {
    throw new Error('LLM client is required for analysis');
  }
  
  const response = await llmClient.complete(promptContent);
  
  // Parse response
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/{[\s\S]*}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse data model response:', error);
    return null;
  }
}

/**
 * Analyze API specification
 */
async function analyzeApiSpecification(taskDetails, functionalReqs, dataModel, config) {
  // Check if initialization failed
  if (config.initError) {
    throw new Error(`AnalysisStrategy initialization failed: ${config.initError.message}`);
  }
  
  const promptData = config.prompts['requirements-analysis/api-specification'];
  if (!promptData) {
    throw new Error('Required prompt not loaded: requirements-analysis/api-specification - FAIL FAST!');
  }
  
  // Use the prompt content with variables
  const promptContent = promptData.content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const variables = {
      projectDescription: taskDetails.description,
      functionalRequirements: JSON.stringify(functionalReqs),
      dataModel: JSON.stringify(dataModel)
    };
    return variables[key] || match;
  });
  
  // Get LLM client
  const llmClient = config.llmClient;
  if (!llmClient) {
    throw new Error('LLM client is required for analysis');
  }
  
  const response = await llmClient.complete(promptContent);
  
  // Parse response
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/{[\s\S]*}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse API specification response:', error);
    return null;
  }
}

/**
 * Analyze dependencies
 */
async function analyzeDependencies(taskDetails, technicalReqs, components, config) {
  // Check if initialization failed
  if (config.initError) {
    throw new Error(`AnalysisStrategy initialization failed: ${config.initError.message}`);
  }
  
  const promptData = config.prompts['requirements-analysis/dependencies'];
  if (!promptData) {
    throw new Error('Required prompt not loaded: requirements-analysis/dependencies - FAIL FAST!');
  }
  
  // Use the prompt content with variables
  const promptContent = promptData.content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const variables = {
      projectType: taskDetails.projectType,
      components: JSON.stringify(components),
      technicalRequirements: JSON.stringify(technicalReqs)
    };
    return variables[key] || match;
  });
  
  // Get LLM client
  const llmClient = config.llmClient;
  if (!llmClient) {
    throw new Error('LLM client is required for analysis');
  }
  
  const response = await llmClient.complete(promptContent);
  
  // Parse response
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/{[\s\S]*}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
    const data = JSON.parse(jsonStr);
    return data.dependencies || [];
  } catch (error) {
    console.error('Failed to parse dependencies response:', error);
    return [];
  }
}

/**
 * Analyze constraints and assumptions
 */
async function analyzeConstraints(taskDetails, config) {
  // Check if initialization failed
  if (config.initError) {
    throw new Error(`AnalysisStrategy initialization failed: ${config.initError.message}`);
  }
  
  const promptData = config.prompts['requirements-analysis/constraints'];
  if (!promptData) {
    throw new Error('Required prompt not loaded: requirements-analysis/constraints - FAIL FAST!');
  }
  
  // Use the prompt content with variables
  const promptContent = promptData.content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const variables = {
      projectDescription: taskDetails.description,
      projectType: taskDetails.projectType
    };
    return variables[key] || match;
  });
  
  // Get LLM client
  const llmClient = config.llmClient;
  if (!llmClient) {
    throw new Error('LLM client is required for analysis');
  }
  
  const response = await llmClient.complete(promptContent);
  
  // Parse response
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/{[\s\S]*}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response;
    return JSON.parse(jsonStr) || { constraints: [], assumptions: [] };
  } catch (error) {
    console.error('Failed to parse constraints response:', error);
    return { constraints: [], assumptions: [] };
  }
}

/**
 * Check if data model is needed
 */
function needsDataModel(taskDetails, functionalReqs) {
  // Check if any functional requirements mention data storage
  const hasDataRequirements = functionalReqs.some(req => 
    req.description?.toLowerCase().includes('data') ||
    req.description?.toLowerCase().includes('store') ||
    req.description?.toLowerCase().includes('database') ||
    req.description?.toLowerCase().includes('persist')
  );
  
  // Check if components include database
  const hasDatabase = taskDetails.components.includes('database');
  
  // Check project type
  const needsData = ['api', 'webapp', 'server'].includes(taskDetails.projectType);
  
  return hasDataRequirements || hasDatabase || needsData;
}

/**
 * Check if API specification is needed
 */
function needsApiSpec(taskDetails, functionalReqs) {
  // Check if any functional requirements mention API
  const hasApiRequirements = functionalReqs.some(req => 
    req.description?.toLowerCase().includes('api') ||
    req.description?.toLowerCase().includes('endpoint') ||
    req.description?.toLowerCase().includes('service')
  );
  
  // Check if components include API
  const hasApi = taskDetails.components.includes('api');
  
  // Check project type
  const needsApi = ['api', 'webapp', 'server'].includes(taskDetails.projectType);
  
  return hasApiRequirements || hasApi || needsApi;
}

/**
 * Generate analysis overview
 */
function generateAnalysisOverview(analysis) {
  const overview = [];
  
  overview.push(`Requirements Analysis Summary:`);
  overview.push(`- ${analysis.functionalRequirements.length} functional requirements identified`);
  overview.push(`- ${analysis.technicalRequirements.length} technical requirements identified`);
  overview.push(`- ${analysis.components.length} system components defined`);
  
  if (analysis.dataModel) {
    overview.push(`- Data model with ${analysis.dataModel?.entities?.length || 0} entities`);
  }
  
  if (analysis.apiSpecification) {
    overview.push(`- API with ${analysis.apiSpecification?.endpoints?.length || 0} endpoints`);
  }
  
  overview.push(`- ${analysis.dependencies.length} external dependencies`);
  overview.push(`- ${analysis.constraints.length} constraints identified`);
  overview.push(`- ${analysis.assumptions.length} assumptions documented`);
  
  return overview.join('\n');
}

/**
 * Parse JSON response safely
 */
function parseJsonResponse(response) {
  if (!response) return null;
  
  try {
    if (typeof response === 'string') {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
    
    if (typeof response === 'object') {
      return response;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to parse JSON response:', error);
    return null;
  }
}