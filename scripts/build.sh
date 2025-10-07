#!/bin/bash

# Build script for Inventory Management System

echo "Building Inventory Management System..."

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
pip install -r requirements.txt
cd ..

# Install frontend dependencies and build
echo "Installing frontend dependencies..."
cd frontend
npm install

echo "Building frontend..."
npm run build

echo "Building Electron app..."
npm run electron-pack

cd ..

echo "Build completed successfully!"
echo "The application installer can be found in frontend/dist/"