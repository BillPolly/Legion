/**
 * Server Response Schemas - Defines the exact formats expected from the Aiur server
 * 
 * This eliminates guesswork about response formats and provides proper validation.
 */

/**
 * Base MCP Response Format
 * All responses from the server follow this structure
 */
export const MCPResponseSchema = {
  content: 'array', // Array of content items
  isError: 'boolean' // Whether this is an error response
};

/**
 * MCP Content Item Schema
 * Individual items within the content array
 */
export const MCPContentItemSchema = {
  type: 'string', // Always "text" for our use case
  text: 'string'  // JSON string containing the actual response data
};

/**
 * Module Operation Response Schemas
 * These are the parsed JSON from the MCP text content
 */
export const ModuleLoadResponseSchema = {
  success: 'boolean',
  message: 'string',
  module: {
    name: 'string',
    toolCount: 'number',
    tools: 'array' // Array of tool names
  }
};

export const ModuleToolsResponseSchema = {
  success: 'boolean',
  module: 'string',
  status: 'string', // "loaded", "not_found", etc.
  toolCount: 'number',
  tools: 'array', // Array of tool objects
  error: 'string?' // Optional error message
};

export const ModuleListResponseSchema = {
  success: 'boolean',
  available: 'array', // Array of available modules
  loaded: 'array',    // Array of loaded modules
  error: 'string?'
};

/**
 * Tool Definition Schema
 * Structure of individual tools in module responses
 */
export const ToolDefinitionSchema = {
  name: 'string',
  description: 'string',
  type: 'string?', // Optional type field
  parameters: 'object?' // Optional parameters schema
};

/**
 * Generic Success Response Schema
 * For simple operations that just return success/error
 */
export const GenericResponseSchema = {
  success: 'boolean',
  message: 'string?',
  error: 'string?',
  data: 'any?' // Optional data payload
};

/**
 * Validation Functions
 */

/**
 * Validate that a response matches the MCP base format
 * @param {any} response - Response to validate
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export function validateMCPResponse(response) {
  const errors = [];
  
  if (!response || typeof response !== 'object') {
    errors.push('Response must be an object');
    return { valid: false, errors };
  }
  
  if (!Array.isArray(response.content)) {
    errors.push('Response.content must be an array');
  }
  
  if (typeof response.isError !== 'boolean') {
    errors.push('Response.isError must be a boolean');
  }
  
  if (response.content && response.content.length > 0) {
    const textContent = response.content.find(item => item.type === 'text');
    if (!textContent) {
      errors.push('Response.content must contain at least one text item');
    } else if (typeof textContent.text !== 'string') {
      errors.push('Content text must be a string');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Extract and parse the JSON content from an MCP response
 * @param {object} mcpResponse - Validated MCP response
 * @returns {{ success: boolean, data: any, error: string? }} Parse result
 */
export function extractMCPContent(mcpResponse) {
  try {
    const textContent = mcpResponse.content.find(item => item.type === 'text');
    if (!textContent) {
      return { success: false, error: 'No text content found' };
    }
    
    const parsed = JSON.parse(textContent.text);
    return { success: true, data: parsed };
  } catch (parseError) {
    return { 
      success: false, 
      error: `Failed to parse JSON: ${parseError.message}`,
      rawText: textContent?.text 
    };
  }
}

/**
 * Validate a parsed response against a known schema
 * @param {any} data - Parsed data to validate
 * @param {string} schemaName - Name of the schema to validate against
 * @returns {{ valid: boolean, errors: string[], data: any }} Validation result
 */
export function validateParsedResponse(data, schemaName) {
  const errors = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object');
    return { valid: false, errors, data };
  }
  
  // Validate based on schema name
  switch (schemaName) {
    case 'module_load':
      if (typeof data.success !== 'boolean') errors.push('success must be boolean');
      if (data.success && !data.module) errors.push('module object required for success');
      if (data.module && typeof data.module.name !== 'string') errors.push('module.name must be string');
      break;
      
    case 'module_tools':
      if (typeof data.success !== 'boolean') errors.push('success must be boolean');
      if (data.success) {
        if (typeof data.module !== 'string') errors.push('module must be string');
        if (typeof data.status !== 'string') errors.push('status must be string');
        if (typeof data.toolCount !== 'number') errors.push('toolCount must be number');
        if (!Array.isArray(data.tools)) errors.push('tools must be array');
      }
      break;
      
    case 'module_list':
      if (typeof data.success !== 'boolean') errors.push('success must be boolean');
      if (data.success) {
        if (!Array.isArray(data.available)) errors.push('available must be array');
        if (!Array.isArray(data.loaded)) errors.push('loaded must be array');
      }
      break;
      
    default:
      // Generic validation
      if (typeof data.success !== 'boolean') errors.push('success must be boolean');
      break;
  }
  
  return { valid: errors.length === 0, errors, data };
}

/**
 * Complete validation pipeline for server responses
 * @param {any} response - Raw response from server
 * @param {string} expectedSchema - Expected schema name
 * @returns {{ success: boolean, data: any?, errors: string[] }} Complete validation result
 */
export function validateServerResponse(response, expectedSchema) {
  // Step 1: Validate MCP format
  const mcpValidation = validateMCPResponse(response);
  if (!mcpValidation.valid) {
    return { 
      success: false, 
      errors: ['MCP format validation failed', ...mcpValidation.errors] 
    };
  }
  
  // Step 2: Extract JSON content
  const extraction = extractMCPContent(response);
  if (!extraction.success) {
    return { 
      success: false, 
      errors: ['Content extraction failed', extraction.error],
      rawResponse: response
    };
  }
  
  // Step 3: Validate against specific schema
  const schemaValidation = validateParsedResponse(extraction.data, expectedSchema);
  if (!schemaValidation.valid) {
    return { 
      success: false, 
      errors: [`Schema validation failed for ${expectedSchema}`, ...schemaValidation.errors],
      data: extraction.data // Return data even if validation failed
    };
  }
  
  return { success: true, data: extraction.data };
}