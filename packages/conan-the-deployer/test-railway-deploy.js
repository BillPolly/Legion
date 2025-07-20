#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🧪 Testing Railway Deployment API Directly\n');

async function testDeploy() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    
    // Create a project with a service that has a GitHub source
    console.log('📦 Creating project with service...');
    
    const mutation = `
      mutation CreateProjectWithService {
        projectCreate(input: {
          name: "test-webapp-live",
          description: "Test web application",
          isPublic: false
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
      body: JSON.stringify({ query: mutation })
    });
    
    let data = await response.json();
    console.log('Project create response:', JSON.stringify(data, null, 2));
    
    if (!data.data?.projectCreate) {
      console.error('Failed to create project');
      return;
    }
    
    const projectId = data.data.projectCreate.id;
    console.log(`\n✅ Project created: ${projectId}`);
    
    // Now create a service with GitHub source
    const serviceMutation = `
      mutation CreateService($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
          name
        }
      }
    `;
    
    const serviceVars = {
      input: {
        projectId: projectId,
        name: "webapp",
        source: {
          image: "nginx:alpine"  // Let's try with a Docker image first
        }
      }
    };
    
    console.log('\n📦 Creating service with Docker image...');
    response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: serviceMutation, variables: serviceVars })
    });
    
    data = await response.json();
    console.log('Service create response:', JSON.stringify(data, null, 2));
    
    if (!data.data?.serviceCreate) {
      // Try with GitHub source
      console.log('\n📦 Trying with GitHub source...');
      
      serviceVars.input.source = {
        github: {
          repo: "railwayapp-templates/nextjs-prisma",
          branch: "main"
        }
      };
      
      response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: serviceMutation, variables: serviceVars })
      });
      
      data = await response.json();
      console.log('GitHub service response:', JSON.stringify(data, null, 2));
    }
    
    if (data.data?.serviceCreate) {
      console.log('\n✅ Service created!');
      console.log('🌐 Check Railway dashboard: https://railway.app');
      console.log('Your project should be deploying automatically!');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testDeploy();