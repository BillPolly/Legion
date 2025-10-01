/**
 * ImageDisplayActor - Displays images in floating windows
 */

import { Actor } from '@legion/actors';

export class ImageDisplayActor extends Actor {
  constructor() {
    super();
  }

  async receive(messageType, data) {
    if (messageType === 'show-image') {
      await this.showImage(data.handle, data.title);
    }
  }

  async showImage(handle, title) {
    // Get image data from Handle
    const imageData = await handle.getData();

    // Create floating window
    const window = document.createElement('div');
    window.className = 'floating-window';
    window.innerHTML = `
      <div class="window-header">
        <span class="window-title">${title || 'Image'}</span>
        <button class="window-close">&times;</button>
      </div>
      <div class="window-content">
        <img src="${imageData.data}" alt="${title}" />
      </div>
    `;

    document.body.appendChild(window);

    // Close button
    window.querySelector('.window-close').onclick = () => {
      document.body.removeChild(window);
    };

    // Make draggable
    this.makeDraggable(window);
  }

  makeDraggable(element) {
    const header = element.querySelector('.window-header');
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    header.onmousedown = (e) => {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = () => {
        document.onmouseup = null;
        document.onmousemove = null;
      };
      document.onmousemove = (e) => {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
      };
    };
  }
}
