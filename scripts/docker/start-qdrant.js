#!/usr/bin/env node

/**
 * Script to start Qdrant vector database in Docker
 * Automatically handles Docker runtime and container lifecycle
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const QDRANT_CONTAINER_NAME = 'legion-qdrant';
const QDRANT_PORT = 6333;
const QDRANT_IMAGE = 'qdrant/qdrant:latest';

/**
 * Check if Docker is running
 */
async function isDockerRunning() {
  try {
    await execAsync('docker info');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Start Docker (Colima on macOS)
 */
async function startDocker() {
  console.log('🐳 Starting Docker runtime...');
  
  // Check if colima is available (macOS)
  try {
    await execAsync('which colima');
    console.log('   Using Colima for Docker runtime');
    
    // Check if colima is already running
    try {
      await execAsync('colima status');
      console.log('   ✅ Colima is already running');
    } catch {
      // Start colima
      console.log('   Starting Colima...');
      await execAsync('colima start');
      console.log('   ✅ Colima started');
    }
  } catch {
    // Try Docker Desktop or standard Docker
    console.log('   Checking standard Docker daemon...');
    const isRunning = await isDockerRunning();
    if (!isRunning) {
      throw new Error('Docker is not running. Please start Docker Desktop or your Docker runtime.');
    }
  }
}

/**
 * Check if container exists
 */
async function containerExists(name) {
  try {
    const { stdout } = await execAsync(`docker ps -a --filter name=${name} --format "{{.Names}}"`);
    return stdout.trim() === name;
  } catch {
    return false;
  }
}

/**
 * Check if container is running
 */
async function isContainerRunning(name) {
  try {
    const { stdout } = await execAsync(`docker ps --filter name=${name} --format "{{.Names}}"`);
    return stdout.trim() === name;
  } catch {
    return false;
  }
}

/**
 * Stop and remove existing container
 */
async function removeExistingContainer(name) {
  if (await containerExists(name)) {
    console.log(`🧹 Removing existing container: ${name}`);
    try {
      await execAsync(`docker stop ${name}`);
    } catch {
      // Container might not be running
    }
    await execAsync(`docker rm ${name}`);
    console.log('   ✅ Existing container removed');
  }
}

/**
 * Pull Qdrant image
 */
async function pullQdrantImage() {
  console.log(`📦 Pulling Qdrant image: ${QDRANT_IMAGE}`);
  
  return new Promise((resolve, reject) => {
    const pullProcess = spawn('docker', ['pull', QDRANT_IMAGE], {
      stdio: 'inherit'
    });
    
    pullProcess.on('close', (code) => {
      if (code === 0) {
        console.log('   ✅ Qdrant image pulled');
        resolve();
      } else {
        reject(new Error(`Failed to pull Qdrant image (exit code: ${code})`));
      }
    });
  });
}

/**
 * Start Qdrant container
 */
async function startQdrantContainer() {
  console.log('🚀 Starting Qdrant container...');
  
  const dockerArgs = [
    'run',
    '-d',
    '--name', QDRANT_CONTAINER_NAME,
    '-p', `${QDRANT_PORT}:6333`,
    '-v', `${process.env.HOME}/.legion/qdrant:/qdrant/storage`,
    '--restart', 'unless-stopped',
    QDRANT_IMAGE
  ];
  
  const { stdout } = await execAsync(`docker ${dockerArgs.join(' ')}`);
  const containerId = stdout.trim().substring(0, 12);
  console.log(`   ✅ Qdrant container started: ${containerId}`);
  
  return containerId;
}

/**
 * Wait for Qdrant to be ready
 */
async function waitForQdrant(maxRetries = 30) {
  console.log('⏳ Waiting for Qdrant to be ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`http://localhost:${QDRANT_PORT}/`);
      if (response.ok) {
        console.log('   ✅ Qdrant is ready!');
        return true;
      }
    } catch {
      // Connection failed, wait and retry
    }
    
    if (i % 5 === 0 && i > 0) {
      console.log(`   Still waiting... (${i}/${maxRetries})`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Qdrant failed to start within timeout');
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🔮 Qdrant Docker Manager');
    console.log('========================');
    console.log('');
    
    // Step 1: Ensure Docker is running
    const dockerRunning = await isDockerRunning();
    if (!dockerRunning) {
      await startDocker();
    } else {
      console.log('✅ Docker is running');
    }
    
    // Step 2: Check if Qdrant is already running
    if (await isContainerRunning(QDRANT_CONTAINER_NAME)) {
      console.log('✅ Qdrant is already running');
      console.log('');
      console.log('🌐 Qdrant endpoints:');
      console.log(`   Web UI: http://localhost:${QDRANT_PORT}/dashboard`);
      console.log(`   API: http://localhost:${QDRANT_PORT}`);
      return;
    }
    
    // Step 3: Remove any existing stopped container
    await removeExistingContainer(QDRANT_CONTAINER_NAME);
    
    // Step 4: Pull latest Qdrant image
    await pullQdrantImage();
    
    // Step 5: Start Qdrant container
    const containerId = await startQdrantContainer();
    
    // Step 6: Wait for Qdrant to be ready
    await waitForQdrant();
    
    console.log('');
    console.log('🎉 Qdrant is ready!');
    console.log('');
    console.log('🌐 Qdrant endpoints:');
    console.log(`   Web UI: http://localhost:${QDRANT_PORT}/dashboard`);
    console.log(`   API: http://localhost:${QDRANT_PORT}`);
    console.log('');
    console.log('📊 Container info:');
    console.log(`   Name: ${QDRANT_CONTAINER_NAME}`);
    console.log(`   ID: ${containerId}`);
    console.log(`   Data: ${process.env.HOME}/.legion/qdrant`);
    console.log('');
    console.log('💡 To stop Qdrant, run:');
    console.log(`   docker stop ${QDRANT_CONTAINER_NAME}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { startDocker, startQdrantContainer, waitForQdrant, isContainerRunning, QDRANT_CONTAINER_NAME, QDRANT_PORT };