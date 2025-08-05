#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkFfmpeg() {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    console.log('✅ ffmpeg is installed');
    console.log(stdout.split('\n')[0]);
    return true;
  } catch (error) {
    console.log('❌ ffmpeg is not installed');
    console.log('\nTo install ffmpeg:');
    console.log('  macOS:    brew install ffmpeg');
    console.log('  Ubuntu:   sudo apt install ffmpeg');
    console.log('  Windows:  Download from https://ffmpeg.org/download.html');
    return false;
  }
}

checkFfmpeg();