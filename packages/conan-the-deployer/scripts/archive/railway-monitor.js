#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🔍 Railway Deployment Monitor\n');

async function monitorRailway() {
  try {
    // Get Railway API key
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    
    if (!apiKey) {
      throw new Error('Railway API key not found');
    }

    console.log('🔑 Connected to Railway API\n');

    // Enhanced query to get detailed project information
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
              deploymentTriggers {
                repository {
                  fullName
                  branch
                }
              }
              services {
                edges {
                  node {
                    id
                    name
                    createdAt
                    updatedAt
                    source {
                      repo
                      branch
                    }
                    deployments(first: 5) {
                      edges {
                        node {
                          id
                          status
                          url
                          createdAt
                          updatedAt
                          staticUrl
                          suggestedUrl
                          meta
                        }
                      }
                    }
                    variables {
                      edges {
                        node {
                          name
                          value
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

    // Display account info
    console.log('👤 Account Information:');
    console.log('━'.repeat(50));
    if (data.data.me) {
      console.log(`Name: ${data.data.me.name || 'Not set'}`);
      console.log(`Email: ${data.data.me.email}`);
      console.log(`User ID: ${data.data.me.id}`);
    }

    console.log('\n📊 Railway Projects & Deployments:');
    console.log('━'.repeat(50));

    const projects = data.data.projects.edges;
    
    if (projects.length === 0) {
      console.log('No projects found.');
      return;
    }

    let totalDeployments = 0;
    let activeDeployments = 0;

    projects.forEach((projectEdge, index) => {
      const project = projectEdge.node;
      console.log(`\n🏗️  Project ${index + 1}: ${project.name}`);
      console.log(`   📝 Description: ${project.description || 'No description'}`);
      console.log(`   🆔 ID: ${project.id}`);
      console.log(`   📅 Created: ${new Date(project.createdAt).toLocaleString()}`);
      console.log(`   🔄 Updated: ${new Date(project.updatedAt).toLocaleString()}`);
      
      // Show repository info if available
      if (project.deploymentTriggers && project.deploymentTriggers.repository) {
        console.log(`   🔗 Repository: ${project.deploymentTriggers.repository.fullName}`);
        console.log(`   🌿 Branch: ${project.deploymentTriggers.repository.branch}`);
      }
      
      const services = project.services.edges;
      console.log(`   ⚙️  Services: ${services.length}`);
      
      services.forEach((serviceEdge, serviceIndex) => {
        const service = serviceEdge.node;
        console.log(`\n     └─ Service ${serviceIndex + 1}: ${service.name}`);
        console.log(`        🆔 ID: ${service.id}`);
        console.log(`        📅 Created: ${new Date(service.createdAt).toLocaleString()}`);
        
        // Show source info
        if (service.source) {
          console.log(`        🔗 Source: ${service.source.repo || 'Unknown'}`);
          console.log(`        🌿 Branch: ${service.source.branch || 'Unknown'}`);
        }
        
        // Show environment variables
        const variables = service.variables.edges;
        if (variables.length > 0) {
          console.log(`        🔧 Environment Variables (${variables.length}):`);
          variables.forEach(varEdge => {
            const variable = varEdge.node;
            // Don't show sensitive values, just names
            console.log(`           ${variable.name}: ${variable.value ? '[SET]' : '[EMPTY]'}`);
          });
        }
        
        // Show deployments
        const deployments = service.deployments.edges;
        totalDeployments += deployments.length;
        
        console.log(`        🚀 Deployments (${deployments.length}):`);
        
        if (deployments.length === 0) {
          console.log(`           No deployments found`);
        } else {
          deployments.forEach((deploymentEdge, deployIndex) => {
            const deployment = deploymentEdge.node;
            const isActive = deployment.status === 'SUCCESS';
            if (isActive) activeDeployments++;
            
            console.log(`\n           ${deployIndex + 1}. Deployment ${deployment.id.slice(-8)}`);
            console.log(`              📊 Status: ${getStatusEmoji(deployment.status)} ${deployment.status}`);
            console.log(`              📅 Created: ${new Date(deployment.createdAt).toLocaleString()}`);
            console.log(`              🔄 Updated: ${new Date(deployment.updatedAt).toLocaleString()}`);
            
            // Show URLs
            if (deployment.url) {
              console.log(`              🌐 URL: ${deployment.url}`);
              console.log(`              📱 Try it: curl ${deployment.url}`);
            }
            if (deployment.staticUrl && deployment.staticUrl !== deployment.url) {
              console.log(`              🔗 Static URL: ${deployment.staticUrl}`);
            }
            if (deployment.suggestedUrl && deployment.suggestedUrl !== deployment.url) {
              console.log(`              💡 Suggested URL: ${deployment.suggestedUrl}`);
            }
            
            // Show metadata
            if (deployment.meta) {
              try {
                const meta = typeof deployment.meta === 'string' ? JSON.parse(deployment.meta) : deployment.meta;
                if (meta && Object.keys(meta).length > 0) {
                  console.log(`              📋 Metadata: ${JSON.stringify(meta, null, 2).slice(0, 100)}...`);
                }
              } catch (e) {
                // Ignore meta parsing errors
              }
            }
          });
        }
      });
    });

    // Summary
    console.log('\n📈 Summary:');
    console.log('━'.repeat(30));
    console.log(`Total Projects: ${projects.length}`);
    console.log(`Total Services: ${projects.reduce((sum, p) => sum + p.node.services.edges.length, 0)}`);
    console.log(`Total Deployments: ${totalDeployments}`);
    console.log(`Active Deployments: ${activeDeployments}`);
    
    // Show live URLs
    console.log('\n🌐 Live URLs to test:');
    console.log('━'.repeat(30));
    let foundUrls = false;
    
    projects.forEach(projectEdge => {
      const project = projectEdge.node;
      project.services.edges.forEach(serviceEdge => {
        const service = serviceEdge.node;
        service.deployments.edges.forEach(deploymentEdge => {
          const deployment = deploymentEdge.node;
          if (deployment.url && deployment.status === 'SUCCESS') {
            console.log(`✅ ${project.name} → ${deployment.url}`);
            foundUrls = true;
          } else if (deployment.url) {
            console.log(`🔄 ${project.name} → ${deployment.url} (${deployment.status})`);
            foundUrls = true;
          }
        });
      });
    });
    
    if (!foundUrls) {
      console.log('No live URLs found yet. Deployments may still be building.');
    }

    console.log('\n🔄 Run this script again to check for updates!');

  } catch (error) {
    console.error('💥 Error monitoring Railway:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

function getStatusEmoji(status) {
  switch (status) {
    case 'SUCCESS': return '✅';
    case 'BUILDING': return '🔄';
    case 'DEPLOYING': return '🚀';
    case 'FAILED': return '❌';
    case 'CRASHED': return '💥';
    case 'REMOVED': return '🗑️';
    default: return '❓';
  }
}

monitorRailway();