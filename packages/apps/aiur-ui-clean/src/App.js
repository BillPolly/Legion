import { Terminal } from './components/terminal/Terminal.js';

export class App {
  constructor(container) {
    this.container = container;
    this.terminal = null;
  }
  
  render() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create terminal container
    const terminalContainer = document.createElement('div');
    terminalContainer.style.width = '100vw';
    terminalContainer.style.height = '100vh';
    
    // Create terminal component
    this.terminal = new Terminal(terminalContainer);
    
    // Add to app container
    this.container.appendChild(terminalContainer);
    
    // Focus the terminal
    this.terminal.focus();
  }
  
  destroy() {
    if (this.terminal) {
      this.terminal.destroy();
    }
  }
}