/**
 * Test utilities for integration tests
 */

/**
 * Get a random port for testing to avoid conflicts
 * @returns {number} Random port number between 4000 and 5000
 */
export function getRandomTestPort() {
  return 4000 + Math.floor(Math.random() * 1000);
}

/**
 * Wait for server to be ready
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export async function waitForServer(ms = 500) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if server is responding
 * @param {number} port - Server port
 * @returns {Promise<boolean>}
 */
export async function isServerResponding(port) {
  try {
    const response = await fetch(`http://localhost:${port}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}