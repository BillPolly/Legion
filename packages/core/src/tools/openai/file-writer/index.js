const OpenAICompatibleTool = require('../../base/openai-compatible-tool');
const fs = require('fs').promises;
const path = require('path');

class FileWriterOpenAI extends OpenAICompatibleTool {
  constructor() {
    super();
    this.name = 'file_writer';
    this.description = 'Writes files and creates directories on the local filesystem';
  }

  /**
   * Returns all tool functions in OpenAI format
   * This tool has two functions: writeFile and createDirectory
   */
  getAllToolDescriptions() {
    return [
      {
        type: 'function',
        function: {
          name: 'file_writer_write_file',
          description: 'Create a new file and write text content to it',
          parameters: {
            type: 'object',
            properties: {
              filepath: {
                type: 'string',
                description: 'The path where the file should be created (can be absolute or relative)'
              },
              content: {
                type: 'string',
                description: 'The text content to write to the file'
              }
            },
            required: ['filepath', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_writer_create_directory',
          description: 'Create a new directory at the specified path',
          parameters: {
            type: 'object',
            properties: {
              dirpath: {
                type: 'string',
                description: 'The path where the directory should be created (can be absolute or relative)'
              }
            },
            required: ['dirpath']
          }
        }
      }
    ];
  }

  /**
   * Returns the primary tool function description (writeFile)
   */
  getToolDescription() {
    return this.getAllToolDescriptions()[0];
  }

  /**
   * Invokes the file writer with the given tool call
   */
  async invoke(toolCall) {
    try {
      // Parse the arguments
      const args = this.parseArguments(toolCall.function.arguments);
      
      let result;
      
      // Route to the appropriate function
      if (toolCall.function.name === 'file_writer_write_file') {
        // Validate required parameters
        this.validateRequiredParameters(args, ['filepath', 'content']);
        result = await this.writeFile(args.filepath, args.content);
      } else if (toolCall.function.name === 'file_writer_create_directory') {
        // Validate required parameters
        this.validateRequiredParameters(args, ['dirpath']);
        result = await this.createDirectory(args.dirpath);
      } else {
        throw new Error(`Unknown function: ${toolCall.function.name}`);
      }
      
      // Return success response
      return this.createSuccessResponse(
        toolCall.id,
        toolCall.function.name,
        result
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
   * Writes content to a file
   */
  async writeFile(filepath, content) {
    try {
      console.log(`Writing file: ${filepath}`);
      
      // Resolve the path
      const resolvedPath = path.resolve(filepath);
      
      // Ensure the directory exists
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write the file
      await fs.writeFile(resolvedPath, content, 'utf8');
      
      console.log(`Successfully wrote ${content.length} characters to ${filepath}`);
      
      return {
        success: true,
        filepath: filepath,
        bytesWritten: content.length
      };
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${filepath}`);
      } else if (error.code === 'ENOSPC') {
        throw new Error(`No space left on device: ${filepath}`);
      }
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Creates a directory
   */
  async createDirectory(dirpath) {
    try {
      console.log(`Creating directory: ${dirpath}`);
      
      // Resolve the path
      const resolvedPath = path.resolve(dirpath);
      
      // Create the directory (recursive)
      await fs.mkdir(resolvedPath, { recursive: true });
      
      console.log(`Successfully created directory: ${dirpath}`);
      
      return {
        success: true,
        dirpath: dirpath
      };
    } catch (error) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${dirpath}`);
      } else if (error.code === 'EEXIST') {
        // This shouldn't happen with recursive: true, but just in case
        throw new Error(`Directory already exists: ${dirpath}`);
      }
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }
}

module.exports = FileWriterOpenAI;