#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from '../../src/providers/RailwayProvider.js';

const COMMANDS = {
  list: 'List all projects',
  details: 'Get project details (requires project ID)',
  delete: 'Delete a project (requires project ID)',
  redeploy: 'Redeploy a service (requires service ID)',
  domains: 'List domains for a service (requires service ID and environment ID)',
  'generate-domain': 'Generate domain for a service (requires service ID and environment ID)'
};

async function main() {
  const command = process.argv[2];
  const arg1 = process.argv[3];
  const arg2 = process.argv[4];
  
  if (!command || command === 'help') {
    console.log('Railway Project Manager\n');
    console.log('Usage: node manage-project.js <command> [args]\n');
    console.log('Commands:');
    Object.entries(COMMANDS).forEach(([cmd, desc]) => {
      console.log(`  ${cmd.padEnd(15)} - ${desc}`);
    });
    return;
  }
  
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    switch (command) {
      case 'list':
        console.log('📋 Listing projects...\n');
        const listResult = await railwayProvider.listProjects();
        if (listResult.success) {
          listResult.projects.forEach(project => {
            console.log(`📁 ${project.name} (${project.id})`);
            project.services.forEach(service => {
              console.log(`  └─ ${service.name} (${service.id})`);
            });
          });
        }
        break;
        
      case 'details':
        if (!arg1) {
          console.error('Project ID required');
          return;
        }
        console.log(`📊 Getting details for project ${arg1}...\n`);
        const detailsResult = await railwayProvider.getProjectDetails(arg1);
        if (detailsResult.success) {
          console.log(JSON.stringify(detailsResult.project, null, 2));
        } else {
          console.error('Failed:', detailsResult.error);
        }
        break;
        
      case 'delete':
        if (!arg1) {
          console.error('Project ID required');
          return;
        }
        console.log(`🗑️  Deleting project ${arg1}...`);
        const deleteResult = await railwayProvider.deleteProject(arg1);
        console.log(deleteResult.success ? '✅ Deleted' : `❌ Failed: ${deleteResult.error}`);
        break;
        
      case 'redeploy':
        if (!arg1) {
          console.error('Service ID required');
          return;
        }
        console.log(`🔄 Redeploying service ${arg1}...`);
        const redeployResult = await railwayProvider.redeploy(arg1);
        if (redeployResult.success) {
          console.log('✅ Redeployment triggered');
          console.log(`Deployment ID: ${redeployResult.deploymentId}`);
        } else {
          console.error('❌ Failed:', redeployResult.error);
        }
        break;
        
      case 'domains':
        if (!arg1 || !arg2) {
          console.error('Service ID and Environment ID required');
          return;
        }
        console.log(`🌐 Getting domains for service ${arg1}...\n`);
        const domainsResult = await railwayProvider.getServiceDomains(arg1, arg2);
        if (domainsResult.success) {
          domainsResult.domains.forEach(domain => {
            console.log(`https://${domain}`);
          });
        }
        break;
        
      case 'generate-domain':
        if (!arg1 || !arg2) {
          console.error('Service ID and Environment ID required');
          return;
        }
        console.log(`🌐 Generating domain for service ${arg1}...`);
        const genResult = await railwayProvider.generateDomain(arg1, arg2);
        if (genResult.success) {
          console.log(`✅ Domain generated: https://${genResult.domain}`);
        } else {
          console.error('❌ Failed:', genResult.error);
        }
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Use "help" to see available commands');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

main();