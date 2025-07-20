#!/usr/bin/env node

import { ResourceManager } from '@jsenvoy/module-loader';

console.log('🧪 Testing Railway API Directly\n');

async function testRailwayAPI() {
  try {
    // Get Railway API key
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.RAILWAY');
    console.log('🔑 API Key found:', apiKey ? `${apiKey.slice(0, 8)}...` : 'NOT FOUND');
    
    if (!apiKey) {
      throw new Error('Railway API key not found');
    }

    // Test 1: Basic authentication
    console.log('\n📋 Test 1: Basic Authentication');
    console.log('━'.repeat(40));
    
    const basicQuery = `
      query {
        me {
          id
          email
        }
      }
    `;

    const response1 = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: basicQuery })
    });

    console.log('Response Status:', response1.status);
    console.log('Response OK:', response1.ok);
    
    const data1 = await response1.json();
    console.log('Response Data:', JSON.stringify(data1, null, 2));

    if (!response1.ok || data1.errors) {
      console.log('❌ Authentication failed!');
      return;
    }

    console.log('✅ Authentication successful!');

    // Test 2: Try to create a project
    console.log('\n📋 Test 2: Create Project');
    console.log('━'.repeat(40));
    
    const createProjectMutation = `
      mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          id
          name
          description
          createdAt
        }
      }
    `;

    const projectVariables = {
      input: {
        name: "conan-test-project-" + Date.now(),
        description: "Test project from Conan The Deployer",
        isPublic: false
      }
    };

    console.log('Request Variables:', JSON.stringify(projectVariables, null, 2));

    const response2 = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: createProjectMutation,
        variables: projectVariables 
      })
    });

    console.log('Response Status:', response2.status);
    const data2 = await response2.json();
    console.log('Response Data:', JSON.stringify(data2, null, 2));

    if (data2.data && data2.data.projectCreate) {
      console.log('✅ Project created successfully!');
      const project = data2.data.projectCreate;
      console.log(`Project ID: ${project.id}`);
      console.log(`Project Name: ${project.name}`);
      
      // Test 3: List projects to confirm
      console.log('\n📋 Test 3: List Projects');
      console.log('━'.repeat(40));
      
      const listQuery = `
        query {
          me {
            projects {
              edges {
                node {
                  id
                  name
                  createdAt
                }
              }
            }
          }
        }
      `;

      const response3 = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: listQuery })
      });

      const data3 = await response3.json();
      if (data3.data && data3.data.me.projects) {
        const projects = data3.data.me.projects.edges;
        console.log(`Found ${projects.length} project(s):`);
        projects.forEach((p, i) => {
          console.log(`${i + 1}. ${p.node.name} (${p.node.id})`);
        });
      }
      
      // Optional: Clean up the test project
      console.log('\n🗑️  Cleaning up test project...');
      const deleteQuery = `
        mutation ProjectDelete {
          projectDelete(id: "${project.id}")
        }
      `;
      
      const response4 = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: deleteQuery })
      });
      
      const data4 = await response4.json();
      console.log('Cleanup result:', JSON.stringify(data4, null, 2));
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error(error.stack);
  }
}

testRailwayAPI();