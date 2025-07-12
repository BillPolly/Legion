/**
 * @jsenvoy/tools - Collection of AI agent tools
 * 
 * This package provides ready-to-use tool implementations for various tasks
 * All tools follow the standard function calling format
 */

// Import modules
import CalculatorModule from './calculator/index.js';
import FileModule from './file/index.js';
import GitHubModule from './github/GitHubModule.js';

// Import individual tools that aren't modules yet
import CommandExecutor from './command-executor/index.js';
import ServerStarter from './server-starter/index.js';
import Serper from './serper/index.js';
import Crawler from './crawler/index.js';
import PageScreenshot from './page-screenshoter/index.js';
import WebPageToMarkdown from './webpage-to-markdown/index.js';
import YoutubeTranscript from './youtube-transcript/index.js';
import GitHub from './github/index.js';
import PolyRepoManager from './github/PolyRepoManager.js';

// Create module instances for the tool registry
const calculatorModule = new CalculatorModule();
const fileModule = new FileModule();
// Note: GitHubModule requires ResourceManager, so it's exported as a class

// Extract tools from modules
const calculatorTool = calculatorModule.getTools()[0];
const fileTool = fileModule.getTools()[0];

// Create tool instances
const tools = {
  calculator: calculatorTool,
  file: fileTool,
  commandExecutor: new CommandExecutor(),
  serverStarter: new ServerStarter(),
  googleSearch: new Serper(),
  crawler: new Crawler(),
  pageScreenshot: new PageScreenshot(),
  webpageToMarkdown: new WebPageToMarkdown(),
  youtubeTranscript: new YoutubeTranscript(),
  github: new GitHub()
};

// Helper function to get all tool descriptions
function getAllToolDescriptions() {
  const descriptions = [];
  
  for (const [name, tool] of Object.entries(tools)) {
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
async function invokeToolByFunctionName(functionName, toolCall) {
  for (const [name, tool] of Object.entries(tools)) {
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

export {
  // Modules
  CalculatorModule,
  FileModule,
  GitHubModule,
  
  // Individual tool classes (not modules yet)
  CommandExecutor,
  ServerStarter,
  Serper,
  Crawler,
  PageScreenshot,
  WebPageToMarkdown,
  YoutubeTranscript,
  GitHub,
  PolyRepoManager,
  
  // Tool registry
  tools,
  getAllToolDescriptions,
  invokeToolByFunctionName
};