/**
 * Simple Server Test
 * 
 * Minimal test to verify server startup and shutdown
 */

import { ShowMeServer } from '../../src/server/ShowMeServer.js';
import { getRandomTestPort, waitForServer } from '../helpers/testUtils.js';

describe('Simple Server Test', () => {
  let server;
  let testPort;

  beforeAll(async () => {
    testPort = getRandomTestPort();
    server = new ShowMeServer({ 
      port: testPort,
      skipLegionPackages: true 
    });
    await server.initialize();
    await server.start();
    await waitForServer(500);
  }, 30000);

  afterAll(async () => {
    if (server) {
      await server.stop();
      // Give it extra time to clean up
      await waitForServer(1000);
    }
  });

  test('should start and stop server', () => {
    const status = server.getStatus();
    expect(status.running).toBe(true);
    expect(status.port).toBe(testPort);
  });
});