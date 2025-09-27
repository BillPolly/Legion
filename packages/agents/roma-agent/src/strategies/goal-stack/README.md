# Goal-Stack Strategy

ROMA agent strategy implementing explicit goal management with hierarchical decomposition.

## Overview

The Goal-Stack Strategy maintains a LIFO stack of goals, expanding them via GoalPlanner (with SOP-based and vanilla planning), executing primitive actions, and tracking completion through evidence accumulation.

## Features

- **Goal Stack**: LIFO stack with depth-first execution
- **SOP-Based Planning**: Uses SOPRegistry for procedural knowledge
- **Vanilla Fallback**: Simple LLM decomposition when no SOP matches
- **Message Interpretation**: LLM-based user intent understanding
- **Tool Integration**: Executes tools from ToolRegistry with suggestions from SOPs
- **Evidence Tracking**: Accumulates data in task artifacts
- **Completion Checking**: Evaluates doneWhen conditions

## Components

- **GoalStack**: Data structure for goal management
- **GoalStackStrategy**: Main strategy following StandardTaskStrategy pattern
- **Prompts**: interpret-message, execute-gather, check-completion

## Integration

Uses:
- GoalPlanner for goal expansion
- SOPRegistry for SOP retrieval
- ToolRegistry for tool execution
- TemplatedPrompt for LLM interactions
- Task framework for context and artifacts

## Status

- ✅ GoalStack implemented and tested (16 tests passing)
- ✅ Strategy scaffold complete
- ✅ All prompts defined
- ⚠️ Integration tests pending (module resolution issues)

See `docs/DESIGN.md` for architecture details.