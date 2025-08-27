# Clean Architecture Refactoring - decent-planner-ui

## Overview

The decent-planner-ui package has been refactored to follow Uncle Bob's Clean Code and Clean Architecture principles while maintaining the MVVM and Actor patterns. This refactoring ensures compatibility with the refactored DecentPlanner backend.

## Architecture Layers

### 1. Domain Layer (`src/domain/`)
The innermost layer containing pure business logic with no external dependencies.

#### Entities (`src/domain/entities/`)
- **PlanningSession**: Core entity representing a planning session with state management
- **ToolSearchQuery**: Entity for tool search requests
- **ExecutionState**: Entity for behavior tree execution state

#### Value Objects (`src/domain/value-objects/`)
- **PlanningGoal**: Immutable planning goal representation
- **PlanningMode**: Enumeration of planning states (IDLE, INFORMAL, FORMAL, etc.)
- **PlanningSessionId**: Unique session identifier
- **SearchType**: TEXT or SEMANTIC search types
- **ExecutionStatus**: Execution states (IDLE, RUNNING, PAUSED, etc.)

#### Domain Services (`src/domain/services/`)
- **PlanningOrchestrationService**: Pure domain logic for workflow orchestration

#### Domain Errors (`src/domain/errors/`)
- **DomainError**: Base class for domain errors
- **ValidationError**: Domain validation errors
- **StateTransitionError**: Invalid state transition errors
- **PlanningError**: Planning-related errors
- **ExecutionError**: Execution-related errors

### 2. Application Layer (`src/application/`)
Contains application-specific business rules and use cases.

#### Use Cases (`src/application/use-cases/`)
- **StartPlanningUseCase**: Initiates planning sessions
- **CancelPlanningUseCase**: Cancels active planning
- **DiscoverToolsUseCase**: Manages tool discovery
- **SearchToolsUseCase**: Handles tool searches
- **SavePlanUseCase**: Saves planning results
- **LoadPlanUseCase**: Loads saved plans

#### Ports (`src/application/ports/`)
Interfaces defining contracts for external dependencies:
- **PlannerService**: Contract for planning backend
- **ActorCommunication**: Contract for actor messaging
- **UIRenderer**: Contract for UI updates
- **PlanStorage**: Contract for plan persistence

#### Application Errors (`src/application/errors/`)
- **ApplicationError**: Base class for application errors
- **UseCaseError**: Use case execution errors
- **ServiceError**: Service operation errors
- **CommunicationError**: Communication errors
- **StorageError**: Storage operation errors

### 3. Infrastructure Layer (`src/infrastructure/`)
Contains implementations of external interfaces and frameworks.

#### Adapters (`src/infrastructure/adapters/`)
- **DecentPlannerAdapter**: Adapter for DecentPlanner
- **WebSocketActorAdapter**: WebSocket-based actor communication (planned)
- **MVVMRenderer**: MVVM-based UI rendering (planned)
- **FilePlanStorage**: File-based plan storage (planned)

#### Components (`src/infrastructure/components/`)
MVVM-based UI components (to be moved here):
- UI components maintain model/view separation
- Two-way data binding
- Event-driven updates

#### Infrastructure Errors (`src/infrastructure/errors/`)
- **InfrastructureError**: Base class for infrastructure errors
- **AdapterError**: Adapter-specific errors
- **NetworkError**: Network communication errors
- **FileSystemError**: File system operation errors

### 4. Actors (`src/actors/`)
Actor-based communication layer:
- **ServerPlannerActor**: Server-side actor using DecentPlanner
- **ClientPlannerActor**: Client-side actor using use cases (to be refactored)
- **ServerExecutionActor**: Behavior tree execution actor

## Key Improvements

### Integration with DecentPlanner
- Uses the refactored `DecentPlanner` with Clean Architecture
- Leverages new API methods: `planInformalOnly`, `plan`, `generateReport`
- Access to refactored use cases and dependencies
- Proper configuration management

### Clean Architecture Benefits

#### 1. Testability
- Domain logic can be tested without external dependencies
- Use cases can be tested with mock adapters
- Integration tests use real components (no mocking)

#### 2. Maintainability
- Clear separation of concerns
- Each layer has single responsibility
- Easy to locate and fix issues

#### 3. Flexibility
- Easy to swap implementations (different planners, storage, etc.)
- Framework-agnostic domain logic
- Can add new features without modifying existing code

#### 4. Scalability
- Clear boundaries enable team separation
- Layers can evolve independently
- Easy to add new use cases

### MVVM Pattern Preservation
- UI components maintain model/view separation
- Model represents state
- View handles rendering
- Two-way data binding preserved
- Event-driven updates

### Actor Pattern Integration
- Actors remain thin orchestrators
- Business logic moved to use cases
- Message protocol maintained
- Client-server communication preserved

## Migration Guide

### For Server-Side Code
1. Use `import { DecentPlanner }` from '@legion/decent-planner'
2. Update initialization:
```javascript
// Old
this.decentPlanner = new DecentPlanner(llmClient, options);

// New
this.decentPlanner = new DecentPlanner(options);
await this.decentPlanner.initialize();
```

3. Update method calls:
```javascript
// Informal planning
const result = await this.decentPlanner.planInformalOnly(goal, context, progressCallback);

// Full planning (includes formal)
const result = await this.decentPlanner.plan(goal, context, progressCallback);

// Tool discovery via use case
const result = await this.decentPlanner.useCases.discoverTools.execute({
  rootTask: hierarchy,
  progressCallback
});
```

### For Client-Side Code
1. Use use cases instead of direct logic:
```javascript
// Create use case
const startPlanning = new StartPlanningUseCase({
  plannerService,
  uiRenderer,
  actorCommunication
});

// Execute
const result = await startPlanning.execute({ goal, mode: 'informal' });
```

2. Implement port adapters for infrastructure concerns
3. Keep UI components MVVM-based

## Testing Strategy

### Unit Tests
- Test domain entities and value objects in isolation
- Test domain services with no external dependencies
- Test use cases with mock ports

### Integration Tests
- Test with real DecentPlanner
- Test actor communication end-to-end
- No mocking - use actual components
- Test complete workflows

### Compliance Tests
- Verify layer separation
- Check dependency rules
- Ensure no cross-layer violations

## Future Enhancements

1. **Complete Client Actor Refactoring**
   - Refactor ClientPlannerActor to use use cases
   - Remove direct business logic

2. **Create Presentation Layer**
   - Implement view models
   - Separate presentation logic

3. **Move Components to Infrastructure**
   - Relocate UI components to infrastructure layer
   - Maintain MVVM pattern

4. **Add More Adapters**
   - IndexedDB storage adapter
   - REST API adapter
   - GraphQL adapter

5. **Enhance Error Handling**
   - Add retry mechanisms
   - Implement circuit breakers
   - Add detailed error reporting

## Conclusion

The refactored decent-planner-ui now follows Clean Architecture principles while preserving the MVVM and Actor patterns. This results in:
- Better testability and maintainability
- Clear separation of concerns
- Flexible and extensible design
- Seamless integration with DecentPlanner
- Professional error handling
- Proper abstraction layers

The architecture ensures the UI remains clean, scalable, and easy to understand as it grows.