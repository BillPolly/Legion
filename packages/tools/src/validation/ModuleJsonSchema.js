/**
 * JSON Schema for module.json files
 * 
 * This schema validates the structure of module.json files used in the JSON module loading system.
 * It ensures that all required fields are present and that the structure follows the expected format.
 */

export const MODULE_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://legion.ai/schemas/module.json",
  type: "object",
  title: "Legion Module JSON Configuration",
  description: "Schema for module.json files in the Legion framework",
  required: ["name", "description"],
  properties: {
    name: {
      type: "string",
      pattern: "^[a-z0-9-]+$",
      minLength: 1,
      maxLength: 100,
      description: "Module name in kebab-case format"
    },
    version: {
      type: "string",
      pattern: "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9-]+)?$",
      description: "Semantic version string (e.g., '1.0.0', '2.1.0-beta')"
    },
    description: {
      type: "string",
      minLength: 10,
      maxLength: 500,
      description: "Human-readable description of the module's purpose"
    },
    package: {
      type: "string",
      description: "Relative path to the module implementation file (e.g., './MyModule.js')"
    },
    type: {
      type: "string",
      enum: ["constructor", "factory", "static"],
      default: "constructor",
      description: "How to instantiate the module class"
    },
    dependencies: {
      type: "object",
      patternProperties: {
        "^[A-Z_][A-Z0-9_]*$": {
          type: "object",
          required: ["type", "description"],
          properties: {
            type: {
              type: "string",
              enum: ["string", "number", "boolean", "object", "array"]
            },
            description: {
              type: "string",
              minLength: 5,
              maxLength: 200
            },
            required: {
              type: "boolean",
              default: true
            },
            default: {
              description: "Default value if environment variable is not set"
            }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false,
      description: "Environment variables and other dependencies required by the module"
    },
    initialization: {
      type: "object",
      description: "Configuration for module instantiation",
      properties: {
        className: {
          type: "string",
          pattern: "^[A-Z][a-zA-Z0-9]*$",
          description: "Name of the class to instantiate"
        },
        config: {
          type: "object",
          description: "Configuration object passed to module constructor",
          patternProperties: {
            ".*": {
              anyOf: [
                { type: "string" },
                { type: "number" },
                { type: "boolean" },
                { type: "object" },
                { type: "array" }
              ]
            }
          }
        },
        treatAsConstructor: {
          type: "boolean",
          description: "Whether to call the class as a constructor (new Class()) vs factory (Class.create())"
        }
      },
      additionalProperties: false
    },
    tools: {
      type: "array",
      minItems: 1,
      description: "Array of tool definitions provided by this module",
      items: {
        type: "object",
        required: ["name", "description", "function"],
        properties: {
          name: {
            type: "string",
            pattern: "^[a-z0-9_]+$",
            minLength: 1,
            maxLength: 100,
            description: "Tool name in snake_case format"
          },
          description: {
            type: "string",
            minLength: 10,
            maxLength: 500,
            description: "Human-readable description of what the tool does"
          },
          function: {
            type: "string",
            pattern: "^[a-zA-Z][a-zA-Z0-9]*$",
            description: "Name of the method to call on the module instance"
          },
          instanceMethod: {
            type: "boolean",
            default: true,
            description: "Whether this is an instance method (true) or static method (false)"
          },
          async: {
            type: "boolean",
            default: true,
            description: "Whether the function is async and should be awaited"
          },
          parameters: {
            $ref: "http://json-schema.org/draft-07/schema#",
            description: "JSON Schema defining the input parameters for the tool"
          },
          resultMapping: {
            type: "object",
            description: "JSONPath expressions for mapping tool results",
            properties: {
              success: {
                type: "object",
                patternProperties: {
                  "^[a-zA-Z][a-zA-Z0-9]*$": {
                    type: "string",
                    pattern: "^\\$\\..+",
                    description: "JSONPath expression for extracting values from successful results"
                  }
                },
                additionalProperties: false
              },
              error: {
                type: "object",
                patternProperties: {
                  "^[a-zA-Z][a-zA-Z0-9]*$": {
                    type: "string",
                    pattern: "^\\$\\..+",
                    description: "JSONPath expression for extracting values from error results"
                  }
                },
                additionalProperties: false
              }
            },
            additionalProperties: false
          },
          examples: {
            type: "array",
            description: "Example usage scenarios",
            items: {
              type: "object",
              required: ["title", "input"],
              properties: {
                title: {
                  type: "string",
                  minLength: 5,
                  maxLength: 100,
                  description: "Short title describing this example"
                },
                description: {
                  type: "string",
                  maxLength: 300,
                  description: "Detailed description of what this example demonstrates"
                },
                input: {
                  type: "object",
                  description: "Example input parameters"
                },
                expectedOutput: {
                  type: "object",
                  description: "Expected output structure"
                }
              },
              additionalProperties: false
            }
          },
          tags: {
            type: "array",
            items: {
              type: "string",
              pattern: "^[a-z0-9-]+$"
            },
            uniqueItems: true,
            description: "Tags for categorizing and searching tools"
          },
          category: {
            type: "string",
            enum: [
              "read", "write", "create", "delete", "update", "search",
              "transform", "validate", "execute", "generate", "analyze"
            ],
            description: "Primary operation category"
          },
          complexity: {
            type: "string",
            enum: ["simple", "moderate", "complex"],
            default: "moderate",
            description: "Tool complexity level"
          }
        },
        additionalProperties: false
      }
    },
    metadata: {
      type: "object",
      description: "Additional metadata about the module",
      properties: {
        author: {
          type: "string",
          description: "Module author name"
        },
        license: {
          type: "string",
          description: "License type (e.g., 'MIT', 'Apache-2.0')"
        },
        repository: {
          type: "string",
          format: "uri",
          description: "Repository URL"
        },
        keywords: {
          type: "array",
          items: {
            type: "string",
            pattern: "^[a-z0-9-]+$"
          },
          uniqueItems: true,
          description: "Keywords for module discovery"
        },
        category: {
          type: "string",
          enum: [
            "filesystem", "network", "data", "ai", "development", 
            "deployment", "testing", "utility", "integration", "storage"
          ],
          description: "Primary functional category"
        }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
};

/**
 * Validation schemas for common patterns used in module.json files
 */
export const VALIDATION_SCHEMAS = {
  // Schema for environment variable reference pattern
  ENV_VAR_PATTERN: {
    type: "string",
    pattern: "^\\$\\{[A-Z_][A-Z0-9_]*\\}$"
  },
  
  // Schema for JSONPath expressions
  JSONPATH_PATTERN: {
    type: "string",
    pattern: "^\\$\\..+"
  },
  
  // Schema for module function names
  FUNCTION_NAME_PATTERN: {
    type: "string",
    pattern: "^[a-zA-Z][a-zA-Z0-9]*$"
  },
  
  // Schema for tool names
  TOOL_NAME_PATTERN: {
    type: "string",
    pattern: "^[a-z0-9_]+$"
  },
  
  // Schema for module names
  MODULE_NAME_PATTERN: {
    type: "string",
    pattern: "^[a-z0-9-]+$"
  }
};

export default MODULE_JSON_SCHEMA;