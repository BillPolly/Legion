/**
 * Check what exports are available in each package
 */

const checkExports = async (packageName) => {
  try {
    const module = await import(packageName);
    const exports = Object.keys(module);
    console.log(`📦 ${packageName}:`);
    if (exports.length === 0) {
      console.log('   No named exports found');
    } else {
      exports.forEach(exp => console.log(`   - ${exp}`));
    }
    console.log();
    return module;
  } catch (error) {
    console.error(`❌ ${packageName}: ${error.message}\n`);
    return null;
  }
};

const main = async () => {
  console.log('🔍 Checking available exports...\n');
  
  const packages = [
    '@legion/unified-planner',
    '@legion/bt-validator',
    '@legion/profile-planner',
    '@legion/actor-bt',
    '@legion/llm',
    '@legion/tools'
  ];
  
  for (const pkg of packages) {
    await checkExports(pkg);
  }
};

main().catch(console.error);