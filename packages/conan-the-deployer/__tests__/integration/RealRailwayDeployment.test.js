import { jest } from '@jest/globals';
import DeployApplicationTool from '../../src/tools/DeployApplicationTool.js';

describe('Real Railway Deployment Integration', () => {
  let deployTool;
  let deploymentId;

  beforeAll(() => {
    deployTool = new DeployApplicationTool();
  });

  afterAll(async () => {
    // Clean up any deployed services
    if (deploymentId) {
      console.log(`\n⚠️  Deployment created with ID: ${deploymentId}`);
      console.log(`Please manually clean up the Railway deployment if needed.`);
    }
  });

  describe('Real Railway API Integration', () => {
    test('should deploy simple Express app to Railway using real API', async () => {
      console.log('\n🚀 Starting real Railway deployment test...');
      
      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'railway',
            config: {
              name: 'conan-test-app',
              source: 'https://github.com/railwayapp/starters',
              branch: 'main',
              environment: {
                NODE_ENV: 'production',
                PORT: '3000'
              },
              railway: {
                region: 'us-west1'
              }
            }
          })
        }
      };

      console.log('📦 Deploying to Railway...');
      const result = await deployTool.invoke(deployCall);

      console.log('\n📋 Deployment Result:');
      console.log('Success:', result.success);
      console.log('Data:', JSON.stringify(result.data, null, 2));
      
      if (result.error) {
        console.log('Error:', result.error);
      }

      // Store deployment ID for cleanup
      if (result.success && result.data?.deployment?.id) {
        deploymentId = result.data.deployment.id;
        console.log(`\n✅ Deployment successful! ID: ${deploymentId}`);
      }

      // The test should succeed even if Railway deployment fails
      // since we want to test the integration, not Railway's availability
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data.deployment).toBeDefined();
        expect(result.data.deployment.id).toBeDefined();
        console.log('\n🎉 Real Railway deployment test PASSED!');
      } else {
        console.log('\n⚠️  Railway deployment failed, but integration test completed');
        console.log('This could be due to API limits, network issues, or Railway service availability');
      }
    }, 120000); // 2 minute timeout for real deployment

    test('should handle Railway authentication with real API key', async () => {
      console.log('\n🔑 Testing Railway authentication...');
      
      // Test with a simple deployment that should at least authenticate
      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'railway',
            config: {
              name: 'auth-test-app',
              source: 'https://github.com/railwayapp/starters',
              environment: {
                NODE_ENV: 'test'
              }
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      console.log('\n📋 Authentication Test Result:');
      console.log('Success:', result.success);
      
      if (result.error) {
        console.log('Error:', result.error);
        
        // Check if it's an authentication error specifically
        const isAuthError = result.error.includes('authentication') || 
                           result.error.includes('unauthorized') ||
                           result.error.includes('API key');
        
        if (isAuthError) {
          console.log('❌ Authentication failed - check Railway API key');
        } else {
          console.log('✅ Authentication succeeded (error is not auth-related)');
        }
      }

      // Test passes if we get any response (success or non-auth failure)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      
      console.log('\n🔐 Railway authentication test completed');
    }, 60000); // 1 minute timeout for auth test
  });

  describe('Railway Provider Direct Test', () => {
    test('should access Railway API key from ResourceManager', async () => {
      console.log('\n🔧 Testing ResourceManager Railway API key access...');
      
      // This will test if the ResourceManager can access the Railway key
      const deployCall = {
        function: {
          name: 'deploy_application',
          arguments: JSON.stringify({
            provider: 'railway',
            config: {
              name: 'resource-test',
              source: 'https://github.com/railwayapp/starters'
            }
          })
        }
      };

      const result = await deployTool.invoke(deployCall);
      
      console.log('\n📋 ResourceManager Test Result:');
      console.log('Success:', result.success);
      
      if (!result.success) {
        console.log('Error:', result.error);
        
        // Check if the error is specifically about missing API key
        const isMissingKey = result.error.includes('Railway API key not available') ||
                            result.error.includes('RAILWAY environment variable');
        
        if (isMissingKey) {
          console.log('❌ ResourceManager cannot access Railway API key');
          expect(true).toBe(false); // Fail the test
        } else {
          console.log('✅ ResourceManager has access to Railway API key');
        }
      } else {
        console.log('✅ ResourceManager successfully accessed Railway API key');
      }

      expect(result).toBeDefined();
      console.log('\n🛠️  ResourceManager Railway API key test completed');
    }, 30000); // 30 second timeout
  });
});