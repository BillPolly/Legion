#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🚀 Deploying Known Working App to Railway\n');

async function deployApp() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    
    // Create project
    console.log('📦 Creating Railway project...');
    
    const createProjectMutation = `
      mutation {
        projectCreate(input: {
          name: "express-live-app"
          description: "Live Express application"
        }) {
          id
          name
        }
      }
    `;
    
    let response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: createProjectMutation })
    });
    
    let data = await response.json();
    
    if (!data.data?.projectCreate) {
      console.error('Failed to create project:', data.errors);
      return;
    }
    
    const projectId = data.data.projectCreate.id;
    console.log(`✅ Project created: ${projectId}\n`);
    
    // Create service with a known working template
    console.log('📦 Creating service...');
    
    const createServiceMutation = `
      mutation CreateService {
        serviceCreate(input: {
          projectId: "${projectId}"
          name: "web"
          source: {
            github: {
              repo: "railway-examples/expressjs"
              branch: "main"
            }
          }
        }) {
          id
          name
        }
      }
    `;
    
    response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: createServiceMutation })
    });
    
    data = await response.json();
    
    if (data.errors) {
      console.error('Service creation error:', data.errors);
      
      // Try with a Docker Hub image instead
      console.log('\n📦 Trying with Docker Hub Node.js image...');
      
      const dockerServiceMutation = `
        mutation CreateDockerService {
          serviceCreate(input: {
            projectId: "${projectId}"
            name: "webapp"
            source: {
              image: "node:18-alpine"
            }
          }) {
            id
            name
          }
        }
      `;
      
      response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: dockerServiceMutation })
      });
      
      data = await response.json();
    }
    
    if (data.data?.serviceCreate) {
      console.log(`✅ Service created: ${data.data.serviceCreate.id}\n`);
      
      console.log('🎉 SUCCESS! Your project has been created.');
      console.log('━'.repeat(60));
      console.log('📊 Next steps:');
      console.log('1. Go to https://railway.app');
      console.log('2. Find your project: "express-live-app"');
      console.log('3. Click on the service to see deployment progress');
      console.log('4. Railway will provide a public URL once deployed');
      console.log('━'.repeat(60));
      
      // Wait and check for deployment
      console.log('\n⏳ Checking deployment status in 20 seconds...');
      await new Promise(resolve => setTimeout(resolve, 20000));
      
      const checkQuery = `
        query {
          project(id: "${projectId}") {
            services {
              edges {
                node {
                  deployments(first: 1) {
                    edges {
                      node {
                        status
                        url
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      
      response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: checkQuery })
      });
      
      data = await response.json();
      const deployment = data.data?.project?.services?.edges?.[0]?.node?.deployments?.edges?.[0]?.node;
      
      if (deployment) {
        console.log(`\nDeployment Status: ${deployment.status}`);
        if (deployment.url) {
          console.log(`🌐 Your app is live at: ${deployment.url}`);
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

deployApp();