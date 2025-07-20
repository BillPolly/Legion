#!/usr/bin/env node

import { RailwayProvider } from '../src/index.js';

console.log('📊 Check Deployment Status\n');

async function checkDeploymentStatus(deploymentId) {
  try {
    const apiKey = process.env.RAILWAY_API_KEY || process.env.RAILWAY;
    if (!apiKey) {
      throw new Error('RAILWAY_API_KEY or RAILWAY environment variable is required');
    }
    const railwayProvider = new RailwayProvider(apiKey);
    
    if (!deploymentId) {
      console.log('Usage: node check-deployment-status.js <deployment-id>');
      console.log('\nListing all deployments instead...\n');
      
      const result = await railwayProvider.listDeployments();
      
      if (result.success && result.deployments.length > 0) {
        result.deployments.forEach(deployment => {
          console.log(`\n📦 ${deployment.projectName} / ${deployment.serviceName}`);
          console.log(`   ID: ${deployment.id}`);
          console.log(`   Status: ${deployment.status}`);
          console.log(`   Created: ${deployment.createdAt}`);
          if (deployment.url) {
            console.log(`   URL: ${deployment.url}`);
          }
        });
      } else {
        console.log('No deployments found');
      }
      
      return;
    }
    
    console.log(`Checking deployment: ${deploymentId}\n`);
    const status = await railwayProvider.getStatus(deploymentId);
    
    console.log('📊 Status:', status.status);
    if (status.url) {
      console.log('🌐 URL:', status.url);
    }
    if (status.error) {
      console.log('❌ Error:', status.error);
    }
    console.log('📅 Created:', status.createdAt);
    if (status.completedAt) {
      console.log('✅ Completed:', status.completedAt);
    }
    
    // Get logs
    console.log('\n📜 Recent Logs:');
    const logsResult = await railwayProvider.getLogs(deploymentId, { limit: 10 });
    
    if (logsResult.success && logsResult.logs.length > 0) {
      logsResult.logs.forEach(log => {
        console.log(`[${log.level}] ${log.message}`);
      });
    } else {
      console.log('No logs available');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

// Get deployment ID from command line
const deploymentId = process.argv[2];
checkDeploymentStatus(deploymentId);