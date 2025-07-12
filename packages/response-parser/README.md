# @jsenvoy/response-parser

Response parsing, validation, and retry management for jsEnvoy. Ensures AI responses conform to expected formats with automatic retry capabilities.

## Installation

```bash
npm install @jsenvoy/response-parser
```

## Usage

```javascript
const { ResponseParser, ResponseValidator, RetryManager } = require('@jsenvoy/response-parser');

// Parse AI response
const parser = new ResponseParser();
const parsed = parser.parse(aiResponse);

// Validate response structure
const validator = new ResponseValidator(schema);
const isValid = validator.validate(parsed);

// Manage retries
const retryManager = new RetryManager({
  maxRetries: 3,
  backoffMultiplier: 2
});
```

## Features

### Response Parsing
- Extract structured data from AI responses
- Handle various response formats (JSON, XML, plain text)
- Clean and normalize responses
- Extract code blocks and structured content

### Response Validation
- Schema-based validation using Zod
- Type checking and coercion
- Custom validation rules
- Detailed error messages

### Retry Management
- Exponential backoff
- Custom retry strategies
- Error classification
- Retry budget management

## API Reference

### ResponseParser

```javascript
const parser = new ResponseParser(options);
```

Options:
- `strictMode` - Enforce strict parsing rules
- `cleanupWhitespace` - Remove extra whitespace
- `extractCodeBlocks` - Extract code from markdown

Methods:
- `parse(response)` - Parse raw response
- `extractJSON(text)` - Extract JSON from text
- `extractCodeBlocks(text)` - Extract code blocks
- `clean(text)` - Clean and normalize text

### ResponseValidator

```javascript
const validator = new ResponseValidator(schema);
```

Methods:
- `validate(data)` - Validate against schema
- `validatePartial(data)` - Partial validation
- `getErrors()` - Get validation errors
- `coerce(data)` - Coerce to schema types

### RetryManager

```javascript
const retryManager = new RetryManager(options);
```

Options:
- `maxRetries` - Maximum retry attempts
- `initialDelay` - Initial delay in ms
- `maxDelay` - Maximum delay in ms
- `backoffMultiplier` - Exponential backoff factor
- `jitter` - Add randomness to delays

Methods:
- `executeWithRetry(fn)` - Execute with retry logic
- `shouldRetry(error)` - Determine if should retry
- `getNextDelay()` - Calculate next delay
- `reset()` - Reset retry state

## Examples

### Basic Parsing and Validation

```javascript
const { ResponseParser, ResponseValidator } = require('@jsenvoy/response-parser');
const { z } = require('zod');

// Define expected schema
const schema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()).optional()
});

// Parse and validate
const parser = new ResponseParser();
const validator = new ResponseValidator(schema);

const rawResponse = `{
  "answer": "Paris is the capital of France",
  "confidence": 0.95,
  "sources": ["Wikipedia", "CIA World Factbook"]
}`;

const parsed = parser.parse(rawResponse);
const validation = validator.validate(parsed);

if (validation.success) {
  console.log("Valid response:", validation.data);
} else {
  console.error("Validation errors:", validation.errors);
}
```

### Retry with Backoff

```javascript
const { RetryManager } = require('@jsenvoy/response-parser');

const retryManager = new RetryManager({
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2
});

async function callAPI() {
  // API call that might fail
  const response = await fetch('/api/data');
  if (!response.ok) throw new Error('API error');
  return response.json();
}

try {
  const data = await retryManager.executeWithRetry(callAPI);
  console.log("Success:", data);
} catch (error) {
  console.error("Failed after retries:", error);
}
```

### Advanced Response Extraction

```javascript
const parser = new ResponseParser({
  extractCodeBlocks: true,
  cleanupWhitespace: true
});

const response = `
Here's the solution:

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
\`\`\`

The time complexity is O(2^n).
`;

const parsed = parser.parse(response);
console.log(parsed.codeBlocks); // [{ language: 'javascript', code: '...' }]
console.log(parsed.text); // Cleaned text without code blocks
```

## License

MIT