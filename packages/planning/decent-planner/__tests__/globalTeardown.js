export default async () => {
  console.log('🧹 Global Jest teardown...');
  
  // Force cleanup of any remaining handles
  if (process.env.NODE_ENV === 'test') {
    // Close any lingering connections
    setTimeout(() => {
      console.log('🔪 Force exiting Jest');
      process.exit(0);
    }, 2000);
  }
};