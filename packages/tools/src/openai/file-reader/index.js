const OpenAICompatibleTool = require('../../base/openai-compatible-tool');
const fs = require('fs').promises;
const path = require('path');

class FileReaderOpenAI extends OpenAICompatibleTool {
  constructor() {
    super();
    this.name = 'file_reader';
    this.description = 'Reads files from the local filesystem';
  }

  /**
   * Returns the tool description in OpenAI function calling format
   */
  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: 'file_reader_read',
        description: 'Read the contents of a file from disk',
        parameters: {
          type: 'object',
          properties: {
            filepath: {
              type: 'string',
              description: 'The path to the file to read (can be absolute or relative)'
            }
          },
          required: ['filepath']
        }
      }
    };
  }

  /**
   * Invokes the file reader with the given tool call
   */
  async invoke(toolCall) {
    try {
      // Parse the arguments
      const args = this.parseArguments(toolCall.function.arguments);
      
      // Validate required parameters
      this.validateRequiredParameters(args, ['filepath']);
      
      // Read the file
      const content = await this.readFile(args.filepath);
      
      // Return success response
      return this.createSuccessResponse(
        toolCall.id,
        toolCall.function.name,
        { content }
      );
    } catch (error) {
      // Return error response
      return this.createErrorResponse(
        toolCall.id,
        toolCall.function.name,
        error
      );
    }
  }

  /**
   * Reads a file from disk
   */
  async readFile(filepath) {
    try {
      console.log(`Reading file: ${filepath}`);
      
      // Resolve the path (handles both absolute and relative paths)
      const resolvedPath = path.resolve(filepath);
      
      // Check if file exists
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filepath}`);
      }
      
      // Read the file
      const content = await fs.readFile(resolvedPath, 'utf8');
      console.log(`Successfully read ${content.length} characters from ${filepath}`);
      
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filepath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${filepath}`);
      } else if (error.code === 'EISDIR') {
        throw new Error(`Path is a directory, not a file: ${filepath}`);
      }
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }
}

module.exports = FileReaderOpenAI;