#!/usr/bin/env python3
"""
CLI entry point for the research agent
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from research_agent.main import main
import asyncio

if __name__ == "__main__":
    asyncio.run(main())
