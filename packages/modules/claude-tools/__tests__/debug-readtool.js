/**
 * Debug what ReadTool is actually returning
 */

import { ReadTool } from '../src/file-operations/ReadTool.js';

async function debugReadTool() {
  const tool = new ReadTool();
  
  console.log('🧪 Testing missing file_path...');
  try {
    const result = await tool.execute({});
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('result.error:', result.error);
    console.log('result.errorCode:', result.errorCode); 
    console.log('result.data:', result.data);
    console.log('typeof result.error:', typeof result.error);
  } catch (error) {
    console.log('Caught error:', error);
  }
  
  console.log('\n🧪 Testing non-existent file...');
  try {
    const result = await tool.execute({ file_path: '/nonexistent/file.txt' });
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('result.error:', result.error);
    console.log('result.errorCode:', result.errorCode);
  } catch (error) {
    console.log('Caught error:', error);
  }
}

debugReadTool().catch(console.error);