#!/bin/bash

# Test script to diagnose network vs code issues
# Usage: ./test-network-stability.sh <heatpump_IP>

if [ -z "$1" ]; then
  echo "Usage: $0 <heatpump_IP>"
  exit 1
fi

HEATPUMP_IP=$1
DURATION_MINUTES=30
PING_COUNT=$((DURATION_MINUTES * 60 / 2))  # Ping every 2 seconds

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     Network Stability Test for Adlar Heat Pump           ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Target: $HEATPUMP_IP"
echo "║  Duration: $DURATION_MINUTES minutes"
echo "║  Ping interval: 2 seconds"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Run continuous ping test
echo "Starting ping test... (Ctrl+C to stop)"
ping -i 2 -c $PING_COUNT $HEATPUMP_IP | tee network-test-$(date +%Y%m%d-%H%M%S).log

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Test Results - Interpretation                            ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Packet Loss:                                             ║"
echo "║    0-1%    : Excellent (code issue possible)              ║"
echo "║    1-5%    : Acceptable (code + network)                  ║"
echo "║    5-10%   : Poor (network primary issue)                 ║"
echo "║    >10%    : Critical (network is the problem!)           ║"
echo "║                                                            ║"
echo "║  Average Latency:                                         ║"
echo "║    <50ms   : Excellent                                    ║"
echo "║    50-100ms: Good                                         ║"
echo "║    >100ms  : Poor (timeouts likely)                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
