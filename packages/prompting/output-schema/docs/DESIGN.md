# Output-Schema Design Document

## Overview

The `@legion/output-schema` package provides a focused response processing system with two core functions:
1. **Prompt Generation**: Generate format instructions from schema + examples for inclusion in LLM prompts
2. **Response Processing**: Parse and validate LLM responses into structured data or return actionable errors

This is NOT a complete LLM interaction manager - it's a reusable validator component that will be used by higher-level prompt orchestration systems.

### Problem Statement

LLMs produce responses in various formats (JSON, XML, delimited sections, natural text with tags), and current approaches require format-specific parsing logic. Additionally, instructing LLMs on the desired output format requires manually crafting format examples and explanations.

### Solution Approach  

A reusable `ResponseValidator` that:
1. **Generates format instructions** from schema + example data to include in prompts
2. **Processes responses** using extended JSON Schema with multi-format support
3. **Returns standardized results** (`{success, data}` or `{success, errors}`)
4. **Provides actionable errors** for reprompting by higher-level systems

## Core Concepts

### Dual-Function Validator

The `ResponseValidator` serves two distinct purposes:

**1. Prompt Generation Function:**
```javascript
const validator = new ResponseValidator(schema);
const instructions = validator.generateInstructions(exampleData, options);
// Returns format instructions to include in main prompt
```

**2. Response Processing Function:**
```javascript
const result = validator.process(llmResponse);
// Returns: { success: true, data: {...} } OR { success: false, errors: [...] }
```

### Schema-Driven Processing

A single extended schema defines:
- **Logical Structure**: What data fields are expected (standard JSON Schema)
- **Format Specifications**: How each format should represent the data (`x-format` extensions)
- **Validation Rules**: How to verify correctness and provide error feedback

The validator intelligently generates prompt instructions by analyzing the schema structure + example data, without any prompt-specific configuration in the schema itself.

### Standardized Result Format

All processing returns a consistent structure:
```javascript
// Success
{ success: true, data: parsedObject }

// Failure  
{ success: false, errors: [actionableErrorObjects] }
```

### Multi-Format Support

The system supports these output formats:
- **JSON**: Standard JSON objects with native types
- **XML**: Element-based with configurable tags and attributes  
- **Delimited Sections**: Text sections with custom delimiters
- **Tagged Content**: Mixed content with XML-style tags
- **Markdown**: Structured markdown with headers and lists

## Extended JSON Schema Specification

### Base Schema Structure

Extended schemas use standard JSON Schema with new `x-format` and `x-parsing` properties:

```json
{
  "$schema": "https://legion.dev/output-schema/v1",
  "type": "object",
  "properties": {
    "task": {
      "type": "string",
      "description": "Main task description",
      "minLength": 5
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "steps": {
      "type": "array", 
      "items": { "type": "string" },
      "minItems": 1
    }
  },
  "required": ["task", "confidence"],
  "x-format": {
    "xml": {
      "root-element": "response",
      "properties": {
        "steps": { 
          "element": "steps",
          "item-element": "step" 
        }
      }
    },
    "delimited": {
      "section-pattern": "---{NAME}---",
      "properties": {
        "steps": { "list-format": "numbered" }
      }
    }
  }
}
```

### Format Extension Properties

#### `x-format` - Format-Specific Rendering

**XML Format Options:**
```json
"x-format": {
  "xml": {
    "root-element": "response",
    "properties": {
      "fieldName": {
        "element": "custom-tag",
        "attribute": false,
        "cdata": false
      },
      "arrayField": {
        "element": "container",
        "item-element": "item"
      }
    },
    "namespace": "http://legion.dev/response",
    "pretty-print": true
  }
}
```

**Delimited Format Options:**
```json
"x-format": {
  "delimited": {
    "section-pattern": "---{NAME}---",
    "end-pattern": "---END-{NAME}---",
    "properties": {
      "arrayField": {
        "list-format": "numbered" | "bullet" | "plain",
        "item-prefix": "• "
      }
    },
    "case-insensitive": true
  }
}
```

**Tagged Format Options:**
```json
"x-format": {
  "tagged": {
    "tag-case": "uppercase" | "lowercase" | "title",
    "properties": {
      "fieldName": { "tag": "CUSTOM_TAG" },
      "arrayField": { 
        "multi-value": "separate-tags" | "comma-separated",
        "tag": "ITEM"
      }
    }
  }
}
```

**Markdown Format Options:**
```json
"x-format": {
  "markdown": {
    "properties": {
      "fieldName": { 
        "header": "## Field Name",
        "level": 2
      },
      "arrayField": {
        "header": "## Items",
        "list-style": "ordered" | "unordered",
        "code-block": false
      }
    }
  }
}
```

#### `x-parsing` - Parsing Configuration

```json
"x-parsing": {
  "format-detection": {
    "enabled": true,
    "strategies": ["json", "xml", "delimited", "tagged", "markdown"],
    "fallback-order": ["json", "xml", "delimited"],
    "confidence-threshold": 0.8
  },
  "error-recovery": {
    "mode": "strict" | "lenient" | "aggressive",
    "auto-repair": true,
    "partial-results": true,
    "type-coercion": true
  },
  "validation": {
    "strict-types": false,
    "required-enforcement": "error" | "warn" | "ignore",
    "additional-properties": "allow" | "warn" | "error"
  }
}
```

### Property-Level Format Control

Individual properties can override global format settings:

```json
{
  "properties": {
    "code": {
      "type": "string",
      "x-format": {
        "json": { "escape-newlines": true },
        "xml": { "cdata": true },
        "delimited": { 
          "wrapper": "```",
          "preserve-whitespace": true
        },
        "markdown": { "code-fence": "javascript" }
      }
    },
    "items": {
      "type": "array",
      "items": { "type": "string" },
      "x-format": {
        "xml": { 
          "container": "items",
          "item": "item"
        },
        "delimited": { 
          "style": "bullet-list",
          "prefix": "• "
        },
        "tagged": {
          "multi-tag": true,
          "tag": "ITEM"
        }
      }
    }
  }
}
```

## Supported Output Formats

### JSON Format

**Standard JSON with native types:**
```json
{
  "task": "Parse configuration files",
  "confidence": 0.85,
  "steps": ["Read file", "Parse JSON", "Validate schema"]
}
```

**Schema Extensions:** None required - uses standard JSON Schema validation.

### XML Format  

**Element-based structure:**
```xml
<response>
  <task>Parse configuration files</task>
  <confidence>0.85</confidence>
  <steps>
    <step>Read file</step>
    <step>Parse JSON</step>
    <step>Validate schema</step>
  </steps>
</response>
```

**Schema Extensions:**
- `root-element`: Root XML element name
- `element`: Custom element names for properties
- `item-element`: Element name for array items
- `attribute`: Store as XML attribute instead of element
- `cdata`: Wrap content in CDATA section
- `namespace`: XML namespace

### Delimited Sections Format

**Text sections with clear boundaries:**
```
---TASK---
Parse configuration files
---END-TASK---

---CONFIDENCE---
0.85
---END-CONFIDENCE---

---STEPS---
1. Read file
2. Parse JSON  
3. Validate schema
---END-STEPS---
```

**Schema Extensions:**
- `section-pattern`: Start delimiter pattern (supports `{NAME}` placeholder)
- `end-pattern`: End delimiter pattern (optional)
- `list-format`: How arrays are formatted (`numbered`, `bullet`, `plain`)
- `case-insensitive`: Allow flexible delimiter casing

### Tagged Content Format

**Mixed content with XML-style tags:**
```
<TASK>Parse configuration files</TASK>
<CONFIDENCE>0.85</CONFIDENCE>
<STEPS>
<STEP>Read file</STEP>
<STEP>Parse JSON</STEP>
<STEP>Validate schema</STEP>
</STEPS>
```

**Schema Extensions:**
- `tag-case`: Tag case style (`uppercase`, `lowercase`, `title`)
- `tag`: Custom tag name for property
- `multi-value`: How arrays are represented (`separate-tags`, `comma-separated`)

### Markdown Format

**Structured markdown with headers:**
```markdown
## Task
Parse configuration files

## Confidence
0.85

## Steps
1. Read file
2. Parse JSON
3. Validate schema
```

**Schema Extensions:**
- `header`: Markdown header text
- `level`: Header level (1-6)
- `list-style`: List format (`ordered`, `unordered`)
- `code-block`: Wrap content in code block

## Processing Pipeline

### 1. Schema Validation

Extended schemas are validated to ensure:
- Valid JSON Schema structure
- Consistent `x-format` properties
- Supported format combinations
- Required property mappings

### 2. Format Detection

Automatic format detection uses multiple strategies:

**JSON Detection:**
- Look for `{` at start (ignoring whitespace)
- Validate bracket matching
- Check for JSON-like structure

**XML Detection:**  
- Look for `<` at start
- Check for matching opening/closing tags
- Validate XML structure

**Delimited Detection:**
- Look for delimiter patterns from schema
- Check for section boundaries
- Validate expected sections exist

**Tagged Detection:**
- Look for `<TAG>content</TAG>` patterns
- Match against schema tag specifications
- Check for required tags

**Markdown Detection:**
- Look for markdown headers (`#`, `##`)
- Check for list structures
- Match against expected sections

### 3. Format-Specific Parsing

Each format has a specialized parser:

**JSON Parser:**
- Uses JSON5 for lenient parsing
- Extracts JSON from markdown blocks
- Handles malformed brackets

**XML Parser:**
- Regex-based extraction for simplicity
- Handles nested elements
- Supports attributes and CDATA

**Delimited Parser:**  
- Pattern matching for sections
- Flexible delimiter recognition
- List parsing (numbered, bullet, plain)

**Tagged Parser:**
- Tag-based content extraction
- Handles nested and repeated tags
- Flexible tag casing

**Markdown Parser:**
- Header-based section extraction
- List structure parsing
- Code block handling

### 4. Data Validation

Parsed data is validated using the base JSON Schema:
- Type validation using `@legion/schema`
- Required property checking
- Constraint validation (min/max, patterns, etc.)
- Custom format validation

### 5. Error Reporting

Errors are classified and structured for reprompting:

**Parse Errors:**
```json
{
  "type": "parsing",
  "format": "json",
  "message": "Unexpected token '}' at position 45",
  "suggestion": "Check for missing comma before closing brace",
  "location": { "line": 3, "column": 12 }
}
```

**Validation Errors:**
```json
{
  "type": "validation", 
  "field": "confidence",
  "message": "Value 1.2 exceeds maximum of 1",
  "suggestion": "Use a decimal value between 0 and 1 (e.g., 0.85)",
  "received": 1.2,
  "expected": "number between 0 and 1"
}
```

**Missing Field Errors:**
```json
{
  "type": "missing",
  "field": "task", 
  "message": "Required field 'task' not found",
  "suggestion": "Add a task field with a string description",
  "format_hint": "In XML: <task>description</task>"
}
```

## API Design

### Core Class

#### ResponseValidator

Main interface with dual functionality:

```javascript
class ResponseValidator {
  constructor(schema, options = {})
  
  // PROMPT GENERATION: Generate format instructions from example data
  generateInstructions(exampleData, options = {})
  
  // RESPONSE PROCESSING: Parse response into structured data or errors
  process(responseText)
  
  // Utilities
  validateSchema()           // Validate the extended schema definition
  getSupportedFormats()     // Get formats supported by this schema
}
```

**Constructor Options:**
```javascript
{
  strictMode: false,           // Strict vs lenient parsing
  preferredFormat: 'auto',     // Default format preference
  autoRepair: true,            // Attempt to repair malformed responses
  partialResults: true         // Return partial data on validation errors
}
```

**generateInstructions() Options:**
```javascript
{
  format: 'json' | 'xml' | 'delimited' | 'tagged' | 'markdown' | 'auto',
  verbosity: 'concise' | 'detailed',
  includeExample: true,        // Whether to show the provided example
  includeConstraints: true,    // Include validation rules (min/max, required, etc.)
  includeDescriptions: true,   // Include field descriptions from schema
  errorPrevention: true        // Include common mistake warnings
}
```

#### FormatDetector

Automatic format detection:

```javascript
class FormatDetector {
  constructor(schema)
  
  // Detect response format
  detect(responseText)
  
  // Get detection confidence scores
  getConfidenceScores(responseText)
  
  // Check if format is supported
  isFormatSupported(format)
}
```

#### ResponseParser

Format-specific parsing:

```javascript
class ResponseParser {
  constructor(schema, format)
  
  // Parse response in specific format
  parse(responseText)
  
  // Validate parsed data
  validate(data)
  
  // Get parsing errors
  getErrors()
}
```

#### SchemaExtensions

Schema extension utilities:

```javascript
class SchemaExtensions {
  // Validate extended schema
  static validateExtendedSchema(schema)
  
  // Extract format specifications
  static getFormatSpecs(schema, format)
  
  // Generate format instructions
  static generateInstructions(schema, format)
  
  // Merge format options
  static mergeFormatOptions(global, property)
}
```

### Processing Result Format

All processing returns a standardized result:

```javascript
// Success result
{
  success: true,
  data: { /* parsed and validated data */ },
  format: "json",
  confidence: 0.95,
  warnings: []
}

// Error result  
{
  success: false,
  errors: [
    {
      type: "parsing" | "validation" | "missing",
      field: "fieldName",
      message: "Human readable error",
      suggestion: "Specific fix suggestion",
      location: { line: 3, column: 12 },
      received: "actual value",
      expected: "expected format"
    }
  ],
  partialData: { /* any successfully parsed data */ },
  format: "detected_format",
  confidence: 0.3
}
```

## Integration with Legion Framework

### Focused Component Role

This package is designed as a **reusable component** for higher-level systems:
- **Used by**: Prompt orchestration systems, LLM interaction managers
- **Provides**: Format instruction generation and response validation
- **Does NOT handle**: Complete prompt assembly, retry logic, LLM communication

### ResourceManager Integration

```javascript
// Access via ResourceManager
const resourceManager = await ResourceManager.getInstance();
const ResponseValidator = resourceManager.get('ResponseValidator');
```

### Schema Package Integration

Leverages existing `@legion/schema` for core validation:

```javascript
import { createValidator } from '@legion/schema';

class ResponseValidator {
  constructor(schema) {
    this.baseValidator = createValidator(this.extractBaseSchema(schema));
    this.formatSpecs = this.extractFormatSpecs(schema);
  }
}
```

### Usage by Higher-Level Systems

This validator will be used by prompt orchestration packages:

```javascript
// Future prompt orchestration system will use this validator
class PromptOrchestrator {
  constructor(specification) {
    this.validator = new ResponseValidator(specification.responseSchema);
  }
  
  async execute(userInput) {
    // Generate full prompt including format instructions
    const formatInstructions = this.validator.generateInstructions(specification.example);
    const fullPrompt = this.assemblePrompt(userInput, formatInstructions);
    
    // Handle response with retry logic
    let response = await this.llm.complete(fullPrompt);
    let result = this.validator.process(response);
    
    while (!result.success && retries < maxRetries) {
      const errorFeedback = this.generateErrorFeedback(result.errors);
      response = await this.llm.complete(fullPrompt + errorFeedback);
      result = this.validator.process(response);
    }
    
    return result;
  }
}
```

## Usage Examples

### Basic Usage Pattern

```javascript
import { ResponseValidator } from '@legion/output-schema';

// 1. Define response schema
const schema = {
  type: 'object',
  properties: {
    summary: { 
      type: 'string',
      description: 'Brief summary of the analysis'
    },
    score: { 
      type: 'number', 
      minimum: 0, 
      maximum: 10,
      description: 'Confidence score from 0-10'
    },
    tags: { 
      type: 'array', 
      items: { type: 'string' },
      maxItems: 5,
      description: 'Relevant category tags'
    }
  },
  required: ['summary', 'score']
};

// 2. Create reusable validator
const validator = new ResponseValidator(schema);

// 3. PROMPT GENERATION: Create instructions for LLM
const exampleData = {
  summary: "User feedback indicates positive sentiment towards the new feature",
  score: 8.5,
  tags: ["positive", "feature-feedback", "user-satisfaction"]
};

const instructions = validator.generateInstructions(exampleData, {
  format: 'json',
  includeExamples: true,
  includeExplanations: true
});

// Use in your main prompt:
const mainPrompt = `
Analyze the following user feedback and provide structured results.

${instructions}

User Feedback: "${userFeedback}"
`;

// 4. RESPONSE PROCESSING: Parse LLM response (reusable)
const llmResponse = await llm.complete(mainPrompt);
const result = validator.process(llmResponse);

if (result.success) {
  console.log('Summary:', result.data.summary);
  console.log('Score:', result.data.score);
  console.log('Tags:', result.data.tags);
} else {
  // Errors are structured for reprompting by higher-level systems
  console.log('Processing failed:', result.errors);
}
```

### Multi-Format Schema

```javascript
const schema = {
  type: 'object',
  properties: {
    analysis: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    recommendations: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['analysis'],
  'x-format': {
    'xml': {
      'root-element': 'analysis-result',
      'properties': {
        'recommendations': {
          'element': 'recommendations',
          'item-element': 'recommendation'
        }
      }
    },
    'delimited': {
      'section-pattern': '===={NAME}====',
      'properties': {
        'recommendations': { 'list-format': 'bullet' }
      }
    },
    'tagged': {
      'tag-case': 'uppercase',
      'properties': {
        'recommendations': { 'multi-value': 'separate-tags' }
      }
    }
  }
};

const processor = new OutputSchema(schema);

// Works with any of these response formats:

// JSON
const jsonResponse = `{
  "analysis": "Market shows strong growth",
  "confidence": 0.87,
  "recommendations": ["Buy", "Hold long-term"]
}`;

// XML  
const xmlResponse = `<analysis-result>
  <analysis>Market shows strong growth</analysis>
  <confidence>0.87</confidence>
  <recommendations>
    <recommendation>Buy</recommendation>
    <recommendation>Hold long-term</recommendation>
  </recommendations>
</analysis-result>`;

// Delimited
const delimitedResponse = `====ANALYSIS====
Market shows strong growth
====CONFIDENCE====
0.87
====RECOMMENDATIONS====
• Buy
• Hold long-term`;

// Tagged
const taggedResponse = `<ANALYSIS>Market shows strong growth</ANALYSIS>
<CONFIDENCE>0.87</CONFIDENCE>
<RECOMMENDATIONS>Buy</RECOMMENDATIONS>
<RECOMMENDATIONS>Hold long-term</RECOMMENDATIONS>`;

// All produce the same result
const result = processor.process(anyResponse);
```

### Intelligent Prompt Generation

The validator analyzes the schema + example to generate optimal instructions:

**Schema Analysis:**
- Extracts field types, constraints, and descriptions
- Identifies required vs optional fields
- Determines format-specific rendering rules
- Analyzes validation requirements

**Example Analysis:**
- Infers realistic value patterns from example data
- Determines appropriate formatting style
- Identifies array structures and content types
- Understands field relationships

**Generated Instructions Example:**

When `validator.generateInstructions(exampleData)` combines this analysis:

```
RESPONSE FORMAT REQUIRED:

Return your response as valid JSON matching this exact structure:

{
  "summary": "<string: Brief summary of the analysis>",
  "score": <number: Confidence score from 0-10>,
  "tags": ["<string>", "<string>", ...] // Max 5 items: Relevant category tags
}

EXAMPLE OUTPUT:
{
  "summary": "User feedback indicates positive sentiment towards the new feature",
  "score": 8.5,
  "tags": ["positive", "feature-feedback", "user-satisfaction"]
}

VALIDATION REQUIREMENTS:
- Return ONLY valid JSON, no additional text or markdown
- Required fields: summary, score (tags is optional)
- Score must be a number between 0 and 10
- Tags array cannot exceed 5 items
- Each tag must be a string
```

The validator generates this by intelligently combining:
- Schema constraints (`minimum: 0, maximum: 10, maxItems: 5`)
- Field descriptions from schema
- Required field specifications
- Example data patterns
- Format-specific best practices

### Error Handling for Reprompting Systems

The validator produces structured errors that higher-level systems can use:

```javascript
const result = validator.process(malformedResponse);

if (!result.success) {
  // Structured errors ready for reprompting systems
  console.log(result.errors);
  /*
  [
    {
      type: "parsing",
      message: "Invalid JSON: Unexpected token '}' at position 45",
      suggestion: "Check for missing comma before closing brace",
      field: null,
      location: { line: 3, column: 12 }
    },
    {
      type: "validation",
      field: "score",
      message: "Value 15 exceeds maximum of 10", 
      suggestion: "Use a number between 0 and 10",
      received: 15,
      expected: "number between 0 and 10"
    }
  ]
  */
  
  // Higher-level prompt orchestration system handles reprompting
  // This validator just provides the structured error data
}
```

### Intelligent Multi-Format Generation

The validator can generate instructions for any supported format by analyzing the same schema + example:

```javascript
const schema = {
  type: 'object',
  properties: {
    analysis: { 
      type: 'string',
      description: 'Detailed analysis of the data'
    },
    confidence: { 
      type: 'number', 
      minimum: 0, 
      maximum: 1,
      description: 'Confidence level in the analysis'
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 3,
      description: 'Top recommendations based on analysis'
    }
  },
  required: ['analysis', 'confidence']
};

const validator = new ResponseValidator(schema);
const exampleData = {
  analysis: "Market trends show strong upward momentum in Q3",
  confidence: 0.87,
  recommendations: ["Increase inventory", "Expand marketing", "Monitor competitors"]
};

// Generate format-specific instructions
const jsonInstructions = validator.generateInstructions(exampleData, { format: 'json' });
const xmlInstructions = validator.generateInstructions(exampleData, { format: 'xml' });
const delimitedInstructions = validator.generateInstructions(exampleData, { format: 'delimited' });

// Each produces optimal instructions for that format, derived from the same schema + example
// No format-specific configuration needed in the schema!
```

### Advanced Parsing Configuration

```javascript
const schema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    explanation: { type: 'string' }
  },
  'x-parsing': {
    'error-recovery': {
      'mode': 'aggressive',
      'auto-repair': true,
      'partial-results': true
    },
    'validation': {
      'strict-types': false,
      'type-coercion': true
    }
  },
  'x-format': {
    'delimited': {
      'properties': {
        'code': {
          'wrapper': '```',
          'preserve-whitespace': true
        }
      }
    },
    'markdown': {
      'properties': {
        'code': { 'code-fence': 'javascript' }
      }
    }
  }
};
```

This comprehensive design provides a bulletproof foundation for reliable LLM response processing across multiple formats while maintaining the familiar JSON Schema approach that Legion already uses successfully.