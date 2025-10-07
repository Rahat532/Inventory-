# Inventory Management System - Copilot Instructions

## Project Overview
- **Type**: Desktop Application (Electron + React frontend, Python FastAPI backend)
- **Database**: SQLite (local storage)
- **Platform**: Windows desktop application
- **Mode**: Fully offline, no external APIs
- **Architecture**: Single-user inventory management system

## Tech Stack
- **Frontend**: React 18 + TypeScript + Electron
- **UI**: Tailwind CSS + shadcn/ui components
- **Backend**: Python FastAPI + SQLAlchemy + SQLite
- **Reports**: PDF generation with ReportLab, Excel with openpyxl
- **Charts**: Recharts for React
- **Packaging**: Electron Builder for Windows installer

## Project Structure
```
├── backend/           # Python FastAPI backend
├── frontend/          # React + Electron frontend
├── database/          # SQLite database files
├── scripts/           # Build and deployment scripts
└── docs/             # Documentation
```

## Key Features
1. **Dashboard**: KPIs, charts, low-stock alerts
2. **Product Management**: CRUD operations, stock updates
3. **Categories**: Product categorization
4. **Reports**: PDF/Excel export capabilities
5. **Settings**: Theme, backup/restore, preferences

## Development Guidelines
- Use TypeScript for type safety
- Implement proper error handling
- Follow REST API conventions
- Use component-based architecture
- Implement proper state management
- Ensure offline-first functionality

## Checklist Progress
- [x] Project structure created
- [x] Backend API implementation
- [x] Frontend React components
- [x] Database schema and models
- [x] Electron integration
- [x] Build and packaging scripts
- [x] Sample data initialization
- [x] Documentation completion