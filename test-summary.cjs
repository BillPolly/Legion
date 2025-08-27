#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, 'packages/modules');
const modules = fs.readdirSync(modulesDir).filter(d => 
  fs.statSync(path.join(modulesDir, d)).isDirectory()
);

console.log('\n📊 LEGION TEST SUITE SUMMARY\n');
console.log('=' .repeat(60));

let totalPassed = 0;
let totalTests = 0;
let perfect = [];
let good = [];
let needsWork = [];

for (const module of modules) {
  const modulePath = path.join(modulesDir, module);
  
  try {
    process.chdir(modulePath);
    const output = execSync('npm test 2>&1', { 
      encoding: 'utf8',
      timeout: 30000,
      stdio: 'pipe'
    });
    
    const match = output.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(?:(\d+)\s+skipped,\s+)?(\d+)\s+passed,\s+(\d+)\s+total/);
    
    if (match) {
      const failed = parseInt(match[1] || '0');
      const skipped = parseInt(match[2] || '0');
      const passed = parseInt(match[3]);
      const total = parseInt(match[4]);
      const activeTotal = total - skipped;
      const percentage = ((passed / activeTotal) * 100).toFixed(1);
      
      totalPassed += passed;
      totalTests += activeTotal;
      
      const status = percentage === '100.0' ? '✅' : percentage >= 80 ? '⚠️' : '❌';
      const line = `${status} ${module.padEnd(25)} ${passed}/${activeTotal} (${percentage}%)`;
      
      if (percentage === '100.0') {
        perfect.push(line);
      } else if (percentage >= 80) {
        good.push(line);
      } else {
        needsWork.push(line);
      }
    }
  } catch (error) {
    const line = `❌ ${module.padEnd(25)} ERROR`;
    needsWork.push(line);
  }
}

console.log('\n✨ PERFECT (100%):');
perfect.forEach(m => console.log(m));

console.log('\n📈 GOOD (80%+):');
good.forEach(m => console.log(m));

console.log('\n🔧 NEEDS WORK (<80%):');
needsWork.forEach(m => console.log(m));

const overallPercentage = ((totalPassed / totalTests) * 100).toFixed(1);
console.log('\n' + '='.repeat(60));
console.log(`\n🏆 OVERALL: ${totalPassed}/${totalTests} tests passing (${overallPercentage}%)`);
console.log(`   Perfect modules: ${perfect.length}`);
console.log(`   Good modules: ${good.length}`);
console.log(`   Modules needing work: ${needsWork.length}`);
console.log('\n' + '='.repeat(60));