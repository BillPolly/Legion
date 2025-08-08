# TaskOrchestrator

The TaskOrchestrator is a comprehensive AI agent that handles complex, multi-step tasks through planning, validation, and execution. It integrates multiple Legion components to provide a complete task automation system.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  TaskOrchestrator  │◄──►│ UserInteractionHandler │◄──►│   ChatAgent     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐    ┌──────────────────┐
│  PlanExecution  │    │PlanExecutionEngine│
└─────────────────┘    └──────────────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐    ┌──────────────────┐
│ProfilePlannerModule│    │   PlanExecutor   │
└─────────────────┘    └──────────────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐    ┌──────────────────┐
│PlanInspectorTool│    │   ModuleLoader   │
└─────────────────┘    └──────────────────┘
```

## Components

### 1. TaskOrchestrator (Main Controller)
- **Purpose**: Central coordinator for complex tasks
- **Responsibilities**:
  - Message routing via actor protocol
  - State management across planning and execution
  - Communication with ChatAgent
  - Resource lifecycle management

### 2. PlanExecution (Planning & Validation)
- **Purpose**: Handles plan generation and validation
- **State Machine**: `idle → planning → validating → validated/invalid → complete`
- **Responsibilities**:
  - Integrate with ProfilePlannerModule for plan generation
  - Validate plans using PlanInspectorTool
  - Create plan artifacts
  - Handle validation failures

### 3. PlanExecutionEngine (Execution)
- **Purpose**: Executes validated plans step-by-step
- **State Machine**: `idle → executing → paused/complete/failed`
- **Responsibilities**:
  - Execute plans using PlanExecutor
  - Real-time progress tracking
  - Error handling and recovery
  - Execution control (pause/resume/cancel)

### 4. UserInteractionHandler (User Interface)
- **Purpose**: Manages user interactions during execution
- **Responsibilities**:
  - Process user commands (status, pause, cancel, etc.)
  - Provide intelligent responses using LLM
  - Handle clarification dialogs
  - Control execution flow based on user input

## Workflow

### Complete Task Automation Flow

1. **Task Request**
   ```
   User → ChatAgent → TaskOrchestrator.receive({type: 'start_task'})
   ```

2. **Planning Phase**
   ```
   PlanExecution.start() → ProfilePlannerModule → Generated Plan
   ```

3. **Validation Phase**
   ```
   PlanExecution.validatePlan() → PlanInspectorTool → Validated Plan
   ```

4. **Artifact Creation**
   ```
   PlanExecution.createPlanArtifact() → ArtifactManager → Stored Plan
   ```

5. **Execution Phase** (Optional)
   ```
   TaskOrchestrator.receive({type: 'execute_plan'}) → PlanExecutionEngine → Results
   ```

### State Transitions

#### Planning States
- `idle`: Ready to accept tasks
- `planning`: Generating plan with ProfilePlannerModule
- `validating`: Validating plan structure and tools
- `validated`: Plan passed validation
- `invalid`: Plan failed validation
- `complete`: Planning workflow complete

#### Execution States
- `idle`: Ready to execute plans
- `executing`: Executing plan steps
- `paused`: Execution paused by user
- `complete`: Execution completed successfully
- `failed`: Execution failed with errors

## Integration Points

### ProfilePlannerModule Integration
- Generates domain-specific plans using pre-configured profiles
- Automatically validates tool names against available modules
- Supports JavaScript development profile with comprehensive actions

### PlanInspectorTool Integration
- Validates plan structure and dependencies
- Checks tool availability against ModuleLoader
- Provides detailed analysis and complexity metrics

### PlanExecutor Integration
- Executes validated plans with full event system
- Handles step-by-step execution with retries
- Provides real-time progress updates

## Actor Protocol

The TaskOrchestrator implements the Legion Actor Protocol for clean communication:

### Message Types

#### Input Messages
- `start_task`: Begin planning for a new task
- `execute_plan`: Execute a validated plan
- `user_message`: Handle user interaction

#### Output Messages (via ChatAgent)
- `orchestrator_status`: Status updates during execution
- `orchestrator_update`: Progress updates
- `orchestrator_complete`: Task completion notification
- `orchestrator_error`: Error notifications
- `agent_thought`: Real-time execution thoughts

### Example Usage

```javascript
// Start a planning task
await taskOrchestrator.receive({
  type: 'start_task',
  description: 'Create a Node.js API server with user authentication',
  agentContext: agentContext
});

// Execute a validated plan
await taskOrchestrator.receive({
  type: 'execute_plan',
  plan: validatedPlan,
  options: { workspaceDir: '/path/to/workspace' },
  agentContext: agentContext
});

// Send user command
await taskOrchestrator.receive({
  type: 'user_message',
  content: 'pause execution'
});
```

## Testing

### Test Architecture

The TaskOrchestrator includes comprehensive testing capabilities:

#### TaskOrchestratorTestActor
- Standalone test harness for complete workflow testing
- No Aiur server dependency
- Full actor protocol simulation
- Mock implementations of all dependencies

#### Test Coverage
- **Unit Tests**: Individual component testing with mocks
- **Integration Tests**: Complete workflow testing
- **Actor Protocol Tests**: Message handling and state management
- **Error Recovery Tests**: Failure scenarios and recovery
- **Performance Tests**: Rapid message handling and state consistency

### Running Tests

```bash
# Run all tests
cd packages/aiur/src/agents/task-orchestrator/__tests__
./run-tests.js

# Run specific test suite
npx jest TaskOrchestrator.unit.test.js
npx jest TaskOrchestrator.integration.test.js
```

### Test Examples

```javascript
// Test complete planning workflow
const testActor = new TaskOrchestratorTestActor();
await testActor.startPlanningTask('Create a web server');
await testActor.waitForState('complete', 60000);

// Test execution workflow
const plan = getValidatedPlan();
await testActor.executePlan(plan);
await testActor.waitForState('complete', 120000);

// Test user interaction
await testActor.sendUserMessage('status');
const messages = testActor.getMessages();
```

## Configuration

### Environment Variables
All configuration is handled through the ResourceManager:
- `ANTHROPIC_API_KEY`: For LLM operations
- `OPENAI_API_KEY`: Alternative LLM provider
- Additional API keys loaded automatically from .env

### Dependencies
- `@legion/profile-planner`: Plan generation
- `@legion/plan-executor-tools`: Plan validation
- `@legion/plan-executor`: Plan execution
- `@legion/module-loader`: Tool and module management

## Error Handling

### Planning Errors
- Invalid profile configurations
- LLM generation failures
- Tool validation errors
- Dependency resolution issues

### Execution Errors
- Missing tools or modules
- Step execution failures
- Timeout and retry handling
- Resource allocation errors

### Recovery Strategies
- Graceful degradation
- State cleanup on errors
- User notification with actionable feedback
- Automatic retry with exponential backoff

## Performance Considerations

### Memory Management
- Proper cleanup of event listeners
- Resource deallocation on completion
- State reset between tasks

### Scalability
- Async/await throughout for non-blocking operations
- Event-driven architecture for real-time updates
- Modular design for easy extension

### Monitoring
- Comprehensive logging at all levels
- Progress tracking for long-running operations
- Performance metrics collection

## Future Enhancements

### Planned Features
- Multiple profile support beyond JavaScript
- Plan modification during execution
- Execution rollback and recovery
- Multi-step user interactions
- Plan templates and reusability

### Integration Opportunities
- WebSocket streaming for real-time updates
- Distributed execution across multiple agents
- Plan sharing and collaboration features
- Analytics and execution history

## Contributing

When extending the TaskOrchestrator:

1. **Follow the Actor Protocol**: All communication through `receive()` method
2. **Maintain State Consistency**: Update state machines properly
3. **Add Comprehensive Tests**: Include both unit and integration tests
4. **Handle Errors Gracefully**: Never crash, always provide feedback
5. **Use ResourceManager**: For all external dependencies and API keys

## Examples

See the test files for comprehensive examples of:
- Complete planning and execution workflows
- Error handling scenarios
- User interaction patterns
- Performance and reliability testing