# Project Manager CLI Example

A comprehensive example demonstrating the LLM-powered CLI framework with stateful project management capabilities.

## Features

- **Project Management**: Create, switch between, and delete projects
- **Task Tracking**: Add tasks, set priorities, assign to team members, and track completion
- **Team Management**: Add and remove team members with specific roles
- **Context Awareness**: Remembers current project and last task for convenient operations
- **Advanced Filtering**: View tasks by status, assignee, priority, or due date
- **Bulk Operations**: Complete or assign multiple tasks at once
- **Search**: Find tasks by keyword
- **Progress Tracking**: Generate status reports with completion metrics

## Running the Example

### Interactive Mode
```bash
npx ts-node examples/project-manager/index.ts
```

### Single Command Mode
```bash
npx ts-node examples/project-manager/index.ts "Create project 'My App'"
```

## Command Examples

### Project Commands
```
Create a new project called "Website Redesign"
List all projects
Switch to project "Mobile App"
Delete project "Old Project"
```

### Task Commands
```
Add task "Design homepage"
Show all tasks
Complete task "Design homepage"
Assign "Backend API" to Alice
Set priority of "Fix bug" to high
Set due date of "Submit report" to tomorrow
Show task details
```

### Task Filtering
```
Show completed tasks
Show overdue tasks
Show high priority tasks
Show tasks assigned to Bob
```

### Team Commands
```
Add team member Alice as developer
Add Bob as designer
Show team members
Remove team member Charlie
```

### Status and Reporting
```
Show project status
Generate progress report
```

### Search
```
Find tasks containing "API"
Search tasks with "frontend"
```

### Bulk Operations
```
Complete all tasks
Assign all tasks to Alice
Clear completed tasks
```

### Context-Aware Commands

The CLI remembers context, allowing shortcuts:
```
Add task "New feature"
Assign it to Bob       # "it" refers to the last task
Set its priority to high
```

## Architecture

This example showcases:

1. **Stateful Command Handlers**: Commands that maintain and update persistent state
2. **Context Providers**: Custom context provider that tracks current project and recent tasks
3. **Natural Language Processing**: Intent recognition for flexible command input
4. **Complex State Management**: Nested data structures (projects containing tasks and team members)
5. **Smart References**: Support for contextual references like "it" or "last"

## Customization

To use with a real LLM provider:

```typescript
import { OpenAIProvider } from '../../src/providers/OpenAIProvider';

const provider = new OpenAIProvider({ apiKey: 'your-key' });
const cli = new ProjectManagerCLI({ llmProvider: provider });
```

## Testing

Run the test suite:
```bash
npm test examples/project-manager/__tests__/project-manager.test.ts
```

The tests demonstrate:
- All command variations
- Context awareness
- Error handling
- State persistence
- Bulk operations