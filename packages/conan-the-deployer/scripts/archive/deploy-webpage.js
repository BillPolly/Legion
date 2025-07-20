#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';
import RailwayProvider from './src/providers/RailwayProvider.js';

console.log('🚀 Deploying Complete Web Application to Railway\n');

async function deployWebpage() {
  try {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const railwayProvider = new RailwayProvider(resourceManager);
    
    // Deploy a Node.js web application
    const config = {
      name: 'conan-web-app',
      description: 'Web application deployed by Conan with auto-generated domain',
      source: 'github',
      repo: 'railwayapp-templates/nextjs-starter',
      branch: 'main'
    };
    
    console.log('📦 Creating Railway project and service...');
    const deployResult = await railwayProvider.deploy(config);
    
    if (!deployResult.success) {
      console.error('❌ Deployment failed:', deployResult.error || deployResult.errors);
      return;
    }
    
    console.log('✅ Service created successfully');
    console.log(`Project ID: ${deployResult.projectId}`);
    console.log(`Service ID: ${deployResult.serviceId}`);
    
    // Get project details to find environment ID
    const projectDetails = await railwayProvider.getProjectDetails(deployResult.projectId);
    
    if (!projectDetails.success) {
      console.error('❌ Failed to get project details:', projectDetails.error);
      return;
    }
    
    const environmentId = projectDetails.project.environments.edges[0]?.node.id;
    
    if (!environmentId) {
      console.error('❌ No environment found for project');
      return;
    }
    
    console.log(`Environment ID: ${environmentId}`);
    
    // Wait a moment for service to initialize
    console.log('\n⏳ Waiting for service to initialize...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Generate domain
    console.log('\n🌐 Generating public domain...');
    const domainResult = await railwayProvider.generateDomain(deployResult.serviceId, environmentId);
    
    if (domainResult.success) {
      const publicUrl = `https://${domainResult.domain}`;
      
      console.log('\n🎉 SUCCESS! Your web application has been deployed!');
      console.log('━'.repeat(60));
      console.log('📊 Deployment Details:');
      console.log(`Project Name: ${config.name}`);
      console.log(`Project ID: ${deployResult.projectId}`);
      console.log(`Service ID: ${deployResult.serviceId}`);
      console.log(`Environment: production`);
      console.log(`\n🌐 Your website is LIVE at:`);
      console.log(`   ${publicUrl}`);
      console.log('━'.repeat(60));
      console.log('\n✨ Domain generated automatically using Railway API!');
      console.log('⏳ Railway is building and deploying your application...');
      console.log('This usually takes 2-3 minutes for Next.js apps.\n');
      
      // Monitor deployment progress
      console.log('Monitoring deployment progress...\n');
      
      let checkCount = 0;
      const maxChecks = 12; // Check for up to 2 minutes
      
      const checkDeployment = async () => {
        const services = projectDetails.project.services.edges;
        if (services.length > 0) {
          const serviceDetails = await railwayProvider.getProjectDetails(deployResult.projectId);
          if (serviceDetails.success) {
            const service = serviceDetails.project.services.edges[0]?.node;
            const latestDeployment = service?.deployments?.edges[0]?.node;
            
            if (latestDeployment) {
              console.log(`Deployment Status: ${latestDeployment.status}`);
              
              if (latestDeployment.status === 'SUCCESS') {
                console.log('\n✅ Deployment successful!');
                console.log(`\n🎯 Your website is now LIVE at: ${publicUrl}`);
                console.log('Open it in your browser to see your deployed application!');
                return true;
              } else if (latestDeployment.status === 'FAILED' || latestDeployment.status === 'CRASHED') {
                console.log('\n❌ Deployment failed!');
                return true;
              }
            }
          }
        }
        return false;
      };
      
      // Check deployment status periodically
      while (checkCount < maxChecks) {
        if (await checkDeployment()) break;
        checkCount++;
        if (checkCount < maxChecks) {
          await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        }
      }
      
      if (checkCount >= maxChecks) {
        console.log('\n⏰ Deployment is taking longer than expected.');
        console.log('Check the Railway dashboard for deployment status.');
      }
      
    } else {
      console.error('\n❌ Domain generation failed:', domainResult.error);
      console.log('You can generate a domain manually in the Railway dashboard.');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error(error.stack);
  }
}

deployWebpage();