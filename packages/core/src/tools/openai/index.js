/**
 * OpenAI-compatible tools export
 * All tools follow the OpenAI function calling format
 */

const CalculatorOpenAI = require('./calculator');
const FileReaderOpenAI = require('./file-reader');
const FileWriterOpenAI = require('./file-writer');
const CommandExecutorOpenAI = require('./command-executor');
const ServerStarterOpenAI = require('./server-starter');
const SerperOpenAI = require('./serper');
const CrawlerOpenAI = require('./crawler');
const PageScreenshotOpenAI = require('./page-screenshoter');
const WebPageToMarkdownOpenAI = require('./webpage-to-markdown');
const YoutubeTranscriptOpenAI = require('./youtube-transcript');
const GitHubOpenAI = require('./github');

// Export tool classes
module.exports = {
  CalculatorOpenAI,
  FileReaderOpenAI,
  FileWriterOpenAI,
  CommandExecutorOpenAI,
  ServerStarterOpenAI,
  SerperOpenAI,
  CrawlerOpenAI,
  PageScreenshotOpenAI,
  WebPageToMarkdownOpenAI,
  YoutubeTranscriptOpenAI,
  GitHubOpenAI,
  
  // Export instantiated tools
  openAITools: {
    calculator: new CalculatorOpenAI(),
    fileReader: new FileReaderOpenAI(),
    fileWriter: new FileWriterOpenAI(),
    commandExecutor: new CommandExecutorOpenAI(),
    serverStarter: new ServerStarterOpenAI(),
    googleSearch: new SerperOpenAI(),
    crawler: new CrawlerOpenAI(),
    pageScreenshot: new PageScreenshotOpenAI(),
    webpageToMarkdown: new WebPageToMarkdownOpenAI(),
    youtubeTranscript: new YoutubeTranscriptOpenAI(),
    github: new GitHubOpenAI()
  },
  
  // Helper function to get all tool descriptions
  getAllToolDescriptions: function() {
    const descriptions = [];
    
    for (const [name, tool] of Object.entries(module.exports.openAITools)) {
      // Handle tools with multiple functions
      if (typeof tool.getAllToolDescriptions === 'function') {
        descriptions.push(...tool.getAllToolDescriptions());
      } else {
        descriptions.push(tool.getToolDescription());
      }
    }
    
    return descriptions;
  },
  
  // Helper function to find and invoke a tool by function name
  invokeByFunctionName: async function(functionName, toolCall) {
    for (const [name, tool] of Object.entries(module.exports.openAITools)) {
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
};