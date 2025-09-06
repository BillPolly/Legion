# Prompt-Builder Design Document

## Overview

The `@legion/prompt-builder` package provides intelligent template processing with labeled inputs for optimal LLM prompt generation. This package sits between data extraction and LLM orchestration, focusing solely on the critical task of smart prompt formatting.

### Problem Statement

LLM prompt generation involves complex challenges:
- **Size constraints**: Prompts must fit within token limits without losing critical information
- **Content formatting**: Different data types (chat history, images, code) need specialized formatting
- **Context management**: Named variables and references must be handled intelligently
- **Quality optimization**: Prompts must be formatted for maximum LLM comprehension and response quality

### Solution Approach

A reusable `PromptBuilder` configured once with template and settings that:
1. **Stores prompt template** and processing configuration at creation
2. **Takes labeled input objects** for each prompt generation
3. **Applies intelligent formatting** based on content types and constraints
4. **Manages prompt size** automatically within token limits
5. **Produces optimized prompts** ready for LLM consumption

## Core Concepts

### Intelligent Template Processing

The `PromptBuilder` is configured once with template and settings, then reused:

```javascript
const builder = new PromptBuilder({
  template: "Analyze: {{codeContent}}\n\n{{outputInstructions}}",
  maxTokens: 4000,
  contentHandlers: { ... }
});

const prompt = builder.build(labeledInputs);
```

**Configuration**: Template + processing settings (set once)  
**Input**: Labeled input values for each prompt generation  
**Processing**: Content-aware formatting with size optimization  
**Output**: Optimally formatted prompt ready for LLM

### Content-Aware Processing

Different content types receive specialized handling:
- **Text**: Smart truncation and summarization
- **Chat History**: Message selection and compression
- **Images**: Automatic description generation
- **Code**: Syntax-aware formatting and truncation
- **Arrays**: Intelligent listing and prioritization
- **Objects**: Structured representation

### Size Management

Automatic prompt optimization:
- **Token counting**: Accurate estimation of prompt size
- **Smart truncation**: Preserve most important content
- **Summarization**: Compress large content intelligently
- **Priority handling**: Critical content preserved over optional content

### Context Variables

Named references for LLM use:
- **Variable declaration**: Make values available to LLM by name
- **Reference management**: Track and optimize variable usage
- **Scope handling**: Manage variable visibility and lifetime

## API Design

### Core Class

#### PromptBuilder

Main interface for intelligent prompt generation:

```javascript
class PromptBuilder {
  constructor(configuration = {})
  
  // MAIN FUNCTION: Build optimized prompt from labeled inputs
  build(labeledInputs, options = {})
  
  // UTILITIES
  estimateTokens(text)              // Estimate token count
  validateTemplate()                // Validate configured template
  getContentHandlers()             // Get available content handlers
  updateConfiguration(newConfig)   // Update builder configuration
}
```

**Constructor Configuration:**
```javascript
{
  template: "Your prompt template with {{placeholders}}",  // Template set once
  maxTokens: 4000,                 // Maximum prompt size
  reserveTokens: 500,              // Reserve tokens for response
  contentHandlers: {               // Content-specific processors
    chatHistory: {
      maxMessages: 10,
      summarizeOlder: true,
      prioritizeRecent: true
    },
    image: {
      summarize: true,
      maxLength: 100,
      includeMetadata: false
    },
    code: {
      preserveFormatting: true,
      maxLines: 50,
      includeComments: true
    },
    largeText: {
      summarize: true,
      maxLength: 500,
      preserveStructure: true
    }
  },
  contextVariables: {
    enabled: true,
    maxVariables: 10,
    namingStrategy: 'descriptive'
  }
}
```

**build() Options:**
```javascript
{
  priority: 'quality' | 'size' | 'balanced',  // Optimization priority
  forceInclude: ['placeholder1', ...],        // Never truncate these
  allowSummarization: true,                   // Allow content summarization
  customHandlers: {                           // Override default handlers
    'specialContent': customHandlerFunction
  }
}
```

### Content Handler System

Extensible content processing:

```javascript
class ContentHandler {
  canHandle(content, metadata)     // Check if handler applies
  process(content, constraints)    // Transform content for prompt
  estimateTokens(content)         // Estimate processed content size
  summarize(content, maxLength)   // Create summary if needed
}
```

**Built-in Handlers:**
- `TextHandler` - Smart text processing and truncation
- `ChatHistoryHandler` - Conversation optimization
- `ImageHandler` - Image description and metadata
- `CodeHandler` - Syntax-aware code formatting
- `ArrayHandler` - List processing and prioritization
- `ObjectHandler` - Structured data representation

### Size Management System

```javascript
class SizeManager {
  constructor(maxTokens, reserveTokens)
  
  estimateTokens(text)             // Token count estimation
  canFit(content, currentSize)     // Check if content fits
  optimizeContent(content, limit)  // Reduce content to fit
  prioritizeContent(contents)      // Order by importance
}
```

### Context Variable System

```javascript
class ContextManager {
  constructor(configuration)
  
  declareVariable(name, value)     // Make variable available
  formatVariables()               // Generate variable section for prompt
  validateReferences(template)    // Check variable usage
  optimizeVariables(usedRefs)     // Remove unused variables
}
```

## Template Syntax

### Basic Placeholders

```
{{variableName}} - Simple substitution
{{user.profile.name}} - Nested object access
{{#items}}...{{/items}} - Conditional sections
{{items|format:list}} - Content formatting directives
```

### Content Type Hints

```
{{chatHistory|type:chat}} - Specify content type for smart processing
{{codeSnippet|type:code|lang:javascript}} - Code with language hint
{{userImage|type:image|summarize:true}} - Image with summarization
{{largeDocument|type:text|maxLength:300}} - Text with size constraint
```

### Context Variable Declaration

```
{{@contextVar:description}} - Declare context variable
{{@userPrefs:user_preferences}} - Named context variable
Reference: Use @userPrefs in your analysis
```

## Content Processing Strategies

### Chat History Processing

**Intelligent Message Selection:**
- Prioritize recent messages
- Include important context (user goals, key decisions)
- Summarize older conversations
- Maintain conversation flow coherence

**Example Processing:**
```javascript
// Input: 50 chat messages (too large)
// Output: 8 recent + 2 summarized context blocks
{
  recent: [msg1, msg2, ...msg8],
  context: [
    "Earlier: User expressed interest in React optimization",
    "Background: Working on e-commerce site performance"
  ]
}
```

### Image Content Processing

**Smart Image Handling:**
- Generate descriptive text from image metadata
- Include relevant technical details
- Compress visual information efficiently
- Preserve critical visual context

**Example Processing:**
```javascript
// Input: 64-bit encoded image
// Output: "Screenshot showing React DevTools performance tab with 
//         component render times, highlighting UserList component 
//         taking 45ms (red indicator)"
```

### Code Content Processing

**Syntax-Aware Formatting:**
- Preserve code structure and readability
- Intelligent truncation at logical boundaries
- Include relevant comments and context
- Handle multiple file/function contexts

**Example Processing:**
```javascript
// Input: 500-line file
// Output: Key functions + context comments
// "Main UserService class with authentication logic:
// [code snippet]
// ... [additional methods omitted for brevity]"
```

### Large Text Processing

**Intelligent Summarization:**
- Extract key points and main ideas
- Preserve document structure (headings, sections)
- Maintain logical flow and relationships
- Include critical details and examples

## Size Management Algorithms

### Token Estimation

**Accurate Token Counting:**
- Character-based estimation with model-specific adjustments
- Account for special characters and formatting
- Reserve tokens for response generation
- Real-time size tracking during prompt building

### Content Prioritization

**Smart Content Ranking:**
```javascript
Priority Levels:
1. CRITICAL - Required for task completion
2. IMPORTANT - Significantly improves response quality  
3. HELPFUL - Provides additional context
4. OPTIONAL - Nice-to-have information
```

### Optimization Strategies

**Size Reduction Techniques:**
- **Selective inclusion**: Include highest priority content first
- **Progressive summarization**: Compress less critical content
- **Intelligent truncation**: Cut at natural boundaries
- **Content deduplication**: Remove redundant information

## Advanced Features

### Context Variable Management

**Variable Declaration:**
```
Context Variables Available:
- @userGoals: "Optimize website performance"  
- @techStack: ["React", "Node.js", "MongoDB"]
- @constraints: { timeline: "2 weeks", budget: "limited" }

Use these variables in your analysis and recommendations.
```

**Smart Variable Selection:**
- Analyze template to identify referenced variables
- Include only variables actually used in prompt
- Optimize variable descriptions for clarity
- Handle variable dependencies and relationships

### Dynamic Content Adaptation

**Adaptive Formatting:**
- Adjust content detail level based on available space
- Switch between full content and summaries dynamically
- Optimize for different LLM models and their preferences
- Handle content type mixing intelligently

### Template Validation and Analysis

**Template Intelligence:**
- Validate placeholder syntax and references
- Analyze content type requirements
- Estimate final prompt size before processing
- Suggest optimizations for better LLM performance

## Integration with Legion Framework

### Input Pipeline Integration

Works seamlessly with prepared labeled inputs:

```javascript
// Data prepared by future @legion/object-query package
const labeledInputs = {
  userContext: extractedUserData,
  chatHistory: processedConversation,
  codeFiles: relevantSourceCode,
  outputSchema: responseValidatorInstructions
};

// Intelligent prompt building
const prompt = builder.build(template, labeledInputs);
```

### Output Schema Integration

Leverages existing `@legion/output-schema` as simple labeled input:

```javascript
// Create builder with template including output instructions placeholder
const builder = new PromptBuilder({
  template: `Analyze the code: {{codeContent}}

{{outputInstructions}}`,
  maxTokens: 4000
});

// Output schema instructions are just another labeled input
const outputInstructions = responseValidator.generateInstructions(exampleData);

const prompt = builder.build({
  codeContent: sourceCode,
  outputInstructions: outputInstructions  // No special processing needed
});
```

### Legion Framework Compatibility

**ResourceManager Integration:**
```javascript
// Access via ResourceManager
const resourceManager = await ResourceManager.getInstance();
const PromptBuilder = resourceManager.get('PromptBuilder');
```

**Configuration Management:**
- Token limits from model configuration
- Content handler settings from environment
- Template directories from project structure

## Usage Examples

### Basic Usage Pattern

```javascript
import { PromptBuilder } from '@legion/prompt-builder';

// 1. Create builder with template and configuration
const builder = new PromptBuilder({
  template: `You are a code review assistant.

Code to review:
{{codeContent|type:code}}

Previous feedback:
{{previousReviews|type:chat}}

Focus areas: {{focusAreas}}

Please provide detailed analysis.`,

  maxTokens: 4000,
  reserveTokens: 500,
  contentHandlers: {
    codeContent: { maxLines: 50, preserveFormatting: true },
    previousReviews: { maxMessages: 5, summarizeOlder: true }
  }
});

// 2. Generate optimized prompts by providing labeled inputs
const prompt1 = builder.build({
  codeContent: "function calculateTotal(items) { ... }", // Will be formatted as code
  previousReviews: [...chatMessages], // Will be optimized as chat history
  focusAreas: ["performance", "security", "maintainability"] // Will be formatted as list
});

const prompt2 = builder.build({
  codeContent: "class UserService { ... }", // Different code, same template
  previousReviews: [...otherChatMessages],
  focusAreas: ["maintainability", "testing"]
});
```

### Advanced Content Processing

```javascript
const advancedBuilder = new PromptBuilder({
  template: `Development Task Analysis:

Project Context:
{{projectContext|type:text|maxLength:300}}

Current Codebase:
{{codeFiles|type:code|maxLines:100}}

Chat History:
{{chatHistory|type:chat|maxMessages:8}}

User's Image Reference:
{{screenshot|type:image}}

Requirements: {{requirements}}

Context Variables:
{{@userGoals:project_goals}}
{{@techStack:technology_stack}}
{{@timeline:project_timeline}}

Provide implementation plan using @userGoals and @techStack.`,

  maxTokens: 4000,
  contentHandlers: {
    projectContext: { maxLength: 300, summarize: true },
    codeFiles: { maxLines: 100, preserveFormatting: true },
    chatHistory: { maxMessages: 8, summarizeOlder: true },
    screenshot: { summarize: true, maxLength: 150 }
  }
});

// Reusable for multiple similar tasks
const optimizedPrompt1 = advancedBuilder.build({
  projectContext: longProjectDescription,
  codeFiles: [file1, file2, file3],
  chatHistory: conversationHistory,
  screenshot: imageData,
  requirements: taskRequirements,
  // Context variables
  project_goals: "Build scalable e-commerce platform",
  technology_stack: ["React", "Node.js", "PostgreSQL"],
  project_timeline: "3 months"
}, {
  priority: 'quality',
  forceInclude: ['requirements']
});

const optimizedPrompt2 = advancedBuilder.build({
  projectContext: differentProjectDescription,
  codeFiles: [otherFiles],
  chatHistory: otherConversation,
  // Same template, different inputs
});
```

### Size-Constrained Processing

```javascript
const sizeConstrainedBuilder = new PromptBuilder({
  template: `Code Review: {{codeContent}}
  
Discussion: {{chatHistory}}

Focus: {{reviewFocus}}`,

  maxTokens: 2000, // Smaller limit
  contentHandlers: {
    chatHistory: {
      maxMessages: 5, // Fewer messages
      summarizeOlder: true,
      compressionRatio: 0.3
    },
    codeContent: {
      maxLines: 30, // Smaller code samples
      includeComments: false // Strip comments to save space
    }
  }
});

// Compact prompt generation
const compactPrompt = sizeConstrainedBuilder.build({
  codeContent: largeCodeFile,
  chatHistory: longConversation,
  reviewFocus: "performance optimization"
}, {
  priority: 'size', // Prioritize fitting within limits
  allowSummarization: true
});
```

### Multi-Language Code Processing

```javascript
const codeReviewBuilder = new PromptBuilder({
  template: `Code Review Request:

Frontend Code:
{{frontendCode|type:code|lang:javascript}}

Backend Code:  
{{backendCode|type:code|lang:javascript}}

Database Schema:
{{dbSchema|type:code|lang:sql}}

Styling:
{{cssStyles|type:code|lang:css}}

Please review all components for consistency and best practices.`,

  maxTokens: 4000,
  contentHandlers: {
    frontendCode: { maxLines: 50, preserveFormatting: true },
    backendCode: { maxLines: 40, includeComments: true },
    dbSchema: { maxLines: 30, preserveFormatting: true },
    cssStyles: { maxLines: 25, compressWhitespace: false }
  }
});

// Intelligent code formatting with syntax awareness
const codeReviewPrompt = codeReviewBuilder.build({
  frontendCode: reactComponentCode,
  backendCode: expressServerCode, 
  dbSchema: sqlSchemaDefinition,
  cssStyles: componentStyles
});
```

### Context Variable Usage

```javascript
const contextBuilder = new PromptBuilder({
  template: `System Analysis Task:

Current System:
{{systemDescription}}

Performance Data:
{{performanceMetrics}}

Context Variables:
{{@currentLoad:system_load}}
{{@userCount:active_users}}
{{@errorRate:error_percentage}}

Analysis Requirements:
- Reference @currentLoad when discussing capacity
- Consider @userCount for scaling recommendations  
- Use @errorRate to assess system health

Provide optimization recommendations using the context variables.`,

  maxTokens: 3000,
  contextVariables: {
    enabled: true,
    maxVariables: 5,
    namingStrategy: 'descriptive'
  }
});

// Context variables intelligently formatted and managed
const contextPrompt = contextBuilder.build({
  systemDescription: systemOverview,
  performanceMetrics: metricsData,
  system_load: "85% CPU, 70% Memory",
  active_users: "1,247 concurrent users", 
  error_percentage: "0.3% error rate"
});
```

## Content Handler Specifications

### Chat History Handler

**Intelligent Conversation Processing:**

```javascript
// Configuration
chatHistory: {
  maxMessages: 10,           // Maximum messages to include
  summarizeOlder: true,      // Summarize older messages
  prioritizeRecent: true,    // Weight recent messages higher
  includeContext: true,      // Include conversation context
  compressionRatio: 0.4,     // Target compression for summaries
  preserveUserIntent: true   // Always preserve user's main goals
}

// Processing Logic
1. Analyze conversation for key themes and user intent
2. Select most recent N messages (full detail)
3. Summarize older messages into context blocks
4. Preserve critical decisions and user preferences
5. Format for optimal LLM understanding
```

**Example Output:**
```
Recent Conversation:
User: "I need help optimizing this React component"
Assistant: "I can help with that. What specific performance issues are you seeing?"
User: "The UserList component is taking 300ms to render"
Assistant: "Let's look at the component code and identify bottlenecks"

Earlier Context:
- User is working on e-commerce site performance optimization
- Previously discussed React.memo and useMemo optimization techniques
- Goal: Reduce page load time below 2 seconds
```

### Image Handler

**Smart Image Processing:**

```javascript
// Configuration  
image: {
  summarize: true,           // Convert to text description
  maxLength: 150,           // Maximum description length
  includeMetadata: true,    // Include technical details
  preserveText: true,       // Extract any visible text
  contextAware: true        // Consider surrounding context
}

// Processing Logic
1. Analyze image content and extract key visual elements
2. Generate descriptive text covering important details
3. Include any visible text or UI elements
4. Compress visual information efficiently
5. Preserve context-relevant details
```

**Example Output:**
```
Image Analysis: Screenshot of React DevTools Performance profiler showing component render times. UserList component highlighted in red with 347ms render time. Component tree shows 50+ child components. Memory usage at 85%. Key issue: UserList re-rendering on every state change.
```

### Code Handler

**Syntax-Aware Code Processing:**

```javascript
// Configuration
code: {
  preserveFormatting: true,  // Maintain code structure
  maxLines: 50,             // Maximum lines to include  
  includeComments: true,    // Preserve important comments
  showContext: true,        // Include surrounding context
  languageHints: true       // Add language-specific formatting
}

// Processing Logic
1. Analyze code structure and identify key components
2. Preserve critical functions and logic
3. Intelligent truncation at logical boundaries
4. Include relevant comments and documentation
5. Maintain syntax highlighting hints
```

**Example Output:**
```
JavaScript Code (React Component):
```javascript
// UserList component - performance critical
function UserList({ users, onUserSelect }) {
  // ISSUE: Missing memoization
  const filteredUsers = users.filter(user => user.active);
  
  return (
    <div className="user-list">
      {filteredUsers.map(user => (
        <UserCard key={user.id} user={user} onSelect={onUserSelect} />
      ))}
    </div>
  );
}
// ... [15 additional methods omitted for brevity]
```

### Large Text Handler

**Intelligent Text Summarization:**

```javascript
// Configuration
largeText: {
  summarize: true,          // Create summaries for large content
  maxLength: 400,          // Target summary length
  preserveStructure: true, // Maintain document structure
  extractKeyPoints: true,  // Highlight important information
  includeExamples: true   // Preserve relevant examples
}

// Processing Logic
1. Analyze text structure (headings, sections, paragraphs)
2. Extract key points and main arguments
3. Preserve important examples and details
4. Maintain logical flow and relationships
5. Compress redundant or verbose content
```

## Size Management Implementation

### Token Estimation Algorithm

**Accurate Size Calculation:**
```javascript
// Token estimation strategy
function estimateTokens(text) {
  // Base character count with model-specific adjustments
  const baseTokens = text.length / 4; // Rough approximation
  
  // Adjustments for content type
  const codeMultiplier = 1.2;    // Code tends to use more tokens
  const chatMultiplier = 0.9;    // Conversational text more efficient
  const structuredMultiplier = 1.1; // JSON/structured content
  
  // Apply formatting overhead
  const formattingOverhead = 1.05; // 5% overhead for formatting
  
  return Math.ceil(baseTokens * contentMultiplier * formattingOverhead);
}
```

### Optimization Strategies

**Progressive Size Reduction:**

1. **Priority-based inclusion**: Include critical content first
2. **Smart summarization**: Compress non-critical sections
3. **Selective truncation**: Remove least important details
4. **Content deduplication**: Eliminate redundant information
5. **Format optimization**: Use most efficient representation

**Example Optimization:**
```javascript
// Original: 6000 tokens
// Target: 4000 tokens
// Strategy:
// 1. Keep requirements (500 tokens) - CRITICAL
// 2. Summarize chat history (1200 → 600 tokens)  
// 3. Truncate code samples (2000 → 1200 tokens)
// 4. Compress project context (800 → 400 tokens)
// 5. Include essential context variables (300 tokens)
// Final: 3700 tokens (within limit)
```

## Error Handling and Validation

### Template Validation

**Comprehensive Template Analysis:**
- Validate placeholder syntax and references
- Check for undefined variable references  
- Estimate minimum and maximum prompt sizes
- Identify content type requirements
- Suggest optimizations for better performance

### Content Validation

**Input Quality Assurance:**
- Validate labeled input structure
- Check for missing required content
- Verify content type compatibility
- Estimate processing requirements
- Warn about potential size issues

### Processing Error Recovery

**Graceful Failure Handling:**
- Fallback strategies for oversized content
- Alternative formatting when handlers fail
- Partial prompt generation with warnings
- Clear error messages for debugging

## Performance Considerations

### Efficient Processing

**Optimization Strategies:**
- Lazy evaluation of content handlers
- Caching of token estimates and summaries
- Incremental prompt building with size tracking
- Minimal memory footprint for large content processing

### Content Handler Performance

**Fast Content Processing:**
- Efficient algorithms for text summarization
- Optimized image metadata extraction
- Fast code analysis and truncation
- Minimal overhead for simple content types

## Usage Patterns and Examples

### Web Development Task

```javascript
const webDevBuilder = new PromptBuilder({
  template: `Development Task: {{taskTitle}}

Current Codebase Analysis:
{{codeAnalysis|type:code|maxLines:40}}

User Requirements:
{{userRequirements|type:text|maxLength:200}}

Previous Discussion:
{{chatHistory|type:chat|maxMessages:6}}

Technical Constraints:
{{@techStack:technology_stack}}
{{@timeline:project_deadline}}

Create implementation plan considering @techStack and @timeline.`,

  maxTokens: 4000,
  contentHandlers: {
    codeAnalysis: { maxLines: 40, preserveFormatting: true },
    userRequirements: { maxLength: 200, summarize: true },
    chatHistory: { maxMessages: 6, summarizeOlder: true }
  }
});

const webDevPrompt = webDevBuilder.build({
  taskTitle: "Add real-time notifications",
  codeAnalysis: [reactCode, serverCode, dbSchema],
  userRequirements: longRequirementsDocument,
  chatHistory: conversationArray,
  technology_stack: "React/Node.js/PostgreSQL stack",
  project_deadline: "2 weeks remaining"
});
```

### Code Review Task

```javascript
const reviewBuilder = new PromptBuilder({
  template: `Code Review Request:

File: {{fileName}}
{{sourceCode|type:code|lang:{{language}}}}

Issues Found:
{{staticAnalysis|type:text|maxLength:300}}

Review History:
{{previousReviews|type:chat|maxMessages:4}}

Focus on: {{reviewFocus}}

Provide detailed feedback with specific suggestions.`,

  maxTokens: 3500,
  contentHandlers: {
    sourceCode: { maxLines: 60, preserveFormatting: true },
    staticAnalysis: { maxLength: 300, preserveStructure: true },
    previousReviews: { maxMessages: 4, summarizeOlder: false }
  }
});

const reviewPrompt = reviewBuilder.build({
  fileName: "UserService.js",
  sourceCode: userServiceCode,
  language: "javascript", 
  staticAnalysis: eslintOutput,
  previousReviews: reviewConversation,
  reviewFocus: ["security", "performance", "maintainability"]
});
```

### Documentation Generation Task

```javascript
const docBuilder = new PromptBuilder({
  template: `Documentation Generation:

API Endpoints:
{{apiEndpoints|type:code|lang:javascript}}

Usage Examples:
{{usageExamples|type:code|maxLines:30}}

Current Documentation:
{{existingDocs|type:text|summarize:true}}

Context:
{{@apiVersion:current_version}}
{{@audience:target_audience}}

Generate comprehensive API documentation for @audience using @apiVersion.`,

  maxTokens: 4000,
  contentHandlers: {
    apiEndpoints: { maxLines: 50, includeComments: true },
    usageExamples: { maxLines: 30, preserveFormatting: true },
    existingDocs: { summarize: true, maxLength: 400 }
  }
});

const docPrompt = docBuilder.build({
  apiEndpoints: endpointDefinitions,
  usageExamples: codeExamples,
  existingDocs: currentDocumentation,
  current_version: "v2.1.0",
  target_audience: "frontend developers"
});
```

## Integration Architecture

### Data Flow Pipeline

```
Object-Query → Labeled Inputs → Prompt-Builder → Formatted Prompt → LLM → Output-Schema → Validated Response
```

### Package Boundaries

**Clear Responsibilities:**
- **Object-Query**: Data extraction and preparation
- **Prompt-Builder**: Intelligent formatting and optimization (THIS PACKAGE)
- **Prompt-Manager**: Complete orchestration with retry logic
- **Output-Schema**: Response validation and parsing

### Configuration Inheritance

**Hierarchical Configuration:**
- Global Legion settings (token limits, model preferences)
- Package-level defaults (content handler settings)
- Instance-specific overrides (per-prompt customization)
- Runtime options (priority, force-include lists)

This design creates a focused, intelligent prompt formatting system that handles the complex task of converting prepared data into optimal LLM prompts while respecting size constraints and content type requirements.