/**
 * AnalysisStrategy - Requirements analysis strategy
 * Refactored to use EnhancedTaskStrategy and utilities
 * 
 * This strategy handles requirements analysis tasks by performing analysis
 * directly within the strategy, following proper parent→child task delegation patterns.
 * 
 * Now uses the new abstractions to eliminate boilerplate:
 * - EnhancedTaskStrategy for message routing and error handling
 * - PromptManager for centralized prompt management
 * - ConfigBuilder for configuration setup
 * - StrategyHelpers for common operations
 */

import { EnhancedTaskStrategy } from '@legion/tasks';
import { fileURLToPath } from 'url';
import path from 'path';
import { PromptManager } from '../utils/PromptManager.js';
import { ConfigBuilder } from '../utils/ConfigBuilder.js';
import { 
  parseJsonResponse, 
  getTaskContext,
  ensureInitialized 
} from '../utils/StrategyHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create an AnalysisStrategy prototype
 * Dramatically simplified using the new abstractions
 */
export function createAnalysisStrategy(llmClient = null, options = {}) {
  // Create strategy inheriting from EnhancedTaskStrategy (which has built-in patterns)
  const strategy = Object.create(EnhancedTaskStrategy);
  
  // Build configuration using ConfigBuilder preset
  const config = ConfigBuilder.createFromPreset('analysis', {
    llmClient,
    options
  });
  
  // Create PromptManager for centralized prompt handling
  const promptManager = new PromptManager(__dirname, { llmClient });
  
  // Define required prompts with schemas
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
  
  // Load all prompts using PromptManager (handles FAIL FAST internally)
  promptManager.loadPrompts(promptDefinitions);
  
  // Store dependencies in strategy for access
  strategy.config = config;
  strategy.promptManager = promptManager;
  
  /**
   * Override doWork - the only method we need to implement
   * EnhancedTaskStrategy handles all the message routing and error boundaries
   */
  strategy.doWork = async function doWork(senderTask, message) {
    // Ensure prompts are initialized
    await promptManager.ensureInitialized();
    
    // Get services using helper
    const services = this.requireServices(['llmClient']);
    
    // Extract task context
    const taskContext = getTaskContext(this);
    
    // Perform the analysis
    const analysis = await performAnalysis(taskContext, this, promptManager);
    
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
 * Simplified using PromptManager
 */
async function performAnalysis(taskContext, task, promptManager) {
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
      taskDetails, promptManager
    );
    analysis.functionalRequirements = functionalReqs;
    task.addConversationEntry('system', 
      `Identified ${functionalReqs.length} functional requirements`);
    
    // Step 2: Technical Requirements Analysis
    console.log('  → Analyzing technical requirements...');
    const technicalReqs = await analyzeTechnicalRequirements(
      taskDetails, functionalReqs, promptManager
    );
    analysis.technicalRequirements = technicalReqs;
    task.addConversationEntry('system', 
      `Identified ${technicalReqs.length} technical requirements`);
    
    // Step 3: Component Architecture
    console.log('  → Determining component architecture...');
    const components = await analyzeComponentArchitecture(
      taskDetails, functionalReqs, technicalReqs, promptManager
    );
    analysis.components = components;
    task.addConversationEntry('system', 
      `Identified ${components.length} system components`);
    
    // Step 4: Data Model (if needed)
    if (needsDataModel(taskDetails, functionalReqs)) {
      console.log('  → Designing data model...');
      const dataModel = await analyzeDataModel(
        taskDetails, functionalReqs, promptManager
      );
      analysis.dataModel = dataModel;
      task.addConversationEntry('system', 
        `Designed data model with ${dataModel?.entities?.length || 0} entities`);
    }
    
    // Step 5: API Specification (if needed)
    if (needsApiSpec(taskDetails, functionalReqs)) {
      console.log('  → Defining API specification...');
      const apiSpec = await analyzeApiSpecification(
        taskDetails, functionalReqs, analysis.dataModel, promptManager
      );
      analysis.apiSpecification = apiSpec;
      task.addConversationEntry('system', 
        `Defined ${apiSpec?.endpoints?.length || 0} API endpoints`);
    }
    
    // Step 6: Dependencies
    console.log('  → Identifying dependencies...');
    const dependencies = await analyzeDependencies(
      taskDetails, technicalReqs, components, promptManager
    );
    analysis.dependencies = dependencies;
    
    // Step 7: Constraints and Assumptions
    console.log('  → Documenting constraints and assumptions...');
    const constraints = await analyzeConstraints(taskDetails, promptManager);
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
 * Analyze functional requirements - simplified with PromptManager
 */
async function analyzeFunctionalRequirements(taskDetails, promptManager) {
  const result = await promptManager.executePrompt(
    'requirements-analysis/functional-requirements',
    {
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
async function analyzeTechnicalRequirements(taskDetails, functionalReqs, promptManager) {
  const result = await promptManager.executePrompt(
    'requirements-analysis/technical-requirements',
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
async function analyzeComponentArchitecture(taskDetails, functionalReqs, technicalReqs, promptManager) {
  const result = await promptManager.executePrompt(
    'requirements-analysis/component-architecture',
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
async function analyzeDataModel(taskDetails, functionalReqs, promptManager) {
  const result = await promptManager.executePrompt(
    'requirements-analysis/data-model',
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
async function analyzeApiSpecification(taskDetails, functionalReqs, dataModel, promptManager) {
  const result = await promptManager.executePrompt(
    'requirements-analysis/api-specification',
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
async function analyzeDependencies(taskDetails, technicalReqs, components, promptManager) {
  const result = await promptManager.executePrompt(
    'requirements-analysis/dependencies',
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
async function analyzeConstraints(taskDetails, promptManager) {
  const result = await promptManager.executePrompt(
    'requirements-analysis/constraints',
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