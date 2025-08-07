/**
 * Quick validation script to check if all imports work correctly
 */

console.log('🔍 Validating imports for integration tests...');

const validateImport = async (packageName, exportName) => {
  try {
    const module = await import(packageName);
    if (exportName && !module[exportName]) {
      throw new Error(`Export '${exportName}' not found in ${packageName}`);
    }
    console.log(`✅ ${packageName}${exportName ? ` (${exportName})` : ''}`);
    return true;
  } catch (error) {
    console.error(`❌ ${packageName}${exportName ? ` (${exportName})` : ''}: ${error.message}`);
    return false;
  }
};

const main = async () => {
  console.log('\n📦 Checking package imports...\n');
  
  const checks = [
    ['@legion/unified-planner', 'PlannerEngine'],
    ['@legion/bt-validator', 'BTValidator'],
    ['@legion/profile-planner', 'ProfilePlannerModule'],
    ['@legion/actor-bt', 'BehaviorTreeExecutor'],
    ['@legion/llm', 'LLMClient'],
    ['@legion/tool-core', 'ResourceManager'],
    ['zod']
  ];
  
  let allPassed = true;
  
  for (const [pkg, exp] of checks) {
    const result = await validateImport(pkg, exp);
    if (!result) allPassed = false;
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 All imports validated successfully!');
    console.log('✨ Integration tests should run without import errors');
  } else {
    console.log('💥 Some imports failed - fix these before running tests');
    process.exit(1);
  }
};

main().catch(console.error);