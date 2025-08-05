# Artifact Reference System Documentation

## Overview

The Legion Aiur artifact system provides intelligent management of tool outputs, allowing the LLM to reference previously generated content using simple labels like `@image1` or `@analysis1`.

## Architecture

### Components

1. **ArtifactDetector** (`src/agents/artifacts/ArtifactDetector.js`)
   - Analyzes tool execution results to identify potential artifacts
   - Detects files, images, text content, analysis results, etc.
   - Tool-specific detection for different artifact types

2. **ArtifactManager** (`src/agents/artifacts/ArtifactManager.js`)
   - Central registry for all artifacts
   - Stores artifacts with unique IDs and labels
   - Provides label-based lookup (`@image1` → actual artifact)
   - Generates artifact context for LLM prompts
   - Manages artifact lifecycle and caching

3. **ArtifactActor** (`src/agents/ArtifactActor.js`)
   - Manages artifact detection and curation workflow
   - Uses LLM to intelligently curate artifacts:
     - Decides which artifacts to keep
     - Assigns meaningful labels
     - Writes descriptions for future reference
   - Falls back to auto-labeling when LLM unavailable

4. **ChatAgent** Integration
   - Sends tool results to ArtifactActor for processing
   - Includes artifact context in LLM messages
   - Performs label substitution in tool parameters

## How It Works

### 1. Artifact Creation Flow

```
Tool Execution → ArtifactDetector → ArtifactActor → LLM Curation → ArtifactManager
```

Example:
- User: "Generate an image of a dragon"
- Tool: `generate_image` creates image and saves to `/tmp/dragon.png`
- ArtifactDetector: Detects image artifact with path, content, metadata
- ArtifactActor: Asks LLM to curate
- LLM: "Keep this as @dragon-image: 'AI-generated dragon artwork'"
- ArtifactManager: Stores with label `@dragon-image`

### 2. Artifact Usage Flow

```
LLM References Label → ChatAgent Substitutes → Tool Gets Real Path
```

Example:
- User: "Analyze the dragon image"
- LLM: Calls `analyze_file("@dragon-image")`
- ChatAgent: Substitutes `@dragon-image` → `/tmp/dragon.png`
- Tool: Receives actual file path and performs analysis

### 3. Context Injection

The LLM sees available artifacts in its context:

```
Available artifacts you can reference:
@dragon-image: "dragon.png" (image/png) - AI-generated dragon artwork
@analysis-1: "Analysis of dragon.png" (text/analysis) - Detailed description of the dragon image

To use an artifact in a tool call, reference it by its label (e.g., analyze_file("@image1"))
```

## Artifact Types

- **Images**: Generated images, uploaded images
- **Text**: Analysis results, generated content
- **Code**: Generated code snippets
- **Documents**: Files, configurations
- **Data**: JSON, CSV, directory listings

## Key Features

1. **Intelligent Curation**: LLM decides what's worth keeping
2. **Semantic Labels**: Meaningful names like `@dragon-image` instead of `@image1`
3. **Automatic Substitution**: Labels are replaced with actual paths/content
4. **Multi-format Support**: Works with files, URLs, base64 content
5. **Session Persistence**: Artifacts persist throughout the conversation

## Testing

### Unit Tests
```bash
npm test -- packages/aiur/__tests__/agents/ArtifactActor.test.js
```

### Integration Tests
```bash
node scratch/test-artifact-actor-live.js      # Test with real LLM
node scratch/test-chat-agent-artifacts.js    # Full workflow test
```

## Configuration

### Enable/Disable Curation
```javascript
const artifactActor = new ArtifactActor({
  enableCuration: true,  // Use LLM for intelligent curation
  autoLabel: true       // Fall back to auto-labeling if needed
});
```

### Custom Curation Model
```javascript
const artifactActor = new ArtifactActor({
  resourceManager: resourceManager,
  // Uses claude-3-haiku-20240307 by default for fast curation
});
```

## Future Enhancements

1. **Artifact Versioning**: Track changes to artifacts over time
2. **Cross-Session Artifacts**: Share artifacts between sessions
3. **Artifact Search**: Find artifacts by content or metadata
4. **Automatic Cleanup**: Remove old/unused artifacts
5. **Artifact Transformations**: Convert between formats
6. **Artifact Relationships**: Link related artifacts together