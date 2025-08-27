# Clean Architecture Refactoring Documentation

## Overview

The decent-planner package has been refactored to follow Uncle Bob's Clean Code and Clean Architecture principles. This document describes the new architecture and how it adheres to these principles.

## Architecture Layers

### 1. Domain Layer (`src/domain/`)
The innermost layer containing pure business logic with no external dependencies.

#### Entities (`src/domain/entities/`)
- **Task**: Core domain model for planning tasks
- **Plan**: Core domain model for planning results

#### Value Objects (`src/domain/value-objects/`)
- **TaskComplexity**: Immutable representation of task complexity (SIMPLE/COMPLEX)
- **TaskStatus**: Immutable representation of task status
- **TaskId**: Immutable unique identifier for tasks
- **PlanStatus**: Immutable representation of plan status
- **PlanId**: Immutable unique identifier for plans

#### Domain Services (`src/domain/services/`)
- **TaskHierarchyService**: Pure domain logic for managing task hierarchies

#### Domain Errors (`src/domain/errors/`)
- **DomainError**: Base class for all domain errors
- **ValidationError**: Domain validation errors
- **TaskError**: Task-related errors
- **PlanError**: Plan-related errors

### 2. Application Layer (`src/application/`)
Contains application-specific business rules and use cases.

#### Use Cases (`src/application/use-cases/`)
- **CreatePlanUseCase**: Creates new planning sessions
- **DecomposeTaskUseCase**: Handles task decomposition logic
- **DiscoverToolsUseCase**: Manages tool discovery process
- **GenerateBehaviorTreeUseCase**: Generates behavior trees
- **ValidatePlanUseCase**: Validates planning results

#### Ports (`src/application/ports/`)
Interfaces defining contracts for external dependencies:
- **PlanRepository**: Contract for plan persistence
- **TaskRepository**: Contract for task persistence
- **ComplexityClassifier**: Contract for classification services
- **TaskDecomposer**: Contract for decomposition services
- **ToolDiscoveryService**: Contract for tool discovery
- **Logger**: Contract for logging services

#### Application Errors (`src/application/errors/`)
- **ApplicationError**: Base class for application errors
- **UseCaseError**: Use case execution errors
- **RepositoryError**: Repository operation errors
- **ServiceError**: Service operation errors

### 3. Infrastructure Layer (`src/infrastructure/`)
Contains implementations of external interfaces and frameworks.

#### Adapters (`src/infrastructure/adapters/`)
- **LLMComplexityClassifier**: LLM-based implementation of ComplexityClassifier
- **LLMTaskDecomposer**: LLM-based implementation of TaskDecomposer
- **RegistryToolDiscoveryService**: Tool registry implementation
- **ConsoleLogger**: Console-based logging implementation
- **InMemoryPlanRepository**: In-memory plan storage
- **InMemoryTaskRepository**: In-memory task storage

#### Infrastructure Errors (`src/infrastructure/errors/`)
- **InfrastructureError**: Base class for infrastructure errors
- **AdapterError**: Adapter-specific errors
- **LLMError**: LLM-related errors
- **StorageError**: Storage operation errors

### 4. Configuration Layer (`src/config/`)
- **PlannerConfiguration**: Centralized configuration management

## Clean Code Principles Applied

### Single Responsibility Principle (SRP)
- Each class has one clear responsibility
- DecentPlannerRefactored is now a thin orchestrator
- Use cases handle specific business operations
- Adapters handle specific external integrations

### Open/Closed Principle (OCP)
- New functionality can be added by creating new use cases
- New adapters can be added without modifying existing code
- Extensible through dependency injection

### Liskov Substitution Principle (LSP)
- All implementations properly fulfill their interface contracts
- Value objects are immutable and interchangeable
- Repository implementations are swappable

### Interface Segregation Principle (ISP)
- Small, focused interfaces (ports) for each capability
- No fat interfaces forcing unnecessary implementations
- Clear separation of concerns

### Dependency Inversion Principle (DIP)
- High-level modules don't depend on low-level modules
- Both depend on abstractions (ports)
- Dependencies flow inward toward the domain

## Clean Architecture Benefits

### 1. Testability
- Domain logic can be tested without any external dependencies
- Use cases can be tested with mock adapters
- Integration tests use real components without mocking

### 2. Maintainability
- Clear separation of concerns
- Easy to locate and fix issues
- Changes in one layer don't affect others

### 3. Flexibility
- Easy to swap implementations (e.g., different LLM providers)
- Can add new features without modifying existing code
- Framework-agnostic domain logic

### 4. Scalability
- Clear boundaries enable team separation
- Can evolve different layers independently
- Easy to add new use cases and adapters

## Key Improvements

### Before Refactoring
- Single 751-line DecentPlanner class violating SRP
- Mixed abstraction levels
- Console.log statements throughout
- Direct framework dependencies
- No clear error hierarchy
- Hard-coded configuration values

### After Refactoring
- Thin orchestrator under 300 lines
- Clear layer separation
- Proper logging abstraction
- Dependency injection
- Comprehensive error hierarchy
- Centralized configuration

## Usage Example

```javascript
import { DecentPlannerRefactored } from './src/DecentPlannerRefactored.js';

// Create planner with configuration
const planner = new DecentPlannerRefactored({
  maxDepth: 5,
  confidenceThreshold: 0.8,
  enableFormalPlanning: true,
  logLevel: 'info'
});

// Initialize (creates dependencies)
await planner.initialize();

// Plan a task
const result = await planner.plan(
  'Build a REST API with authentication',
  { domain: 'web_development' }
);

if (result.success) {
  console.log('Planning successful!');
  console.log(planner.generateReport(result.data));
}
```

## Testing Strategy

### Unit Tests
- Test domain entities and value objects in isolation
- Test domain services with no external dependencies
- Use test data builders for complex objects

### Integration Tests
- Test use cases with real adapters
- No mocking - use actual LLM and tool registry
- Test complete workflows end-to-end

### Example Test
```javascript
// No mocks - using real components
const planner = new DecentPlannerRefactored();
await planner.initialize();

const result = await planner.plan('Write Hello World to file');
expect(result.success).toBe(true);
expect(result.data.rootTask).toBeDefined();
```

## Migration Path

To migrate from the old DecentPlanner to the refactored version:

1. Replace `DecentPlanner` imports with `DecentPlannerRefactored`
2. Update configuration to use the new structure
3. The API remains largely compatible for easy migration
4. Gradually adopt new error handling patterns

## Future Enhancements

- Add more repository implementations (MongoDB, PostgreSQL)
- Implement caching adapter for LLM responses
- Add metrics and monitoring adapters
- Extend configuration for runtime updates
- Add event sourcing for plan history

## Conclusion

The refactored decent-planner package now follows Clean Code and Clean Architecture principles, resulting in:
- Better testability and maintainability
- Clear separation of concerns
- Flexible and extensible design
- Professional error handling
- Proper abstraction layers

This architecture ensures the codebase remains clean, scalable, and easy to understand as it grows.