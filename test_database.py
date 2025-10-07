import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.database import get_db, engine
from app.models import Product, Sale, Return, Category
from sqlalchemy import create_engine, inspect

print("Database Diagnostic")
print("=" * 60)

# Check if database exists and tables are created
inspector = inspect(engine)
tables = inspector.get_table_names()

print(f"\nDatabase Tables: {tables}")
print(f"Total tables: {len(tables)}")

# Get a database session
db = next(get_db())

try:
    # Count products
    total_products = db.query(Product).count()
    active_products = db.query(Product).filter(Product.is_active == True).count()
    print(f"\n Products:")
    print(f"   Total: {total_products}")
    print(f"   Active: {active_products}")
    print(f"   Inactive: {total_products - active_products}")
    
    # Count categories
    total_categories = db.query(Category).count()
    print(f"\n Categories: {total_categories}")
    
    # Count sales
    total_sales = db.query(Sale).count()
    print(f"\n Sales: {total_sales}")
    
    # Count returns
    total_returns = db.query(Return).count()
    refunded_returns = db.query(Return).filter(Return.status == 'refunded').count()
    print(f"\n Returns:")
    print(f"   Total: {total_returns}")
    print(f"   Refunded: {refunded_returns}")
    
    # Check for low stock
    low_stock = db.query(Product).filter(
        Product.stock_quantity <= Product.min_stock_level,
        Product.is_active == True
    ).count()
    print(f"\n Low Stock Products: {low_stock}")
    
    # Show sample products
    print(f"\n Sample Products (first 5):")
    products = db.query(Product).limit(5).all()
    for p in products:
        print(f"   ID: {p.id}, Name: {p.name}, Active: {p.is_active}, Stock: {p.stock_quantity}")
    
    if total_products == 0:
        print("\n⚠ WARNING: No products in database!")
        print("   You may need to run: python backend/init_sample_data.py")
    
except Exception as e:
    print(f"\n✗ Error querying database: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()

print("\n" + "=" * 60)
