/**
 * File system module for OpenAI function calling
 * Exports the FileModule which contains all file-related tools
 */

const FileModule = require('./FileModule');
const FileReaderTool = require('./FileReaderTool');
const FileWriterTool = require('./FileWriterTool');
const DirectoryCreatorTool = require('./DirectoryCreatorTool');

// Default export is the FileModule
module.exports = FileModule;

// Also export individual components
module.exports.FileModule = FileModule;
module.exports.FileOperationsTool = FileModule.FileOperationsTool;
module.exports.FileReaderTool = FileReaderTool;
module.exports.FileWriterTool = FileWriterTool;
module.exports.DirectoryCreatorTool = DirectoryCreatorTool;