/**
 * WindowZIndexManager - Global z-index management for floating windows
 *
 * Ensures clicking any floating window brings it to the front
 */

export const WindowZIndexManager = {
  currentMax: 1000,

  getNext() {
    return ++this.currentMax;
  },

  bringToFront(windowElement) {
    windowElement.style.zIndex = this.getNext();
  }
};
