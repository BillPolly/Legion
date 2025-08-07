/**
 * Default configuration values
 */

export const DEFAULT_CONFIG = {
  // Environment settings
  environment: 'development',
  
  // LLM Configuration
  llm: {
    provider: 'anthropic', // Default to Anthropic Claude
    anthropic: {
      model: 'claude-3-haiku-20240307',
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30000
    },
    openai: {
      model: 'gpt-3.5-turbo',
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30000
    },
    costBudget: {
      enabled: false,
      maxCostUSD: 10.0,
      warningThreshold: 0.8
    }
  },
  
  // Database Configuration
  database: {
    qdrant: {
      host: '127.0.0.1',
      port: 6333,
      timeout: 5000,
      retries: 3
    },
    mongodb: {
      url: 'mongodb://localhost:27017/recursive_planner',
      database: 'recursive_planner',
      timeout: 5000,
      retries: 3
    }
  },
  
  // External APIs
  apis: {
    serper: {
      timeout: 10000,
      retries: 2
    },
    github: {
      timeout: 10000,
      retries: 2
    }
  },
  
  // Server Configuration
  server: {
    storageActor: {
      port: 3700,
      path: '/storage'
    },
    storageBrowser: {
      port: 3601
    }
  },
  
  // Storage Configuration
  storage: {
    provider: 'mongodb',
    timeout: 5000,
    retries: 3
  },
  
  // Framework Configuration
  framework: {
    agent: {
      maxRetries: 3,
      planningTimeout: 30000,
      reflectionEnabled: true,
      debugMode: false
    },
    tool: {
      timeout: 30000,
      retries: 0,
      cacheResults: false
    },
    resources: {
      maxExecutionTime: 300000, // 5 minutes
      maxMemoryMB: 512,
      maxToolCalls: 50,
      maxRecursionDepth: 5
    }
  }
};

/**
 * Required environment variables for different features
 */
export const REQUIRED_ENV_VARS = {
  llm: {
    anthropic: ['ANTHROPIC_API_KEY'],
    openai: ['OPENAI_API_KEY']
  },
  database: {
    qdrant: [], // Optional, uses defaults
    mongodb: [] // Optional, uses defaults
  },
  apis: {
    serper: ['SERPER_API_KEY'],
    github: ['GITHUB_PAT', 'GITHUB_ORG']
  }
};

/**
 * Environment variable type conversions
 */
export const ENV_TYPE_CONVERSIONS = {
  // Ports should be numbers
  QDRANT_PORT: 'number',
  STORAGE_ACTOR_PORT: 'number',
  STORAGE_BROWSER_PORT: 'number',
  
  // Booleans
  LLM_COST_BUDGET_ENABLED: 'boolean',
  FRAMEWORK_AGENT_REFLECTION_ENABLED: 'boolean',
  FRAMEWORK_AGENT_DEBUG_MODE: 'boolean',
  FRAMEWORK_TOOL_CACHE_RESULTS: 'boolean',
  
  // Numbers
  LLM_MAX_TOKENS: 'number',
  LLM_TEMPERATURE: 'number',
  LLM_TIMEOUT: 'number',
  LLM_COST_BUDGET_MAX: 'number',
  LLM_COST_BUDGET_WARNING_THRESHOLD: 'number',
  
  DATABASE_QDRANT_TIMEOUT: 'number',
  DATABASE_QDRANT_RETRIES: 'number',
  DATABASE_MONGODB_TIMEOUT: 'number',
  DATABASE_MONGODB_RETRIES: 'number',
  
  FRAMEWORK_AGENT_MAX_RETRIES: 'number',
  FRAMEWORK_AGENT_PLANNING_TIMEOUT: 'number',
  FRAMEWORK_TOOL_TIMEOUT: 'number',
  FRAMEWORK_TOOL_RETRIES: 'number',
  FRAMEWORK_RESOURCES_MAX_EXECUTION_TIME: 'number',
  FRAMEWORK_RESOURCES_MAX_MEMORY_MB: 'number',
  FRAMEWORK_RESOURCES_MAX_TOOL_CALLS: 'number',
  FRAMEWORK_RESOURCES_MAX_RECURSION_DEPTH: 'number'
};