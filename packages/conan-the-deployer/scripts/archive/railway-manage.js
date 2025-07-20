#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  try {
    // Initialize ResourceManager and RailwayProvider
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    switch (command) {
      case 'list':
        await listProjects(railwayProvider);
        break;
        
      case 'overview':
        await showOverview(railwayProvider);
        break;
        
      case 'details':
        const projectId = args[1];
        if (!projectId) {
          console.error('Please provide a project ID: railway-manage.js details <project-id>');
          process.exit(1);
        }
        await showProjectDetails(railwayProvider, projectId);
        break;
        
      case 'delete':
        const deleteId = args[1];
        if (!deleteId) {
          console.error('Please provide a project ID: railway-manage.js delete <project-id>');
          process.exit(1);
        }
        await deleteProject(railwayProvider, deleteId);
        break;
        
      case 'delete-all':
        await deleteAllProjects(railwayProvider);
        break;
        
      default:
        showHelp();
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log('🚂 Railway Management Tool\n');
  console.log('Usage: node railway-manage.js <command> [options]\n');
  console.log('Commands:');
  console.log('  list              List all projects');
  console.log('  overview          Show comprehensive account overview');
  console.log('  details <id>      Show detailed project information');
  console.log('  delete <id>       Delete a specific project');
  console.log('  delete-all        Delete ALL projects (use with caution!)');
  console.log('\nExamples:');
  console.log('  node railway-manage.js list');
  console.log('  node railway-manage.js details abc123');
  console.log('  node railway-manage.js delete abc123');
}

async function listProjects(provider) {
  console.log('📋 Listing Railway Projects...\n');
  
  const result = await provider.listProjects();
  
  if (!result.success) {
    console.error('❌ Failed to list projects:', result.error);
    return;
  }
  
  const projects = result.projects;
  
  if (projects.length === 0) {
    console.log('No projects found.');
    return;
  }
  
  console.log(`Found ${projects.length} project(s):\n`);
  
  projects.forEach((project, index) => {
    console.log(`${index + 1}. ${project.name}`);
    console.log(`   ID: ${project.id}`);
    console.log(`   Description: ${project.description || 'No description'}`);
    console.log(`   Created: ${new Date(project.createdAt).toLocaleString()}`);
    console.log(`   Services: ${project.services ? project.services.length : 0}`);
    console.log('');
  });
}

async function showOverview(provider) {
  console.log('📊 Railway Account Overview\n');
  
  const result = await provider.getAccountOverview();
  
  if (!result.success) {
    console.error('❌ Failed to get overview:', result.error);
    return;
  }
  
  console.log('👤 Account Information:');
  console.log('━'.repeat(50));
  console.log(`Email: ${result.account.email}`);
  console.log(`User ID: ${result.account.id}`);
  console.log(`Name: ${result.account.name || 'Not set'}`);
  
  console.log('\n📈 Statistics:');
  console.log('━'.repeat(50));
  console.log(`Total Projects: ${result.stats.totalProjects}`);
  console.log(`Total Services: ${result.stats.totalServices}`);
  console.log(`Total Deployments: ${result.stats.totalDeployments}`);
  console.log(`Active Deployments: ${result.stats.activeDeployments}`);
  
  if (result.liveUrls.length > 0) {
    console.log('\n🌐 Live URLs:');
    console.log('━'.repeat(50));
    result.liveUrls.forEach(item => {
      console.log(`${item.projectName}/${item.serviceName}: ${item.url}`);
    });
  }
  
  if (result.projects.length > 0) {
    console.log('\n🏗️  Projects:');
    console.log('━'.repeat(50));
    result.projects.forEach((project, index) => {
      console.log(`\n${index + 1}. ${project.name} (${project.id})`);
      console.log(`   Services: ${project.services.edges.length}`);
      console.log(`   Environments: ${project.environments.edges.length}`);
    });
  }
}

async function showProjectDetails(provider, projectId) {
  console.log(`📋 Project Details for ${projectId}\n`);
  
  const result = await provider.getProjectDetails(projectId);
  
  if (!result.success) {
    console.error('❌ Failed to get project details:', result.error);
    return;
  }
  
  const project = result.project;
  
  console.log(`Project: ${project.name}`);
  console.log(`ID: ${project.id}`);
  console.log(`Description: ${project.description || 'No description'}`);
  console.log(`Created: ${new Date(project.createdAt).toLocaleString()}`);
  console.log(`Updated: ${new Date(project.updatedAt).toLocaleString()}`);
  
  console.log('\n⚙️  Services:');
  const services = project.services.edges;
  
  if (services.length === 0) {
    console.log('No services found.');
  } else {
    services.forEach((serviceEdge, index) => {
      const service = serviceEdge.node;
      console.log(`\n${index + 1}. ${service.name}`);
      console.log(`   ID: ${service.id}`);
      console.log(`   Created: ${new Date(service.createdAt).toLocaleString()}`);
      
      const deployments = service.deployments.edges;
      if (deployments.length > 0) {
        console.log(`   Recent Deployments:`);
        deployments.forEach(depEdge => {
          const dep = depEdge.node;
          console.log(`     - ${dep.id.slice(-8)} [${dep.status}]`);
          if (dep.url) console.log(`       URL: ${dep.url}`);
        });
      }
    });
  }
  
  console.log('\n🌍 Environments:');
  const environments = project.environments.edges;
  environments.forEach(envEdge => {
    console.log(`   - ${envEdge.node.name} (${envEdge.node.id})`);
  });
}

async function deleteProject(provider, projectId) {
  console.log(`🗑️  Deleting project ${projectId}...\n`);
  
  // First get project details to show what we're deleting
  const detailsResult = await provider.getProjectDetails(projectId);
  
  if (detailsResult.success) {
    const project = detailsResult.project;
    console.log(`Project to delete: ${project.name}`);
    console.log(`Services: ${project.services.edges.length}`);
    console.log('\n⚠️  This action cannot be undone!');
    console.log('Press Ctrl+C to cancel, or wait 3 seconds...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  const result = await provider.deleteProject(projectId);
  
  if (result.success) {
    console.log('✅ Project deleted successfully!');
  } else {
    console.error('❌ Failed to delete project:', result.error);
  }
}

async function deleteAllProjects(provider) {
  console.log('🧹 Delete ALL Railway Projects\n');
  console.log('⚠️  WARNING: This will DELETE ALL projects in your account!');
  console.log('━'.repeat(60));
  
  // First list what will be deleted
  const listResult = await provider.listProjects();
  
  if (!listResult.success) {
    console.error('❌ Failed to list projects:', listResult.error);
    return;
  }
  
  const projects = listResult.projects;
  
  if (projects.length === 0) {
    console.log('No projects to delete.');
    return;
  }
  
  console.log(`\nFound ${projects.length} project(s) to delete:`);
  projects.forEach((project, index) => {
    console.log(`${index + 1}. ${project.name} (${project.id})`);
  });
  
  console.log('\n⚠️  This action cannot be undone!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const result = await provider.deleteAllProjects();
  
  console.log('\n📊 Results:');
  console.log(`Deleted: ${result.deletedProjects}`);
  console.log(`Failed: ${result.failedDeletions}`);
  
  if (result.success) {
    console.log('\n✅ All projects deleted successfully!');
  } else {
    console.log('\n⚠️  Some deletions failed.');
  }
}

// Run the main function
main();