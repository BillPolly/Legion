# Formal Planner

The Formal Planner implements bottom-up synthesis of executable behavior trees from hierarchical task decompositions. It transforms validated BTs at child levels into synthetic tools usable at parent levels.

## Key Concept: BT-as-Tool

The core innovation is that **a complete, valid behavior tree at one level becomes an executable tool at the parent level**. The BT is not transformed - it's simply wrapped with metadata and executed directly.

## Architecture

```
Task Hierarchy (from Informal Planner)
         ↓
    Bottom-up Synthesis
         ↓
Level 3: [SIMPLE tasks] → [BTs] → [Synthetic Tools]
         ↓
Level 2: [Use synthetic tools] → [BTs] → [Synthetic Tools]
         ↓
Level 1: [Use synthetic tools] → [BTs] → [Synthetic Tools]
         ↓
Level 0: [Root BT using all tools]
         ↓
    Executable Plan
```

## Components

### FormalPlanner
Main orchestrator for bottom-up synthesis. Processes task hierarchy level by level, creating synthetic tools and aggregating results.

```javascript
const formalPlanner = new FormalPlanner({
  planner,      // BT generation
  validator,    // BT validation
  toolFactory,  // Synthetic tool creation
  artifactMapper, // Artifact management
  toolRegistry  // Tool discovery
});

const result = await formalPlanner.synthesize(taskHierarchy);
```

### SyntheticTool
Wrapper around a complete, valid BT that makes it appear as an atomic tool.

```javascript
const syntheticTool = {
  name: "task_create_database",
  description: "Create and configure database",
  executionPlan: validBehaviorTree, // The actual BT
  inputSchema: { ... },
  outputSchema: { ... }
};
```

### SyntheticToolExecutor
Executes synthetic tools by passing their stored BTs directly to BehaviorTreeExecutor.

```javascript
const executor = new SyntheticToolExecutor(btExecutor);
const result = await executor.execute(syntheticTool, inputs);
// Internally: btExecutor.executeTree(syntheticTool.executionPlan, context)
```

### SyntheticToolFactory
Creates synthetic tools from BTs without modifying the BT itself.

```javascript
const factory = new SyntheticToolFactory();
const syntheticTool = factory.createFromBT(behaviorTree, taskNode);
```

### AugmentedToolRegistry
Extends the tool registry to include both real and synthetic tools.

```javascript
const augmentedRegistry = new AugmentedToolRegistry(realRegistry);
augmentedRegistry.addSyntheticTool(syntheticTool);
const tools = await augmentedRegistry.searchTools('database');
```

## Usage

### Basic Example

```javascript
import { FormalPlanner } from './FormalPlanner.js';
import { Planner } from '@legion/planner';
import { BTValidator } from '@legion/bt-validator';

// Initialize components
const planner = new PlannerAdapter(new Planner({ llmClient }));
const validator = new BTValidator();
const toolFactory = new SyntheticToolFactory();

// Create formal planner
const formalPlanner = new FormalPlanner({
  planner,
  validator,
  toolFactory,
  artifactMapper: new ArtifactMapping(),
  toolRegistry
});

// Task hierarchy from informal planner
const hierarchy = {
  id: 'root',
  description: 'Build application',
  complexity: 'COMPLEX',
  level: 0,
  children: [
    {
      id: 'backend',
      description: 'Create backend',
      complexity: 'SIMPLE',
      level: 1,
      tools: ['express_setup', 'route_create']
    }
  ]
};

// Synthesize executable plan
const result = await formalPlanner.synthesize(hierarchy);

if (result.success) {
  // Execute the root BT
  const executor = new BehaviorTreeExecutor(toolRegistry);
  await executor.executeTree(result.rootBT, context);
}
```

### Executing Synthetic Tools

```javascript
// Synthetic tools store complete BTs
const syntheticTool = result.syntheticTools['task_backend'];

// Execute via SyntheticToolExecutor
const executor = new SyntheticToolExecutor(btExecutor);
const result = await executor.execute(syntheticTool, {
  port: 3000,
  database: 'postgres'
});

// The executor simply runs: btExecutor.executeTree(syntheticTool.executionPlan)
```

## Key Insights

1. **BTs are complete and valid** - The Planner generates executable BTs, not templates
2. **No transformation needed** - Synthetic tools store BTs directly in `executionPlan`
3. **Direct execution** - BTs are passed directly to BehaviorTreeExecutor
4. **Isolation maintained** - Each BT executes in its own context
5. **Bottom-up synthesis** - Process leaves first, then work up the tree

## Testing

### Unit Tests
```bash
npm test -- src/core/formal/__tests__/unit/
```

### Integration Tests
```bash
npm test -- src/core/formal/__tests__/integration/
```

### Test Coverage
- 10 unit test suites (all passing)
- 6 integration test suites (all passing)
- Error scenarios validated
- Multi-level hierarchies tested

## Error Handling

The formal planner raises errors rather than silencing them:

```javascript
const result = await formalPlanner.synthesize(hierarchy);

if (!result.success) {
  console.error('Synthesis failed:', result.errors);
  // Errors are propagated from child levels
  // Each error includes context about where it occurred
}
```

## Performance

Typical synthesis times with real LLM (Claude 3.5 Sonnet):
- Simple task: ~8-10 seconds
- Two-level hierarchy: ~30-40 seconds  
- Three-level hierarchy: ~60-100 seconds

## Design Documents

- [Formal Planner Design](./docs/FORMAL_PLANNER_DESIGN.md) - Complete design specification
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md) - 10-phase implementation plan
- [Final Validation](./docs/FINAL_VALIDATION.md) - Validation report and checklist

## No Mocks Policy

The implementation follows a strict **no mocks in production code** policy:
- All components use real dependencies
- Integration tests use real LLM and services
- Only unit tests use mocks for isolation

## License

Part of the Legion framework.