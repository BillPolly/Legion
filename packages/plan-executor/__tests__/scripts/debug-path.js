import path from 'path';
import { fileURLToPath } from 'url';

const moduleUrl = new URL(import.meta.url);
console.log('moduleUrl:', moduleUrl);
console.log('moduleUrl.pathname:', moduleUrl.pathname);

const modulePath = moduleUrl.pathname;
const cleanPath = process.platform === 'win32' && modulePath.startsWith('/') 
  ? modulePath.slice(1) 
  : modulePath;
  
console.log('cleanPath:', cleanPath);

const __dirname = path.dirname(cleanPath);
console.log('__dirname:', __dirname);

const packageRoot = path.resolve(__dirname, '..');
console.log('packageRoot:', packageRoot);

const defaultLogDir = path.join(packageRoot, '__tests__', 'tmp', 'logs');
console.log('defaultLogDir:', defaultLogDir);

// Alternative approach
const __filename = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename);
console.log('\nAlternative:');
console.log('__filename:', __filename);
console.log('__dirname2:', __dirname2);
const packageRoot2 = path.resolve(__dirname2, '..');
console.log('packageRoot2:', packageRoot2);
const defaultLogDir2 = path.join(packageRoot2, '__tests__', 'tmp', 'logs');
console.log('defaultLogDir2:', defaultLogDir2);