# Agent Validator Framework Design

## Executive Summary

The Agent Validator Framework provides comprehensive validation, testing, and verification capabilities for configurable agents. It ensures agent configurations are syntactically correct, semantically valid, and executable, while providing automated testing and regeneration support for agent configurations.

## System Architecture

### Core Purpose

The validator framework:
1. Validates agent configurations at multiple levels
2. Runs automated test scenarios
3. Provides detailed error reporting with fix suggestions
4. Enables automatic configuration regeneration
5. Offers runtime monitoring and verification

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Validator Framework                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │Schema Validator│ │Semantic Val. │  │Runtime Val.  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │Test Runner   │  │Scenario Exec │  │Mock Provider │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │Error Reporter│  │Auto Fixer   │  │Regeneration  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Validation System

### Three-Level Validation Architecture

```javascript
class ConfigValidator {
  constructor() {
    this.schemaValidator = new SchemaValidator();
    this.semanticValidator = new SemanticValidator();
    this.runtimeValidator = new RuntimeValidator();
  }
  
  async validateConfig(config) {
    const results = {
      schema: await this.schemaValidator.validate(config),
      semantic: await this.semanticValidator.validate(config),
      runtime: await this.runtimeValidator.validate(config)
    };
    
    return {
      valid: results.schema.valid && results.semantic.valid && results.runtime.valid,
      results,
      errors: this.collectErrors(results),
      regenerationHints: this.generateHints(results)
    };
  }
}
```

### Level 1: Schema Validation

Uses `@legion/schema` package with Zod for structural validation:

```javascript
class SchemaValidator {
  constructor() {
    this.zodValidator = new ZodValidator();
    this.schemas = this.loadSchemas();
  }
  
  async validate(config) {
    const schema = this.schemas.agentConfig;
    const result = await this.zodValidator.validate(config, schema);
    
    return {
      valid: result.success,
      errors: result.errors?.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        type: 'schema',
        severity: 'error',
        fix: this.suggestSchemaFix(e)
      }))
    };
  }
  
  loadSchemas() {
    return {
      agentConfig: z.object({
        agent: z.object({
          id: z.string().regex(/^[a-z0-9-]+$/),
          name: z.string().min(1).max(100),
          type: z.enum(['conversational', 'task', 'analytical', 'creative']),
          version: z.string().regex(/^\d+\.\d+\.\d+$/),
          
          llm: z.object({
            provider: z.enum(['anthropic', 'openai']),
            model: z.string(),
            temperature: z.number().min(0).max(1),
            maxTokens: z.number().positive().max(100000),
            systemPrompt: z.string()
          }),
          
          capabilities: z.array(z.object({
            module: z.string(),
            tools: z.array(z.string()),
            permissions: z.record(z.any())
          })).optional(),
          
          behaviorTree: BehaviorTreeSchema.optional(),
          knowledge: KnowledgeSchema.optional(),
          prompts: PromptsSchema.optional(),
          state: StateSchema.optional()
        })
      })
    };
  }
}
```

### Level 2: Semantic Validation

Validates logical consistency and relationships:

```javascript
class SemanticValidator {
  constructor() {
    this.moduleLoader = new ModuleLoader();
    this.toolRegistry = new ToolRegistry();
  }
  
  async validate(config) {
    const errors = [];
    
    // Validate tool references
    errors.push(...await this.validateToolReferences(config));
    
    // Validate behavior tree consistency
    errors.push(...await this.validateBehaviorTree(config));
    
    // Validate prompt templates
    errors.push(...await this.validatePromptTemplates(config));
    
    // Validate knowledge graph schemas
    errors.push(...await this.validateKnowledgeGraph(config));
    
    // Validate state references
    errors.push(...await this.validateStateReferences(config));
    
    // Validate cross-component dependencies
    errors.push(...await this.validateDependencies(config));
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  async validateToolReferences(config) {
    const errors = [];
    const availableTools = new Set();
    
    // Load and validate each capability module
    for (const capability of config.agent.capabilities || []) {
      const module = await this.moduleLoader.load(capability.module);
      
      if (!module) {
        errors.push({
          path: `agent.capabilities[${capability.module}]`,
          message: `Module '${capability.module}' not found`,
          type: 'semantic',
          severity: 'error',
          suggestion: await this.getSimilarModules(capability.module),
          fix: {
            type: 'replace',
            candidates: await this.getAvailableModules()
          }
        });
        continue;
      }
      
      // Validate tool existence in module
      const moduleTools = module.getTools();
      for (const toolName of capability.tools) {
        if (toolName === '*') {
          moduleTools.forEach(t => availableTools.add(t.name));
        } else if (!moduleTools.find(t => t.name === toolName)) {
          errors.push({
            path: `agent.capabilities[${capability.module}].tools`,
            message: `Tool '${toolName}' not found in module '${capability.module}'`,
            type: 'semantic',
            severity: 'error',
            suggestion: `Available tools: ${moduleTools.map(t => t.name).join(', ')}`,
            fix: {
              type: 'replace',
              value: moduleTools[0]?.name
            }
          });
        } else {
          availableTools.add(toolName);
        }
      }
    }
    
    // Validate behavior tree tool references
    if (config.agent.behaviorTree) {
      const btTools = this.extractBehaviorTreeTools(config.agent.behaviorTree);
      for (const toolRef of btTools) {
        if (!availableTools.has(toolRef) && !this.isBuiltInTool(toolRef)) {
          errors.push({
            path: 'agent.behaviorTree',
            message: `Behavior tree references undefined tool '${toolRef}'`,
            type: 'semantic',
            severity: 'error',
            suggestion: `Add to capabilities or use: ${Array.from(availableTools).join(', ')}`,
            fix: {
              type: 'add_capability',
              tool: toolRef
            }
          });
        }
      }
    }
    
    return errors;
  }
  
  async validatePromptTemplates(config) {
    const errors = [];
    const templates = config.agent.prompts?.templates || {};
    const availableVars = this.collectAvailableVariables(config);
    
    for (const [name, template] of Object.entries(templates)) {
      const usedVars = this.extractTemplateVariables(template);
      
      for (const varName of usedVars) {
        if (!availableVars.has(varName)) {
          errors.push({
            path: `agent.prompts.templates.${name}`,
            message: `Template uses undefined variable '${varName}'`,
            type: 'semantic',
            severity: 'error',
            suggestion: `Define in state.contextVariables or use: ${Array.from(availableVars).join(', ')}`,
            fix: {
              type: 'add_state_variable',
              variable: varName,
              schema: { type: 'string' }
            }
          });
        }
      }
    }
    
    return errors;
  }
  
  extractTemplateVariables(template) {
    const pattern = /\{\{(\w+(?:\.\w+)*)\}\}/g;
    const variables = new Set();
    let match;
    
    while ((match = pattern.exec(template)) !== null) {
      variables.add(match[1]);
    }
    
    return variables;
  }
  
  collectAvailableVariables(config) {
    const vars = new Set(['agentName', 'agentType', 'currentTime']);
    
    // Add state variables
    if (config.agent.state?.contextVariables) {
      Object.keys(config.agent.state.contextVariables).forEach(v => vars.add(v));
    }
    
    // Add system variables
    vars.add('sessionId');
    vars.add('messageCount');
    
    return vars;
  }
}
```

### Level 3: Runtime Validation

Validates execution feasibility:

```javascript
class RuntimeValidator {
  constructor() {
    this.resourceManager = null;
  }
  
  async initialize() {
    this.resourceManager = await ResourceManager.getInstance();
  }
  
  async validate(config) {
    if (!this.resourceManager) await this.initialize();
    
    const errors = [];
    
    // Test LLM connectivity
    errors.push(...await this.validateLLMConnectivity(config.agent.llm));
    
    // Test module loading
    errors.push(...await this.validateModuleLoading(config.agent.capabilities));
    
    // Test behavior tree execution
    errors.push(...await this.validateBehaviorTreeExecution(config.agent.behaviorTree));
    
    // Test knowledge graph
    errors.push(...await this.validateKnowledgeGraph(config.agent.knowledge));
    
    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors
    };
  }
  
  async validateLLMConnectivity(llmConfig) {
    const errors = [];
    
    try {
      const llmClient = await this.resourceManager.createLLMClient(llmConfig);
      await llmClient.test();
    } catch (error) {
      errors.push({
        path: 'agent.llm',
        message: `LLM connection failed: ${error.message}`,
        type: 'runtime',
        severity: 'error',
        suggestion: 'Check API keys and network connectivity',
        fix: {
          type: 'verify_api_key',
          provider: llmConfig.provider
        }
      });
    }
    
    return errors;
  }
  
  async validateModuleLoading(capabilities) {
    const errors = [];
    
    for (const capability of capabilities || []) {
      try {
        const module = await this.resourceManager.loadModule(capability.module);
        if (!module) throw new Error('Module not found');
      } catch (error) {
        errors.push({
          path: `agent.capabilities[${capability.module}]`,
          message: `Module loading failed: ${error.message}`,
          type: 'runtime',
          severity: 'warning',
          suggestion: 'Ensure module is installed and dependencies are met'
        });
      }
    }
    
    return errors;
  }
}
```

## Testing Framework

### Test Configuration Schema

```json
{
  "testing": {
    "scenarios": [
      {
        "name": "greeting_test",
        "description": "Test agent greeting behavior",
        "setup": {
          "state": {
            "userName": "TestUser"
          },
          "mocks": {
            "time": "2024-01-01T12:00:00Z"
          }
        },
        "steps": [
          {
            "input": {
              "type": "message",
              "content": "Hello"
            },
            "expectedOutput": {
              "assertions": [
                {
                  "type": "contains",
                  "value": "Hello TestUser"
                },
                {
                  "type": "responseTime",
                  "maxMs": 5000
                }
              ]
            }
          }
        ],
        "teardown": {
          "clearState": true
        }
      }
    ],
    "coverage": {
      "tools": ["all"],
      "prompts": ["all"],
      "behaviorPaths": ["all"]
    },
    "mocks": {
      "tools": {},
      "llm": {}
    }
  }
}
```

### Test Runner

```javascript
class AgentTestRunner {
  constructor(agentConfig, testConfig) {
    this.agentConfig = agentConfig;
    this.testConfig = testConfig || agentConfig.agent.testing;
    this.results = [];
    this.coverage = new CoverageTracker();
  }
  
  async runTests() {
    // Validate configuration first
    const validator = new ConfigValidator();
    const validation = await validator.validateConfig(this.agentConfig);
    
    if (!validation.valid) {
      return {
        success: false,
        validation,
        message: 'Configuration validation failed'
      };
    }
    
    // Create test agent
    const agent = await this.createTestAgent();
    
    // Run each scenario
    for (const scenario of this.testConfig.scenarios) {
      const result = await this.runScenario(agent, scenario);
      this.results.push(result);
    }
    
    // Generate report
    return this.generateReport();
  }
  
  async createTestAgent() {
    // Apply mocks to configuration
    const testConfig = this.applyMocks(this.agentConfig);
    
    // Create agent with test configuration
    const { ConfigurableAgent } = await import('@legion/configurable-agent');
    const agent = new ConfigurableAgent(testConfig);
    
    // Initialize with test context
    await agent.initialize();
    
    return agent;
  }
  
  async runScenario(agent, scenario) {
    const scenarioResult = {
      name: scenario.name,
      description: scenario.description,
      steps: [],
      passed: true,
      duration: 0
    };
    
    const startTime = Date.now();
    
    try {
      // Setup
      if (scenario.setup) {
        await this.applySetup(agent, scenario.setup);
      }
      
      // Execute steps
      for (const step of scenario.steps) {
        const stepResult = await this.executeStep(agent, step);
        scenarioResult.steps.push(stepResult);
        
        if (!stepResult.passed) {
          scenarioResult.passed = false;
          break;
        }
      }
      
      // Teardown
      if (scenario.teardown) {
        await this.applyTeardown(agent, scenario.teardown);
      }
      
    } catch (error) {
      scenarioResult.passed = false;
      scenarioResult.error = error.message;
    }
    
    scenarioResult.duration = Date.now() - startTime;
    return scenarioResult;
  }
  
  async executeStep(agent, step) {
    const stepResult = {
      input: step.input,
      expectedOutput: step.expectedOutput,
      actualOutput: null,
      assertions: [],
      passed: true
    };
    
    try {
      // Send input to agent
      const response = await agent.receive(step.input);
      stepResult.actualOutput = response;
      
      // Run assertions
      for (const assertion of step.expectedOutput.assertions) {
        const assertionResult = await this.runAssertion(response, assertion);
        stepResult.assertions.push(assertionResult);
        
        if (!assertionResult.passed) {
          stepResult.passed = false;
        }
      }
      
      // Track coverage
      this.coverage.track(response);
      
    } catch (error) {
      stepResult.passed = false;
      stepResult.error = error.message;
    }
    
    return stepResult;
  }
}
```

### Assertion Engine

```javascript
class AssertionEngine {
  constructor() {
    this.assertionTypes = new Map();
    this.registerBuiltInAssertions();
  }
  
  registerBuiltInAssertions() {
    // Content assertions
    this.register('contains', (output, expected) => {
      const content = this.extractContent(output);
      return content.includes(expected);
    });
    
    this.register('matches', (output, pattern) => {
      const content = this.extractContent(output);
      const regex = new RegExp(pattern);
      return regex.test(content);
    });
    
    // Structure assertions
    this.register('hasField', (output, field) => {
      return output?.[field] !== undefined;
    });
    
    this.register('schema', async (output, schema) => {
      const validator = new ZodValidator();
      const result = await validator.validate(output, schema);
      return result.success;
    });
    
    // Tool usage assertions
    this.register('toolsUsed', (output, expectedTools) => {
      const usedTools = output.metadata?.toolsUsed || [];
      return expectedTools.every(t => usedTools.includes(t));
    });
    
    // Performance assertions
    this.register('responseTime', (output, maxMs) => {
      const responseTime = output.metadata?.responseTime || 0;
      return responseTime <= maxMs;
    });
    
    // Sentiment assertions
    this.register('sentiment', async (output, expectedSentiment) => {
      const analyzer = new SentimentAnalyzer();
      const sentiment = await analyzer.analyze(this.extractContent(output));
      return sentiment === expectedSentiment;
    });
  }
  
  register(type, validator) {
    this.assertionTypes.set(type, validator);
  }
  
  async runAssertion(output, assertion) {
    const validator = this.assertionTypes.get(assertion.type);
    
    if (!validator) {
      return {
        type: assertion.type,
        passed: false,
        error: `Unknown assertion type: ${assertion.type}`
      };
    }
    
    try {
      const passed = await validator(output, assertion.value || assertion.expected);
      
      return {
        type: assertion.type,
        passed,
        expected: assertion.value || assertion.expected,
        actual: this.extractRelevantValue(output, assertion.type)
      };
    } catch (error) {
      return {
        type: assertion.type,
        passed: false,
        error: error.message
      };
    }
  }
  
  extractContent(output) {
    if (typeof output === 'string') return output;
    if (output.content) return output.content;
    if (output.message) return output.message;
    return JSON.stringify(output);
  }
  
  extractRelevantValue(output, assertionType) {
    switch (assertionType) {
      case 'toolsUsed':
        return output.metadata?.toolsUsed || [];
      case 'responseTime':
        return output.metadata?.responseTime || 0;
      default:
        return this.extractContent(output);
    }
  }
}
```

### Mock Provider

```javascript
class MockProvider {
  constructor(mockConfig) {
    this.config = mockConfig;
    this.toolMocks = new Map();
    this.llmMocks = new Map();
    this.setupMocks();
  }
  
  setupMocks() {
    // Setup tool mocks
    for (const [toolName, mockDef] of Object.entries(this.config.tools || {})) {
      this.toolMocks.set(toolName, this.createToolMock(mockDef));
    }
    
    // Setup LLM mocks
    for (const [pattern, response] of Object.entries(this.config.llm || {})) {
      this.llmMocks.set(pattern, response);
    }
  }
  
  createToolMock(mockDef) {
    return {
      execute: async (params) => {
        switch (mockDef.behavior) {
          case 'return':
            return mockDef.value;
          case 'echo':
            return params;
          case 'error':
            throw new Error(mockDef.error || 'Mock error');
          case 'delay':
            await new Promise(r => setTimeout(r, mockDef.delayMs));
            return mockDef.value;
          default:
            return mockDef;
        }
      }
    };
  }
  
  getMockTool(toolName) {
    return this.toolMocks.get(toolName);
  }
  
  getMockLLMResponse(input) {
    for (const [pattern, response] of this.llmMocks) {
      if (input.includes(pattern)) {
        return response;
      }
    }
    return null;
  }
}
```

### Coverage Tracker

```javascript
class CoverageTracker {
  constructor() {
    this.toolUsage = new Map();
    this.promptUsage = new Map();
    this.behaviorPaths = new Set();
    this.stateVariables = new Set();
  }
  
  track(response) {
    // Track tool usage
    if (response.metadata?.toolsUsed) {
      for (const tool of response.metadata.toolsUsed) {
        this.toolUsage.set(tool, (this.toolUsage.get(tool) || 0) + 1);
      }
    }
    
    // Track prompt usage
    if (response.metadata?.promptTemplate) {
      this.promptUsage.set(
        response.metadata.promptTemplate,
        (this.promptUsage.get(response.metadata.promptTemplate) || 0) + 1
      );
    }
    
    // Track behavior tree paths
    if (response.metadata?.behaviorPath) {
      this.behaviorPaths.add(response.metadata.behaviorPath);
    }
    
    // Track state variables
    if (response.metadata?.stateVariables) {
      Object.keys(response.metadata.stateVariables).forEach(v => 
        this.stateVariables.add(v)
      );
    }
  }
  
  getReport() {
    return {
      tools: {
        used: Array.from(this.toolUsage.keys()),
        usage: Object.fromEntries(this.toolUsage),
        coverage: this.calculateToolCoverage()
      },
      prompts: {
        used: Array.from(this.promptUsage.keys()),
        usage: Object.fromEntries(this.promptUsage),
        coverage: this.calculatePromptCoverage()
      },
      behaviorPaths: {
        covered: Array.from(this.behaviorPaths),
        coverage: this.calculatePathCoverage()
      },
      stateVariables: {
        accessed: Array.from(this.stateVariables),
        coverage: this.calculateStateCoverage()
      }
    };
  }
}
```

## Error Reporting

### Error Report Format

```javascript
class ErrorReporter {
  generateReport(validationResult, testResult) {
    return {
      timestamp: new Date().toISOString(),
      summary: {
        configValid: validationResult.valid,
        testsPass: testResult?.success || false,
        totalErrors: this.countErrors(validationResult),
        criticalErrors: this.countCriticalErrors(validationResult)
      },
      validation: {
        schema: this.formatValidationLevel(validationResult.results.schema),
        semantic: this.formatValidationLevel(validationResult.results.semantic),
        runtime: this.formatValidationLevel(validationResult.results.runtime)
      },
      testing: testResult ? {
        scenarios: testResult.scenarios,
        coverage: testResult.coverage,
        performance: testResult.performance
      } : null,
      regeneration: {
        canAutoFix: this.canAutoFix(validationResult),
        hints: validationResult.regenerationHints,
        prompt: this.generateRegenerationPrompt(validationResult)
      },
      recommendations: this.generateRecommendations(validationResult, testResult)
    };
  }
  
  formatValidationLevel(levelResult) {
    return {
      valid: levelResult.valid,
      errors: levelResult.errors?.map(e => ({
        path: e.path,
        message: e.message,
        severity: e.severity,
        suggestion: e.suggestion,
        fix: e.fix
      }))
    };
  }
  
  generateRegenerationPrompt(validationResult) {
    const errors = this.collectAllErrors(validationResult);
    
    return `
Please regenerate the agent configuration with the following fixes:

${errors.map(e => `
- ${e.path}: ${e.message}
  Suggestion: ${e.suggestion}
  ${e.fix ? `Fix: ${JSON.stringify(e.fix)}` : ''}
`).join('\n')}

Requirements:
1. All tool references must exist in capabilities
2. All template variables must be defined in state
3. All behavior tree nodes must reference valid tools
4. Knowledge graph schemas must be consistent
5. LLM configuration must be valid

Return a corrected JSON configuration.
    `;
  }
}
```

## Auto-Fix System

```javascript
class ConfigAutoFixer {
  async autoFix(config, validationResult) {
    let fixedConfig = JSON.parse(JSON.stringify(config));
    const appliedFixes = [];
    
    // Sort errors by fix priority
    const sortedErrors = this.sortByPriority(validationResult.errors);
    
    for (const error of sortedErrors) {
      if (error.fix && this.canApplyFix(error.fix)) {
        const result = await this.applyFix(fixedConfig, error);
        if (result.success) {
          fixedConfig = result.config;
          appliedFixes.push({
            path: error.path,
            type: error.fix.type,
            description: result.description
          });
        }
      }
    }
    
    // Re-validate fixed configuration
    const validator = new ConfigValidator();
    const revalidation = await validator.validateConfig(fixedConfig);
    
    return {
      success: revalidation.valid,
      config: fixedConfig,
      appliedFixes,
      remainingErrors: revalidation.errors,
      fixReport: this.generateFixReport(appliedFixes, revalidation)
    };
  }
  
  canApplyFix(fix) {
    const autoFixableTypes = [
      'replace',
      'remove',
      'add',
      'add_capability',
      'add_state_variable',
      'fix_schema_type'
    ];
    
    return autoFixableTypes.includes(fix.type);
  }
  
  async applyFix(config, error) {
    switch (error.fix.type) {
      case 'replace':
        return this.applyReplace(config, error.path, error.fix.value);
        
      case 'add_capability':
        return this.addCapability(config, error.fix.tool);
        
      case 'add_state_variable':
        return this.addStateVariable(config, error.fix.variable, error.fix.schema);
        
      case 'fix_schema_type':
        return this.fixSchemaType(config, error.path, error.fix.expectedType);
        
      default:
        return { success: false };
    }
  }
}
```

## Integration with Configurable Agent

The validator framework integrates with the configurable agent package:

```javascript
// Creating a validated agent
import { ConfigurableAgent } from '@legion/configurable-agent';
import { ConfigValidator, AgentTestRunner } from '@legion/agent-validator';

async function createValidatedAgent(config) {
  // Validate configuration
  const validator = new ConfigValidator();
  const validation = await validator.validateConfig(config);
  
  if (!validation.valid) {
    // Try auto-fix
    const fixer = new ConfigAutoFixer();
    const fixResult = await fixer.autoFix(config, validation);
    
    if (fixResult.success) {
      config = fixResult.config;
      console.log('Configuration auto-fixed:', fixResult.fixReport);
    } else {
      throw new Error('Configuration validation failed', {
        cause: validation
      });
    }
  }
  
  // Run tests if configured
  if (config.agent.testing) {
    const testRunner = new AgentTestRunner(config);
    const testResult = await testRunner.runTests();
    
    if (!testResult.success) {
      console.warn('Tests failed:', testResult);
    }
  }
  
  // Create agent
  return new ConfigurableAgent(config);
}
```

## Package Structure

```
packages/agents/agent-validator/
├── package.json
├── README.md
├── docs/
│   └── DESIGN.md
├── src/
│   ├── index.js
│   ├── validation/
│   │   ├── ConfigValidator.js
│   │   ├── SchemaValidator.js
│   │   ├── SemanticValidator.js
│   │   └── RuntimeValidator.js
│   ├── testing/
│   │   ├── AgentTestRunner.js
│   │   ├── ScenarioExecutor.js
│   │   ├── AssertionEngine.js
│   │   ├── MockProvider.js
│   │   └── CoverageTracker.js
│   ├── reporting/
│   │   ├── ErrorReporter.js
│   │   └── TestReporter.js
│   ├── fixing/
│   │   ├── ConfigAutoFixer.js
│   │   └── RegenerationHints.js
│   └── schemas/
│       ├── agent-config.schema.json
│       ├── test-scenario.schema.json
│       └── validation-rules.json
└── examples/
    ├── validation-examples/
    ├── test-scenarios/
    └── auto-fix-examples/
```

## Dependencies

```json
{
  "dependencies": {
    "@legion/schema": "workspace:*",
    "@legion/resource-manager": "workspace:*",
    "@legion/tools": "workspace:*",
    "@legion/configurable-agent": "workspace:*"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```