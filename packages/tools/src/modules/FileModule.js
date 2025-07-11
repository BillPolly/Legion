const { OpenAIModule } = require('@jsenvoy/core');
// Import tools from local file package
const { FileReaderTool, FileWriterTool, DirectoryCreatorTool } = require('../file');

/**
 * Module containing file system related tools
 */
class FileModule extends OpenAIModule {
  // Declare required dependencies
  static dependencies = ['basePath', 'encoding', 'createDirectories', 'permissions'];

  constructor({ basePath, encoding, createDirectories, permissions }) {
    super();
    this.name = 'file';

    // Validate required dependencies
    if (!basePath) {
      throw new Error('Missing required dependency: basePath');
    }

    if (typeof basePath !== 'string') {
      throw new Error('basePath must be a string');
    }

    // Validate optional dependencies if provided
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new Error('encoding must be a string');
    }

    if (createDirectories !== undefined && typeof createDirectories !== 'boolean') {
      throw new Error('createDirectories must be a boolean');
    }

    if (permissions !== undefined && typeof permissions !== 'number') {
      throw new Error('permissions must be a number');
    }

    // Create tools with dependencies
    this.tools = [
      new FileReaderTool({
        basePath,
        encoding,
        maxFileSize: 10 * 1024 * 1024 // 10MB default
      }),
      new FileWriterTool({
        basePath,
        encoding,
        createDirectories
      }),
      new DirectoryCreatorTool({
        basePath,
        permissions
      })
    ];
  }
}

module.exports = FileModule;