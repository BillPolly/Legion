/**
 * Global Jest teardown
 * Cleans up ToolRegistry singleton after all tests complete
 */

export default async function globalTeardown() {
  try {
    // Get the ToolRegistry singleton and cleanup
    const { getToolRegistry } = await import('@legion/tools-registry');
    const toolRegistry = await getToolRegistry();

    if (toolRegistry && toolRegistry.cleanup) {
      console.log('Cleaning up ToolRegistry...');
      await toolRegistry.cleanup();
      console.log('ToolRegistry cleanup complete');
    }

    // Give time for MongoDB connections to close
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Force exit - all tests passed, cleanup done
    console.log('Global teardown complete - forcing exit');
    process.exit(0);
  } catch (error) {
    console.error('Error in global teardown:', error);
    process.exit(1);
  }
}
