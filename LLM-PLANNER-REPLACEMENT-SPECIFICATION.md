# LLM Planner Replacement Specification

## Executive Summary

This specification outlines the complete replacement of 6 specialized planner classes in the code-agent package with calls to the LLM planner. The LLM planner has been verified to work with real LLM providers and can generate comprehensive plans that match the complexity and functionality of the existing hardcoded planners.

## Current State Analysis

### ✅ **LLM Planner Status: READY**

The LLM planner package is production-ready with:
- **85% test coverage** with 354 passing tests
- **Complete LLM integration** with multiple providers (OpenAI, Anthropic, DeepSeek, OpenRouter)
- **Robust validation system** with multi-layer validation
- **Comprehensive architecture** with proper abstractions
- **Verified plan generation** - successfully generates complex, structured plans using real LLMs

### 📋 **Specialized Planners to Replace**

The following 6 specialized planner classes need to be replaced with LLM-based implementations:

| Planner Class | Lines of Code | Purpose | Complexity | Integration Point |
|---------------|---------------|---------|------------|-------------------|
| `RequirementAnalyzer` | 577 | Converts natural language requirements to structured analysis | Medium | CodeAgent.planProject() |
| `DirectoryPlanner` | 475 | Plans project directory structures based on complexity | Medium | CodeAgent.planProject() |
| `DependencyPlanner` | 803 | Plans file creation order using topological sorting | High | CodeAgent.planProject() |
| `FrontendArchitecturePlanner` | 822 | Plans frontend architecture and component hierarchy | High | CodeAgent.planProject() |
| `BackendArchitecturePlanner` | 1,236 | Plans backend architecture and service design | High | CodeAgent.planProject() |
| `APIInterfacePlanner` | 1,232 | Plans API interfaces and data transfer objects | High | CodeAgent.planProject() |

**Total**: 5,145 lines of hardcoded planning logic to be replaced with LLM-based planning.

## Integration Points

### Current Code Agent Architecture

The CodeAgent class (lines 246-261) has a `planProject()` method with TODO comments indicating where these planners should be integrated:

```javascript
async planProject(requirements) {
  // TODO: Implement project planning logic
  // - Analyze requirements          ← RequirementAnalyzer
  // - Determine project structure   ← DirectoryPlanner
  // - Plan file organization        ← DependencyPlanner  
  // - Design API interfaces         ← APIInterfacePlanner
  //   (if fullstack)
  
  this.projectPlan = {
    structure: {},
    files: [],
    dependencies: [],
    architecture: this.config.projectType
  };
}
```

### Expected Integration Flow

1. **RequirementAnalyzer** → Parse natural language requirements
2. **DirectoryPlanner** → Plan directory structure based on analysis
3. **DependencyPlanner** → Determine file creation order
4. **FrontendArchitecturePlanner** → Plan frontend architecture (if applicable)
5. **BackendArchitecturePlanner** → Plan backend architecture (if applicable)
6. **APIInterfacePlanner** → Plan API interfaces (if fullstack)

## Detailed Planner Analysis

### 1. RequirementAnalyzer

**Current Functionality:**
- Parses natural language requirements into structured analysis
- Extracts features from text using keyword matching
- Determines project type (frontend/backend/fullstack)
- Analyzes complexity based on feature count
- Generates architecture suggestions

**LLM Replacement Strategy:**
- Single LLM call with comprehensive analysis prompt
- Parse response into structured format matching existing schema
- Maintain exact output format for compatibility

**Key Methods to Replace:**
- `analyzeRequirements()` - Main analysis method
- `extractFeatures()` - Feature extraction from text
- `determineComplexity()` - Complexity assessment
- `suggestArchitecture()` - Architecture suggestions

### 2. DirectoryPlanner

**Current Functionality:**
- Creates directory structures based on project type and complexity
- Uses predefined templates (simple/modular/layered)
- Adds feature-specific directories
- Adds technology-specific structure

**LLM Replacement Strategy:**
- Template-based prompting with examples
- Generate directory structures based on analysis
- Include descriptions and validation

**Key Methods to Replace:**
- `planDirectoryStructure()` - Main planning method
- `_applyBaseStructure()` - Template application
- `_addFeatureSpecificDirectories()` - Feature-based additions

### 3. DependencyPlanner

**Current Functionality:**
- Plans file creation order using topological sorting
- Analyzes dependencies between files
- Generates parallel execution groups
- Resolves circular dependencies

**LLM Replacement Strategy:**
- Dependency reasoning through prompts
- Generate creation order based on architectural patterns
- Include validation and conflict resolution

**Key Methods to Replace:**
- `planDependencies()` - Main dependency planning
- `_generateCreationOrder()` - Topological sorting
- `_generateParallelGroups()` - Parallel execution planning

### 4. FrontendArchitecturePlanner

**Current Functionality:**
- Plans component hierarchy and relationships
- Designs state management patterns
- Plans styling architecture
- Generates routing configuration

**LLM Replacement Strategy:**
- Component planning through architectural reasoning
- Generate hierarchies based on features and complexity
- Include state management and styling patterns

**Key Methods to Replace:**
- `planArchitecture()` - Main architecture planning
- `planComponents()` - Component planning
- `planStateManagement()` - State management patterns
- `planStyling()` - Styling architecture

### 5. BackendArchitecturePlanner

**Current Functionality:**
- Plans API design and endpoints
- Designs data layer architecture
- Plans service organization
- Generates middleware stack
- Plans security and performance

**LLM Replacement Strategy:**
- Comprehensive backend architecture planning
- Generate layered architectures with proper separation
- Include security and performance considerations

**Key Methods to Replace:**
- `planArchitecture()` - Main architecture planning
- `planApiDesign()` - API structure planning
- `planDataLayer()` - Data layer architecture
- `planServices()` - Service organization
- `planMiddleware()` - Middleware stack
- `planSecurity()` - Security architecture

### 6. APIInterfacePlanner

**Current Functionality:**
- Plans API contracts and endpoints
- Generates Data Transfer Objects (DTOs)
- Plans communication patterns
- Designs error handling
- Plans authentication interfaces

**LLM Replacement Strategy:**
- API contract generation through structured prompts
- Generate DTOs and interface specifications
- Include validation and error handling patterns

**Key Methods to Replace:**
- `planInterfaces()` - Main interface planning
- `planApiContracts()` - API contract generation
- `generateDTOs()` - Data transfer object creation
- `planCommunication()` - Communication patterns
- `planErrorHandling()` - Error handling design

## Test Coverage Analysis

### Current Test Coverage

Each planner has comprehensive test coverage:

- **RequirementAnalyzer**: 35 tests covering requirements analysis, feature extraction, complexity determination
- **DirectoryPlanner**: Tests for structure generation, feature-specific directories, validation
- **DependencyPlanner**: Tests for topological sorting, parallel execution, circular dependency resolution
- **FrontendArchitecturePlanner**: Tests for component planning, state management, styling
- **BackendArchitecturePlanner**: Tests for API design, data layer, security, performance
- **APIInterfacePlanner**: Tests for contract generation, DTOs, communication patterns

**Total**: 100+ comprehensive tests that must pass with LLM implementations.

### Test Preservation Requirements

**Critical**: All existing tests must continue to pass with LLM implementations. This requires:

1. **Exact Output Format Matching**: LLM responses must be parsed into the exact same data structures
2. **Deterministic Responses**: Use temperature=0 and response caching for consistent test results
3. **Mock LLM Responses**: Create deterministic mock responses for each test scenario
4. **Schema Validation**: Implement strict JSON schema validation for LLM outputs

## Implementation Strategy

### Phase 1: Create LLMPlanner Integration Class

```javascript
// src/planning/LLMPlanner.js
class LLMPlanner {
  constructor(llmClient, config = {}) {
    this.llmClient = llmClient;
    this.config = config;
  }

  async analyzeRequirements(requirements) {
    // Replace RequirementAnalyzer with LLM call
  }

  async planDirectoryStructure(analysis) {
    // Replace DirectoryPlanner with LLM call
  }

  async planDependencies(structure, analysis) {
    // Replace DependencyPlanner with LLM call
  }

  async planFrontendArchitecture(analysis) {
    // Replace FrontendArchitecturePlanner with LLM call
  }

  async planBackendArchitecture(analysis) {
    // Replace BackendArchitecturePlanner with LLM call
  }

  async planAPIInterfaces(frontendArch, backendArch) {
    // Replace APIInterfacePlanner with LLM call
  }
}
```

### Phase 2: Update CodeAgent Integration

```javascript
// src/index.js - Update planProject method
async planProject(requirements) {
  const llmPlanner = new LLMPlanner(this.llmClient);
  
  // 1. Analyze requirements
  const analysis = await llmPlanner.analyzeRequirements(requirements);
  
  // 2. Plan directory structure
  const structure = await llmPlanner.planDirectoryStructure(analysis);
  
  // 3. Plan dependencies
  const dependencies = await llmPlanner.planDependencies(structure, analysis);
  
  // 4. Plan architectures
  let frontendArch, backendArch, apiInterface;
  
  if (analysis.projectType === 'frontend' || analysis.projectType === 'fullstack') {
    frontendArch = await llmPlanner.planFrontendArchitecture(analysis);
  }
  
  if (analysis.projectType === 'backend' || analysis.projectType === 'fullstack') {
    backendArch = await llmPlanner.planBackendArchitecture(analysis);
  }
  
  if (analysis.projectType === 'fullstack') {
    apiInterface = await llmPlanner.planAPIInterfaces(frontendArch, backendArch);
  }
  
  this.projectPlan = {
    analysis,
    structure,
    dependencies,
    frontendArchitecture: frontendArch,
    backendArchitecture: backendArch,
    apiInterface
  };
}
```

### Phase 3: Prompt Engineering

Create comprehensive prompts for each planning domain:

1. **Requirements Analysis Prompt**: Convert natural language to structured analysis
2. **Directory Structure Prompt**: Generate project structures with examples
3. **Dependency Planning Prompt**: Create file creation order with reasoning
4. **Frontend Architecture Prompt**: Plan component hierarchies and patterns
5. **Backend Architecture Prompt**: Design service layers and API structures
6. **API Interface Prompt**: Generate contracts and DTOs

### Phase 4: Response Parsing & Validation

Implement robust parsing and validation:

```javascript
class ResponseParser {
  static parseRequirementAnalysis(response) {
    // Parse and validate requirements analysis response
  }
  
  static parseDirectoryStructure(response) {
    // Parse and validate directory structure response
  }
  
  // ... etc for each planner type
}
```

### Phase 5: Test Migration

Update all tests to work with LLM implementations:

```javascript
// Mock LLM responses for deterministic testing
const mockLLMResponses = {
  requirementAnalysis: {
    // Mock response matching expected format
  },
  directoryStructure: {
    // Mock response matching expected format
  }
  // ... etc
};
```

## Success Criteria

### Functional Requirements
- [ ] All 6 specialized planners replaced with LLM-based implementations
- [ ] All existing tests pass (100+ tests)
- [ ] CodeAgent.planProject() integrates with LLM planner
- [ ] Response parsing handles all edge cases
- [ ] Error handling maintains existing behavior

### Performance Requirements
- [ ] Planning speed maintained or improved
- [ ] LLM response caching implemented
- [ ] Async/await patterns preserved
- [ ] Memory usage optimized

### Quality Requirements
- [ ] Code coverage maintained at 85%+
- [ ] All ESLint rules pass
- [ ] Documentation updated
- [ ] Integration tests pass

## Risk Mitigation

### Response Consistency
- **Risk**: LLM responses may vary between calls
- **Mitigation**: Use temperature=0, implement response caching, use structured prompts

### Schema Validation
- **Risk**: LLM outputs may not match expected schema
- **Mitigation**: Implement strict JSON schema validation with retry logic

### Performance Impact
- **Risk**: LLM calls may be slower than hardcoded logic
- **Mitigation**: Implement response caching, optimize prompts, use faster models

### Test Compatibility
- **Risk**: Existing tests may fail with LLM implementations
- **Mitigation**: Create deterministic mock responses, maintain exact output formats

## Implementation Timeline

### Week 1: Foundation
- [ ] Create LLMPlanner class structure
- [ ] Implement RequirementAnalyzer replacement
- [ ] Create response parsing framework
- [ ] Set up test infrastructure

### Week 2: Core Planners
- [ ] Implement DirectoryPlanner replacement
- [ ] Implement DependencyPlanner replacement
- [ ] Create comprehensive test mocks
- [ ] Validate response formats

### Week 3: Architecture Planners
- [ ] Implement FrontendArchitecturePlanner replacement
- [ ] Implement BackendArchitecturePlanner replacement
- [ ] Implement APIInterfacePlanner replacement
- [ ] Complete prompt engineering

### Week 4: Integration & Testing
- [ ] Update CodeAgent integration
- [ ] Run full test suite
- [ ] Performance optimization
- [ ] Documentation updates

## Conclusion

The replacement of specialized planners with LLM-based implementations represents a significant architectural improvement that will:

1. **Reduce Code Complexity**: Eliminate 5,145 lines of hardcoded planning logic
2. **Improve Flexibility**: Enable natural language planning across all domains
3. **Enhance Maintainability**: Replace complex algorithmic logic with prompt engineering
4. **Increase Capability**: Leverage LLM intelligence for better planning decisions

The LLM planner package is proven to work with real LLM providers and can generate complex, structured plans. With proper prompt engineering and response validation, it can fully replace the existing specialized planners while maintaining all existing functionality and test compatibility.