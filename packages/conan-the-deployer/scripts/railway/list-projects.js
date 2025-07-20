#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from '../../src/providers/RailwayProvider.js';

console.log('📋 Listing All Railway Projects\n');

async function listProjects() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // List personal projects
    console.log('1️⃣ Personal Projects:');
    const result = await railwayProvider.listProjects();
    
    if (result.success && result.projects.length > 0) {
      result.projects.forEach(project => {
        console.log(`\n📁 ${project.name} (${project.id})`);
        console.log(`   Created: ${project.createdAt}`);
        if (project.services.length > 0) {
          console.log(`   Services:`);
          project.services.forEach(service => {
            console.log(`   - ${service.name} (${service.id})`);
          });
        }
      });
    } else {
      console.log('   No personal projects found');
    }
    
    // Get account overview (includes team info)
    console.log('\n\n2️⃣ Account Overview:');
    const overview = await railwayProvider.getAccountOverview();
    
    if (overview.success) {
      console.log(`Account: ${overview.account.email}`);
      console.log(`Total Projects: ${overview.stats.totalProjects}`);
      console.log(`Total Services: ${overview.stats.totalServices}`);
      console.log(`Active Deployments: ${overview.stats.activeDeployments}`);
      
      if (overview.liveUrls.length > 0) {
        console.log('\n🌐 Live URLs:');
        overview.liveUrls.forEach(({ projectName, serviceName, url }) => {
          console.log(`   ${projectName}/${serviceName}: ${url}`);
        });
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

listProjects();