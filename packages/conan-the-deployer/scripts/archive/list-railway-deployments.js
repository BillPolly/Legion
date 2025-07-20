#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🔍 Listing Railway deployments via API...\n');

async function listRailwayDeployments() {
  try {
    // Get Railway API key from ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    console.log('🔑 Using Railway API key:', apiKey ? `${apiKey.slice(0, 8)}...` : 'NOT FOUND');
    
    if (!apiKey) {
      throw new Error('Railway API key not found in environment variables');
    }

    // Query Railway GraphQL API to list projects
    const query = `
      query {
        me {
          id
          name
          email
        }
        projects {
          edges {
            node {
              id
              name
              description
              createdAt
              updatedAt
              services {
                edges {
                  node {
                    id
                    name
                    createdAt
                    updatedAt
                    deployments(first: 3) {
                      edges {
                        node {
                          id
                          status
                          url
                          createdAt
                          updatedAt
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    console.log('📡 Querying Railway API...');
    const response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('❌ GraphQL Errors:', data.errors);
      return;
    }

    console.log('\n👤 Account Info:');
    if (data.data.me) {
      console.log(`Name: ${data.data.me.name || 'N/A'}`);
      console.log(`Email: ${data.data.me.email || 'N/A'}`);
      console.log(`ID: ${data.data.me.id}`);
    }

    console.log('\n📋 Projects in your Railway account:');
    console.log('='.repeat(50));

    const projects = data.data.projects.edges;
    
    if (projects.length === 0) {
      console.log('No projects found.');
      return;
    }

    projects.forEach((projectEdge, index) => {
      const project = projectEdge.node;
      console.log(`\n${index + 1}. Project: ${project.name}`);
      console.log(`   ID: ${project.id}`);
      console.log(`   Description: ${project.description || 'No description'}`);
      console.log(`   Created: ${new Date(project.createdAt).toLocaleString()}`);
      console.log(`   Updated: ${new Date(project.updatedAt).toLocaleString()}`);
      
      const services = project.services.edges;
      if (services.length > 0) {
        console.log(`   Services (${services.length}):`);
        services.forEach((serviceEdge) => {
          const service = serviceEdge.node;
          console.log(`     - ${service.name} (ID: ${service.id})`);
          
          const deployments = service.deployments.edges;
          if (deployments.length > 0) {
            console.log(`       Recent deployments:`);
            deployments.forEach((deploymentEdge) => {
              const deployment = deploymentEdge.node;
              console.log(`         * Status: ${deployment.status}`);
              console.log(`           URL: ${deployment.url || 'No URL yet'}`);
              console.log(`           Created: ${new Date(deployment.createdAt).toLocaleString()}`);
              console.log(`           ID: ${deployment.id}`);
              console.log('');
            });
          } else {
            console.log(`       No deployments found`);
          }
        });
      } else {
        console.log(`   No services found`);
      }
    });

    console.log('\n🔍 Looking for "conan-demo-app" or recent deployments...');
    
    // Look for our specific app
    const conanApp = projects.find(p => p.node.name.includes('conan') || p.node.name.includes('demo'));
    if (conanApp) {
      console.log(`\n🎯 Found potential match: ${conanApp.node.name}`);
    } else {
      console.log(`\n❓ No project matching "conan-demo-app" found. The deployment might have failed or used a different name.`);
    }

  } catch (error) {
    console.error('💥 Error listing deployments:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

listRailwayDeployments();