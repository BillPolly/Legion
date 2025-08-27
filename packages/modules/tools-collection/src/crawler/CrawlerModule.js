import { Module } from '@legion/tools-registry';
import Crawler from './index.js';

/**
 * CrawlerModule - Module wrapper for Crawler tool
 */
export default class CrawlerModule extends Module {
  constructor() {
    super();
    this.name = 'CrawlerModule';
    this.description = 'Web crawler for extracting content from webpages';
    this.version = '1.0.0';
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new CrawlerModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  async initialize() {
    await super.initialize();
    
    // Create the Crawler tool
    const crawlerTool = new Crawler();
    
    // Register the tool
    this.registerTool(crawlerTool.name, crawlerTool);
  }
}