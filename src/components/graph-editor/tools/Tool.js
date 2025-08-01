/**
 * Tool - Base class for graph editor tools
 * 
 * Tools handle user interactions and perform operations on the graph
 */

export class Tool {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.coordinator = null; // Set by EventCoordinator
    this.active = false;
    this.cursor = config.cursor || 'default';
  }

  /**
   * Get tool name
   */
  getName() {
    return this.name;
  }

  /**
   * Get cursor style
   */
  getCursor() {
    return this.cursor;
  }

  /**
   * Check if tool is active
   */
  isActive() {
    return this.active;
  }

  /**
   * Activate tool
   */
  activate() {
    this.active = true;
    this.onActivate();
  }

  /**
   * Deactivate tool
   */
  deactivate() {
    this.active = false;
    this.onDeactivate();
  }

  /**
   * Handle interaction event
   */
  handleInteraction(interaction) {
    if (!this.active) return;
    
    // Dispatch to specific handlers based on action
    switch (interaction.action) {
      case 'mouseDown':
        this.onMouseDown(interaction);
        break;
      case 'click':
        this.onClick(interaction);
        break;
      case 'rightClick':
        this.onRightClick(interaction);
        break;
      case 'backgroundClick':
        this.onBackgroundClick(interaction);
        break;
      case 'dragStart':
        this.onDragStart(interaction);
        break;
      case 'drag':
        this.onDrag(interaction);
        break;
      case 'dragEnd':
        this.onDragEnd(interaction);
        break;
      case 'tap':
        this.onTap(interaction);
        break;
    }
    
    // Handle special event types
    if (interaction.type === 'wheel') {
      this.onWheel(interaction);
    }
    
    // Also handle state-based events
    if (interaction.state === 'dragging') {
      this.onDragging(interaction);
    }
  }

  /**
   * Get view model
   */
  getViewModel() {
    return this.coordinator?.viewModel;
  }

  /**
   * Get model
   */
  getModel() {
    return this.coordinator?.viewModel?.getModel();
  }

  /**
   * Get view
   */
  getView() {
    return this.coordinator?.view;
  }

  // Override these methods in subclasses
  onActivate() {}
  onDeactivate() {}
  onMouseDown(interaction) {}
  onClick(interaction) {}
  onRightClick(interaction) {}
  onBackgroundClick(interaction) {}
  onDragStart(interaction) {}
  onDrag(interaction) {}
  onDragEnd(interaction) {}
  onDragging(interaction) {}
  onTap(interaction) {}
  onWheel(interaction) {}
}