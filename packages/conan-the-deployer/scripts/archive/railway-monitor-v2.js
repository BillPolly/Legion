#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🔍 Railway Deployment Monitor v2 (Based on Official API Docs)\n');

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

    // First, get basic user info and projects list
    // Based on the official docs structure
    const projectsQuery = `
      query me {
        me {
          id
          name
          email
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
                    }
                  }
                }
                environments {
                  edges {
                    node {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    console.log('📋 Fetching projects...');
    const projectsResponse = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: projectsQuery })
    });

    if (!projectsResponse.ok) {
      throw new Error(`Projects query failed: ${projectsResponse.status} ${projectsResponse.statusText}`);
    }

    const projectsData = await projectsResponse.json();
    
    if (projectsData.errors) {
      console.error('❌ GraphQL Errors:', JSON.stringify(projectsData.errors, null, 2));
      return;
    }

    // Display account info
    console.log('👤 Account Information:');
    console.log('━'.repeat(50));
    const me = projectsData.data.me;
    console.log(`Name: ${me.name || 'Not set'}`);
    console.log(`Email: ${me.email}`);
    console.log(`User ID: ${me.id}`);

    console.log('\n📊 Projects Overview:');
    console.log('━'.repeat(50));

    const projects = me.projects.edges;
    
    if (projects.length === 0) {
      console.log('No projects found.');
      return;
    }

    console.log(`Found ${projects.length} project(s)\n`);

    // For each project, get detailed deployment info
    for (const projectEdge of projects) {
      const project = projectEdge.node;
      console.log(`\n🏗️  Project: ${project.name}`);
      console.log(`   📝 Description: ${project.description || 'No description'}`);
      console.log(`   🆔 ID: ${project.id}`);
      console.log(`   📅 Created: ${new Date(project.createdAt).toLocaleString()}`);
      console.log(`   🔄 Updated: ${new Date(project.updatedAt).toLocaleString()}`);
      
      const services = project.services.edges;
      const environments = project.environments.edges;
      
      console.log(`   ⚙️  Services: ${services.length}`);
      console.log(`   🌍 Environments: ${environments.length}`);

      // For each service and environment, get deployments
      for (const serviceEdge of services) {
        const service = serviceEdge.node;
        console.log(`\n   └─ Service: ${service.name}`);
        console.log(`      🆔 Service ID: ${service.id}`);

        // Get deployments for each environment
        for (const envEdge of environments) {
          const env = envEdge.node;
          console.log(`\n      🌍 Environment: ${env.name}`);
          
          // Query deployments for this specific service/environment
          const deploymentsQuery = `
            query deployments {
              deployments(
                first: 5
                input: {
                  projectId: "${project.id}"
                  environmentId: "${env.id}"
                  serviceId: "${service.id}"
                }
              ) {
                edges {
                  node {
                    id
                    status
                    url
                    staticUrl
                    createdAt
                  }
                }
              }
            }
          `;

          const deploymentsResponse = await fetch('https://backboard.railway.com/graphql/v2', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: deploymentsQuery })
          });

          if (deploymentsResponse.ok) {
            const deploymentsData = await deploymentsResponse.json();
            
            if (!deploymentsData.errors && deploymentsData.data.deployments) {
              const deployments = deploymentsData.data.deployments.edges;
              
              if (deployments.length > 0) {
                console.log(`         🚀 Recent Deployments (${deployments.length}):`);
                
                deployments.forEach((deploymentEdge, index) => {
                  const deployment = deploymentEdge.node;
                  console.log(`\n         ${index + 1}. Deployment ${deployment.id.slice(-8)}`);
                  console.log(`            📊 Status: ${deployment.status}`);
                  console.log(`            📅 Created: ${new Date(deployment.createdAt).toLocaleString()}`);
                  
                  if (deployment.url) {
                    console.log(`            🌐 URL: ${deployment.url}`);
                    console.log(`            📱 Test it: curl ${deployment.url}`);
                  }
                  if (deployment.staticUrl && deployment.staticUrl !== deployment.url) {
                    console.log(`            🔗 Static URL: ${deployment.staticUrl}`);
                  }
                });
              } else {
                console.log(`         No deployments found`);
              }
            }
          } else {
            console.log(`         ⚠️  Failed to fetch deployments: ${deploymentsResponse.status}`);
          }
        }
      }
    }

    // Summary of live URLs
    console.log('\n\n🌐 Live Deployments Summary:');
    console.log('━'.repeat(50));
    
    // Re-fetch all deployments to find live ones
    for (const projectEdge of projects) {
      const project = projectEdge.node;
      
      for (const serviceEdge of project.services.edges) {
        const service = serviceEdge.node;
        
        for (const envEdge of project.environments.edges) {
          const env = envEdge.node;
          
          const liveQuery = `
            query deployments {
              deployments(
                first: 1
                input: {
                  projectId: "${project.id}"
                  environmentId: "${env.id}"
                  serviceId: "${service.id}"
                }
              ) {
                edges {
                  node {
                    status
                    url
                    staticUrl
                  }
                }
              }
            }
          `;

          const liveResponse = await fetch('https://backboard.railway.com/graphql/v2', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: liveQuery })
          });

          if (liveResponse.ok) {
            const liveData = await liveResponse.json();
            
            if (!liveData.errors && liveData.data.deployments.edges.length > 0) {
              const deployment = liveData.data.deployments.edges[0].node;
              
              if (deployment.url || deployment.staticUrl) {
                const url = deployment.url || deployment.staticUrl;
                console.log(`✅ ${project.name}/${service.name} (${env.name}): ${url}`);
                console.log(`   Status: ${deployment.status}`);
              }
            }
          }
        }
      }
    }

    console.log('\n🔄 Run this script again to check for updates!');
    console.log('📚 Learn more at: https://docs.railway.com/reference/public-api');

  } catch (error) {
    console.error('💥 Error monitoring Railway:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

monitorRailway();