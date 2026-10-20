#!/bin/bash

# Start backend and frontend servers concurrently

echo "🚀 Starting Blogaganda..."
echo ""

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Warning: backend/.env not found"
    echo "   Copy backend/.env.example to backend/.env and add your API key"
    echo ""
fi

# Start both servers using concurrently
npm start
