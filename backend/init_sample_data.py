"""
Sample data initialization script for the Inventory Management System
Run this script to populate the database with sample data for testing
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, create_tables
from app.models import Category, Product, Settings

def init_sample_data():
    """Initialize the database with sample data"""
    
    create_tables()
    db = SessionLocal()
    
    try:
        # Check if data already exists
        if db.query(Category).count() > 0:
            print("Sample data already exists. Skipping initialization.")
            return
        
        print("Initializing sample data...")
        
        # Create sample categories
        categories = [
            Category(name="Electronics", description="Electronic devices and gadgets"),
            Category(name="Clothing", description="Apparel and fashion items"),
            Category(name="Books", description="Books and educational materials"),
            Category(name="Home & Garden", description="Home improvement and garden supplies"),
            Category(name="Sports", description="Sports equipment and accessories"),
            Category(name="Toys", description="Toys and games for children"),
        ]
        
        for category in categories:
            db.add(category)
        
        db.commit()
        
        # Get category IDs
        electronics = db.query(Category).filter(Category.name == "Electronics").first()
        clothing = db.query(Category).filter(Category.name == "Clothing").first()
        books = db.query(Category).filter(Category.name == "Books").first()
        home_garden = db.query(Category).filter(Category.name == "Home & Garden").first()
        sports = db.query(Category).filter(Category.name == "Sports").first()
        toys = db.query(Category).filter(Category.name == "Toys").first()
        
        # Create sample products
        products = [
            # Electronics
            Product(
                name="Wireless Bluetooth Headphones",
                description="High-quality wireless headphones with noise cancellation",
                sku="ELEC-WBH-001",
                barcode="1234567890123",
                category_id=electronics.id,
                price=79.99,
                cost=45.00,
                stock_quantity=25,
                min_stock_level=5,
                unit="pcs"
            ),
            Product(
                name="USB-C Charging Cable",
                description="Fast charging USB-C cable 6ft length",
                sku="ELEC-USC-002",
                barcode="1234567890124",
                category_id=electronics.id,
                price=19.99,
                cost=8.00,
                stock_quantity=50,
                min_stock_level=10,
                unit="pcs"
            ),
            Product(
                name="Wireless Mouse",
                description="Ergonomic wireless mouse with precision tracking",
                sku="ELEC-WM-003",
                barcode="1234567890125",
                category_id=electronics.id,
                price=35.99,
                cost=18.00,
                stock_quantity=15,
                min_stock_level=8,
                unit="pcs"
            ),
            
            # Clothing
            Product(
                name="Cotton T-Shirt",
                description="Comfortable 100% cotton t-shirt",
                sku="CLTH-CTS-001",
                barcode="2234567890123",
                category_id=clothing.id,
                price=24.99,
                cost=12.00,
                stock_quantity=40,
                min_stock_level=15,
                unit="pcs"
            ),
            Product(
                name="Denim Jeans",
                description="Classic blue denim jeans",
                sku="CLTH-DJ-002",
                barcode="2234567890124",
                category_id=clothing.id,
                price=59.99,
                cost=30.00,
                stock_quantity=20,
                min_stock_level=8,
                unit="pcs"
            ),
            
            # Books
            Product(
                name="Python Programming Guide",
                description="Comprehensive guide to Python programming",
                sku="BOOK-PPG-001",
                barcode="3234567890123",
                category_id=books.id,
                price=39.99,
                cost=20.00,
                stock_quantity=12,
                min_stock_level=5,
                unit="pcs"
            ),
            Product(
                name="Business Management Handbook",
                description="Essential guide for business management",
                sku="BOOK-BMH-002",
                barcode="3234567890124",
                category_id=books.id,
                price=45.99,
                cost=22.00,
                stock_quantity=8,
                min_stock_level=3,
                unit="pcs"
            ),
            
            # Home & Garden
            Product(
                name="Indoor Plant Pot Set",
                description="Set of 3 decorative ceramic plant pots",
                sku="HOME-IPPS-001",
                barcode="4234567890123",
                category_id=home_garden.id,
                price=29.99,
                cost=15.00,
                stock_quantity=18,
                min_stock_level=6,
                unit="set"
            ),
            Product(
                name="Garden Watering Can",
                description="2-gallon capacity metal watering can",
                sku="HOME-GWC-002",
                barcode="4234567890124",
                category_id=home_garden.id,
                price=34.99,
                cost=18.00,
                stock_quantity=3,  # Low stock for demo
                min_stock_level=5,
                unit="pcs"
            ),
            
            # Sports
            Product(
                name="Basketball",
                description="Official size basketball",
                sku="SPRT-BB-001",
                barcode="5234567890123",
                category_id=sports.id,
                price=29.99,
                cost=15.00,
                stock_quantity=22,
                min_stock_level=10,
                unit="pcs"
            ),
            Product(
                name="Yoga Mat",
                description="Non-slip exercise yoga mat",
                sku="SPRT-YM-002",
                barcode="5234567890124",
                category_id=sports.id,
                price=24.99,
                cost=12.00,
                stock_quantity=16,
                min_stock_level=8,
                unit="pcs"
            ),
            
            # Toys
            Product(
                name="Building Blocks Set",
                description="Creative building blocks for kids",
                sku="TOYS-BBS-001",
                barcode="6234567890123",
                category_id=toys.id,
                price=39.99,
                cost=20.00,
                stock_quantity=14,
                min_stock_level=8,
                unit="set"
            ),
            Product(
                name="Educational Puzzle",
                description="100-piece educational puzzle",
                sku="TOYS-EP-002",
                barcode="6234567890124",
                category_id=toys.id,
                price=19.99,
                cost=10.00,
                stock_quantity=4,  # Low stock for demo
                min_stock_level=6,
                unit="pcs"
            ),
        ]
        
        for product in products:
            db.add(product)
        
        db.commit()
        
        # Create default settings
        default_settings = [
            Settings(key="company_name", value="Sample Company Inc.", description="Company name"),
            Settings(key="company_address", value="123 Business Street, City, State 12345", description="Company address"),
            Settings(key="company_phone", value="(555) 123-4567", description="Company phone number"),
            Settings(key="company_email", value="info@samplecompany.com", description="Company email"),
            Settings(key="currency", value="USD", description="Default currency"),
            Settings(key="currency_symbol", value="$", description="Currency symbol"),
            Settings(key="tax_rate", value="8.5", description="Default tax rate percentage"),
            Settings(key="theme", value="light", description="Application theme"),
            Settings(key="low_stock_threshold", value="10", description="Global low stock threshold"),
        ]
        
        for setting in default_settings:
            db.add(setting)
        
        db.commit()
        
        print("Sample data initialized successfully!")
        print(f"Created {len(categories)} categories")
        print(f"Created {len(products)} products")
        print(f"Created {len(default_settings)} settings")
        
        # Display low stock products
        low_stock = [p for p in products if p.stock_quantity <= p.min_stock_level]
        if low_stock:
            print(f"\nLow stock products ({len(low_stock)}):")
            for product in low_stock:
                print(f"  - {product.name}: {product.stock_quantity} (min: {product.min_stock_level})")
        
    except Exception as e:
        print(f"Error initializing sample data: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_sample_data()