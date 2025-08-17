/**
 * Smart Home Hub Server
 * Stage 1: Basic foundation with one light device
 */

import { BaseServer } from '../../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Server actor factory - manages smart home devices
function createSmartHomeServerActor(services) {
  return {
    // Device state
    devices: {
      'light-1': {
        id: 'light-1',
        name: 'Living Room Light',
        type: 'light',
        state: 'off',
        lastChanged: new Date().toISOString()
      },
      'temp-1': {
        id: 'temp-1',
        name: 'Living Room Temperature',
        type: 'temperature',
        value: 22.5,
        unit: '°C',
        lastChanged: new Date().toISOString()
      },
      'motion-1': {
        id: 'motion-1',
        name: 'Front Door Motion',
        type: 'motion',
        state: 'no motion',
        lastChanged: new Date().toISOString()
      },
      'thermostat-1': {
        id: 'thermostat-1',
        name: 'Living Room Thermostat',
        type: 'thermostat',
        targetTemp: 22,
        currentTemp: 22.5,
        mode: 'auto',
        unit: '°C',
        lastChanged: new Date().toISOString()
      },
      'lock-1': {
        id: 'lock-1',
        name: 'Front Door Lock',
        type: 'lock',
        state: 'locked',
        lastChanged: new Date().toISOString()
      },
      'camera-1': {
        id: 'camera-1',
        name: 'Security Camera',
        type: 'camera',
        state: 'recording',
        activity: 'idle',
        lastChanged: new Date().toISOString()
      }
    },
    
    // Timer references for autonomous sensor updates
    timers: [],
    
    remoteActor: null,
    
    // Set remote actor reference (called by framework)
    setRemoteActor(remoteActor) {
      console.log('[SMART HOME SERVER] Setting remote actor:', remoteActor);
      this.remoteActor = remoteActor;
      
      // Start autonomous sensor monitoring when client connects
      this.startSensorMonitoring();
    },
    
    // Handle incoming messages (Actor protocol method)
    async receive(messageType, data) {
      console.log('[SMART HOME SERVER] Received:', messageType, data);
      let response = null;
      
      switch (messageType) {
        case 'toggle_device':
          response = this.handleToggleDevice(data);
          break;
          
        case 'set_thermostat':
          response = this.handleSetThermostat(data);
          break;
          
        case 'get_device_status':
          response = this.handleGetDeviceStatus(data);
          break;
          
        case 'get_all_devices':
          response = this.handleGetAllDevices();
          break;
          
        default:
          console.warn(`[SMART HOME SERVER] Unknown message type: ${messageType}`);
          response = { type: 'error', message: `Unknown message type: ${messageType}` };
      }
      
      // Send response to client if we have a remote actor
      if (this.remoteActor && response) {
        console.log('[SMART HOME SERVER] Sending response:', response);
        this.remoteActor.receive(response.type, response);
      }
      
      return response;
    },
    
    // Handle device toggle request
    handleToggleDevice(data) {
      const { deviceId } = data;
      const device = this.devices[deviceId];
      
      if (!device) {
        return { type: 'error', message: `Device not found: ${deviceId}` };
      }
      
      let message = '';
      
      // Handle different device types
      switch (device.type) {
        case 'light':
          device.state = device.state === 'on' ? 'off' : 'on';
          message = `${device.name} turned ${device.state}`;
          break;
          
        case 'lock':
          device.state = device.state === 'locked' ? 'unlocked' : 'locked';
          message = `${device.name} ${device.state}`;
          break;
          
        case 'camera':
          device.state = device.state === 'recording' ? 'stopped' : 'recording';
          message = `${device.name} ${device.state}`;
          break;
          
        default:
          return { type: 'error', message: `Cannot toggle device type: ${device.type}` };
      }
      
      device.lastChanged = new Date().toISOString();
      console.log(`[SMART HOME SERVER] ${message}`);
      
      return {
        type: 'device_updated',
        device: { ...device },
        message: message
      };
    },
    
    // Handle thermostat setting
    handleSetThermostat(data) {
      const { deviceId, targetTemp } = data;
      const device = this.devices[deviceId];
      
      if (!device || device.type !== 'thermostat') {
        return { type: 'error', message: `Thermostat not found: ${deviceId}` };
      }
      
      device.targetTemp = targetTemp;
      device.lastChanged = new Date().toISOString();
      
      const message = `${device.name} set to ${targetTemp}${device.unit}`;
      console.log(`[SMART HOME SERVER] ${message}`);
      
      return {
        type: 'device_updated',
        device: { ...device },
        message: message
      };
    },
    
    // Handle device status request
    handleGetDeviceStatus(data) {
      const { deviceId } = data;
      const device = this.devices[deviceId];
      
      if (!device) {
        return { type: 'error', message: `Device not found: ${deviceId}` };
      }
      
      return {
        type: 'device_status',
        device: { ...device }
      };
    },
    
    // Handle get all devices request
    handleGetAllDevices() {
      return {
        type: 'all_devices',
        devices: Object.values(this.devices)
      };
    },
    
    // Start autonomous sensor monitoring
    startSensorMonitoring() {
      console.log('[SMART HOME SERVER] Starting autonomous sensor monitoring...');
      
      // Temperature sensor - update every 3 seconds
      const tempTimer = setInterval(() => {
        this.updateTemperatureSensor();
      }, 3000);
      
      // Motion sensor - random triggers every 5-10 seconds
      const motionTimer = setInterval(() => {
        this.updateMotionSensor();
      }, 5000 + Math.random() * 5000);
      
      // Thermostat - adjust current temp every 4 seconds
      const thermostatTimer = setInterval(() => {
        this.updateThermostat();
      }, 4000);
      
      // Camera activity - random events every 8-15 seconds
      const cameraTimer = setInterval(() => {
        this.updateCameraActivity();
      }, 8000 + Math.random() * 7000);
      
      this.timers.push(tempTimer, motionTimer, thermostatTimer, cameraTimer);
      console.log('[SMART HOME SERVER] Sensor monitoring started');
    },
    
    // Update temperature sensor with simulated reading
    updateTemperatureSensor() {
      const tempDevice = this.devices['temp-1'];
      
      // Simulate temperature fluctuation between 18°C and 26°C
      const baseTemp = 22;
      const variation = (Math.random() - 0.5) * 8; // ±4°C variation
      const newTemp = Math.round((baseTemp + variation) * 10) / 10; // Round to 1 decimal
      
      tempDevice.value = newTemp;
      tempDevice.lastChanged = new Date().toISOString();
      
      console.log(`[SMART HOME SERVER] Temperature updated to ${newTemp}°C`);
      
      // Broadcast update to client
      if (this.remoteActor) {
        this.remoteActor.receive('sensor_update', {
          type: 'sensor_update',
          device: { ...tempDevice },
          message: `Temperature reading: ${newTemp}°C`
        });
      }
    },
    
    // Update motion sensor with random triggers
    updateMotionSensor() {
      const motionDevice = this.devices['motion-1'];
      
      // Random motion detection (30% chance)
      const hasMotion = Math.random() < 0.3;
      const newState = hasMotion ? 'motion detected' : 'no motion';
      
      // Only update if state changed or if motion was detected
      if (motionDevice.state !== newState || hasMotion) {
        motionDevice.state = newState;
        motionDevice.lastChanged = new Date().toISOString();
        
        console.log(`[SMART HOME SERVER] Motion sensor: ${newState}`);
        
        // Broadcast update to client
        if (this.remoteActor) {
          this.remoteActor.receive('sensor_update', {
            type: 'sensor_update',
            device: { ...motionDevice },
            message: `Motion sensor: ${newState}`
          });
        }
      }
    },
    
    // Update thermostat with temperature adjustment
    updateThermostat() {
      const thermostat = this.devices['thermostat-1'];
      const targetTemp = thermostat.targetTemp;
      const currentTemp = thermostat.currentTemp;
      
      // Simulate thermostat working towards target temperature
      const diff = targetTemp - currentTemp;
      const adjustment = Math.sign(diff) * Math.min(Math.abs(diff), 0.5); // Max 0.5° adjustment per update
      const newTemp = Math.round((currentTemp + adjustment) * 10) / 10;
      
      thermostat.currentTemp = newTemp;
      thermostat.lastChanged = new Date().toISOString();
      
      console.log(`[SMART HOME SERVER] Thermostat adjusted to ${newTemp}°C (target: ${targetTemp}°C)`);
      
      // Broadcast update to client
      if (this.remoteActor) {
        this.remoteActor.receive('sensor_update', {
          type: 'sensor_update',
          device: { ...thermostat },
          message: `Thermostat: ${newTemp}°C (target: ${targetTemp}°C)`
        });
      }
    },
    
    // Update camera activity with random events
    updateCameraActivity() {
      const camera = this.devices['camera-1'];
      
      // Random activity types
      const activities = ['idle', 'person detected', 'vehicle detected', 'package detected'];
      const randomActivity = activities[Math.floor(Math.random() * activities.length)];
      
      // Only update if activity changed or it's an interesting event
      if (camera.activity !== randomActivity || randomActivity !== 'idle') {
        camera.activity = randomActivity;
        camera.lastChanged = new Date().toISOString();
        
        console.log(`[SMART HOME SERVER] Camera activity: ${randomActivity}`);
        
        // Broadcast update to client
        if (this.remoteActor) {
          this.remoteActor.receive('sensor_update', {
            type: 'sensor_update',
            device: { ...camera },
            message: `Security Camera: ${randomActivity}`
          });
        }
      }
    },
    
    // Clean up timers when connection closes
    cleanup() {
      console.log('[SMART HOME SERVER] Cleaning up timers...');
      this.timers.forEach(timer => clearInterval(timer));
      this.timers = [];
    }
  };
}

// Create and configure server
async function main() {
  const server = new BaseServer();
  
  // Initialize with ResourceManager
  await server.initialize();
  
  // Register the smart home hub route
  const clientActorFile = path.join(__dirname, 'client.js');
  server.registerRoute('/smart-home', createSmartHomeServerActor, clientActorFile, 8080);
  
  // Start the server
  await server.start();
  
  console.log('Smart Home Hub running at http://localhost:8080/smart-home');
  console.log('Press Ctrl+C to stop');
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});