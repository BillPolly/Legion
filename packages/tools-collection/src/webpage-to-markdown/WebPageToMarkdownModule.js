import { Module } from '@legion/tools-registry';
import WebPageToMarkdown from './index.js';

/**
 * WebPageToMarkdownModule - Module wrapper for WebPageToMarkdown tool
 */
export default class WebPageToMarkdownModule extends Module {
  constructor() {
    super();
    this.name = 'WebPageToMarkdownModule';
    this.description = 'Convert webpages to markdown format';
    this.version = '1.0.0';
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new WebPageToMarkdownModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  async initialize() {
    await super.initialize();
    
    // Create the WebPageToMarkdown tool
    const webpageTool = new WebPageToMarkdown();
    
    // Register the tool
    this.registerTool(webpageTool.name, webpageTool);
  }
}