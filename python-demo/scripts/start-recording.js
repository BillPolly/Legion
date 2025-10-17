#!/usr/bin/env node
/**
 * Start screen recording for demo
 * Records VSCode window only using Quartz to get bounds
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const PID_FILE = '/tmp/demo-recording.pid';
const OUTPUT_FILE = process.cwd() + '/demo-recording.mp4';

console.log('🎥 Starting VSCode window recording...');
console.log(`📁 Output will be saved to: ${OUTPUT_FILE}`);

try {
  // Get VSCode window bounds using python with Quartz
  const pythonScript = `
import Quartz
import sys

window_list = Quartz.CGWindowListCopyWindowInfo(
    Quartz.kCGWindowListOptionOnScreenOnly | Quartz.kCGWindowListExcludeDesktopElements,
    Quartz.kCGNullWindowID
)

for window in window_list:
    owner = window.get('kCGWindowOwnerName', '')
    name = window.get('kCGWindowName', '')
    layer = window.get('kCGWindowLayer', 999)
    if owner == 'Code' and layer == 0 and name:
        bounds = window['kCGWindowBounds']
        print(f"{int(bounds['X'])},{int(bounds['Y'])},{int(bounds['Width'])},{int(bounds['Height'])}")
        sys.exit(0)

print("0,0,1920,1080")
`;

  const bounds = execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}"`, { encoding: 'utf-8' }).trim();
  const [x, y, width, height] = bounds.split(',').map(Number);

  console.log(`📐 VSCode window: ${width}x${height} at (${x},${y})`);

  // Start ffmpeg screen recording with crop filter
  const command = `ffmpeg -f avfoundation -i "2:none" -r 30 -filter:v "crop=${width}:${height}:${x}:${y}" -y "${OUTPUT_FILE}" > /tmp/ffmpeg.log 2>&1 & echo $!`;

  const pid = execSync(command, { encoding: 'utf-8' }).trim();

  writeFileSync(PID_FILE, pid);

  console.log(`✅ Recording started (PID: ${pid})`);
  console.log('📌 Recording VSCode window only');
  console.log('📌 When finished, run: node scripts/stop-recording.js');

} catch (error) {
  console.error('❌ Failed to start recording:', error.message);
  console.error('\nMake sure VSCode is open');
  process.exit(1);
}
