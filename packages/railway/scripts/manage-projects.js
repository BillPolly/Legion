#!/usr/bin/env node

/**
 * Manage Railway projects - list, delete, or get details
 * 
 * Usage: node manage-projects.js <command> [options]
 * Commands:
 *   list              - List all projects
 *   delete <id>       - Delete a specific project
 *   delete-all        - Delete all projects
 *   details <id>      - Get project details
 */

import { ResourceManager } from '@legion/tool-core';
import { RailwayProvider } from '../src/index.js';

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.error('Usage: node manage-projects.js <command> [options]');
  console.error('Commands:');
  console.error('  list              - List all projects');
  console.error('  delete <id>       - Delete a specific project');
  console.error('  delete-all        - Delete all projects');
  console.error('  details <id>      - Get project details');
  process.exit(1);
}

async function manageProjects() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.env.RAILWAY || resourceManager.env.RAILWAY_API_KEY;
    const railwayProvider = new RailwayProvider(apiKey);
    
    switch (command) {
      case 'list': {
        console.log('📋 Listing Railway projects...\n');
        const result = await railwayProvider.listProjects();
        
        if (result.success) {
          if (result.projects.length === 0) {
            console.log('No projects found.');
          } else {
            console.log(`Found ${result.projects.length} project(s):\n`);
            result.projects.forEach(project => {
              console.log(`  ${project.name}`);
              console.log(`  ID: ${project.id}`);
              console.log(`  Created: ${project.createdAt}`);
              console.log('  ---');
            });
          }
        } else {
          console.error('Failed to list projects:', result.error);
        }
        break;
      }
      
      case 'delete': {
        const projectId = args[1];
        if (!projectId) {
          console.error('Error: Project ID required');
          console.error('Usage: node manage-projects.js delete <id>');
          process.exit(1);
        }
        
        console.log(`🗑️  Deleting project ${projectId}...`);
        const result = await railwayProvider.deleteProject(projectId);
        
        if (result.success) {
          console.log('✅ Project deleted successfully');
        } else {
          console.error('❌ Failed to delete project:', result.error);
        }
        break;
      }
      
      case 'delete-all': {
        console.log('🗑️  Deleting all projects...\n');
        const listResult = await railwayProvider.listProjects();
        
        if (listResult.success && listResult.projects.length > 0) {
          console.log(`Found ${listResult.projects.length} project(s) to delete.\n`);
          
          for (const project of listResult.projects) {
            console.log(`Deleting ${project.name}...`);
            const deleteResult = await railwayProvider.deleteProject(project.id);
            
            if (deleteResult.success) {
              console.log(`✅ Deleted ${project.name}`);
            } else {
              console.error(`❌ Failed to delete ${project.name}:`, deleteResult.error);
            }
          }
          
          console.log('\nAll projects deleted.');
        } else {
          console.log('No projects to delete.');
        }
        break;
      }
      
      case 'details': {
        const projectId = args[1];
        if (!projectId) {
          console.error('Error: Project ID required');
          console.error('Usage: node manage-projects.js details <id>');
          process.exit(1);
        }
        
        console.log(`📋 Getting details for project ${projectId}...\n`);
        const result = await railwayProvider.getProjectDetails(projectId);
        
        if (result.success) {
          const project = result.project;
          console.log(`Project: ${project.name}`);
          console.log(`ID: ${project.id}`);
          console.log(`Created: ${project.createdAt}`);
          
          if (project.services?.edges?.length > 0) {
            console.log('\nServices:');
            project.services.edges.forEach(edge => {
              const service = edge.node;
              console.log(`  - ${service.name} (${service.id})`);
            });
          }
          
          if (project.environments?.edges?.length > 0) {
            console.log('\nEnvironments:');
            project.environments.edges.forEach(edge => {
              const env = edge.node;
              console.log(`  - ${env.name} (${env.id})`);
            });
          }
        } else {
          console.error('Failed to get project details:', result.error);
        }
        break;
      }
      
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

manageProjects();