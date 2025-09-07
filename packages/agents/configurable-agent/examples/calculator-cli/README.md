# Calculator CLI Examples

This directory contains simple examples demonstrating how to use the BehaviorTree system through a command-line interface.

## Examples

### 1. `simple-cli.js` - Interactive Calculator

An interactive CLI that accepts calculator commands and executes them through the BT system.

**Features:**
- Interactive prompt for continuous calculations
- Single-step BT execution
- Real-time results with execution timing
- Help command for guidance

**Usage:**
```bash
# Start the interactive CLI
node simple-cli.js

# Then type commands like:
> add 10 5
✅ Result: 15

> multiply 3 7
✅ Result: 21

> divide 100 4
✅ Result: 25

> help
# Shows available commands

> exit
# Exits the program
```

### 2. `run-workflow.js` - Multi-Step Workflow

Demonstrates a sequential workflow that chains multiple operations together.

**Features:**
- Sequential BT node execution
- Variable passing between steps (`@variable` syntax)
- State persistence
- Execution tracking and timing
- Error handling with step identification

**Usage:**
```bash
# Run a two-step calculation: (a + b) * multiplier
node run-workflow.js 10 5 2

# Output:
# Calculates: (10 + 5) * 2
# Step 1 (Addition): 10 + 5 = 15
# Step 2 (Multiplication): 15 * 2 = 30
# Final Result: 30
```

## How It Works

### BehaviorTree Execution Flow

1. **Create Agent Configuration**
   - Define capabilities (calculator tools)
   - Set up LLM configuration
   - Initialize state management

2. **Build BT Configuration**
   - For simple operations: single `agent_tool` node
   - For workflows: `sequence` node with multiple children
   - Each node specifies tool, operation, and parameters

3. **Execute Through Agent**
   ```javascript
   const result = await agent.receive({
     type: 'execute_bt',
     btConfig: { /* tree configuration */ }
   });
   ```

4. **Process Results**
   - Access artifacts for step outputs
   - Check nodeResults for execution tracking
   - Handle errors with detailed feedback

### Key Concepts Demonstrated

- **Single Node Execution**: Direct tool execution through BT
- **Sequential Workflows**: Chaining operations with data flow
- **Variable Resolution**: Using `@variable.property` to pass data
- **State Management**: Saving calculation history
- **Error Handling**: Graceful failure with clear error messages
- **Performance Tracking**: Execution time measurement

## Requirements

- Node.js 18+ (for native readline support)
- Legion packages installed (`@legion/resource-manager`, etc.)
- Environment variables configured (.env file at monorepo root)

## Next Steps

These examples provide a foundation for:
- Building more complex workflows
- Adding conditional logic (selector nodes)
- Implementing parallel operations
- Creating chat-based interactions
- Integrating with external services

See the main ConfigurableAgent documentation for more advanced usage patterns.