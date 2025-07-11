/**
 * @jsenvoy/tools - Collection of AI agent tools
 * 
 * This package provides ready-to-use tool implementations for various tasks
 * All tools follow the OpenAI function calling format
 */

// Import modules
const CalculatorModule = require('./calculator');
const FileModule = require('./file');
const { FileReaderTool, FileWriterTool, DirectoryCreatorTool } = require('./file');

// Import individual tools that aren't modules yet
const CommandExecutorOpenAI = require('./command-executor');
const ServerStarterOpenAI = require('./server-starter');
const SerperOpenAI = require('./serper');
const CrawlerOpenAI = require('./crawler');
const PageScreenshotOpenAI = require('./page-screenshoter');
const WebPageToMarkdownOpenAI = require('./webpage-to-markdown');
const YoutubeTranscriptOpenAI = require('./youtube-transcript');
const GitHubOpenAI = require('./github');

// Create module instances for the tool registry
const calculatorModule = new CalculatorModule();
const fileModule = new FileModule();

// Extract tools from modules
const calculatorTool = calculatorModule.getTools()[0];
const fileTool = fileModule.getTools()[0];

// Create tool instances
const openAITools = {
  calculator: calculatorTool,
  file: fileTool,
  commandExecutor: new CommandExecutorOpenAI(),
  serverStarter: new ServerStarterOpenAI(),
  googleSearch: new SerperOpenAI(),
  crawler: new CrawlerOpenAI(),
  pageScreenshot: new PageScreenshotOpenAI(),
  webpageToMarkdown: new WebPageToMarkdownOpenAI(),
  youtubeTranscript: new YoutubeTranscriptOpenAI(),
  github: new GitHubOpenAI()
};

// Helper function to get all tool descriptions
function getAllOpenAIToolDescriptions() {
  const descriptions = [];
  
  for (const [name, tool] of Object.entries(openAITools)) {
    // Handle tools with multiple functions
    if (typeof tool.getAllToolDescriptions === 'function') {
      descriptions.push(...tool.getAllToolDescriptions());
    } else {
      descriptions.push(tool.getToolDescription());
    }
  }
  
  return descriptions;
}

// Helper function to find and invoke a tool by function name
async function invokeOpenAIToolByFunctionName(functionName, toolCall) {
  for (const [name, tool] of Object.entries(openAITools)) {
    const toolDesc = tool.getToolDescription();
    if (toolDesc.function.name === functionName) {
      return await tool.invoke(toolCall);
    }
    
    // Check tools with multiple functions
    if (typeof tool.getAllToolDescriptions === 'function') {
      const allDescs = tool.getAllToolDescriptions();
      for (const desc of allDescs) {
        if (desc.function.name === functionName) {
          return await tool.invoke(toolCall);
        }
      }
    }
  }
  
  throw new Error(`Tool function not found: ${functionName}`);
}

module.exports = {
  // Modules
  CalculatorModule,
  FileModule,
  
  // Individual tool classes (not modules yet)
  CommandExecutorOpenAI,
  ServerStarterOpenAI,
  SerperOpenAI,
  CrawlerOpenAI,
  PageScreenshotOpenAI,
  WebPageToMarkdownOpenAI,
  YoutubeTranscriptOpenAI,
  GitHubOpenAI,
  
  // Tool registry
  openAITools,
  getAllOpenAIToolDescriptions,
  invokeOpenAIToolByFunctionName,
  
  // Individual exports from file module (for backward compatibility)
  FileReaderTool,
  FileWriterTool,
  DirectoryCreatorTool
};