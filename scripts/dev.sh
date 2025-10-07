#!/bin/bash

# Development script for Inventory Management System

echo "Starting Inventory Management System in development mode..."

# Function to cleanup background processes
cleanup() {
    echo "Cleaning up..."
    kill $BACKEND_PID 2>/dev/null
    exit
}

# Trap cleanup function on script exit
trap cleanup EXIT

# Start backend server
echo "Starting backend server..."
cd backend
python main.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend in development mode
echo "Starting frontend development server..."
cd frontend
npm run electron-dev

# Keep script running
wait