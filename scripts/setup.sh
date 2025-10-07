#!/bin/bash

# Complete setup script for Inventory Management System

echo "Setting up Inventory Management System..."

# Check prerequisites
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed. Aborting." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting." >&2; exit 1; }

echo "✓ Prerequisites check passed"

# Setup backend
echo "Setting up backend..."
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # For bash/zsh
# For fish shell: source venv/bin/activate.fish
# For Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize sample data
echo "Initializing sample data..."
python init_sample_data.py

cd ..

# Setup frontend
echo "Setting up frontend..."
cd frontend

# Install dependencies
npm install

# Create .env file for development
cat > .env << EOL
REACT_APP_API_URL=http://localhost:8000/api
GENERATE_SOURCEMAP=false
EOL

cd ..

echo "✓ Setup completed successfully!"
echo ""
echo "To start development mode:"
echo "  ./scripts/dev.sh"
echo ""
echo "To build for production:"
echo "  ./scripts/build.sh"
echo ""
echo "The application will be available at:"
echo "  Backend API: http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  API Docs: http://localhost:8000/docs"