# Inventory Management System - Production Ready ✅

A modern, offline-first desktop inventory management system with e-commerce features, real-time analytics, and production-ready deployment.

## 🚀 Current Status: FULLY FUNCTIONAL & PRODUCTION READY

### ✅ All Features Implemented & Tested
- **E-commerce Image System**: Product photo upload and display
- **Sales & Returns Workflow**: Complete transaction processing
- **Interactive Dashboard**: Real-time Chart.js analytics with refresh functionality
- **Desktop GUI Application**: Native Electron app ready for distribution
- **Dynamic Chart Filtering**: 1 day, 7 days, 30 days, 12 months comparisons
- **Sales vs Returns Analytics**: Visual trend comparison charts
- **Production Build System**: Automated installer creation for end users

### 🎯 Quick Start (Recommended)
1. **Download** this repository
2. **Double-click** `start-desktop.bat`
3. **Wait** for automatic setup and launch

### 📊 Dashboard Features
- Key Performance Indicators (KPIs)
- Sales analytics with charts
- Low stock alerts
- Category distribution visualization
- Recent sales overview

### 📦 Product Management
- Complete CRUD operations for products
- Stock tracking with movement history
- Low stock alerts and minimum level management
- Barcode and SKU support
- Category-based organization

### 🏷️ Category Management
- Create and manage product categories
- Category-based reporting
- Product count tracking per category

### 💰 Sales Management
- Point of sale functionality
- Sales history and reporting
- Return/cancellation support
- Multiple payment methods
- Automatic stock deduction

### 📈 Reports
- PDF and Excel report generation
- Sales reports with date filtering
- Inventory reports
- Category analysis reports
- Exportable data

### ⚙️ Settings
- Theme customization (Light/Dark mode)
- Database backup and restore
- Application preferences
- Company information setup

## Tech Stack

### Backend
- **Python 3.8+**
- **FastAPI** - Modern, fast web framework
- **SQLAlchemy** - Database ORM
- **SQLite** - Local database storage
- **ReportLab** - PDF generation
- **OpenPyXL** - Excel file generation

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Electron** - Desktop application wrapper
- **Tailwind CSS** - Styling framework
- **shadcn/ui** - UI component library
- **Recharts** - Data visualization
- **React Query** - Data fetching and caching

## Installation and Setup

### Prerequisites
- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **npm** or **yarn**

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd inventory-management-system
   ```

2. **Install dependencies and build (Windows)**
   ```bash
   scripts\build.bat
   ```

   **Or for Linux/macOS**
   ```bash
   chmod +x scripts/build.sh
   ./scripts/build.sh
   ```

3. **Run the application**
   - The installer will be created in `frontend/dist/`
   - Install and run the application

### Development Setup

1. **Backend Setup**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

3. **Run in Development Mode (Windows)**
   ```bash
   scripts\dev.bat
   ```

   **Or for Linux/macOS**
   ```bash
   chmod +x scripts/dev.sh
   ./scripts/dev.sh
   ```

## Project Structure

```
inventory-management-system/
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── models/         # Database models
│   │   ├── routers/        # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── database.py     # Database configuration
│   │   └── schemas.py      # Pydantic schemas
│   ├── main.py            # FastAPI application entry point
│   └── requirements.txt   # Python dependencies
├── frontend/              # React + Electron frontend
│   ├── public/           # Static files
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   └── lib/         # Utility functions
│   ├── package.json     # Node.js dependencies
│   └── electron.js      # Electron main process
├── database/            # SQLite database files
├── scripts/             # Build and deployment scripts
└── docs/               # Documentation
```

## API Documentation

When running in development mode, visit `http://localhost:8000/docs` for interactive API documentation powered by FastAPI's automatic OpenAPI generation.

## Building for Production

### Windows Installer
```bash
scripts\build.bat
```

The build process will:
1. Install Python dependencies
2. Install Node.js dependencies
3. Build the React application
4. Package the Electron application
5. Create a Windows installer in `frontend/dist/`

### Manual Build Steps

1. **Build Backend**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Build Frontend**
   ```bash
   cd frontend
   npm install
   npm run build
   npm run electron-pack
   ```

## Configuration

### Backend Configuration
- Database: SQLite (stored in `database/inventory.db`)
- Port: 8000 (configurable in `main.py`)
- CORS: Enabled for frontend communication

### Frontend Configuration
- React development server: Port 3000
- Electron: Automatically starts backend in production
- API base URL: `http://localhost:8000/api`

## Features Overview

### Dashboard Analytics
- Real-time KPIs display
- Sales trend visualization
- Low stock product alerts
- Category distribution charts
- Quick action buttons

### Inventory Management
- Add, edit, delete products
- Bulk stock updates
- Stock movement tracking
- Barcode scanning support
- Category-based filtering

### Sales Processing
- Quick sale creation
- Multiple payment methods
- Automatic inventory updates
- Sales receipt generation
- Return processing

### Reporting System
- Generate PDF/Excel reports
- Date range filtering
- Sales performance analysis
- Inventory status reports
- Category performance metrics

### Data Management
- Database backup/restore
- Settings export/import
- Data integrity checks
- Automatic data validation

## Security Features

- Local-only operation (no external network dependencies)
- SQLite database with integrity constraints
- Input validation and sanitization
- Error handling and logging

## Performance Optimizations

- Efficient database queries with SQLAlchemy
- React Query for client-side caching
- Lazy loading of components
- Optimized Electron packaging
- Compressed asset delivery

## Troubleshooting

### Common Issues

1. **Backend won't start**
   - Check Python version (3.8+)
   - Verify all dependencies are installed
   - Check port 8000 availability

2. **Frontend compilation errors**
   - Ensure Node.js version is 16+
   - Clear npm cache: `npm cache clean --force`
   - Delete `node_modules` and reinstall

3. **Database errors**
   - Check database file permissions
   - Verify SQLite installation
   - Review database path configuration

4. **Electron app won't launch**
   - Check for missing dependencies
   - Verify build process completed
   - Review Electron logs in developer console

### Getting Help

- Check the console logs for detailed error messages
- Review the API documentation at `/docs`
- Verify all dependencies are correctly installed
- Ensure proper file permissions

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Roadmap

- [ ] Advanced analytics and forecasting
- [ ] Multi-location inventory support
- [ ] Supplier management
- [ ] Purchase order management
- [ ] Mobile app companion
- [ ] Cloud sync capabilities
- [ ] Advanced user management
- [ ] API integrations

## Support

For support and questions, please create an issue in the GitHub repository.