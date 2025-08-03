# Overview

This is a Flask-based Point of Sale (POS) system with inventory management capabilities. The application provides a dual-role interface for administrators and cashiers, with administrators managing inventory and reports while cashiers handle transaction processing. The system uses in-memory data storage for items and transactions, making it suitable for development and demonstration purposes.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Template Engine**: Jinja2 templating with a base template structure for consistent UI
- **CSS Framework**: Bootstrap 5 with dark theme and Font Awesome icons for professional appearance
- **JavaScript**: Vanilla JavaScript with a POSSystem class for client-side cart management and item search functionality
- **Responsive Design**: Mobile-friendly interface using Bootstrap's grid system

## Backend Architecture
- **Framework**: Flask web framework with session-based authentication
- **Data Storage**: In-memory Python dictionaries for items and transactions data
- **Authentication**: Simple hardcoded credentials for admin access (admin/admin123)
- **Session Management**: Flask sessions for user role management (admin vs cashier)
- **Middleware**: ProxyFix for handling reverse proxy headers

## Core Business Logic
- **Inventory Management**: CRUD operations for items with code, name, cost price, selling price, and stock tracking
- **Transaction Processing**: Cart-based checkout system with profit calculation
- **Role-Based Access**: Separate interfaces and permissions for admin and cashier roles
- **Profit Tracking**: Total profit calculation based on actual sales: (harga_jual - harga_awal) × (stok_awal - stok_akhir)

## API Structure
- **Route Organization**: Logical separation of admin routes (/admin/*) and cashier routes (/cashier/*)
- **RESTful Patterns**: Standard HTTP methods for CRUD operations
- **JSON Responses**: AJAX endpoints for dynamic search and cart operations

# External Dependencies

## Frontend Libraries
- **Bootstrap 5**: CSS framework loaded from Replit CDN for UI components and styling
- **Font Awesome 6**: Icon library loaded from CDNJS for interface icons
- **Custom CSS**: Application-specific styles for POS interface enhancements

## Python Packages
- **Flask**: Core web framework for routing, templating, and session management
- **Werkzeug**: WSGI utilities including ProxyFix middleware for deployment

## Development Tools
- **Python Logging**: Built-in logging module configured for debug-level output
- **Environment Variables**: SESSION_SECRET for production security configuration

Note: The current implementation uses in-memory storage which means data will be lost on application restart. This architecture choice simplifies development but would need to be replaced with persistent storage (database) for production use.