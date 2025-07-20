#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🔍 Checking Railway Deployment Status\n');

async function checkDeployment() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    
    // Get project details with services and deployments
    const projectId = 'cd5bd7fc-e59e-43f5-8fcd-2c7ed42a9119';
    
    const query = `
      query ProjectStatus($projectId: String!) {
        project(id: $projectId) {
          id
          name
          createdAt
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
          services {
            edges {
              node {
                id
                name
                createdAt
                deployments(first: 5) {
                  edges {
                    node {
                      id
                      status
                      url
                      staticUrl
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
    `;

    const response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query,
        variables: { projectId }
      })
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL Errors:', data.errors);
      return;
    }
    
    const project = data.data.project;
    console.log(`📦 Project: ${project.name}`);
    console.log(`🆔 ID: ${project.id}`);
    console.log(`📅 Created: ${new Date(project.createdAt).toLocaleString()}`);
    
    console.log('\n⚙️  Services:');
    const services = project.services.edges;
    
    if (services.length === 0) {
      console.log('No services found yet...');
      return;
    }
    
    services.forEach(serviceEdge => {
      const service = serviceEdge.node;
      console.log(`\n   Service: ${service.name}`);
      console.log(`   ID: ${service.id}`);
      
      const deployments = service.deployments.edges;
      console.log(`   Deployments: ${deployments.length}`);
      
      if (deployments.length > 0) {
        const latestDeploy = deployments[0].node;
        console.log(`\n   🚀 Latest Deployment:`);
        console.log(`      ID: ${latestDeploy.id}`);
        console.log(`      Status: ${latestDeploy.status}`);
        console.log(`      Created: ${new Date(latestDeploy.createdAt).toLocaleString()}`);
        console.log(`      Updated: ${new Date(latestDeploy.updatedAt).toLocaleString()}`);
        
        if (latestDeploy.url) {
          console.log(`\n   🎉 YOUR APP IS LIVE!`);
          console.log(`   🌐 URL: ${latestDeploy.url}`);
          console.log(`\n   Open this URL in your browser to see your web app!`);
        } else if (latestDeploy.staticUrl) {
          console.log(`   🔗 Static URL: ${latestDeploy.staticUrl}`);
        } else {
          console.log(`   ⏳ No URL yet - deployment is ${latestDeploy.status}`);
        }
      }
    });
    
    console.log('\n📊 Check your Railway dashboard: https://railway.app');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

checkDeployment();