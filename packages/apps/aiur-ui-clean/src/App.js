import { Terminal } from './components/terminal/Terminal.js';
import { Window } from '/Legion/components/window/index.js';

export class App {
  constructor(container) {
    this.container = container;
    this.terminal = null;
    this.window = null;
  }
  
  render() {
    // Clear container
    this.container.innerHTML = '';
    
    // Set container to full viewport
    this.container.style.width = '100vw';
    this.container.style.height = '100vh';
    this.container.style.position = 'relative';
    this.container.style.background = '#1a1a1a';
    
    // Create window using the umbilical protocol
    this.window = Window.create({
      dom: this.container,
      title: 'Aiur Terminal',
      width: 800,
      height: 600,
      position: { x: 50, y: 50 },
      theme: 'dark',
      resizable: true,
      draggable: true,
      onClose: () => {
        console.log('Terminal window closed');
      },
      onResize: (width, height) => {
        console.log(`Terminal window resized to ${width}x${height}`);
      }
    });
    
    // Create terminal inside the window's content area
    this.terminal = new Terminal(this.window.contentElement);
    
    // Focus the terminal
    this.terminal.focus();
  }
  
  destroy() {
    if (this.terminal) {
      this.terminal.destroy();
    }
    if (this.window) {
      this.window.destroy();
    }
  }
}