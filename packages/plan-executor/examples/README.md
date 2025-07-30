# Legion Plan Executor Examples

This directory contains example plans that demonstrate the modular code generation capabilities of the Legion framework. These plans showcase how the decomposed code-gen tools can be orchestrated by the plan executor to create complete, production-ready applications.

## Overview

The Legion framework has evolved from monolithic code generation workflows to a modular approach where atomic tools can be composed into flexible plans. These examples demonstrate this architectural shift and the benefits it provides.

## Available Example Plans

### 1. Simple JavaScript Project (`simple-javascript-project.json`)

**Complexity**: Low  
**Duration**: 5-10 minutes  
**Purpose**: Basic JavaScript project creation

Creates a complete JavaScript project with:
- Project directory structure
- Package.json with proper dependencies
- Main application module with functions
- Unit tests using Jest
- Code validation and quality checks
- Documentation and configuration files

**Demonstrates**:
- Basic modular tool orchestration
- File generation and validation workflow
- Testing integration
- Project structure best practices

**Tools Used**:
- JS Generator (generate_javascript_module, generate_unit_tests)
- Package Manager (create_package_json, install_packages)
- Code Analysis (validate_javascript)
- Jester (run_tests)

### 2. Express.js API Project (`express-api-project.json`)

**Complexity**: Medium  
**Duration**: 10-15 minutes  
**Purpose**: Complete REST API application

Creates a production-ready Express.js API with:
- Full project structure (routes, middleware, controllers)
- Express server with security middleware
- Modular route handlers for user management
- Custom middleware (logging, error handling, API key validation)
- Comprehensive integration tests
- Environment configuration
- API documentation

**Demonstrates**:
- Complex multi-module coordination
- Express.js architecture patterns
- Security and middleware integration
- Comprehensive testing strategy
- Production-ready configuration

**Tools Used**:
- JS Generator (complex module generation with classes and functions)
- Package Manager (Express dependencies management)
- Code Analysis (security and performance validation)
- Jester (integration testing with supertest)

### 3. Test-Driven Development Workflow (`tdd-workflow.json`)

**Complexity**: Medium-High  
**Duration**: 8-12 minutes  
**Purpose**: Complete TDD process automation

Demonstrates the full RED-GREEN-REFACTOR TDD cycle:
- **RED Phase**: Write failing tests first
- **GREEN Phase**: Implement minimal code to pass tests
- **REFACTOR Phase**: Improve code quality while maintaining test coverage
- Continuous validation and quality measurement
- TDD process documentation and reporting

**Demonstrates**:
- Automated TDD workflow
- Test analytics and insights
- Code quality measurement and improvement
- Process documentation
- Modular tool orchestration for complex workflows

**Tools Used**:
- JS Generator (test generation and iterative code improvement)
- Package Manager (test environment setup)
- Jester (TDD analytics and test execution)
- Code Analysis (quality measurement and improvement tracking)

## Architecture Benefits Demonstrated

### 1. Modularity
Each tool has a single responsibility and can be used independently or composed into larger workflows.

### 2. Flexibility
Plans can mix and match tools from different modules to create custom workflows for specific project types.

### 3. Composability
Complex workflows are built by orchestrating simple, atomic tools rather than using monolithic commands.

### 4. Testability
Each tool can be tested in isolation, and plans can validate their execution at each step.

### 5. Maintainability
Tools are easier to maintain, extend, and debug when they're focused on specific tasks.

### 6. Reusability
Tools can be reused across different project types and development workflows.

## Plan Structure

Each plan follows a consistent structure:

```json
{
  "id": "unique-plan-identifier",
  "name": "Human-readable plan name",
  "description": "Detailed description of what the plan creates",
  "inputs": [...],     // Required and optional inputs
  "outputs": [...],    // Expected outputs and results
  "steps": [...],      // Orchestrated sequence of tool executions
  "success_criteria": [...], // Validation conditions
  "demonstrates": [...] // Educational value and patterns shown
}
```

### Step Types

Plans organize work into different step types:

- **setup**: Directory creation, environment preparation
- **configuration**: Package.json, environment files, project settings
- **code-generation**: Creating source code using JS Generator tools
- **test-generation**: Creating test files and test suites
- **validation**: Code quality checks, security analysis
- **testing**: Running test suites, analyzing results
- **documentation**: README files, API docs, reports

### Tool Integration

Steps specify which Legion module and tool to use:

```json
{
  "type": "create_package_json",
  "module": "package-manager",
  "parameters": {...}
}
```

This allows the plan executor to:
1. Load the appropriate module dynamically
2. Execute the specified tool with given parameters
3. Validate outputs and handle errors
4. Pass results to dependent steps

## Running the Examples

To execute these example plans:

1. **Ensure Dependencies**: Make sure all code-gen modules are properly installed and their dependencies are available.

2. **Use Plan Executor**: Load and execute plans through the plan executor:
   ```javascript
   const planExecutor = new PlanExecutor({ planToolRegistry });
   const result = await planExecutor.executePlan(planData, inputs);
   ```

3. **Provide Inputs**: Each plan requires specific inputs (project name, path, etc.) - check the plan's `inputs` section.

4. **Monitor Progress**: Plans emit progress events and provide detailed logging of each step.

## Educational Value

These examples serve multiple purposes:

### For Developers
- Learn Legion framework patterns and best practices
- Understand modular code generation approaches
- See how complex workflows can be automated

### For Architecture
- Demonstrate separation of concerns in code generation
- Show how atomic tools can be composed into powerful workflows
- Illustrate benefits of modular vs. monolithic approaches

### For Testing
- Provide integration test scenarios for the plan executor
- Validate that modular tools work correctly together
- Test complex dependency chains and error handling

## Contributing

When adding new example plans:

1. **Follow Naming Convention**: Use descriptive, kebab-case filenames
2. **Include All Metadata**: Complexity, duration, demonstrates, tools used
3. **Add Documentation**: Update this README with plan details
4. **Test Thoroughly**: Ensure the plan executes successfully
5. **Show Benefits**: Highlight what the plan demonstrates about modular architecture

## Future Examples

Potential additional examples to demonstrate other aspects of the Legion framework:

- **React Application**: Frontend project with components, routing, and build process
- **Full-Stack Application**: Coordinated frontend and backend development
- **Multi-Language Project**: Demonstrating Legion's language-agnostic capabilities
- **Deployment Pipeline**: End-to-end development to deployment workflow
- **Legacy Code Migration**: Automated refactoring and modernization processes

---

These examples demonstrate the power and flexibility of Legion's modular approach to code generation, showing how atomic tools can be orchestrated into sophisticated development workflows.