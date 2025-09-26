/**
 * DSL Examples for Declarative Strategy - Parent-Child Data Flow
 * 
 * This file demonstrates how to use the DSL template literal syntax
 * for declarative task configuration with parent-child data flow.
 */

import { query, update } from '@legion/handle-dsl';

/**
 * Example 1: Simple API Development Flow
 * Parent task: "Build API with authentication and user management"
 * Child tasks: Requirements, Design, Implementation, Testing
 */
export const apiDevelopmentFlow = {
  id: 'api-development',
  name: 'Build API with authentication and user management',
  description: 'Complete API development from requirements to deployment',
  
  children: [
    {
      id: 'gather-requirements',
      description: 'Gather and analyze API requirements',
      strategy: 'analysis',
      
      // No query spec - child starts with empty context
      querySpec: null,
      
      // Update parent context with requirements
      updateSpec: update`
        +artifacts = ${result.artifacts.requirements}
        status = "requirements-gathered"
        progress = 20
      `
    },
    
    {
      id: 'design-api',
      description: 'Design API endpoints and data models',
      strategy: 'design',
      
      // Pull requirements from parent context
      querySpec: query`find ?artifact where artifact/type = "requirements"`,
      
      // Add design artifacts to parent context
      updateSpec: update`
        +artifacts = ${result.artifacts.design}
        +artifacts = ${result.artifacts.schema}
        status = "api-designed"
        progress = 40
      `
    },
    
    {
      id: 'implement-auth',
      description: 'Implement authentication system',
      strategy: 'coding',
      
      // Pull design artifacts for auth implementation
      querySpec: query`find ?artifact where artifact/type = "design" and artifact/component = "auth"`,
      
      // Add auth implementation to artifacts
      updateSpec: update`
        +artifacts = ${result.artifacts.auth}
        +completedComponents = "authentication"
        progress = 60
      `
    },
    
    {
      id: 'implement-user-management',
      description: 'Implement user management endpoints',
      strategy: 'coding',
      
      // Pull design and auth artifacts
      querySpec: {
        queries: {
          design: query`find ?artifact where artifact/type = "design" and artifact/component = "users"`,
          auth: query`find ?artifact where artifact/type = "code" and artifact/component = "auth"`
        }
      },
      
      // Add user management implementation
      updateSpec: update`
        +artifacts = ${result.artifacts.userManagement}
        +completedComponents = "user-management"
        progress = 80
      `
    },
    
    {
      id: 'test-api',
      description: 'Create and run API tests',
      strategy: 'testing',
      
      // Pull all implementation artifacts for testing
      querySpec: query`find ?artifact where artifact/type = "code"`,
      
      // Add test results and mark completion
      updateSpec: update`
        +artifacts = ${result.artifacts.tests}
        +artifacts = ${result.artifacts.coverage}
        status = "completed"
        progress = 100
        testsPassed = ${result.summary.passed}
        testsFailed = ${result.summary.failed}
      `
    }
  ]
};

/**
 * Example 2: Data Pipeline Development
 * Parent task: "Build data pipeline with ETL and monitoring"
 * Child tasks: Source Analysis, Transform Design, Load Implementation, Monitoring
 */
export const dataPipelineFlow = {
  id: 'data-pipeline',
  name: 'Build data pipeline with ETL and monitoring',
  description: 'End-to-end data pipeline development',
  
  children: [
    {
      id: 'analyze-data-sources',
      description: 'Analyze source data formats and schemas',
      strategy: 'analysis',
      
      querySpec: null,
      
      updateSpec: update`
        +dataSources = ${result.sources}
        +schemas = ${result.schemas}
        sourceCount = ${result.sources.length}
        status = "sources-analyzed"
      `
    },
    
    {
      id: 'design-transforms',
      description: 'Design data transformation logic',
      strategy: 'design',
      
      querySpec: {
        // Multiple named queries for different data needs
        sources: query`find ?source where source/type = "data-source"`,
        schemas: query`find ?schema where schema/type = "source-schema"`
      },
      
      updateSpec: update`
        +transforms = ${result.transforms}
        +validationRules = ${result.validation}
        transformCount = ${result.transforms.length}
        status = "transforms-designed"
      `
    },
    
    {
      id: 'implement-etl',
      description: 'Implement ETL pipeline components',
      strategy: 'coding',
      
      querySpec: query`find ?artifact where artifact/type = "transform" or artifact/type = "schema"`,
      
      updateSpec: update`
        +artifacts = ${result.artifacts.etl}
        +pipelineComponents = ${result.components}
        status = "etl-implemented"
        -blockers = "missing-transforms"
      `
    },
    
    {
      id: 'implement-monitoring',
      description: 'Add monitoring and alerting',
      strategy: 'coding',
      
      querySpec: query`find ?component where component/type = "pipeline-component"`,
      
      updateSpec: update`
        +artifacts = ${result.artifacts.monitoring}
        +dashboards = ${result.dashboards}
        +alerts = ${result.alerts}
        monitoringEnabled = true
        status = "monitoring-added"
      `
    },
    
    {
      id: 'test-pipeline',
      description: 'Test pipeline end-to-end',
      strategy: 'testing',
      
      // Get all pipeline artifacts for comprehensive testing
      querySpec: query`find ?artifact where artifact/category = "pipeline"`,
      
      updateSpec: update`
        +testResults = ${result.results}
        +performanceMetrics = ${result.performance}
        status = "pipeline-complete"
        dataProcessed = ${result.metrics.recordsProcessed}
        avgProcessingTime = ${result.metrics.avgTime}
      `
    }
  ]
};

/**
 * Example 3: Content Management System Development
 * Demonstrates relationship operations and complex data flow
 */
export const cmsFlow = {
  id: 'cms-development',
  name: 'Build content management system',
  description: 'Full-stack CMS with admin panel and API',
  
  children: [
    {
      id: 'design-content-model',
      description: 'Design content types and relationships',
      strategy: 'design',
      
      querySpec: null,
      
      // Use relationship operators to manage content types
      updateSpec: update`
        +contentTypes = ${result.contentTypes}
        +relationships = ${result.relationships}
        modelComplexity = ${result.complexity}
        status = "content-model-designed"
      `
    },
    
    {
      id: 'implement-backend',
      description: 'Implement CMS backend API',
      strategy: 'coding',
      
      querySpec: query`find ?type where type/category = "content-type"`,
      
      updateSpec: update`
        +artifacts = ${result.artifacts.backend}
        +endpoints = ${result.endpoints}
        +middleware = ${result.middleware}
        apiEndpointCount = ${result.endpoints.length}
        status = "backend-implemented"
      `
    },
    
    {
      id: 'implement-admin-ui',
      description: 'Build admin interface',
      strategy: 'frontend',
      
      // Query both content model and API artifacts
      querySpec: {
        queries: {
          contentTypes: query`find ?type where type/category = "content-type"`,
          endpoints: query`find ?endpoint where endpoint/type = "api-endpoint"`
        }
      },
      
      updateSpec: update`
        +artifacts = ${result.artifacts.frontend}
        +components = ${result.components}
        +pages = ${result.pages}
        uiComponentCount = ${result.components.length}
        status = "admin-ui-complete"
      `
    },
    
    {
      id: 'implement-content-api',
      description: 'Build public content API',
      strategy: 'coding',
      
      querySpec: query`find ?artifact where artifact/component = "backend" or artifact/type = "content-type"`,
      
      updateSpec: update`
        +artifacts = ${result.artifacts.publicApi}
        +publicEndpoints = ${result.endpoints}
        publicApiEnabled = true
        status = "public-api-complete"
      `
    },
    
    {
      id: 'add-search-features',
      description: 'Implement search and filtering',
      strategy: 'coding',
      
      // Complex query for search implementation needs
      querySpec: query`find ?artifact where (artifact/type = "api-endpoint" and artifact/access = "public") or artifact/type = "content-type"`,
      
      updateSpec: update`
        +searchFeatures = ${result.features}
        +searchIndexes = ${result.indexes}
        searchEnabled = true
        indexedContentTypes = ${result.indexes.length}
        status = "search-implemented"
      `
    },
    
    {
      id: 'final-testing',
      description: 'Comprehensive system testing',
      strategy: 'testing',
      
      // Get all artifacts for full system test
      querySpec: query`find ?artifact where artifact/category = "cms"`,
      
      updateSpec: update`
        +testSuites = ${result.testSuites}
        +coverageReports = ${result.coverage}
        status = "cms-complete"
        overallCoverage = ${result.coverage.overall}
        integrationTestsPassed = ${result.integration.passed}
        -blockers = "incomplete-testing"
      `
    }
  ]
};

/**
 * Example 4: Function-based Queries and Updates
 * For complex logic that can't be expressed in DSL
 */
export const complexLogicFlow = {
  id: 'machine-learning-pipeline',
  name: 'Build ML training pipeline',
  description: 'Data preprocessing, model training, and deployment',
  
  children: [
    {
      id: 'preprocess-data',
      description: 'Clean and prepare training data',
      strategy: 'data-science',
      
      // Function query for complex data analysis
      querySpec: (contextRM, contextHandle) => {
        // Access context data programmatically
        const rawData = contextRM.query({ path: 'datasets.raw' });
        const requirements = contextRM.query({ path: 'requirements' });
        
        // Apply complex selection logic
        const relevantData = rawData.filter(dataset => {
          return dataset.quality > requirements.minQuality &&
                 dataset.size > requirements.minSize;
        });
        
        return {
          datasets: relevantData,
          qualityThreshold: requirements.minQuality,
          sizeRequirement: requirements.minSize
        };
      },
      
      updateSpec: update`
        +cleanedDatasets = ${result.datasets}
        +preprocessingStats = ${result.stats}
        dataQualityScore = ${result.qualityScore}
        recordsProcessed = ${result.recordCount}
        status = "data-preprocessed"
      `
    },
    
    {
      id: 'train-model',
      description: 'Train machine learning model',
      strategy: 'ml-training',
      
      querySpec: query`find ?dataset where dataset/status = "preprocessed"`,
      
      // Function update for complex model metadata
      updateSpec: (contextRM, contextHandle, childResult) => {
        // Complex logic for model versioning and metadata
        const currentModels = contextRM.query({ path: 'models' }) || [];
        const newVersion = currentModels.length + 1;
        
        // Use DSL for simpler updates, function for complex logic
        const dslUpdate = update`
          +models = ${childResult.model}
          bestModelAccuracy = ${childResult.accuracy}
          status = "model-trained"
        `;
        
        // Apply DSL update first
        contextHandle.dataSource.update(dslUpdate);
        
        // Then apply complex metadata update
        contextRM.update({
          path: 'modelMetadata',
          value: {
            version: `v${newVersion}`,
            trainingTime: childResult.trainingDuration,
            hyperparameters: childResult.hyperparameters,
            performance: childResult.metrics,
            timestamp: new Date().toISOString()
          }
        });
      }
    },
    
    {
      id: 'deploy-model',
      description: 'Deploy model to production',
      strategy: 'deployment',
      
      querySpec: query`find ?model where model/accuracy > 0.85`,
      
      updateSpec: update`
        +deployments = ${result.deployment}
        productionModelId = ${result.deployment.modelId}
        deploymentStatus = ${result.deployment.status}
        endpointUrl = ${result.deployment.endpoint}
        status = "model-deployed"
      `
    }
  ]
};

/**
 * Example 5: Multi-stage Build Pipeline
 * Demonstrates sequential dependencies and artifact passing
 */
export const buildPipelineFlow = {
  id: 'ci-cd-pipeline',
  name: 'Set up CI/CD pipeline',
  description: 'Automated build, test, and deployment pipeline',
  
  children: [
    {
      id: 'setup-build',
      description: 'Configure build environment',
      strategy: 'devops',
      
      querySpec: query`find ?config where config/type = "build-config"`,
      
      updateSpec: update`
        +buildConfigs = ${result.configs}
        +dockerfiles = ${result.dockerfiles}
        +buildScripts = ${result.scripts}
        buildEnvironment = ${result.environment}
        status = "build-configured"
      `
    },
    
    {
      id: 'setup-testing',
      description: 'Configure automated testing',
      strategy: 'testing',
      
      querySpec: query`find ?artifact where artifact/stage = "build"`,
      
      updateSpec: update`
        +testConfigs = ${result.testConfigs}
        +testSuites = ${result.testSuites}
        testCoverage = ${result.coverage.target}
        status = "testing-configured"
      `
    },
    
    {
      id: 'setup-deployment',
      description: 'Configure deployment stages',
      strategy: 'devops',
      
      querySpec: {
        build: query`find ?config where config/stage = "build"`,
        test: query`find ?config where config/stage = "test"`
      },
      
      updateSpec: update`
        +deploymentStages = ${result.stages}
        +environments = ${result.environments}
        +rollbackStrategies = ${result.rollback}
        stagingEnvironment = ${result.environments.staging}
        productionEnvironment = ${result.environments.production}
        status = "deployment-configured"
      `
    },
    
    {
      id: 'test-pipeline',
      description: 'Run full pipeline test',
      strategy: 'testing',
      
      querySpec: query`find ?config where config/category = "pipeline"`,
      
      updateSpec: update`
        +pipelineResults = ${result.results}
        +metrics = ${result.metrics}
        buildTime = ${result.metrics.buildDuration}
        testTime = ${result.metrics.testDuration}
        deployTime = ${result.metrics.deployDuration}
        pipelineStatus = ${result.status}
        status = "pipeline-complete"
        -issues = "configuration-incomplete"
      `
    }
  ]
};

/**
 * Utility functions for working with DSL examples
 */
export const DSLExampleUtils = {
  /**
   * Create a basic query spec for artifact types
   */
  createArtifactQuery(artifactType) {
    return query`find ?artifact where artifact/type = ${artifactType}`;
  },
  
  /**
   * Create a basic update spec for adding results
   */
  createResultUpdate(resultPath) {
    return update`
      +artifacts = ${resultPath}
      status = "completed"
      completedAt = ${new Date().toISOString()}
    `;
  },
  
  /**
   * Create a progress update spec
   */
  createProgressUpdate(progressValue) {
    return update`
      progress = ${progressValue}
      updatedAt = ${new Date().toISOString()}
    `;
  },
  
  /**
   * Create a relationship add/remove spec
   */
  createRelationshipUpdate(attribute, value, operation = 'add') {
    if (operation === 'add') {
      return update`+${attribute} = ${value}`;
    } else {
      return update`-${attribute} = ${value}`;
    }
  }
};

/**
 * Example usage patterns for common scenarios
 */
export const commonPatterns = {
  // Pattern: Sequential dependency chain
  sequentialChain: [
    {
      querySpec: null, // First task has no dependencies
      updateSpec: update`+step1Results = ${result}`
    },
    {
      querySpec: query`find ?result where result/step = "step1"`,
      updateSpec: update`+step2Results = ${result}`
    },
    {
      querySpec: query`find ?result where result/step = "step2"`,
      updateSpec: update`+finalResults = ${result}`
    }
  ],
  
  // Pattern: Parallel execution with merge
  parallelMerge: [
    {
      id: 'parallel-task-a',
      querySpec: query`find ?input where input/category = "shared"`,
      updateSpec: update`+parallelResults = ${result.a}`
    },
    {
      id: 'parallel-task-b',
      querySpec: query`find ?input where input/category = "shared"`,
      updateSpec: update`+parallelResults = ${result.b}`
    },
    {
      id: 'merge-task',
      querySpec: query`find ?result where result/type = "parallel-result"`,
      updateSpec: update`mergedResult = ${result.merged}`
    }
  ],
  
  // Pattern: Conditional execution
  conditionalExecution: [
    {
      id: 'condition-check',
      querySpec: query`find ?condition where condition/type = "execution-condition"`,
      updateSpec: update`
        conditionMet = ${result.conditionMet}
        +conditionalData = ${result.data}
      `
    },
    {
      id: 'conditional-task',
      querySpec: (contextRM) => {
        const conditionMet = contextRM.query({ path: 'conditionMet' });
        return conditionMet ? contextRM.query({ path: 'conditionalData' }) : null;
      },
      updateSpec: update`
        conditionalResult = ${result}
        executed = ${result !== null}
      `
    }
  ]
};