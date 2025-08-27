#!/usr/bin/env node
/**
 * Isolated Test - Only SD agents, no auto-loading
 */

// Only import what we absolutely need
import { DesignDatabaseService } from '../src/services/DesignDatabaseService.js';

// Create minimal ResourceManager that doesn't trigger module loading
class MinimalResourceManager {
  constructor() {
    this.resources = new Map();
  }
  
  async initialize() {
    // Load .env file manually
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const envPath = path.resolve(process.cwd(), '../../.env');
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      const envObj = {};
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            envObj[key] = valueParts.join('=');
          }
        }
      }
      
      this.resources.set('env', envObj);
    } catch (error) {
      console.warn('Could not load .env file:', error.message);
    }
  }
  
  get(key) {
    if (key.startsWith('env.')) {
      const envKey = key.replace('env.', '');
      return this.resources.get('env')[envKey];
    }
    return this.resources.get(key);
  }
}

async function isolatedTest() {
  console.log('🧪 Isolated Test - SD Package Only...\n');
  
  try {
    console.log('📋 Testing MinimalResourceManager...');
    const resourceManager = new MinimalResourceManager();
    await resourceManager.initialize();
    
    const mongoUrl = resourceManager.get('env.MONGODB_URL');
    const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    
    if (!mongoUrl || !anthropicKey) {
      console.error('❌ Missing required environment variables');
      console.log('MongoDB URL:', !!mongoUrl);
      console.log('Anthropic Key:', !!anthropicKey);
      process.exit(1);
    }
    
    console.log('✅ Environment variables loaded');
    
    console.log('\n🗄️  Testing DesignDatabaseService...');
    const dbService = new DesignDatabaseService(resourceManager);
    await dbService.initialize();
    
    const health = await dbService.healthCheck();
    if (health.status !== 'healthy') {
      throw new Error(`Database unhealthy: ${health.error}`);
    }
    
    console.log('✅ Database service healthy');
    
    // Test basic CRUD operations
    const testArtifact = {
      type: 'isolated_test',
      projectId: `isolated-${Date.now()}`,
      data: { message: 'Isolated test successful' }
    };
    
    const stored = await dbService.storeArtifact(testArtifact);
    console.log('✅ Artifact stored:', stored._id);
    
    const retrieved = await dbService.retrieveArtifacts('isolated_test', {
      projectId: testArtifact.projectId
    });
    
    if (retrieved.length !== 1) {
      throw new Error('Artifact retrieval failed');
    }
    
    console.log('✅ Artifact retrieved successfully');
    
    // Cleanup
    await dbService.disconnect();
    
    console.log('\n🎉 Isolated Test Passed! 🎉');
    console.log('✅ SD package works independently');
    console.log('✅ Database CRUD operations working');
    console.log('\n💡 Now ready to test with agents (avoiding auto-loading)');
    
  } catch (error) {
    console.error('\n❌ Isolated Test Failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

isolatedTest();