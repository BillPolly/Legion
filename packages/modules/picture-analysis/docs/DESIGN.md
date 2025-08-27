# Picture Analysis Tool Design Document

## Overview and Purpose

The Picture Analysis Tool provides AI-powered image analysis capabilities within the Legion framework. This tool enables users to submit images along with natural language prompts to receive detailed analysis, descriptions, and insights about visual content.

### Core Functionality
- **Image Analysis**: Analyze images using vision-capable LLM models
- **Natural Language Queries**: Accept user prompts to guide analysis focus
- **Multi-format Support**: Handle common image formats (PNG, JPG, JPEG, GIF, WebP)
- **Integration Ready**: Seamless integration with existing Legion tools like screenshot capture

### Primary Use Cases
1. **Screenshot Analysis**: Analyze UI screenshots for usability, errors, or layout issues
2. **Content Description**: Generate detailed descriptions of images for accessibility
3. **Visual Debugging**: Identify visual errors or inconsistencies in application interfaces
4. **Document Analysis**: Extract information from images of documents, diagrams, or charts
5. **General Vision Tasks**: Any task requiring AI-powered visual understanding

### MVP Scope
This MVP focuses on core image analysis functionality with a single tool that accepts file paths and prompts, returning text-based analysis results. The tool integrates with existing Legion infrastructure and follows established patterns.

## Architecture Design

### Component Overview
```
PictureAnalysisModule
├── PictureAnalysisTool (core analysis functionality)
├── ResourceManager Integration (API key management)
└── LLM Client Integration (vision API calls)
```

### PictureAnalysisModule
The module follows Legion's standard async factory pattern and handles dependency injection through ResourceManager.

**Key Responsibilities:**
- Initialize LLM client with vision capabilities
- Manage API key configuration through ResourceManager
- Register the picture analysis tool
- Handle module lifecycle and cleanup

**ResourceManager Dependencies:**
- `OPENAI_API_KEY`: Primary API key for GPT-4V access
- `ANTHROPIC_API_KEY`: Secondary API key for Claude 3 (future expansion)
- Optional configuration variables for model selection and parameters

### PictureAnalysisTool
The core tool implementing image analysis functionality.

**Key Responsibilities:**
- Validate input parameters (file path, prompt)
- Read and encode image files as base64
- Construct vision API requests with image and prompt
- Process LLM responses and format results
- Handle errors and edge cases gracefully

## API Specification

### Tool Definition
```javascript
{
  name: "analyse_picture",
  description: "Analyze images using AI vision models. Accepts image file paths and natural language prompts to provide detailed visual analysis, descriptions, and insights.",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Path to the image file to analyze. Supports absolute paths, or relative paths resolved in order: current working directory, monorepo root, project root"
      },
      prompt: {
        type: "string", 
        description: "Natural language prompt describing what you want to know about the image"
      }
    },
    required: ["file_path", "prompt"]
  }
}
```

### Input Validation
**File Path Validation:**
- Supports absolute paths or relative paths with intelligent resolution
- Path resolution order: current working directory → monorepo root → project root
- File must exist and be readable at resolved path
- File extension must be supported (.png, .jpg, .jpeg, .gif, .webp)
- File size must be within limits (max 20MB)

**Prompt Validation:**
- Must be non-empty string
- Minimum length: 10 characters
- Maximum length: 2000 characters
- No special character restrictions


### Output Format
```javascript
{
  success: true,
  data: {
    analysis: "Detailed analysis text from the LLM",
    file_path: "/path/to/analyzed/image.png",
    prompt: "User's original prompt",
    tokens_used: 150,
    processing_time_ms: 2340
  }
}

// Error format
{
  success: false,
  data: {
    errorMessage: "File not found: /invalid/path.png",
    errorCode: "FILE_NOT_FOUND",
    file_path: "/invalid/path.png"
  }
}
```

### Zod Validation Schemas
```javascript
const InputSchema = z.object({
  file_path: z.string()
    .min(1, "File path is required"),
  
  prompt: z.string()
    .min(10, "Prompt must be at least 10 characters")
    .max(2000, "Prompt must not exceed 2000 characters")
});
```

## Technical Implementation Details

### File Handling
**Supported Formats:**
- PNG (recommended for screenshots)
- JPG/JPEG (compressed photos)
- GIF (animated images, first frame analyzed)
- WebP (modern web format)

**File Processing Pipeline:**
1. **Path Resolution**: Intelligent path resolution with fallback locations
   - If absolute path: use directly
   - If relative path: try current working directory → monorepo root → project root
2. **Existence Check**: Verify file exists and is readable at resolved path
3. **Format Validation**: Check file extension and MIME type
4. **Size Validation**: Ensure file size within API limits
5. **Base64 Encoding**: Convert to base64 for API transmission
6. **Metadata Extraction**: Capture file size, format, dimensions

**File Size Limits:**
- Maximum file size: 20MB (OpenAI limit)
- Automatic compression for oversized files (future enhancement)
- Clear error messages for rejected files

### LLM Integration Strategy

**Prerequisites: Vision Support in @legion/llm**

The picture analysis tool requires vision capabilities to be added to the existing `@legion/llm` package. The LLMClient needs to be enhanced with:

1. **Vision Message Support**: Handle messages with both text and image content
2. **Image Encoding**: Support for base64 image data in API requests  
3. **Provider Vision APIs**: Integration with OpenAI GPT-4V and Anthropic Claude 3 vision capabilities

**Enhanced LLMClient Usage:**
```javascript
// The @legion/llm LLMClient will be enhanced to support vision messages
const response = await this.llmClient.sendAndReceiveResponse([
  {
    role: "user",
    content: [
      { type: "text", text: prompt },
      { 
        type: "image_url", 
        image_url: { 
          url: `data:image/${format};base64,${base64Data}` 
        } 
      }
    ]
  }
], {
  max_tokens: 1000,
  temperature: 0.7
});
```

**Vision Capabilities Required in @legion/llm:**
- **Message Format**: Support for multi-modal content arrays (text + images)
- **Model Selection**: Automatic selection of vision-capable models (GPT-4V, Claude 3)
- **Error Handling**: Vision-specific error handling and validation
- **File Support**: Integration with image encoding and format validation

**Error Handling:**
- API rate limiting with exponential backoff
- Network timeout handling (30-second timeout)
- Invalid API key detection and reporting
- Model availability checks
- Response parsing and validation

### Vision API Request Construction
**Request Format:**
```javascript
{
  model: "gpt-4-vision-preview",
  messages: [
    {
      role: "user", 
      content: [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: base64DataURL } }
      ]
    }
  ],
  max_tokens: 1000,
  temperature: 0.7
}
```

**Response Processing:**
- Extract analysis text from LLM response
- Parse token usage and timing information
- Handle streaming responses if supported
- Validate response completeness and quality

## Integration Patterns

### ResourceManager Integration
The module follows Legion's standard dependency injection pattern:

```javascript
export default class PictureAnalysisModule extends Module {
  static async create(resourceManager) {
    // Get API keys from environment via ResourceManager
    const openaiKey = resourceManager.get('env.OPENAI_API_KEY');
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    
    // Validate required dependencies
    if (!openaiKey && !anthropicKey) {
      throw new Error('At least one vision API key required (OPENAI_API_KEY or ANTHROPIC_API_KEY)');
    }
    
    // Create module instance with dependencies
    const module = new PictureAnalysisModule({ 
      openaiKey, 
      anthropicKey 
    });
    await module.initialize();
    return module;
  }
}
```

### Legion Tool Registry Integration
The tool registers with Legion's tool system following standard patterns:

```javascript
async initialize() {
  await super.initialize();
  
  const analysisTool = new PictureAnalysisTool({
    llmClient: this.llmClient
  });
  
  this.registerTool(analysisTool.name, analysisTool);
}
```

### MCP Server Integration
Integration with the MCP monitor follows the established MongoDB pattern:

**1. Package Dependency:**
```json
{
  "dependencies": {
    "@legion/picture-analysis": "file:../../picture-analysis"
  }
}
```

**2. MCP Server Initialization:**
```javascript
// In mcp-server.js
import PictureAnalysisModule from '../../picture-analysis/src/index.js';

async initializePictureAnalysis() {
  try {
    const resourceManager = await getResourceManager();
    this.pictureModule = await PictureAnalysisModule.create(resourceManager);
    this.pictureTool = this.pictureModule.getTool('analyse_picture');
    this.toolHandler.setPictureTool(this.pictureTool);
    this.logger.info('Picture Analysis Module initialized successfully');
  } catch (error) {
    this.logger.error('Failed to initialize Picture Analysis module', error);
  }
}
```

**3. Tool Handler Registration:**
```javascript
// In SimpleToolHandler.js
tools.push({
  name: 'analyse_picture',
  description: 'Analyze images using AI vision models...',
  inputSchema: { /* schema definition */ }
});
```

### Environment Variable Configuration
**Required Variables:**
- `OPENAI_API_KEY`: OpenAI API key for GPT-4V access
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude 3 (optional)

**Optional Configuration:**
- `PICTURE_ANALYSIS_MAX_TOKENS`: Token limit for responses (default: 1000)
- `PICTURE_ANALYSIS_TEMPERATURE`: Response randomness (default: 0.7)

## File Format and Validation

### Supported Image Formats
| Format | Extension | MIME Type | Notes |
|--------|-----------|-----------|-------|
| PNG | .png | image/png | Preferred for screenshots, lossless |
| JPEG | .jpg, .jpeg | image/jpeg | Compressed photos, good for photos |
| GIF | .gif | image/gif | Animated support (first frame) |
| WebP | .webp | image/webp | Modern format, good compression |

### Validation Pipeline
**1. Path Resolution and Validation:**
```javascript
resolveFilePath(filePath) {
  // If absolute path, use directly
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  
  // Try relative path resolution in order
  const searchPaths = [
    process.cwd(),                           // Current working directory
    process.env.MONOREPO_ROOT,              // Monorepo root from environment
    path.resolve(process.cwd(), '../..'),   // Project root (relative)
  ].filter(Boolean); // Remove undefined values
  
  for (const basePath of searchPaths) {
    const resolvedPath = path.resolve(basePath, filePath);
    if (fs.existsSync(resolvedPath)) {
      const stats = fs.statSync(resolvedPath);
      if (stats.isFile()) {
        return resolvedPath;
      }
    }
  }
  
  throw new Error(`File not found: ${filePath} (searched: ${searchPaths.join(', ')})`);
}
```

**2. Format Validation:**
```javascript
validateImageFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const supportedFormats = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  
  if (!supportedFormats.includes(ext)) {
    throw new Error(`Unsupported format: ${ext}. Supported: ${supportedFormats.join(', ')}`);
  }
}
```

**3. Size Validation:**
```javascript
validateFileSize(filePath) {
  const stats = fs.statSync(filePath);
  const maxSize = 20 * 1024 * 1024; // 20MB
  
  if (stats.size > maxSize) {
    throw new Error(`File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB. Maximum: 20MB`);
  }
}
```

### Security Considerations
- **Path Traversal Prevention**: Sanitize relative paths and prevent escaping base directories
- **File Type Verification**: Check MIME type in addition to extension
- **Size Limits**: Enforce API provider limits
- **Access Controls**: Respect file system permissions
- **Sanitization**: Clean file paths and validate encoding
- **Path Resolution**: Limit resolution to safe base directories only

## Usage Examples

### MCP Integration Example
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "analyse_picture",
    "arguments": {
      "file_path": "screenshots/screenshot-2024-08-16.png",
      "prompt": "Analyze this screenshot for usability issues. Are there any broken layouts, missing elements, or accessibility concerns?"
    }
  }
}
```

### Direct Tool Usage Example
```javascript
// Initialize module
const resourceManager = await getResourceManager();
const pictureModule = await PictureAnalysisModule.create(resourceManager);
const analyseTool = pictureModule.getTool('analyse_picture');

// Execute analysis (using relative path)
const result = await analyseTool.execute({
  file_path: "screenshots/app-screenshot.png", // Resolves from cwd/monorepo/project root
  prompt: "Describe the main UI elements and identify any visual bugs or inconsistencies"
});

console.log(result.data.analysis);
```

### Screenshot + Analysis Workflow
```javascript
// Step 1: Take screenshot (using existing screenshot tool)
const screenshot = await screenshotTool.execute({
  session_id: "debug-session",
  fullPage: true,
  path: "/tmp/current-page.png"
});

// Step 2: Analyze screenshot
const analysis = await analyseTool.execute({
  file_path: "tmp/current-page.png", 
  prompt: "What's happening on this page? Are there any error messages or broken layouts?"
});

// Step 3: Get actionable insights
console.log('Page Analysis:', analysis.data.analysis);
```

### Complex Analysis Example
```javascript
// Analyze technical diagrams or complex screenshots
const result = await analyseTool.execute({
  file_path: "docs/architecture-diagram.png",
  prompt: "Explain the technical architecture shown in this diagram. Identify the main components, data flow, and any potential bottlenecks or design issues."
});

console.log('Architecture Analysis:', result.data.analysis);
console.log('Tokens used:', result.data.tokens_used);
console.log('Processing time:', result.data.processing_time_ms, 'ms');
```

## Error Handling and Edge Cases

### Error Categories
**1. File Access Errors:**
- File not found
- Permission denied
- File is not readable
- Path traversal attempts

**2. Format Validation Errors:**
- Unsupported file format
- Corrupted image files
- Invalid file headers
- Zero-byte files

**3. API Errors:**
- Invalid API keys
- Rate limiting
- Network timeouts
- Model unavailability
- Response parsing failures

**4. Input Validation Errors:**
- Empty or invalid prompts
- Missing required parameters
- Invalid model specifications

### Error Response Format
```javascript
{
  success: false,
  data: {
    errorMessage: "Human-readable error description",
    errorCode: "MACHINE_READABLE_CODE", 
    errorDetails: {
      file_path: "/attempted/path.png",
      attempted_operation: "file_read",
      system_error: "ENOENT: no such file or directory"
    },
    suggestions: [
      "Verify the file path is correct",
      "Check file permissions", 
      "Ensure the file exists"
    ]
  }
}
```

This design provides a robust, well-integrated picture analysis capability that leverages existing Legion infrastructure while providing powerful new visual analysis capabilities to users and other tools within the ecosystem.