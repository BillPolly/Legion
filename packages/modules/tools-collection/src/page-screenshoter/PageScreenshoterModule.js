import { Module } from '@legion/tools-registry';
import PageScreenshot from './index.js';

/**
 * PageScreenshoterModule - Module wrapper for PageScreenshot tool
 */
export default class PageScreenshoterModule extends Module {
  constructor() {
    super();
    this.name = 'PageScreenshoterModule';
    this.description = 'Web page screenshot capture tool';
    this.version = '1.0.0';
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new PageScreenshoterModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  async initialize() {
    await super.initialize();
    
    // Create the PageScreenshot tool
    const screenshotTool = new PageScreenshot();
    
    // Register the tool
    this.registerTool(screenshotTool.name, screenshotTool);
  }
}