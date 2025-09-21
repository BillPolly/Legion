# Prompt Management System

## Overview

The ROMA Agent now uses a file-based prompt management system with markdown templates and namespace support. All prompts are stored as markdown files in the `/prompts` directory with frontmatter metadata.

## Architecture

### Components

1. **EnhancedPromptRegistry** (`@legion/prompting-manager`)
   - Loads and manages markdown prompt templates
   - Supports namespace-based organization
   - Provides caching and metadata extraction
   - Handles variable substitution with `{{variable}}` syntax

2. **Prompt Files** (`/prompts/**/*.md`)
   - Organized by component and purpose
   - Include frontmatter metadata for discoverability
   - Support template variables for dynamic content

### Directory Structure

```
prompts/
├── coding/
│   ├── requirements/
│   │   └── analyze.md          # Requirements analysis prompts
│   ├── quality/
│   │   └── assess.md           # Quality assessment prompts
│   └── recovery/
│       └── analyze-failure.md  # Error recovery prompts
└── utils/
    └── tools/
        └── generate-descriptions.md  # Tool discovery prompts
```

## Prompt File Format

Each prompt file uses markdown with YAML frontmatter:

```markdown
---
name: analyze-requirements
description: Analyze project requirements and extract features
tags: [requirements, analysis, project-planning]
category: coding
variables: [requirements]
responseFormat: json
---

Analyze the following project requirements...

{{requirements}}

Return a JSON object with...
```

### Metadata Fields

- **name**: Unique identifier for the prompt
- **description**: Human-readable description
- **tags**: Array of searchable tags
- **category**: Primary category (e.g., 'coding', 'utils')
- **variables**: Template variables expected
- **responseFormat**: Expected response format ('json', 'text', 'markdown')

## Usage

### In Components

```javascript
import { EnhancedPromptRegistry } from '@legion/prompting-manager';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class MyComponent {
  constructor() {
    const promptsPath = path.resolve(__dirname, '../../../../prompts');
    this.promptRegistry = new EnhancedPromptRegistry(promptsPath);
  }

  async usePrompt() {
    // Fill template with variables
    const prompt = await this.promptRegistry.fill('coding/requirements/analyze', {
      requirements: 'Create a REST API...'
    });
    
    // Use with LLM
    const response = await this.llmClient.complete(prompt);
  }
}
```

### Namespace Convention

Prompts are accessed using a namespace path that mirrors the directory structure:

- `coding/requirements/analyze` → `/prompts/coding/requirements/analyze.md`
- `utils/tools/generate-descriptions` → `/prompts/utils/tools/generate-descriptions.md`

## Migrated Components

### Phase 1: Core Components
- ✅ **RequirementsAnalyzer** - Requirements analysis prompts
- ✅ **QualityController** - Quality assessment prompts
- ✅ **RecoveryManager** - Error recovery prompts

### Phase 2: Utility Components
- ✅ **ToolDiscovery** - Tool description generation prompts

### Phase 3: Strategy Components
- ✅ **SimpleNodeServerStrategy** - Server generation prompts
- ✅ **SimpleNodeTestStrategy** - Test generation prompts
- ✅ **SimpleNodeDebugStrategy** - Debug analysis prompts
- ✅ **ProjectPlannerStrategy** - Project planning prompts

## Benefits

1. **Separation of Concerns**: Prompts are separated from business logic
2. **Version Control**: Track prompt changes independently
3. **Reusability**: Share prompts across components
4. **Maintainability**: Centralized prompt management
5. **Discoverability**: Metadata-based search and categorization
6. **Consistency**: Standardized format and variable handling

## Testing

Each migrated component includes unit tests to verify prompt loading:

```javascript
it('should load prompts from markdown files', async () => {
  const template = await analyzer.promptRegistry.load('coding/requirements/analyze');
  expect(template).toBeDefined();
  expect(template.content).toBeDefined();
  expect(template.metadata).toBeDefined();
});

it('should fill prompt templates with variables', async () => {
  const filled = await analyzer.promptRegistry.fill('coding/requirements/analyze', {
    requirements: 'test requirements'
  });
  expect(filled).toContain('test requirements');
  expect(filled).not.toContain('{{requirements}}');
});
```

## Migration Checklist

When migrating a component to use the prompt registry:

1. ✅ Create markdown file(s) in appropriate `/prompts` subdirectory
2. ✅ Add frontmatter metadata with all required fields
3. ✅ Import EnhancedPromptRegistry in component
4. ✅ Initialize registry with correct prompts path
5. ✅ Replace inline prompts with `promptRegistry.fill()` calls
6. ✅ Create unit tests for prompt loading
7. ✅ Run integration tests to verify functionality
8. ✅ Update component documentation

## Future Enhancements

- [ ] Add prompt versioning support
- [ ] Implement prompt A/B testing
- [ ] Add prompt performance metrics
- [ ] Create prompt validation schemas
- [ ] Build prompt management CLI tools
- [ ] Add hot-reload for development