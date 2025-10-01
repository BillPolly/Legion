/**
 * CLIWebApp - Legacy wrapper (deprecated)
 *
 * This class is kept for backward compatibility but is no longer the main controller.
 * The MainPageActor is now responsible for managing the entire application.
 *
 * If you're using this directly, consider migrating to MainPageActor instead.
 */

import { MainPageActor } from './client/MainPageActor.js';

export class CLIWebApp {
  constructor(config = {}) {
    console.warn('CLIWebApp is deprecated. Use MainPageActor directly.');

    this.config = config;
    this.mainPageActor = null;
  }

  /**
   * Initialize the application (delegates to MainPageActor)
   */
  async initialize() {
    this.mainPageActor = new MainPageActor(this.config);
    await this.mainPageActor.initialize();
  }

  /**
   * Cleanup and destroy app (delegates to MainPageActor)
   */
  destroy() {
    if (this.mainPageActor) {
      this.mainPageActor.destroy();
      this.mainPageActor = null;
    }
  }
}
