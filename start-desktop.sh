#!/bin/bash

echo "Starting Inventory Management System..."
echo

# Start the backend server
echo "Starting backend server..."
cd backend
python main.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start the desktop application
echo "Starting desktop application..."
cd ../frontend
npm run electron-dev

# Clean up background process when script exits
trap "kill $BACKEND_PID" EXIT