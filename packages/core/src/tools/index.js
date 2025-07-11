// Export base classes and types
const { Tool } = require("./base/base-tool");
const OpenAICompatibleTool = require("./base/openai-compatible-tool");
const types = require("./base/types");

// Export individual legacy tools
const { calculatorTool } = require("./calculator");
const { fileReaderTool } = require("./file-reader");
const { serverStarterTool } = require("./server-starter");
const { googleSearchTool } = require("./serper");
const { bashExecutorTool } = require("./command-executor");
const { crawlerTool } = require("./crawler");
const { fileWriterTool } = require("./file-writer");
const { pageScreenshotTool } = require("./page-screenshoter");
const { webPageToMarkdownTool } = require("./webpage-to-markdown");
const { youtubeTranscriptTool } = require("./youtube-transcript");
const { githubTool } = require("./github");

// Export OpenAI-compatible tools
const openAI = require("./openai");

module.exports = {
    // Base classes
    Tool,
    OpenAICompatibleTool,
    ...types,
    
    // Legacy tools
    calculatorTool,
    fileReaderTool,
    serverStarterTool,
    googleSearchTool,
    bashExecutorTool,
    crawlerTool,
    fileWriterTool,
    pageScreenshotTool,
    webPageToMarkdownTool,
    youtubeTranscriptTool,
    githubTool,
    
    // OpenAI-compatible tools
    ...openAI,
    openAITools: openAI.openAITools,
    getAllOpenAIToolDescriptions: openAI.getAllToolDescriptions,
    invokeOpenAIToolByFunctionName: openAI.invokeByFunctionName
};