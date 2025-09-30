/**
 * ShowMeWindow
 *
 * Represents a single browser window displaying a Handle
 * Provides methods to control the window: update content, change title, close
 */

export class ShowMeWindow {
  constructor(windowId, controller, options = {}) {
    this.id = windowId;
    this.controller = controller;
    this.title = options.title || 'ShowMe Window';
    this.width = options.width || 1000;
    this.height = options.height || 700;
    this.x = options.x;
    this.y = options.y;
    this.isOpen = true;
    this.currentHandle = null;
    this.url = `http://localhost:${controller.port}/showme?windowId=${windowId}`;
  }

  /**
   * Update the Handle displayed in this window
   * @param {Handle} handle - The Handle to display
   */
  async update(handle) {
    if (!this.isOpen) {
      throw new Error(`Cannot update closed window ${this.id}`);
    }

    // Get server actor from controller
    const serverActor = this.controller.getServerActor();
    if (!serverActor) {
      throw new Error('ShowMeServer not initialized');
    }

    // Send display message to this window's client
    await serverActor.handleDisplayAsset({
      assetId: `window-${this.id}-${Date.now()}`,
      assetType: handle.resourceType || 'unknown',
      title: this.title,
      asset: handle
    });

    this.currentHandle = handle;
  }

  /**
   * Change the window title
   * @param {string} title - New window title
   */
  async setTitle(title) {
    if (!this.isOpen) {
      throw new Error(`Cannot set title on closed window ${this.id}`);
    }

    this.title = title;

    // Send title update message to browser
    const serverActor = this.controller.getServerActor();
    if (serverActor && serverActor.remoteActor) {
      serverActor.remoteActor.receive('set-title', { title });
    }
  }

  /**
   * Close this window
   */
  async close() {
    if (!this.isOpen) {
      return; // Already closed
    }

    // Send close message to browser
    const serverActor = this.controller.getServerActor();
    if (serverActor && serverActor.remoteActor) {
      serverActor.remoteActor.receive('close-window', { windowId: this.id });
    }

    this.isOpen = false;
    this.currentHandle = null;

    // Notify controller to remove this window from tracking
    this.controller._removeWindow(this.id);
  }

  /**
   * Get the currently displayed Handle
   * @returns {Handle|null}
   */
  getHandle() {
    return this.currentHandle;
  }

  /**
   * Get window state
   * @returns {Object}
   */
  getState() {
    return {
      id: this.id,
      title: this.title,
      width: this.width,
      height: this.height,
      isOpen: this.isOpen,
      url: this.url,
      hasHandle: this.currentHandle !== null
    };
  }
}