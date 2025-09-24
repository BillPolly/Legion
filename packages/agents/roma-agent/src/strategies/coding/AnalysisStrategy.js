/**
 * AnalysisStrategy - Requirements analysis strategy
 * Refactored to use EnhancedTaskStrategy and TemplatedPrompt
 * 
 * This strategy handles requirements analysis tasks by performing analysis
 * directly within the strategy, following proper parent→child task delegation patterns.
 * 
 * Now uses the new abstractions to eliminate boilerplate:
 * - EnhancedTaskStrategy for message routing and error handling
 * - TemplatedPrompt for LLM interactions with schema validation
 * - ConfigBuilder for configuration setup
 * - StrategyHelpers for common operations
 */

import { EnhancedTaskStrategy } from '@legion/tasks';
import { TemplatedPrompt } from '@legion/prompting-manager';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { createFromPreset } from '../utils/ConfigBuilder.js';
import { 
  parseJsonResponse, 
  getTaskContext,
  ensureInitialized 
} from '../utils/StrategyHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load a prompt template from the prompts directory
 */
async function loadPromptTemplate(promptPath) {
  const fullPath = path.join(__dirname, '../../prompts', promptPath + '.md');
  try {
    return await fs.readFile(fullPath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to load prompt template at ${fullPath}: ${error.message}`);
  }
}

/**
 * Create an AnalysisStrategy prototype
 * Using TemplatedPrompt for all LLM interactions
 */
export function createAnalysisStrategy(context = {}, options = {}) {
  // Support legacy signature for backward compatibility
  let actualContext = context;
  let actualOptions = options;
  if (arguments.length === 2 && typeof arguments[0] !== 'object') {
    // Old signature: (llmClient, options)
    actualContext = { llmClient: arguments[0] };
    actualOptions = arguments[1] || {};
  } else if (!context.llmClient && !context.toolRegistry && arguments.length === 1) {
    // Passed just llmClient
    actualContext = { llmClient: arguments[0] };
    actualOptions = {};
  }
  
  // Create strategy inheriting from EnhancedTaskStrategy (which has built-in patterns)
  const strategy = Object.create(EnhancedTaskStrategy);
  
  // Build configuration using ConfigBuilder preset
  const config = createFromPreset('analysis', {
    context: actualContext,
    options: actualOptions
  });
  
  // Store the llmClient for creating TemplatedPrompts
  strategy.llmClient = actualContext.llmClient;
  
  // Define prompt schemas for each analysis type
  const promptSchemas = {
    functionalRequirements: {
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
      required: ['requirements']
    },
    technicalRequirements: {
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
      required: ['requirements']
    },
    componentArchitecture: {
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
      required: ['components']
    },
    dataModel: {
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
      }
    },
    apiSpecification: {
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
      }
    },
    dependencies: {
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
      required: ['dependencies']
    },
    constraints: {
      type: 'object',
      properties: {
        constraints: { type: 'array', items: { type: 'string' } },
        assumptions: { type: 'array', items: { type: 'string' } }
      }
    }
  };
  
  // Initialize TemplatedPrompt instances when strategy is created
  // These will be loaded lazily when first needed
  strategy.prompts = {};
  
  // Store dependencies in strategy for access
  strategy.config = config;
  strategy.promptSchemas = promptSchemas;
  strategy.sessionLogger = actualOptions.sessionLogger;
  
  /**
   * Lazily create a TemplatedPrompt instance
   */
  strategy.getPrompt = async function(promptName) {
    if (!this.prompts[promptName]) {
      if (!this.promptSchemas[promptName]) {
        throw new Error(`Unknown prompt: ${promptName}`);
      }
      
      if (!this.llmClient) {
        throw new Error('LLMClient is required for TemplatedPrompt');
      }
      
      // Load the prompt template
      const templatePath = `requirements-analysis/${promptName.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1)}`;
      const template = await loadPromptTemplate(templatePath);
      
      // Create TemplatedPrompt instance
      this.prompts[promptName] = new TemplatedPrompt({
        prompt: template,
        responseSchema: this.promptSchemas[promptName],
        llmClient: this.llmClient,
        maxRetries: 3,
        sessionLogger: this.sessionLogger
      });
    }
    return this.prompts[promptName];
  };
  
  /**
   * Override doWork - the only method we need to implement
   * EnhancedTaskStrategy handles all the message routing and error boundaries
   */
  strategy.doWork = async function doWork(senderTask, message) {
    // Extract task context
    const taskContext = getTaskContext(this);
    
    // Perform the analysis using TemplatedPrompt
    const analysis = await performAnalysis(taskContext, this);
    
    // Complete with artifacts using built-in helper
    this.completeWithArtifacts({
      'requirements-analysis': {
        value: analysis,
        description: 'Requirements analysis including functional and technical specifications',
        type: 'analysis'
      }
    }, analysis);
  };
  
  return strategy;
}

// Export default for backward compatibility
export default createAnalysisStrategy;

// ============================================================================
// Internal implementation functions - now much simpler
// ============================================================================

/**
 * Extract task details from the task context
 */
function extractTaskDetails(taskContext) {
  const description = taskContext.description.toLowerCase();
  
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
    description: taskContext.description,
    context: taskContext
  };
}

/**
 * Perform comprehensive requirements analysis
 * Using TemplatedPrompt for all LLM interactions
 */
async function performAnalysis(taskContext, task) {
  // Extract task details for analysis
  const taskDetails = extractTaskDetails(taskContext);
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
      taskDetails, task
    );
    analysis.functionalRequirements = functionalReqs;
    task.addConversationEntry('system', 
      `Identified ${functionalReqs.length} functional requirements`);
    
    // Step 2: Technical Requirements Analysis
    console.log('  → Analyzing technical requirements...');
    const technicalReqs = await analyzeTechnicalRequirements(
      taskDetails, functionalReqs, task
    );
    analysis.technicalRequirements = technicalReqs;
    task.addConversationEntry('system', 
      `Identified ${technicalReqs.length} technical requirements`);
    
    // Step 3: Component Architecture
    console.log('  → Determining component architecture...');
    const components = await analyzeComponentArchitecture(
      taskDetails, functionalReqs, technicalReqs, task
    );
    analysis.components = components;
    task.addConversationEntry('system', 
      `Identified ${components.length} system components`);
    
    // Step 4: Data Model (if needed)
    if (needsDataModel(taskDetails, functionalReqs)) {
      console.log('  → Designing data model...');
      const dataModel = await analyzeDataModel(
        taskDetails, functionalReqs, task
      );
      analysis.dataModel = dataModel;
      task.addConversationEntry('system', 
        `Designed data model with ${dataModel?.entities?.length || 0} entities`);
    }
    
    // Step 5: API Specification (if needed)
    if (needsApiSpec(taskDetails, functionalReqs)) {
      console.log('  → Defining API specification...');
      const apiSpec = await analyzeApiSpecification(
        taskDetails, functionalReqs, analysis.dataModel, task
      );
      analysis.apiSpecification = apiSpec;
      task.addConversationEntry('system', 
        `Defined ${apiSpec?.endpoints?.length || 0} API endpoints`);
    }
    
    // Step 6: Dependencies
    console.log('  → Identifying dependencies...');
    const dependencies = await analyzeDependencies(
      taskDetails, technicalReqs, components, task
    );
    analysis.dependencies = dependencies;
    
    // Step 7: Constraints and Assumptions
    console.log('  → Documenting constraints and assumptions...');
    const constraints = await analyzeConstraints(taskDetails, task);
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
 * Analyze functional requirements - using TemplatedPrompt
 */
async function analyzeFunctionalRequirements(taskDetails, task) {
  const prompt = await task.getPrompt('functionalRequirements');
  const result = await prompt.execute({
    projectDescription: taskDetails.description,
      projectType: taskDetails.projectType,
      components: JSON.stringify(taskDetails.components)
    }
  );
  
  return result.success ? (result.data.requirements || []) : [];
}

/**
 * Analyze technical requirements - simplified with PromptManager
 */
async function analyzeTechnicalRequirements(taskDetails, functionalReqs, task) {
  const prompt = await task.getPrompt('technicalRequirements');
  const result = await prompt.execute(
    {
      projectDescription: taskDetails.description,
      projectType: taskDetails.projectType,
      functionalRequirements: JSON.stringify(functionalReqs)
    }
  );
  
  return result.success ? (result.data.requirements || []) : [];
}

/**
 * Analyze component architecture - simplified with PromptManager
 */
async function analyzeComponentArchitecture(taskDetails, functionalReqs, technicalReqs, task) {
  const prompt = await task.getPrompt('componentArchitecture');
  const result = await prompt.execute(
    {
      projectDescription: taskDetails.description,
      projectType: taskDetails.projectType,
      functionalRequirements: JSON.stringify(functionalReqs),
      technicalRequirements: JSON.stringify(technicalReqs)
    }
  );
  
  return result.success ? (result.data.components || []) : [];
}

/**
 * Analyze data model - simplified with PromptManager
 */
async function analyzeDataModel(taskDetails, functionalReqs, task) {
  const prompt = await task.getPrompt('dataModel');
  const result = await prompt.execute(
    {
      projectDescription: taskDetails.description,
      functionalRequirements: JSON.stringify(functionalReqs)
    }
  );
  
  return result.success ? result.data : null;
}

/**
 * Analyze API specification - simplified with PromptManager
 */
async function analyzeApiSpecification(taskDetails, functionalReqs, dataModel, task) {
  const prompt = await task.getPrompt('apiSpecification');
  const result = await prompt.execute(
    {
      projectDescription: taskDetails.description,
      functionalRequirements: JSON.stringify(functionalReqs),
      dataModel: JSON.stringify(dataModel)
    }
  );
  
  return result.success ? result.data : null;
}

/**
 * Analyze dependencies - simplified with PromptManager
 */
async function analyzeDependencies(taskDetails, technicalReqs, components, task) {
  const prompt = await task.getPrompt('dependencies');
  const result = await prompt.execute(
    {
      projectType: taskDetails.projectType,
      components: JSON.stringify(components),
      technicalRequirements: JSON.stringify(technicalReqs)
    }
  );
  
  return result.success ? (result.data.dependencies || []) : [];
}

/**
 * Analyze constraints and assumptions - simplified with PromptManager
 */
async function analyzeConstraints(taskDetails, task) {
  const prompt = await task.getPrompt('constraints');
  const result = await prompt.execute(
    {
      projectDescription: taskDetails.description,
      projectType: taskDetails.projectType
    }
  );
  
  return result.success ? result.data : { constraints: [], assumptions: [] };
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