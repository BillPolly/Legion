#!/bin/bash

# Aiur + UI Launch Script
# Starts both the Aiur server and the Aiur Actors UI

echo "═══════════════════════════════════════════════════════════"
echo "           Starting Aiur Server with UI                    "
echo "═══════════════════════════════════════════════════════════"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the Legion root directory
if [ ! -f "package.json" ] || [ ! -d "packages" ]; then
    echo -e "${RED}Error: This script must be run from the Legion root directory${NC}"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down servers...${NC}"
    
    # Kill Aiur server
    if [ ! -z "$AIUR_PID" ]; then
        kill $AIUR_PID 2>/dev/null
        echo "Stopped Aiur server (PID: $AIUR_PID)"
    fi
    
    # Kill UI server
    if [ ! -z "$UI_PID" ]; then
        kill $UI_PID 2>/dev/null
        echo "Stopped UI server (PID: $UI_PID)"
    fi
    
    # Also try to kill by port if PIDs didn't work
    lsof -ti:8080 | xargs kill -9 2>/dev/null
    lsof -ti:3002 | xargs kill -9 2>/dev/null
    
    echo -e "${GREEN}All servers stopped${NC}"
    exit 0
}

# Set up trap for cleanup on script exit
trap cleanup EXIT INT TERM

# Start Aiur Server
echo -e "${GREEN}Starting Aiur Server on port 8080...${NC}"
cd packages/aiur
npm start &
AIUR_PID=$!
cd ../..

# Wait a moment for Aiur to start
sleep 2

# Check if Aiur started successfully
if ! lsof -i:8080 > /dev/null 2>&1; then
    echo -e "${RED}Failed to start Aiur server on port 8080${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Aiur server running on port 8080 (PID: $AIUR_PID)${NC}"

# Start UI Server
echo -e "${GREEN}Starting UI Server on port 3002...${NC}"
cd packages/apps/aiur-actors-ui
npm start &
UI_PID=$!
cd ../../..

# Wait a moment for UI to start
sleep 2

# Check if UI started successfully
if ! lsof -i:3002 > /dev/null 2>&1; then
    echo -e "${RED}Failed to start UI server on port 3002${NC}"
    exit 1
fi

echo -e "${GREEN}✓ UI server running on port 3002 (PID: $UI_PID)${NC}"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "                    Services Running                       "
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  🚀 Aiur Server:    ws://localhost:8080/actors"
echo "  🌐 UI Application: http://localhost:3002"
echo ""
echo "  Open http://localhost:3002 in your browser"
echo ""
echo "  Press Ctrl+C to stop both servers"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Wait for processes
wait