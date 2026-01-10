#!/bin/bash
# Start script for ContextCopilot server

export PATH="/tmp/node-v20.19.6-darwin-arm64/bin:$PATH"
export PNPM_HOME="/Users/andreacakan/Library/pnpm"
export PATH="$PNPM_HOME:$PATH"

cd "$(dirname "$0")"

echo "Starting ContextCopilot server..."
echo "Node version: $(node --version)"
echo "pnpm version: $(pnpm --version)"

# Check if .env exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please create .env file with: GEMINI_API_KEY=your_key_here"
    exit 1
fi

# Ensure esbuild is installed (needed by tsx)
if ! node -e "require('esbuild')" 2>/dev/null; then
    echo "Installing missing esbuild dependency..."
    pnpm add -D esbuild @esbuild/darwin-arm64
fi

# Start the server
pnpm dev
