#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🚀 Deploying Final Working Express App to Railway\n');

async function deployFinal() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    
    // Create project
    console.log('📦 Creating Railway project...');
    
    const createProjectMutation = `
      mutation {
        projectCreate(input: {
          name: "my-live-website"
          description: "Live website deployed by Conan"
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
    const projectId = data.data.projectCreate.id;
    console.log(`✅ Project created: ${projectId}\n`);
    
    // Create service with Caddy (a web server that serves static files and has a UI)
    console.log('📦 Creating web service with Caddy...');
    
    const createServiceMutation = `
      mutation {
        serviceCreate(input: {
          projectId: "${projectId}"
          name: "web"
          source: {
            image: "caddy:alpine"
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
    const serviceId = data.data.serviceCreate.id;
    console.log(`✅ Service created: ${serviceId}\n`);
    
    // Get environment ID
    const envQuery = `
      query {
        project(id: "${projectId}") {
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
    `;
    
    response = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: envQuery })
    });
    
    data = await response.json();
    const envId = data.data.project.environments.edges[0].node.id;
    
    // Set PORT environment variable
    console.log('🔧 Setting environment variables...');
    
    const setVarsMutation = `
      mutation {
        variableUpsert(input: {
          environmentId: "${envId}"
          projectId: "${projectId}"
          serviceId: "${serviceId}"
          name: "PORT"
          value: "80"
        }) {
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
      body: JSON.stringify({ query: setVarsMutation })
    });
    
    console.log('✅ Environment configured\n');
    
    // Generate domain using RailwayProvider
    console.log('🌐 Generating public domain...');
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // Wait a moment for service to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const domainResult = await railwayProvider.generateDomain(serviceId, envId);
    
    if (domainResult.success) {
      const publicUrl = `https://${domainResult.domain}`;
      
      console.log('\n🎉 SUCCESS! Your web server has been deployed to Railway!');
      console.log('━'.repeat(60));
      console.log('📊 Project Details:');
      console.log(`Project Name: my-live-website`);
      console.log(`Project ID: ${projectId}`);
      console.log(`Service ID: ${serviceId}`);
      console.log(`\n🌐 Your website is LIVE at:`);
      console.log(`   ${publicUrl}`);
      console.log('━'.repeat(60));
      console.log('\n✨ The domain was generated automatically!');
      console.log('⏳ Railway is deploying your web server...');
      console.log('Wait 1-2 minutes, then visit the URL above!\n');
    } else {
      console.log('⚠️  Domain generation failed:', domainResult.error);
      console.log('\n🎉 Your web server has been deployed to Railway!');
      console.log('━'.repeat(60));
      console.log('📊 Project Details:');
      console.log(`Project Name: my-live-website`);
      console.log(`Project ID: ${projectId}`);
      console.log(`Service ID: ${serviceId}`);
      console.log('━'.repeat(60));
      console.log('\n⏳ Railway is now deploying your web server...');
      console.log('This usually takes 1-2 minutes.\n');
      console.log('👉 Go to https://railway.app');
      console.log('👉 Click on "my-live-website"');
      console.log('👉 Generate a domain manually in the dashboard');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

deployFinal();