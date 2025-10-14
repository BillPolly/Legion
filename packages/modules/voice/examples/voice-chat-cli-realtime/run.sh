#!/bin/bash
# Wrapper script to suppress mpg123 warnings
node index.js 2>&1 | grep -v "coreaudio.c" | grep -v "buffer underflow"
