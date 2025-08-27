# Tool Registry Standardization and Testing Framework

## Executive Summary

The Legion tool registry currently faces significant challenges with module and tool standardization, metadata consistency, and automated testing. This document outlines a comprehensive solution to establish rigorous standards, enforce metadata compliance, and implement automated testing for all tools in the registry.

**Key Decision**: All schema validation throughout the tool registry will leverage the existing `@legion/schema` package, which provides robust JSON Schema to Zod conversion. This ensures:
- Consistent validation across all tools and modules
- Type-safe runtime validation with detailed error messages
- Reuse of existing, well-tested validation infrastructure
- Unified approach to schema handling throughout the Legion framework

## Current State Analysis

### 1. Issues Identified

#### 1.1 Inconsistent Module Standards

**Problem**: Modules across the Legion framework follow different patterns and standards, leading to integration difficulties and unpredictable behavior.

**Evidence**:
- Some modules properly extend the base `Module` class from `@legion/tools-registry`
- Others implement custom base classes (e.g., NodeRunner has its own `Tool.js` at `/base/Tool.js`)
- Missing required methods in some modules (e.g., some lack proper `getTools()` implementation)
- Inconsistent constructor patterns (some use ResourceManager, others don't)

**Impact**:
- Module loading failures
- Unpredictable tool discovery
- Integration complexity
- Maintenance overhead

#### 1.2 Module Discovery Limitations

**Problem**: The current `ModuleDiscovery` class has rigid patterns and incomplete validation.

**Evidence**:
```javascript
// Current implementation only finds files ending with Module.js
modulePattern: /Module\.js$/

// Hardcoded exclusions
if (entry.name === 'Module.js' && (
  fullPath.includes('/tools-registry/src/core/Module.js') ||
  fullPath.includes('/node-runner/src/base/Module.js') ||
  fullPath.includes('/tools-registry-obsolete/')
)) {
  continue;
}
```

**Impact**:
- Modules with different naming conventions are missed
- No validation during discovery phase
- Silent failures when modules don't comply with interface
- Incomplete module inventory

#### 1.3 Metadata Inconsistencies

**Problem**: Tools and modules lack consistent, complete metadata.

**Evidence**:
- Some tools have `inputSchema` property, others use `schema.input`
- Missing critical metadata fields (description, version, author)
- No enforcement of metadata requirements
- Inconsistent schema formats (JSON Schema vs custom formats)

**Examples**:
```javascript
// Pattern 1: Direct properties
this.inputSchema = { type: 'object', properties: {...} }
this.outputSchema = { type: 'object', properties: {...} }

// Pattern 2: Nested schema
this.schema = {
  input: { type: 'object', properties: {...} },
  output: { type: 'object', properties: {...} }
}

// Pattern 3: Constructor config
super({
  name: 'tool-name',
  description: 'description',
  inputSchema: {...},
  outputSchema: {...}
})
```

**Impact**:
- Tools cannot be properly documented
- Semantic search fails due to missing descriptions
- Parameter validation is inconsistent
- API generation is impossible

#### 1.4 Testing Infrastructure Gaps

**Problem**: No automated testing framework for tool execution and validation.

**Current State**:
- Manual testing only
- No execution verification
- No parameter validation testing
- No output schema compliance checks
- No integration testing for tool interactions

**Impact**:
- Tools may not work as advertised
- Runtime failures in production
- No confidence in tool reliability
- Difficult to identify breaking changes

## Proposed Solution

### 2. Architecture Overview

```
packages/tools-registry/src/verification/
├── MetadataManager.js        # Centralized metadata management
├── ToolValidator.js          # Runtime validation engine (uses @legion/schema)
├── ToolTester.js            # Automated testing framework
├── TestRunner.js            # Test orchestration
├── ReportGenerator.js       # Compliance reporting
├── AutoFixer.js            # Automated issue resolution
└── schemas/
    ├── ModuleSchema.js      # Standard module definition (JSON Schema format)
    ├── ToolSchema.js        # Standard tool definition (JSON Schema format)
    └── TestCaseSchema.js    # Test case structure (JSON Schema format)
```

**Key Integration**: All schema validation will use the existing `@legion/schema` package which provides:
- JSON Schema to Zod conversion via `jsonSchemaToZod`
- Robust validation with `createValidator` and `ZodValidator`
- Type coercion and custom format support
- Detailed error reporting with path information

### 3. Component Specifications

#### 3.1 MetadataManager

**Purpose**: Centralize and standardize all metadata operations.

**Responsibilities**:
- Define canonical metadata schemas
- Validate metadata compliance
- Generate missing metadata through code analysis
- Provide metadata transformation utilities
- Track metadata quality metrics

**Key Methods**:
```javascript
import { createValidator, jsonSchemaToZod } from '@legion/schema';
import { ModuleMetadataSchema, ToolMetadataSchema } from './schemas/index.js';

class MetadataManager {
  constructor() {
    // Create validators using @legion/schema
    this.moduleValidator = createValidator(ModuleMetadataSchema);
    this.toolValidator = createValidator(ToolMetadataSchema);
  }
  
  // Validation using @legion/schema
  validateModuleMetadata(module) {
    return this.moduleValidator.validate(module);
  }
  
  validateToolMetadata(tool) {
    return this.toolValidator.validate(tool);
  }
  
  // Generation
  generateMissingMetadata(entity, type)
  inferMetadataFromCode(filePath)
  
  // Standardization
  standardizeSchema(schema, format) {
    // Convert any schema format to JSON Schema
    // Then use jsonSchemaToZod for validation
  }
  normalizeMetadata(metadata)
  
  // Quality Assessment
  calculateComplianceScore(metadata)
  generateComplianceReport(modules)
  
  // Auto-fixing
  suggestMetadataFixes(metadata)
  applyMetadataFixes(metadata, fixes)
}
```

**Metadata Standards**:
```javascript
// Required Module Metadata
{
  name: string,           // Unique identifier
  version: string,        // Semantic version
  description: string,    // Clear purpose description
  author: string,         // Author/team name
  keywords: string[],     // Searchable keywords
  dependencies: object,   // Required dependencies
  toolCount: number,      // Number of tools provided
  status: string,         // loaded|discovered|error
  lastUpdated: Date,      // Last modification
  compliance: {
    score: number,        // 0-100 compliance score
    issues: string[]      // List of compliance issues
  }
}

// Required Tool Metadata
{
  name: string,           // Unique tool identifier
  description: string,    // Clear tool purpose
  version: string,        // Tool version
  category: string,       // Tool category
  keywords: string[],     // Searchable keywords
  author: string,         // Tool author
  inputSchema: object,    // JSON Schema for input
  outputSchema: object,   // JSON Schema for output
  examples: object[],     // Usage examples
  testCases: object[],    // Test cases for validation
  performance: {
    timeout: number,      // Max execution time (ms)
    memory: number,       // Max memory usage (MB)
  },
  compliance: {
    score: number,        // 0-100 compliance score
    validated: boolean,   // Has been validated
    tested: boolean,      // Has been tested
    issues: string[]      // List of issues
  }
}
```

#### 3.2 ToolValidator

**Purpose**: Validate tool implementation and interface compliance.

**Responsibilities**:
- Verify tool interface implementation
- Validate execute method signature
- Check schema compliance
- Validate parameter types
- Ensure error handling

**Validation Levels**:
```javascript
import { createValidator, jsonSchemaToZod, ZodValidator } from '@legion/schema';

class ToolValidator {
  constructor() {
    // Validator for tool interface compliance
    this.interfaceValidator = createValidator(ToolInterfaceSchema);
  }
  
  // Interface Validation
  validateInterface(tool) {
    // Use @legion/schema to validate tool structure
    return this.interfaceValidator.validate(tool);
  }
  
  // Schema Validation using @legion/schema
  validateSchemas(tool) {
    try {
      // Validate that inputSchema is valid JSON Schema
      const inputValidator = new ZodValidator(tool.inputSchema);
      const outputValidator = new ZodValidator(tool.outputSchema);
      
      return {
        valid: true,
        inputSchemaValid: true,
        outputSchemaValid: true
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
  
  // Runtime Validation with schema enforcement
  async validateExecution(tool, testParams) {
    // Create validator from tool's schema
    const inputValidator = jsonSchemaToZod(tool.inputSchema);
    const outputValidator = jsonSchemaToZod(tool.outputSchema);
    
    // Validate input
    const validInput = inputValidator.parse(testParams);
    
    // Execute tool
    const result = await tool.execute(validInput);
    
    // Validate output
    const validOutput = outputValidator.parse(result);
    
    return { success: true, output: validOutput };
  }
  
  // Error Handling Validation
  validateErrorHandling(tool) {
    // Test with invalid params using schema validation
    const validator = createValidator(tool.inputSchema);
    // Generate invalid test cases based on schema
    // Test tool's error handling
  }
  
  // Performance Validation
  validatePerformance(tool, testParams) {
    // Measure execution time
    // Check memory usage
    // Test timeout handling
  }
}
```

**Validation Rules**:
1. All tools must have an `execute` method
2. All tools must have valid `inputSchema` and `outputSchema`
3. Execute method must be async or return a Promise
4. Tools must handle errors gracefully
5. Tools must emit appropriate events (progress, info, error)
6. Tools must respect timeout constraints
7. Tools must validate input parameters

#### 3.3 ToolTester

**Purpose**: Automated testing framework for tool execution.

**Responsibilities**:
- Generate test cases from schemas
- Execute tools with test data
- Validate outputs against schemas
- Measure performance metrics
- Generate test reports

**Testing Framework**:
```javascript
import { createValidator, jsonSchemaToZod } from '@legion/schema';
import { generateTestDataFromSchema } from './utils/TestDataGenerator.js';

class ToolTester {
  // Test Case Generation from JSON Schema
  generateTestCases(tool) {
    const inputValidator = jsonSchemaToZod(tool.inputSchema);
    
    // Use schema to generate test data
    const validCases = generateTestDataFromSchema(tool.inputSchema, 'valid');
    const edgeCases = generateTestDataFromSchema(tool.inputSchema, 'edge');
    const invalidCases = generateTestDataFromSchema(tool.inputSchema, 'invalid');
    
    return {
      valid: validCases.map(input => ({
        name: `Valid case: ${JSON.stringify(input)}`,
        input,
        shouldPass: true,
        validator: inputValidator
      })),
      edge: edgeCases.map(input => ({
        name: `Edge case: ${JSON.stringify(input)}`,
        input,
        shouldPass: true,
        validator: inputValidator
      })),
      invalid: invalidCases.map(input => ({
        name: `Invalid case: ${JSON.stringify(input)}`,
        input,
        shouldPass: false,
        validator: inputValidator
      }))
    };
  }
  
  // Test Execution with schema validation
  async runTests(tool, testCases) {
    const outputValidator = createValidator(tool.outputSchema);
    const results = [];
    
    for (const testCase of testCases) {
      try {
        // Validate input first
        if (testCase.validator) {
          const inputValidation = testCase.validator.safeParse(testCase.input);
          if (!inputValidation.success && testCase.shouldPass) {
            results.push({
              ...testCase,
              success: false,
              error: 'Input validation failed'
            });
            continue;
          }
        }
        
        // Execute tool
        const startTime = Date.now();
        const output = await tool.execute(testCase.input);
        const executionTime = Date.now() - startTime;
        
        // Validate output
        const outputValidation = outputValidator.validate(output);
        
        results.push({
          ...testCase,
          success: outputValidation.valid,
          output: outputValidation.data,
          errors: outputValidation.errors,
          executionTime
        });
      } catch (error) {
        results.push({
          ...testCase,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  // Validation using @legion/schema
  validateResults(results, expectedSchema) {
    const validator = createValidator(expectedSchema);
    return results.map(result => ({
      ...result,
      outputValid: validator.isValid(result.output)
    }));
  }
  
  // Reporting
  generateTestReport(tool, results) {
    // Success/failure summary
    // Performance metrics
    // Coverage analysis
    // Recommendations
  }
  
  // Integration Testing
  async testToolIntegration(tool1, tool2) {
    // Test tool chaining with schema validation
    // Output of tool1 must match input schema of tool2
    const tool1OutputValidator = createValidator(tool1.outputSchema);
    const tool2InputValidator = createValidator(tool2.inputSchema);
    
    // Test compatibility
    // ...implementation
  }
}
```

**Test Case Structure**:
```javascript
{
  name: string,           // Test case name
  description: string,    // Test purpose
  input: object,         // Input parameters
  expectedOutput: {
    schema: object,      // Expected schema compliance
    values: object,      // Expected values (optional)
    constraints: object  // Output constraints
  },
  performance: {
    maxTime: number,     // Maximum execution time
    maxMemory: number    // Maximum memory usage
  },
  shouldFail: boolean,   // Whether test should fail
  errorMessage: string   // Expected error (if shouldFail)
}
```

#### 3.4 TestRunner

**Purpose**: Orchestrate comprehensive testing across all modules and tools.

**Responsibilities**:
- Discover all modules and tools
- Run validation suite
- Execute test suite
- Aggregate results
- Generate reports

**Orchestration Flow**:
```javascript
class TestRunner {
  async runCompletePipeline(options = {}) {
    // Phase 1: Discovery
    const modules = await this.discoverModules();
    
    // Phase 2: Load and Validate
    const loadedModules = await this.loadModules(modules);
    const validationResults = await this.validateModules(loadedModules);
    
    // Phase 3: Test Execution
    const testResults = await this.testAllTools(loadedModules);
    
    // Phase 4: Integration Tests
    const integrationResults = await this.runIntegrationTests();
    
    // Phase 5: Report Generation
    const report = await this.generateComprehensiveReport({
      modules,
      validationResults,
      testResults,
      integrationResults
    });
    
    return report;
  }
  
  // Parallel Execution
  async testModulesConcurrently(modules, concurrency = 5) {
    // Batch modules for parallel testing
    // Manage resource constraints
    // Handle failures gracefully
  }
  
  // Continuous Testing
  async watchAndTest(options) {
    // Monitor file changes
    // Re-run affected tests
    // Update reports incrementally
  }
}
```

#### 3.5 ReportGenerator

**Purpose**: Generate comprehensive compliance and test reports.

**Report Types**:
1. **Compliance Report**: Metadata and standard compliance
2. **Test Report**: Test execution results
3. **Performance Report**: Performance metrics and bottlenecks
4. **Integration Report**: Tool interaction compatibility
5. **Executive Summary**: High-level overview for stakeholders

**Report Structure**:
```javascript
{
  timestamp: Date,
  summary: {
    totalModules: number,
    totalTools: number,
    complianceScore: number,  // 0-100
    testCoverage: number,      // 0-100
    successRate: number,       // 0-100
    criticalIssues: number,
    warnings: number
  },
  modules: [{
    name: string,
    complianceScore: number,
    tools: [{
      name: string,
      status: string,
      complianceScore: number,
      testResults: object,
      issues: string[]
    }]
  }],
  recommendations: [{
    priority: string,      // critical|high|medium|low
    module: string,
    tool: string,
    issue: string,
    solution: string,
    autoFixable: boolean
  }],
  trends: {
    complianceHistory: object[],
    testHistory: object[],
    performanceHistory: object[]
  }
}
```

#### 3.6 AutoFixer

**Purpose**: Automatically fix common issues where possible.

**Capabilities**:
- Add missing metadata fields
- Standardize schema formats
- Fix method signatures
- Add error handling
- Generate documentation

**Auto-fix Rules**:
```javascript
class AutoFixer {
  // Metadata Fixes
  async fixMissingMetadata(module) {
    // Add default version
    // Generate description from code
    // Infer keywords from tool names
    // Add author from git history
  }
  
  // Schema Fixes
  async standardizeSchemas(tool) {
    // Convert to JSON Schema format
    // Add missing type definitions
    // Fix property constraints
    // Add examples
  }
  
  // Code Fixes
  async fixInterfaceIssues(module) {
    // Add missing methods
    // Fix method signatures
    // Add error handling
    // Implement event emitters
  }
  
  // Documentation
  async generateDocumentation(module) {
    // Create README
    // Generate API docs
    // Add inline comments
    // Create examples
  }
}
```

### 4. Implementation Plan

#### Phase 1: Foundation (Week 1)
1. Create verification directory structure
2. Implement ModuleSchema and ToolSchema
3. Develop MetadataManager base functionality
4. Write unit tests for schemas

#### Phase 2: Validation (Week 2)
1. Implement ToolValidator
2. Create validation rule engine
3. Develop compliance scoring
4. Add validation tests

#### Phase 3: Testing Framework (Week 3)
1. Implement ToolTester
2. Create test case generator
3. Build test execution engine
4. Develop result validators

#### Phase 4: Orchestration (Week 4)
1. Implement TestRunner
2. Create parallel execution
3. Build report generator
4. Add progress tracking

#### Phase 5: Auto-fixing (Week 5)
1. Implement AutoFixer
2. Create fix rule engine
3. Build safe fix application
4. Add rollback capability

#### Phase 6: Integration (Week 6)
1. Integrate with existing pipeline
2. Update scripts
3. Create CI/CD integration
4. Documentation and training

### 5. Migration Strategy

#### 5.1 Gradual Adoption
1. **Phase 1**: Run validation in report-only mode
2. **Phase 2**: Fix critical issues identified
3. **Phase 3**: Enable enforcement for new modules
4. **Phase 4**: Migrate existing modules
5. **Phase 5**: Full enforcement

#### 5.2 Backward Compatibility
- Support both old and new metadata formats initially
- Provide migration utilities
- Maintain compatibility layer for 3 months
- Gradual deprecation of old patterns

#### 5.3 Module Migration Checklist
- [ ] Update to extend base Module class
- [ ] Implement static create() method
- [ ] Add complete metadata
- [ ] Standardize tool schemas
- [ ] Add test cases
- [ ] Update documentation
- [ ] Run validation suite
- [ ] Fix identified issues
- [ ] Submit for review

### 6. Success Metrics

#### 6.1 Compliance Metrics
- **Target**: 95% compliance score across all modules
- **Measurement**: Weekly automated reports
- **Key Indicators**:
  - Metadata completeness
  - Schema compliance
  - Interface implementation
  - Test coverage

#### 6.2 Quality Metrics
- **Test Coverage**: 90% of tools have automated tests
- **Success Rate**: 98% test pass rate
- **Performance**: All tools execute within defined timeouts
- **Reliability**: <1% failure rate in production

#### 6.3 Development Metrics
- **Time to Add Tool**: Reduced by 50%
- **Debug Time**: Reduced by 70%
- **Documentation Coverage**: 100%
- **Onboarding Time**: Reduced by 60%

### 7. Risk Management

#### 7.1 Technical Risks
- **Risk**: Breaking existing functionality
  - **Mitigation**: Comprehensive testing, gradual rollout
- **Risk**: Performance degradation
  - **Mitigation**: Performance benchmarks, optimization
- **Risk**: Increased complexity
  - **Mitigation**: Clear documentation, training

#### 7.2 Adoption Risks
- **Risk**: Developer resistance
  - **Mitigation**: Clear benefits, auto-fixing tools
- **Risk**: Migration delays
  - **Mitigation**: Phased approach, support resources

### 8. Schema Integration with @legion/schema

The `@legion/schema` package is central to all validation in the standardized tool registry. It provides:

#### 8.1 Core Features Used
- **JSON Schema to Zod Conversion**: All JSON Schemas are converted to Zod validators for runtime validation
- **Type Coercion**: Optional type coercion for flexible input handling
- **Custom Formats**: Support for custom format validators (email, url, uuid, etc.)
- **Detailed Error Reporting**: Path-based error messages for debugging

#### 8.2 Usage Patterns

```javascript
// In tools - validate input parameters
import { jsonSchemaToZod } from '@legion/schema';

class MyTool extends Tool {
  constructor() {
    super();
    this.inputSchema = { /* JSON Schema */ };
    this.validator = jsonSchemaToZod(this.inputSchema);
  }
  
  async execute(params) {
    // Parse validates and returns typed data
    const validatedParams = this.validator.parse(params);
    // ... tool execution
  }
}

// In verification - validate metadata
import { createValidator } from '@legion/schema';

const moduleMetadataValidator = createValidator({
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    description: { type: 'string', minLength: 10 }
  },
  required: ['name', 'version', 'description']
});

// Validate with detailed errors
const result = moduleMetadataValidator.validate(moduleData);
if (!result.valid) {
  console.log('Validation errors:', result.errors);
  // errors: [{ path: 'version', message: '...', code: '...' }]
}
```

### 9. Example Implementations

#### 9.1 Compliant Module Example
```javascript
import { Module } from '@legion/tools-registry';
import { CalculatorTool } from './tools/CalculatorTool.js';

export default class CalculatorModule extends Module {
  constructor() {
    super();
    this.name = 'calculator';
    this.version = '1.0.0';
    this.description = 'Mathematical calculation tools for arithmetic operations';
    this.author = 'Legion Team';
    this.keywords = ['math', 'calculator', 'arithmetic'];
  }

  static async create(resourceManager) {
    const module = new CalculatorModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  async initialize() {
    await super.initialize();
    
    // Register tools with complete metadata
    const calculatorTool = new CalculatorTool();
    this.registerTool(calculatorTool.name, calculatorTool);
  }
}
```

#### 9.2 Compliant Tool Example with @legion/schema
```javascript
import { Tool } from '@legion/tools-registry';
import { jsonSchemaToZod } from '@legion/schema';

export class CalculatorTool extends Tool {
  constructor() {
    super({
      name: 'calculator',
      description: 'Evaluates mathematical expressions safely',
      version: '1.0.0',
      category: 'mathematics',
      keywords: ['math', 'calculate', 'evaluate'],
      author: 'Legion Team',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate',
            minLength: 1,
            examples: ['2+2', 'Math.sqrt(16)', '(10+5)*3']
          }
        },
        required: ['expression'],
        additionalProperties: false
      },
      outputSchema: {
        type: 'object',
        properties: {
          result: {
            type: 'number',
            description: 'Calculation result'
          },
          expression: {
            type: 'string',
            description: 'Original expression'
          }
        },
        required: ['result', 'expression'],
        additionalProperties: false
      },
      examples: [
        {
          input: { expression: '2+2' },
          output: { result: 4, expression: '2+2' }
        }
      ],
      testCases: [
        {
          name: 'Basic addition',
          input: { expression: '5+3' },
          expectedOutput: { result: 8, expression: '5+3' }
        },
        {
          name: 'Invalid input',
          input: { expression: '' },
          shouldFail: true
        }
      ],
      performance: {
        timeout: 5000,
        memory: 50
      }
    });
    
    // Create validators using @legion/schema
    this.inputValidator = jsonSchemaToZod(this.inputSchema);
    this.outputValidator = jsonSchemaToZod(this.outputSchema);
  }

  async execute(params) {
    // Validate input using @legion/schema
    let validatedParams;
    try {
      validatedParams = this.inputValidator.parse(params);
    } catch (error) {
      this.error('Input validation failed', { error: error.errors });
      throw new Error(`Validation failed: ${error.message}`);
    }

    // Emit progress
    this.progress('Starting calculation', 0);

    try {
      // Execute calculation
      const result = Function('"use strict"; return (' + validatedParams.expression + ')')();
      
      // Validate output before returning
      const output = {
        result,
        expression: validatedParams.expression
      };
      
      // Validate output schema
      const validatedOutput = this.outputValidator.parse(output);
      
      // Emit completion
      this.progress('Calculation complete', 100);
      
      return validatedOutput;
    } catch (error) {
      this.error('Calculation failed', { error: error.message });
      throw new Error(`Failed to evaluate expression: ${error.message}`);
    }
  }
}
```

### 10. Conclusion

This comprehensive standardization and testing framework will transform the Legion tool registry from a loosely coupled collection of tools into a robust, reliable, and maintainable system. By enforcing standards, ensuring complete metadata, and implementing automated testing, we will significantly improve:

1. **Reliability**: All tools will be tested and validated
2. **Discoverability**: Complete metadata enables better search
3. **Maintainability**: Consistent patterns reduce complexity
4. **Documentation**: Auto-generated from metadata
5. **Developer Experience**: Clear standards and automated tooling

The phased implementation approach ensures minimal disruption while gradually improving the entire system. With automated testing and compliance reporting, we can maintain high quality standards as the framework grows.

## Appendices

### Appendix A: Script Specifications

#### verify-modules.js
```bash
# Check all modules for compliance
node scripts/verify-modules.js

# Check specific module
node scripts/verify-modules.js --module calculator

# Auto-fix issues
node scripts/verify-modules.js --fix

# Generate detailed report
node scripts/verify-modules.js --report detailed
```

#### test-tools.js
```bash
# Test all tools
node scripts/test-tools.js

# Test specific tool
node scripts/test-tools.js --tool calculator

# Run performance tests
node scripts/test-tools.js --performance

# Generate test coverage
node scripts/test-tools.js --coverage
```

### Appendix B: Configuration Schema

```javascript
// .toolregistryrc.json
{
  "validation": {
    "enforceCompliance": true,
    "minimumScore": 80,
    "autoFix": true
  },
  "testing": {
    "runOnCommit": true,
    "coverage": 90,
    "parallel": true,
    "timeout": 30000
  },
  "metadata": {
    "requireComplete": true,
    "inferMissing": true,
    "standardFormat": "jsonschema"
  },
  "reporting": {
    "format": "html",
    "outputDir": "./reports",
    "includeHistory": true
  }
}
```

### Appendix C: Error Codes

| Code | Description | Severity | Auto-fixable |
|------|-------------|----------|--------------|
| TR001 | Missing module name | Critical | Yes |
| TR002 | Missing module description | High | Yes |
| TR003 | Invalid module version | High | Yes |
| TR004 | Missing static create() | Critical | No |
| TR005 | Missing getTools() | Critical | No |
| TR006 | Invalid tool schema | High | Partial |
| TR007 | Missing tool execute() | Critical | No |
| TR008 | Invalid schema format | Medium | Yes |
| TR009 | Missing test cases | Medium | Partial |
| TR010 | Performance violation | High | No |

### Appendix D: Performance Benchmarks

| Operation | Target Time | Max Memory | Timeout |
|-----------|------------|------------|---------|
| Module Discovery | <500ms | 50MB | 5s |
| Module Loading | <100ms | 25MB | 2s |
| Tool Validation | <50ms | 10MB | 1s |
| Tool Execution | <1000ms | 100MB | 30s |
| Test Suite | <5min | 500MB | 10min |
| Report Generation | <30s | 200MB | 60s |

---

*Document Version: 1.0.0*
*Last Updated: 2025-01-27*
*Author: Legion Framework Team*