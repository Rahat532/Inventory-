from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import Product, Category, StockMovement
from app.schemas import (
    Product as ProductSchema, ProductCreate, ProductUpdate,
    StockMovement as StockMovementSchema, StockMovementCreate
)

router = APIRouter()


@router.get("/", response_model=List[ProductSchema])
def get_products(
    skip: int = 0,
    limit: int = 100,
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get all products with optional filtering"""
    query = db.query(Product)
    
    if category_id:
        query = query.filter(Product.category_id == category_id)
    
    if search:
        query = query.filter(
            (Product.name.contains(search)) | 
            (Product.sku.contains(search)) | 
            (Product.description.contains(search))
        )
    
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    
    products = query.offset(skip).limit(limit).all()
    return products


@router.get("/{product_id}", response_model=ProductSchema)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get a specific product by ID"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=ProductSchema)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """Create a new product"""
    # Check if category exists
    category = db.query(Category).filter(Category.id == product.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if SKU already exists
    existing_product = db.query(Product).filter(Product.sku == product.sku).first()
    if existing_product:
        raise HTTPException(status_code=400, detail="SKU already exists")
    
    db_product = Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    # Create initial stock movement if stock_quantity > 0
    if db_product.stock_quantity > 0:
        stock_movement = StockMovement(
            product_id=db_product.id,
            movement_type="in",
            quantity=db_product.stock_quantity,
            previous_stock=0,
            new_stock=db_product.stock_quantity,
            notes="Initial stock"
        )
        db.add(stock_movement)
        db.commit()
    
    return db_product


@router.put("/{product_id}", response_model=ProductSchema)
def update_product(product_id: int, product: ProductUpdate, db: Session = Depends(get_db)):
    """Update a product"""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if category exists if being updated
    if product.category_id:
        category = db.query(Category).filter(Category.id == product.category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if SKU already exists if being updated
    if product.sku and product.sku != db_product.sku:
        existing_product = db.query(Product).filter(Product.sku == product.sku).first()
        if existing_product:
            raise HTTPException(status_code=400, detail="SKU already exists")
    
    # Update product fields
    update_data = product.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_product, field, value)
    
    db.commit()
    db.refresh(db_product)
    return db_product


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Delete a product (soft delete by setting is_active to False)"""
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db_product.is_active = False
    db.commit()
    return {"message": "Product deactivated successfully"}


@router.post("/{product_id}/stock", response_model=StockMovementSchema)
def update_stock(
    product_id: int,
    movement: StockMovementCreate,
    db: Session = Depends(get_db)
):
    """Update product stock with movement tracking"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    previous_stock = product.stock_quantity
    
    if movement.movement_type == "in":
        new_stock = previous_stock + movement.quantity
    elif movement.movement_type == "out":
        new_stock = previous_stock - movement.quantity
        if new_stock < 0:
            raise HTTPException(status_code=400, detail="Insufficient stock")
    elif movement.movement_type == "adjustment":
        new_stock = movement.quantity
    else:
        raise HTTPException(status_code=400, detail="Invalid movement type")
    
    # Update product stock
    product.stock_quantity = new_stock
    
    # Create stock movement record
    db_movement = StockMovement(
        product_id=product_id,
        movement_type=movement.movement_type,
        quantity=movement.quantity,
        previous_stock=previous_stock,
        new_stock=new_stock,
        notes=movement.notes
    )
    
    db.add(db_movement)
    db.commit()
    db.refresh(db_movement)
    
    return db_movement


@router.get("/{product_id}/movements", response_model=List[StockMovementSchema])
def get_product_movements(
    product_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get stock movement history for a product"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    movements = db.query(StockMovement)\
        .filter(StockMovement.product_id == product_id)\
        .order_by(StockMovement.created_at.desc())\
        .offset(skip).limit(limit).all()
    
    return movements


@router.get("/low-stock/", response_model=List[ProductSchema])
def get_low_stock_products(db: Session = Depends(get_db)):
    """Get products with stock below minimum level"""
    products = db.query(Product)\
        .filter(Product.stock_quantity <= Product.min_stock_level)\
        .filter(Product.is_active)\
        .all()
    
    return products