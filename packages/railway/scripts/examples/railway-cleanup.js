#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🧹 Railway Resource Cleanup Tool\n');
console.log('⚠️  WARNING: This will DELETE ALL projects and services in your Railway account!');
console.log('━'.repeat(60));

async function cleanupRailway() {
  try {
    // Get Railway API key
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    
    if (!apiKey) {
      throw new Error('Railway API key not found');
    }

    console.log('\n🔑 Connected to Railway API');
    console.log('API Key:', apiKey.slice(0, 8) + '...');

    // Create Railway provider
    const railwayProvider = new RailwayProvider(resourceManager);

    // First, list all projects to show what will be deleted
    console.log('\n📋 Checking for existing projects...');
    const projectsResult = await railwayProvider.listProjects();
    
    if (!projectsResult.success) {
      console.error('❌ Failed to list projects:', projectsResult.error);
      return;
    }

    const projects = projectsResult.projects;
    
    if (projects.length === 0) {
      console.log('✅ No projects found. Your Railway account is already clean!');
      return;
    }

    console.log(`\n🗂️  Found ${projects.length} project(s) to delete:`);
    console.log('━'.repeat(50));
    
    projects.forEach((project, index) => {
      console.log(`\n${index + 1}. Project: ${project.name}`);
      console.log(`   ID: ${project.id}`);
      console.log(`   Description: ${project.description || 'No description'}`);
      console.log(`   Created: ${new Date(project.createdAt).toLocaleString()}`);
      console.log(`   Services: ${project.services ? project.services.length : 0}`);
    });

    console.log('\n⚠️  This action cannot be undone!');
    console.log('Press Ctrl+C now to cancel, or wait 5 seconds to continue...');
    
    // Give user time to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🗑️  Starting deletion process...');
    console.log('━'.repeat(50));

    // Delete all projects
    const deleteResult = await railwayProvider.deleteAllProjects();
    
    console.log('\n📊 Deletion Summary:');
    console.log('━'.repeat(50));
    console.log(`Total Projects: ${deleteResult.totalProjects}`);
    console.log(`Successfully Deleted: ${deleteResult.deletedProjects}`);
    console.log(`Failed Deletions: ${deleteResult.failedDeletions}`);
    
    if (deleteResult.failedDeletions > 0) {
      console.log('\n❌ Failed deletions:');
      deleteResult.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.projectName}: ${r.error}`);
        });
    }

    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...');
    const verifyResult = await railwayProvider.listProjects();
    
    if (verifyResult.success) {
      const remainingProjects = verifyResult.projects;
      
      if (remainingProjects.length === 0) {
        console.log('✅ All projects successfully deleted!');
        console.log('🎉 Your Railway account is now clean.');
      } else {
        console.log(`⚠️  ${remainingProjects.length} project(s) still remain:`);
        remainingProjects.forEach(p => {
          console.log(`  - ${p.name} (${p.id})`);
        });
      }
    }

    console.log('\n✨ Cleanup process completed!');

  } catch (error) {
    console.error('\n💥 Error during cleanup:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Add ability to cleanup specific project by ID
const args = process.argv.slice(2);
if (args.length > 0 && args[0] === '--project') {
  const projectId = args[1];
  if (!projectId) {
    console.error('Please provide a project ID: --project <project-id>');
    process.exit(1);
  }
  
  console.log(`Deleting specific project: ${projectId}`);
  // Add specific project deletion logic here
} else {
  // Run full cleanup
  cleanupRailway();
}