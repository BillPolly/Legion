/**
 * Smart Home Hub Client Actor
 * Stage 1: Basic UI with one light card and activity log
 */

export default class SmartHomeClientActor {
  constructor() {
    this.remoteActor = null;
    this.devices = new Map();
    this.activityLog = [];
    this.lastMetricsUpdate = 0;
    this.temperatureHistory = [];
    this.activityHistory = [];
    this.createUI();
    console.log('[SMART HOME CLIENT] Actor initialized');
  }

  // Framework interface: called by the generated HTML template
  setRemoteActor(remoteActor) {
    console.log('[SMART HOME CLIENT] setRemoteActor called with:', remoteActor);
    this.remoteActor = remoteActor;
    
    // Update connection status immediately
    this.updateConnectionStatus();
    
    // Get initial device states
    this.getAllDevices();
  }

  // Actor protocol method: called by ActorSpace
  async receive(messageType, data) {
    console.log('[SMART HOME CLIENT] Received:', messageType, data);
    
    if (messageType === 'server_actor_ready') {
      console.log('[SMART HOME CLIENT] Server actor ready, creating remote reference...');
      const actorSpace = window.__legionActorSpace;
      if (actorSpace && actorSpace._channel) {
        const remoteActor = actorSpace._channel.makeRemote(data.serverActorId);
        console.log('[SMART HOME CLIENT] Remote server actor created:', remoteActor);
        this.setRemoteActor(remoteActor);
      }
      return;
    }
    
    // Handle server messages
    this.handleServerMessage(data);
  }

  // Handle messages from server
  handleServerMessage(message) {
    console.log('[SMART HOME CLIENT] handleServerMessage:', message);
    
    switch (message.type) {
      case 'device_updated':
        this.handleDeviceUpdated(message);
        break;
        
      case 'device_status':
        this.handleDeviceStatus(message);
        break;
        
      case 'all_devices':
        this.handleAllDevices(message);
        break;
        
      case 'sensor_update':
        this.handleSensorUpdate(message);
        break;
        
      case 'error':
        this.addToActivityLog(`Error: ${message.message}`, 'error');
        break;
        
      default:
        console.warn('[SMART HOME CLIENT] Unknown message type:', message.type);
    }
  }

  // Handle device updated message
  handleDeviceUpdated(message) {
    const { device, message: activityMessage } = message;
    this.devices.set(device.id, device);
    this.updateDeviceUI(device);
    this.addToActivityLog(activityMessage, 'action', device.type);
    this.updateMetricsThrottled();
  }

  // Handle device status message
  handleDeviceStatus(message) {
    const { device } = message;
    this.devices.set(device.id, device);
    this.updateDeviceUI(device);
  }

  // Handle all devices message
  handleAllDevices(message) {
    const { devices } = message;
    devices.forEach(device => {
      this.devices.set(device.id, device);
      this.updateDeviceUI(device);
    });
    this.addToActivityLog(`Loaded ${devices.length} device(s)`, 'info');
    this.updateMetrics();
  }

  // Handle sensor update message (server-initiated)
  handleSensorUpdate(message) {
    const { device, message: activityMessage } = message;
    this.devices.set(device.id, device);
    this.updateDeviceUI(device);
    this.addToActivityLog(activityMessage, 'sensor', device.type);
    this.updateMetricsThrottled();
    
    // Track data for visualization
    this.trackDataPoint(device);
  }

  // Send message to server
  async sendToServer(messageType, data = {}) {
    console.log('[SMART HOME CLIENT] sendToServer:', messageType, data);
    
    if (this.remoteActor && typeof this.remoteActor.receive === 'function') {
      try {
        this.remoteActor.receive(messageType, data);
        console.log('[SMART HOME CLIENT] Message sent via remoteActor');
      } catch (error) {
        console.error('[SMART HOME CLIENT] Remote actor communication error:', error);
        this.addToActivityLog(`Communication error: ${error.message}`, 'error');
      }
    } else {
      console.warn('[SMART HOME CLIENT] Remote actor not available');
      this.addToActivityLog('Server not connected', 'error');
    }
  }

  // Device operations
  async toggleDevice(deviceId) {
    console.log('[SMART HOME CLIENT] Toggling device:', deviceId);
    const device = this.devices.get(deviceId);
    this.addToActivityLog(`Toggling ${device?.name || deviceId}...`, 'action');
    await this.sendToServer('toggle_device', { deviceId });
  }

  async setThermostat(deviceId, targetTemp) {
    console.log('[SMART HOME CLIENT] Setting thermostat:', deviceId, targetTemp);
    const device = this.devices.get(deviceId);
    this.addToActivityLog(`Setting ${device?.name} to ${targetTemp}°C...`, 'action');
    await this.sendToServer('set_thermostat', { deviceId, targetTemp });
  }

  async getAllDevices() {
    console.log('[SMART HOME CLIENT] Getting all devices');
    await this.sendToServer('get_all_devices');
  }

  // UI Management
  createUI() {
    const app = document.getElementById('app');
    if (app) {
      // Create main container
      const container = this.createComponent('div', 'smart-home-container');
      
      // Create header
      const header = this.createHeader();
      container.appendChild(header);
      
      // Create main content
      const main = this.createComponent('main', 'main-content');
      
      // Create dashboard metrics section
      const metricsSection = this.createMetricsSection();
      main.appendChild(metricsSection);
      
      // Create container for devices and charts
      const devicesAndCharts = this.createComponent('div', 'devices-and-activity');
      
      // Create devices section
      const devicesSection = this.createDevicesSection();
      devicesAndCharts.appendChild(devicesSection);
      
      // Create right column with charts and activity
      const rightColumn = this.createComponent('div', 'right-column');
      
      // Create charts section
      const chartsSection = this.createChartsSection();
      rightColumn.appendChild(chartsSection);
      
      // Create activity section under charts
      const activitySection = this.createActivitySection();
      rightColumn.appendChild(activitySection);
      
      devicesAndCharts.appendChild(rightColumn);
      
      main.appendChild(devicesAndCharts);
      
      container.appendChild(main);
      app.appendChild(container);
      
      this.addStyles();
      this.addToActivityLog('Smart Home Hub initialized', 'info');
    }
  }

  // Component creation helpers
  createComponent(tag, className = '', textContent = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
  }

  createHeader() {
    const header = this.createComponent('header', 'header');
    const title = this.createComponent('h1', '', '🏠 Smart Home Hub');
    
    // Create right section with command input and connection status
    const rightSection = this.createComponent('div', 'header-right');
    
    // Add command input
    const commandSection = this.createComponent('div', 'command-section');
    const commandInput = this.createComponent('input', 'command-input');
    commandInput.type = 'text';
    commandInput.placeholder = 'Try: "turn on all lights" or "status report"';
    commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.processCommand(commandInput.value);
        commandInput.value = '';
      }
    });
    
    const commandButton = this.createComponent('button', 'command-btn', '💬');
    commandButton.title = 'Send Command';
    commandButton.onclick = () => {
      this.processCommand(commandInput.value);
      commandInput.value = '';
    };
    
    commandSection.appendChild(commandInput);
    commandSection.appendChild(commandButton);
    
    // Add connection status
    const connectionStatus = this.createComponent('div', 'connection-status connecting', 'Connecting');
    connectionStatus.id = 'connection-status';
    
    rightSection.appendChild(commandSection);
    rightSection.appendChild(connectionStatus);
    
    header.appendChild(title);
    header.appendChild(rightSection);
    return header;
  }

  createDevicesSection() {
    const section = this.createComponent('section', 'devices-section');
    const title = this.createComponent('h2', '', 'Devices');
    const grid = this.createComponent('div', 'devices-grid');
    grid.id = 'devices-grid';
    
    section.appendChild(title);
    section.appendChild(grid);
    return section;
  }

  createMetricsSection() {
    const section = this.createComponent('section', 'metrics-section');
    const title = this.createComponent('h2', '', 'System Overview');
    const metricsGrid = this.createComponent('div', 'metrics-grid');
    metricsGrid.id = 'metrics-grid';
    
    section.appendChild(title);
    section.appendChild(metricsGrid);
    return section;
  }

  createChartsSection() {
    const section = this.createComponent('section', 'charts-section');
    const title = this.createComponent('h2', '', 'Data Trends');
    const chartsContainer = this.createComponent('div', 'charts-container');
    chartsContainer.id = 'charts-container';
    
    section.appendChild(title);
    section.appendChild(chartsContainer);
    return section;
  }

  createActivitySection() {
    const section = this.createComponent('section', 'activity-section');
    const title = this.createComponent('h2', '', 'Activity Log');
    const log = this.createComponent('div', 'activity-log');
    log.id = 'activity-log';
    
    section.appendChild(title);
    section.appendChild(log);
    return section;
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .smart-home-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 2px solid #e0e0e0;
      }
      
      .header-right {
        display: flex;
        align-items: center;
        gap: 20px;
      }
      
      .command-section {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .command-input {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        width: 300px;
        transition: border-color 0.2s ease;
      }
      
      .command-input:focus {
        outline: none;
        border-color: #2196f3;
        box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
      }
      
      .command-btn {
        background: #2196f3;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        transition: background-color 0.2s ease;
      }
      
      .command-btn:hover {
        background: #1976d2;
      }
      
      .header h1 {
        color: #333;
        margin: 0;
      }
      
      .connection-status {
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
      }
      
      .connection-status.connected {
        background-color: #4caf50;
        color: white;
      }
      
      .connection-status.connecting {
        background-color: #ff9800;
        color: white;
      }
      
      .connection-status.disconnected {
        background-color: #f44336;
        color: white;
      }
      
      .main-content {
        display: grid;
        grid-template-columns: 1fr;
        gap: 30px;
      }
      
      .metrics-section {
        margin-bottom: 20px;
      }
      
      .metrics-section h2 {
        color: #333;
        margin-bottom: 15px;
        font-size: 1.2em;
      }
      
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
      }
      
      .metric-card {
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: all 0.2s ease;
      }
      
      .metric-card:hover {
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        transform: translateY(-2px);
      }
      
      .metric-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      
      .metric-icon {
        font-size: 18px;
      }
      
      .metric-title {
        font-size: 14px;
        color: #666;
        font-weight: 500;
      }
      
      .metric-value {
        font-size: 24px;
        font-weight: bold;
        color: #333;
        margin-bottom: 5px;
      }
      
      .metric-subtitle {
        font-size: 12px;
        color: #999;
      }
      
      .devices-and-activity {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-bottom: 30px;
      }
      
      .right-column {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .charts-section {
        margin-bottom: 20px;
      }
      
      .charts-section h2 {
        color: #333;
        margin-bottom: 15px;
        font-size: 1.2em;
      }
      
      .charts-container {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }
      
      .chart-container {
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .chart-title {
        margin: 0 0 15px 0;
        font-size: 16px;
        color: #333;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .simple-chart {
        height: 120px;
        margin-bottom: 10px;
      }
      
      .chart-data {
        display: flex;
        align-items: end;
        justify-content: space-between;
        height: 80px;
        padding: 0 5px;
        border-bottom: 1px solid #eee;
      }
      
      .chart-bar {
        flex: 1;
        background: #2196f3;
        margin: 0 1px;
        border-radius: 2px 2px 0 0;
        position: relative;
        transition: all 0.3s ease;
        min-height: 5px;
      }
      
      .chart-bar.latest {
        background: #ff9800;
        animation: highlight 1s ease-out;
      }
      
      @keyframes highlight {
        0% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
      
      .chart-bar:hover {
        opacity: 0.8;
      }
      
      .bar-value {
        position: absolute;
        top: -20px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 10px;
        color: #666;
        white-space: nowrap;
      }
      
      .chart-info {
        font-size: 12px;
        color: #666;
        text-align: center;
        margin-top: 10px;
      }
      
      .activity-summary {
        padding: 10px 0;
      }
      
      .activity-bars {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .activity-bar-container {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .activity-bar-label {
        min-width: 80px;
        font-size: 12px;
        color: #666;
        text-transform: capitalize;
      }
      
      .activity-bar-track {
        flex: 1;
        height: 20px;
        background: #f5f5f5;
        border-radius: 10px;
        overflow: hidden;
        position: relative;
      }
      
      .activity-bar-fill {
        height: 100%;
        border-radius: 10px;
        transition: width 0.5s ease;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-right: 8px;
      }
      
      .activity-count {
        color: white;
        font-size: 11px;
        font-weight: bold;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }
      
      .devices-section h2,
      .activity-section h2 {
        color: #333;
        margin-bottom: 15px;
        font-size: 1.2em;
      }
      
      .devices-grid {
        display: grid;
        gap: 15px;
      }
      
      .device-card {
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: all 0.2s ease;
      }
      
      .device-card:hover {
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }
      
      .device-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        position: relative;
      }
      
      .health-indicator {
        position: absolute;
        top: -5px;
        right: -5px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
      }
      
      .health-indicator.healthy {
        animation-duration: 3s;
      }
      
      .health-indicator.warning {
        animation-duration: 1.5s;
      }
      
      .health-indicator.error {
        animation-duration: 0.8s;
      }
      
      .device-name {
        font-weight: 600;
        color: #333;
      }
      
      .device-type {
        font-size: 12px;
        background: #f5f5f5;
        padding: 4px 8px;
        border-radius: 4px;
        color: #666;
      }
      
      .device-controls {
        display: flex;
        align-items: center;
        gap: 15px;
      }
      
      .device-status {
        font-size: 14px;
        padding: 6px 12px;
        border-radius: 4px;
        font-weight: 500;
      }
      
      .device-status.on {
        background-color: #e8f5e8;
        color: #2e7d32;
      }
      
      .device-status.off {
        background-color: #f5f5f5;
        color: #666;
      }
      
      .toggle-btn {
        background: #2196f3;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.2s ease;
      }
      
      .toggle-btn:hover {
        background: #1976d2;
      }
      
      .toggle-btn:active {
        transform: translateY(1px);
      }
      
      .activity-log {
        background: #f9f9f9;
        border: 1px solid #ddd;
        border-radius: 6px;
        max-height: 300px;
        overflow-y: auto;
        padding: 15px;
      }
      
      .activity-entry {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid #eee;
        font-size: 14px;
      }
      
      .activity-entry:last-child {
        border-bottom: none;
      }
      
      .activity-time {
        color: #666;
        font-size: 12px;
        min-width: 60px;
      }
      
      .activity-icon {
        font-size: 16px;
      }
      
      .activity-message {
        flex: 1;
      }
      
      .sensor-reading {
        text-align: center;
        padding: 10px;
      }
      
      .reading-value {
        font-size: 24px;
        font-weight: bold;
        color: #333;
        margin-bottom: 5px;
      }
      
      .reading-time {
        font-size: 12px;
        color: #666;
      }
      
      .motion-status {
        font-size: 14px;
        padding: 8px 12px;
        border-radius: 4px;
        font-weight: 500;
        margin-bottom: 5px;
      }
      
      .motion-status.motion-detected {
        background-color: #ffebee;
        color: #c62828;
      }
      
      .motion-status.no-motion {
        background-color: #f5f5f5;
        color: #666;
      }
      
      .activity-entry.info .activity-icon { color: #2196f3; }
      .activity-entry.action .activity-icon { color: #4caf50; }
      .activity-entry.sensor .activity-icon { color: #ff9800; }
      .activity-entry.error .activity-icon { color: #f44336; }
      
      /* Device type specific colors */
      .light-card { border-left: 4px solid #ffc107; }
      .temperature-card { border-left: 4px solid #2196f3; }
      .motion-card { border-left: 4px solid #9c27b0; }
      .thermostat-card { border-left: 4px solid #ff5722; }
      .lock-card { border-left: 4px solid #607d8b; }
      .camera-card { border-left: 4px solid #e91e63; }
      
      .activity-entry.device-light { border-left: 3px solid #ffc107; }
      .activity-entry.device-temperature { border-left: 3px solid #2196f3; }
      .activity-entry.device-motion { border-left: 3px solid #9c27b0; }
      .activity-entry.device-thermostat { border-left: 3px solid #ff5722; }
      .activity-entry.device-lock { border-left: 3px solid #607d8b; }
      .activity-entry.device-camera { border-left: 3px solid #e91e63; }
      
      .temp-controls {
        display: flex;
        gap: 10px;
        margin-top: 10px;
      }
      
      .temp-btn {
        background: #2196f3;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      }
      
      .temp-btn:hover {
        background: #1976d2;
      }
      
      .thermostat-controls {
        text-align: center;
        padding: 10px;
      }
      
      .temp-display {
        margin-bottom: 10px;
      }
      
      .current-temp {
        font-size: 20px;
        font-weight: bold;
        color: #333;
      }
      
      .target-temp {
        font-size: 12px;
        color: #666;
        margin-top: 5px;
      }
      
      .camera-info {
        text-align: center;
        padding: 10px;
      }
      
      .camera-status {
        font-size: 14px;
        padding: 6px 12px;
        border-radius: 4px;
        font-weight: 500;
        margin-bottom: 5px;
      }
      
      .camera-status.recording {
        background-color: #ffebee;
        color: #c62828;
      }
      
      .camera-status.stopped {
        background-color: #f5f5f5;
        color: #666;
      }
      
      .camera-activity {
        font-size: 12px;
        color: #666;
        margin-bottom: 10px;
      }
      
      /* Enhanced animations */
      @keyframes slideIn {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .device-card {
        animation: slideIn 0.3s ease-out;
      }
      
      .metric-card {
        /* Remove animation for stability */
      }
      
      .activity-entry {
        animation: slideIn 0.2s ease-out;
      }
      
      .toggle-btn {
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      }
      
      .toggle-btn:active {
        transform: scale(0.95);
      }
      
      .toggle-btn::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        background: rgba(255,255,255,0.3);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        transition: width 0.3s, height 0.3s;
      }
      
      .toggle-btn:active::before {
        width: 200%;
        height: 200%;
      }
      
      @media (max-width: 768px) {
        .devices-and-activity {
          grid-template-columns: 1fr;
        }
        
        .metrics-grid {
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        }
        
        .smart-home-container {
          padding: 10px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  updateDeviceUI(device) {
    const devicesGrid = document.getElementById('devices-grid');
    if (!devicesGrid) return;
    
    let deviceCard = document.getElementById(`device-${device.id}`);
    
    if (!deviceCard) {
      deviceCard = this.createDeviceCard(device);
      devicesGrid.appendChild(deviceCard);
    } else {
      // Update existing card
      this.updateDeviceCard(deviceCard, device);
    }
    
    // Update connection status
    this.updateConnectionStatus();
  }

  createDeviceCard(device) {
    const card = this.createComponent('div', `device-card ${device.type}-card`);
    card.id = `device-${device.id}`;
    
    // Create device-specific component
    const deviceComponent = this.createDeviceComponent(device);
    card.appendChild(deviceComponent);
    
    return card;
  }

  updateDeviceCard(card, device) {
    // Clear existing content and recreate
    card.innerHTML = '';
    card.className = `device-card ${device.type}-card`;
    
    const deviceComponent = this.createDeviceComponent(device);
    card.appendChild(deviceComponent);
  }

  createDeviceComponent(device) {
    switch (device.type) {
      case 'light':
        return this.createLightComponent(device);
      case 'temperature':
        return this.createTemperatureComponent(device);
      case 'motion':
        return this.createMotionComponent(device);
      case 'thermostat':
        return this.createThermostatComponent(device);
      case 'lock':
        return this.createLockComponent(device);
      case 'camera':
        return this.createCameraComponent(device);
      default:
        return this.createUnknownDeviceComponent(device);
    }
  }

  createDeviceHeader(icon, name, type, device = null) {
    const header = this.createComponent('div', 'device-header');
    const nameElement = this.createComponent('div', 'device-name', `${icon} ${name}`);
    const typeElement = this.createComponent('div', 'device-type', type);
    
    // Add health indicator
    if (device) {
      const healthIndicator = this.createHealthIndicator(device);
      header.appendChild(healthIndicator);
    }
    
    header.appendChild(nameElement);
    header.appendChild(typeElement);
    return header;
  }

  createHealthIndicator(device) {
    const now = new Date();
    const lastChanged = new Date(device.lastChanged);
    const timeDiff = (now - lastChanged) / 1000; // seconds
    
    let status = 'healthy';
    let color = '#4caf50';
    let title = 'Device responsive';
    
    if (timeDiff > 60) { // No update for over 1 minute
      status = 'warning';
      color = '#ff9800';
      title = 'Device may be slow';
    }
    
    if (timeDiff > 300) { // No update for over 5 minutes
      status = 'error';
      color = '#f44336';
      title = 'Device not responding';
    }
    
    const indicator = this.createComponent('div', `health-indicator ${status}`);
    indicator.style.backgroundColor = color;
    indicator.title = title;
    
    return indicator;
  }

  createLightComponent(device) {
    const container = this.createComponent('div');
    const icon = device.state === 'on' ? '💡' : '🔅';
    
    const header = this.createDeviceHeader(icon, device.name, device.type, device);
    container.appendChild(header);
    
    const controls = this.createComponent('div', 'device-controls');
    const status = this.createComponent('div', `device-status ${device.state}`, device.state.toUpperCase());
    const button = this.createComponent('button', 'toggle-btn', 'Toggle');
    button.onclick = () => this.toggleDevice(device.id);
    
    controls.appendChild(status);
    controls.appendChild(button);
    container.appendChild(controls);
    
    return container;
  }

  createTemperatureComponent(device) {
    const container = this.createComponent('div');
    const header = this.createDeviceHeader('🌡️', device.name, device.type, device);
    container.appendChild(header);
    
    const reading = this.createComponent('div', 'sensor-reading');
    const value = this.createComponent('div', 'reading-value', `${device.value}${device.unit}`);
    const time = this.createComponent('div', 'reading-time', `Updated: ${new Date(device.lastChanged).toLocaleTimeString()}`);
    
    reading.appendChild(value);
    reading.appendChild(time);
    container.appendChild(reading);
    
    return container;
  }

  createMotionComponent(device) {
    const container = this.createComponent('div');
    const icon = device.state === 'motion detected' ? '🚶' : '👁️';
    const header = this.createDeviceHeader(icon, device.name, device.type, device);
    container.appendChild(header);
    
    const reading = this.createComponent('div', 'sensor-reading');
    const status = this.createComponent('div', `motion-status ${device.state.replace(' ', '-')}`, device.state.toUpperCase());
    const time = this.createComponent('div', 'reading-time', `Updated: ${new Date(device.lastChanged).toLocaleTimeString()}`);
    
    reading.appendChild(status);
    reading.appendChild(time);
    container.appendChild(reading);
    
    return container;
  }

  createThermostatComponent(device) {
    const container = this.createComponent('div');
    const header = this.createDeviceHeader('🌡️', device.name, device.type, device);
    container.appendChild(header);
    
    const controls = this.createComponent('div', 'thermostat-controls');
    
    const display = this.createComponent('div', 'temp-display');
    const current = this.createComponent('div', 'current-temp', `${device.currentTemp}${device.unit}`);
    const target = this.createComponent('div', 'target-temp', `Target: ${device.targetTemp}${device.unit}`);
    display.appendChild(current);
    display.appendChild(target);
    
    const tempControls = this.createComponent('div', 'temp-controls');
    const minusBtn = this.createComponent('button', 'temp-btn', '-');
    const plusBtn = this.createComponent('button', 'temp-btn', '+');
    minusBtn.onclick = () => this.setThermostat(device.id, device.targetTemp - 1);
    plusBtn.onclick = () => this.setThermostat(device.id, device.targetTemp + 1);
    
    tempControls.appendChild(minusBtn);
    tempControls.appendChild(plusBtn);
    
    controls.appendChild(display);
    controls.appendChild(tempControls);
    container.appendChild(controls);
    
    return container;
  }

  createLockComponent(device) {
    const container = this.createComponent('div');
    const icon = device.state === 'locked' ? '🔒' : '🔓';
    const header = this.createDeviceHeader(icon, device.name, device.type, device);
    container.appendChild(header);
    
    const controls = this.createComponent('div', 'device-controls');
    const status = this.createComponent('div', `device-status ${device.state}`, device.state.toUpperCase());
    const button = this.createComponent('button', `toggle-btn ${device.state}`, device.state === 'locked' ? 'Unlock' : 'Lock');
    button.onclick = () => this.toggleDevice(device.id);
    
    controls.appendChild(status);
    controls.appendChild(button);
    container.appendChild(controls);
    
    return container;
  }

  createCameraComponent(device) {
    const container = this.createComponent('div');
    const icon = device.state === 'recording' ? '📹' : '📷';
    const header = this.createDeviceHeader(icon, device.name, device.type, device);
    container.appendChild(header);
    
    const info = this.createComponent('div', 'camera-info');
    const status = this.createComponent('div', `camera-status ${device.state}`, device.state.toUpperCase());
    const activity = this.createComponent('div', 'camera-activity', device.activity);
    const button = this.createComponent('button', 'toggle-btn', device.state === 'recording' ? 'Stop' : 'Start');
    button.onclick = () => this.toggleDevice(device.id);
    
    info.appendChild(status);
    info.appendChild(activity);
    info.appendChild(button);
    container.appendChild(info);
    
    return container;
  }

  createUnknownDeviceComponent(device) {
    const container = this.createComponent('div');
    const header = this.createDeviceHeader('🔌', device.name, device.type);
    const info = this.createComponent('div', 'device-info', 'Unknown device type');
    
    container.appendChild(header);
    container.appendChild(info);
    return container;
  }

  updateConnectionStatus() {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      const isConnected = this.remoteActor && typeof this.remoteActor.receive === 'function';
      
      if (isConnected) {
        statusElement.textContent = 'Connected';
        statusElement.className = 'connection-status connected';
      } else {
        statusElement.textContent = 'Connecting';
        statusElement.className = 'connection-status connecting';
      }
    }
  }

  addToActivityLog(message, type = 'info', deviceType = null) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = {
      timestamp,
      message,
      type,
      deviceType
    };
    
    this.activityLog.unshift(entry);
    
    // Keep only last 50 entries
    if (this.activityLog.length > 50) {
      this.activityLog = this.activityLog.slice(0, 50);
    }
    
    this.updateActivityLogUI();
  }

  updateActivityLogUI() {
    const activityLogElement = document.getElementById('activity-log');
    if (!activityLogElement) return;
    
    // Clear existing entries
    activityLogElement.innerHTML = '';
    
    // Create activity entries as components
    this.activityLog.forEach(entry => {
      const entryElement = this.createActivityEntry(entry);
      activityLogElement.appendChild(entryElement);
    });
    
    // Scroll to top to show latest entry
    activityLogElement.scrollTop = 0;
  }

  createActivityEntry(entry) {
    const entryDiv = this.createComponent('div', `activity-entry ${entry.type}`);
    
    // Add device-type-specific styling
    if (entry.deviceType) {
      entryDiv.classList.add(`device-${entry.deviceType}`);
    }
    
    const timeElement = this.createComponent('div', 'activity-time', entry.timestamp);
    const iconElement = this.createComponent('div', 'activity-icon', this.getActivityIcon(entry.type, entry.deviceType));
    const messageElement = this.createComponent('div', 'activity-message', entry.message);
    
    entryDiv.appendChild(timeElement);
    entryDiv.appendChild(iconElement);
    entryDiv.appendChild(messageElement);
    
    return entryDiv;
  }

  getActivityIcon(type, deviceType) {
    // Device-specific icons take precedence
    if (deviceType) {
      const deviceIcons = {
        light: '💡',
        temperature: '🌡️',
        motion: '👁️',
        thermostat: '🌡️',
        lock: '🔒',
        camera: '📹'
      };
      
      if (deviceIcons[deviceType]) {
        return deviceIcons[deviceType];
      }
    }
    
    // Fallback to activity type icons
    const typeIcons = {
      info: 'ℹ️',
      action: '⚡',
      sensor: '📊',
      error: '❌'
    };
    
    return typeIcons[type] || 'ℹ️';
  }

  // Throttled metrics update to prevent flashing
  updateMetricsThrottled() {
    const now = Date.now();
    // Only update metrics every 1 second maximum
    if (now - this.lastMetricsUpdate < 1000) {
      return;
    }
    this.lastMetricsUpdate = now;
    this.updateMetrics();
  }

  // Metrics dashboard
  updateMetrics() {
    const metricsGrid = document.getElementById('metrics-grid');
    if (!metricsGrid) return;

    // Calculate new metrics
    const newMetrics = this.calculateMetrics();

    // Check if this is the first load
    if (metricsGrid.children.length === 0) {
      // First load - create all cards
      newMetrics.forEach(metric => {
        const card = this.createMetricCard(metric);
        metricsGrid.appendChild(card);
      });
      return;
    }

    // Update existing cards smoothly
    newMetrics.forEach((metric, index) => {
      const existingCard = metricsGrid.children[index];
      if (existingCard) {
        this.updateMetricCard(existingCard, metric);
      }
    });
  }

  updateMetricCard(card, metric) {
    // Update only the values that have changed
    const valueElement = card.querySelector('.metric-value');
    const subtitleElement = card.querySelector('.metric-subtitle');
    
    if (valueElement && valueElement.textContent !== metric.value) {
      // Add a subtle highlight animation for changed values
      valueElement.textContent = metric.value;
      valueElement.style.transition = 'color 0.3s ease';
      valueElement.style.color = metric.color;
      
      setTimeout(() => {
        valueElement.style.color = '#333';
      }, 300);
    }
    
    if (subtitleElement && subtitleElement.textContent !== metric.subtitle) {
      subtitleElement.textContent = metric.subtitle;
    }
    
    // Update border color smoothly
    if (card.style.borderLeftColor !== metric.color) {
      card.style.transition = 'border-left-color 0.3s ease';
      card.style.borderLeftColor = metric.color;
    }
  }

  calculateMetrics() {
    const devices = Array.from(this.devices.values());
    
    const deviceCounts = devices.reduce((counts, device) => {
      counts[device.type] = (counts[device.type] || 0) + 1;
      return counts;
    }, {});

    const activeDevices = devices.filter(device => 
      device.state === 'on' || device.state === 'recording' || device.state === 'motion detected'
    ).length;

    const tempDevice = devices.find(d => d.type === 'temperature');
    const thermostatDevice = devices.find(d => d.type === 'thermostat');
    
    const metrics = [
      {
        title: 'Total Devices',
        value: devices.length,
        icon: '🏠',
        color: '#2196f3',
        subtitle: `${activeDevices} active`
      },
      {
        title: 'Temperature',
        value: tempDevice ? `${tempDevice.value}°C` : 'N/A',
        icon: '🌡️',
        color: '#ff9800',
        subtitle: 'Current reading'
      },
      {
        title: 'Climate Control',
        value: thermostatDevice ? `${thermostatDevice.targetTemp}°C` : 'N/A',
        icon: '🌡️',
        color: '#ff5722',
        subtitle: thermostatDevice ? `Currently ${thermostatDevice.currentTemp}°C` : 'Offline'
      },
      {
        title: 'Security Status',
        value: this.getSecurityStatus(),
        icon: '🔒',
        color: '#607d8b',
        subtitle: 'Locks & cameras'
      },
      {
        title: 'Activity Events',
        value: this.activityLog.length,
        icon: '📊',
        color: '#4caf50',
        subtitle: 'Recent events'
      }
    ];

    return metrics;
  }

  getSecurityStatus() {
    const locks = Array.from(this.devices.values()).filter(d => d.type === 'lock');
    const cameras = Array.from(this.devices.values()).filter(d => d.type === 'camera');
    
    const lockedCount = locks.filter(d => d.state === 'locked').length;
    const recordingCount = cameras.filter(d => d.state === 'recording').length;
    
    if (lockedCount === locks.length && recordingCount === cameras.length) {
      return 'Secure';
    } else if (lockedCount > 0 || recordingCount > 0) {
      return 'Partial';
    } else {
      return 'Open';
    }
  }

  createMetricCard(metric) {
    const card = this.createComponent('div', 'metric-card');
    card.style.borderLeft = `4px solid ${metric.color}`;
    
    const header = this.createComponent('div', 'metric-header');
    const icon = this.createComponent('div', 'metric-icon', metric.icon);
    const title = this.createComponent('div', 'metric-title', metric.title);
    
    header.appendChild(icon);
    header.appendChild(title);
    
    const value = this.createComponent('div', 'metric-value', metric.value);
    const subtitle = this.createComponent('div', 'metric-subtitle', metric.subtitle);
    
    card.appendChild(header);
    card.appendChild(value);
    card.appendChild(subtitle);
    
    return card;
  }

  // Data tracking for visualization
  trackDataPoint(device) {
    const now = new Date();
    
    if (device.type === 'temperature') {
      this.temperatureHistory.push({
        time: now,
        value: device.value,
        timestamp: now.toLocaleTimeString()
      });
      
      // Keep only last 20 data points
      if (this.temperatureHistory.length > 20) {
        this.temperatureHistory.shift();
      }
      
      this.updateTemperatureChart();
    }
    
    // Track activity counts over time
    this.updateActivityChart();
  }

  updateTemperatureChart() {
    const container = document.getElementById('charts-container');
    if (!container || this.temperatureHistory.length < 2) return;
    
    let tempChart = document.getElementById('temp-chart');
    if (!tempChart) {
      tempChart = this.createTemperatureChart();
      container.appendChild(tempChart);
    }
    
    this.renderTemperatureChart(tempChart);
  }

  createTemperatureChart() {
    const chartContainer = this.createComponent('div', 'chart-container');
    chartContainer.id = 'temp-chart';
    
    const title = this.createComponent('h3', 'chart-title', '🌡️ Temperature Trend');
    const chart = this.createComponent('div', 'simple-chart');
    chart.id = 'temp-chart-canvas';
    
    chartContainer.appendChild(title);
    chartContainer.appendChild(chart);
    
    return chartContainer;
  }

  renderTemperatureChart(container) {
    const canvas = container.querySelector('.simple-chart');
    if (!canvas || this.temperatureHistory.length < 2) return;
    
    // Create simple ASCII-style chart
    const data = this.temperatureHistory.slice(-10); // Last 10 points
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    
    let chartHTML = '<div class="chart-data">';
    
    data.forEach((point, index) => {
      const height = ((point.value - min) / range) * 60 + 10; // 10-70px height
      const isLatest = index === data.length - 1;
      
      chartHTML += `
        <div class="chart-bar ${isLatest ? 'latest' : ''}" 
             style="height: ${height}px;" 
             title="${point.value}°C at ${point.timestamp}">
          <div class="bar-value">${point.value}°</div>
        </div>
      `;
    });
    
    chartHTML += '</div>';
    chartHTML += `<div class="chart-info">Range: ${min}°C - ${max}°C</div>`;
    
    canvas.innerHTML = chartHTML;
  }

  updateActivityChart() {
    const container = document.getElementById('charts-container');
    if (!container) return;
    
    let activityChart = document.getElementById('activity-chart');
    if (!activityChart) {
      activityChart = this.createActivityChart();
      container.appendChild(activityChart);
    }
    
    this.renderActivityChart(activityChart);
  }

  createActivityChart() {
    const chartContainer = this.createComponent('div', 'chart-container');
    chartContainer.id = 'activity-chart';
    
    const title = this.createComponent('h3', 'chart-title', '📊 Activity Summary');
    const chart = this.createComponent('div', 'activity-summary');
    
    chartContainer.appendChild(title);
    chartContainer.appendChild(chart);
    
    return chartContainer;
  }

  renderActivityChart(container) {
    const chart = container.querySelector('.activity-summary');
    if (!chart) return;
    
    // Count activity types
    const typeCounts = this.activityLog.reduce((counts, entry) => {
      const key = entry.deviceType || entry.type;
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    
    const total = this.activityLog.length;
    
    let summaryHTML = '<div class="activity-bars">';
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      const percentage = total > 0 ? (count / total * 100) : 0;
      const color = this.getTypeColor(type);
      
      summaryHTML += `
        <div class="activity-bar-container">
          <div class="activity-bar-label">${type}</div>
          <div class="activity-bar-track">
            <div class="activity-bar-fill" style="width: ${percentage}%; background-color: ${color};">
              <span class="activity-count">${count}</span>
            </div>
          </div>
        </div>
      `;
    });
    
    summaryHTML += '</div>';
    
    chart.innerHTML = summaryHTML;
  }

  getTypeColor(type) {
    const colors = {
      light: '#ffc107',
      temperature: '#2196f3',
      motion: '#9c27b0',
      thermostat: '#ff5722',
      lock: '#607d8b',
      camera: '#e91e63',
      action: '#4caf50',
      sensor: '#ff9800',
      info: '#2196f3',
      error: '#f44336'
    };
    
    return colors[type] || '#666';
  }

  // Voice-like command processing
  processCommand(command) {
    if (!command.trim()) return;
    
    const cmd = command.toLowerCase().trim();
    this.addToActivityLog(`Command: "${command}"`, 'info');
    
    // Parse and execute commands
    if (cmd.includes('turn on all lights') || cmd.includes('lights on')) {
      this.executeAllLights('on');
    } else if (cmd.includes('turn off all lights') || cmd.includes('lights off')) {
      this.executeAllLights('off');
    } else if (cmd.includes('lock all doors') || cmd.includes('secure')) {
      this.executeAllLocks('lock');
    } else if (cmd.includes('unlock all doors') || cmd.includes('unsecure')) {
      this.executeAllLocks('unlock');
    } else if (cmd.includes('status report') || cmd.includes('status')) {
      this.generateStatusReport();
    } else if (cmd.includes('temperature up') || cmd.includes('warmer')) {
      this.adjustAllThermostats(1);
    } else if (cmd.includes('temperature down') || cmd.includes('cooler')) {
      this.adjustAllThermostats(-1);
    } else if (cmd.includes('emergency') || cmd.includes('panic')) {
      this.emergencyMode();
    } else {
      this.addToActivityLog(`Unknown command: "${command}". Try "status report" or "turn on all lights"`, 'error');
    }
  }

  executeAllLights(action) {
    const lights = Array.from(this.devices.values()).filter(d => d.type === 'light');
    let count = 0;
    
    lights.forEach(light => {
      if ((action === 'on' && light.state === 'off') || (action === 'off' && light.state === 'on')) {
        this.toggleDevice(light.id);
        count++;
      }
    });
    
    if (count > 0) {
      this.addToActivityLog(`Turned ${action} ${count} light(s)`, 'action');
    } else {
      this.addToActivityLog(`All lights already ${action}`, 'info');
    }
  }

  executeAllLocks(action) {
    const locks = Array.from(this.devices.values()).filter(d => d.type === 'lock');
    let count = 0;
    
    locks.forEach(lock => {
      const targetState = action === 'lock' ? 'locked' : 'unlocked';
      if (lock.state !== targetState) {
        this.toggleDevice(lock.id);
        count++;
      }
    });
    
    if (count > 0) {
      this.addToActivityLog(`${action === 'lock' ? 'Locked' : 'Unlocked'} ${count} door(s)`, 'action');
    } else {
      this.addToActivityLog(`All doors already ${action}ed`, 'info');
    }
  }

  adjustAllThermostats(delta) {
    const thermostats = Array.from(this.devices.values()).filter(d => d.type === 'thermostat');
    
    thermostats.forEach(thermostat => {
      const newTarget = thermostat.targetTemp + delta;
      if (newTarget >= 16 && newTarget <= 30) { // Reasonable temperature range
        this.setThermostat(thermostat.id, newTarget);
      }
    });
    
    this.addToActivityLog(`Adjusted ${thermostats.length} thermostat(s) by ${delta > 0 ? '+' : ''}${delta}°C`, 'action');
  }

  generateStatusReport() {
    const devices = Array.from(this.devices.values());
    const lights = devices.filter(d => d.type === 'light');
    const locks = devices.filter(d => d.type === 'lock');
    const cameras = devices.filter(d => d.type === 'camera');
    const sensors = devices.filter(d => d.type === 'temperature' || d.type === 'motion');
    
    const lightsOn = lights.filter(d => d.state === 'on').length;
    const doorsLocked = locks.filter(d => d.state === 'locked').length;
    const camerasRecording = cameras.filter(d => d.state === 'recording').length;
    
    const temp = devices.find(d => d.type === 'temperature');
    const motion = devices.find(d => d.type === 'motion');
    
    this.addToActivityLog('=== STATUS REPORT ===', 'info');
    this.addToActivityLog(`💡 Lights: ${lightsOn}/${lights.length} on`, 'info');
    this.addToActivityLog(`🔒 Security: ${doorsLocked}/${locks.length} doors locked, ${camerasRecording}/${cameras.length} cameras recording`, 'info');
    if (temp) this.addToActivityLog(`🌡️ Temperature: ${temp.value}°C`, 'info');
    if (motion) this.addToActivityLog(`👁️ Motion: ${motion.state}`, 'info');
    this.addToActivityLog(`📊 Total Events: ${this.activityLog.length}`, 'info');
  }

  emergencyMode() {
    this.addToActivityLog('🚨 EMERGENCY MODE ACTIVATED', 'error');
    
    // Turn on all lights
    this.executeAllLights('on');
    
    // Lock all doors
    this.executeAllLocks('lock');
    
    // Start all cameras
    const cameras = Array.from(this.devices.values()).filter(d => d.type === 'camera');
    cameras.forEach(camera => {
      if (camera.state !== 'recording') {
        this.toggleDevice(camera.id);
      }
    });
    
    this.addToActivityLog('Emergency protocol: All lights on, doors locked, cameras recording', 'error');
  }
}

// Make actor available globally
window.SmartHomeClientActor = SmartHomeClientActor;
window.smartHomeActor = null;

// Set global reference when actor is created
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for the actor to be created by the framework
  setTimeout(() => {
    if (window.__legionActor) {
      window.smartHomeActor = window.__legionActor;
    }
  }, 100);
});