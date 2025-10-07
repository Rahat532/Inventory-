from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import func
from app.database import get_db
from app.models import Category, Product
from app.schemas import CategoryWithStats as CategorySchema, CategoryCreate, CategoryUpdate

router = APIRouter()


@router.get("/", response_model=List[CategorySchema])
def get_categories(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all categories with optional search"""
    # Query categories with product counts using LEFT OUTER JOIN
    query = db.query(
        Category,
        func.count(Product.id).label('product_count')
    ).outerjoin(Product, Product.category_id == Category.id)
    
    if search:
        query = query.filter(
            (Category.name.contains(search)) | 
            (Category.description.contains(search))
        )
    
    query = query.group_by(Category.id)
    rows = query.offset(skip).limit(limit).all()
    # Map to schema with product_count and is_active rules
    result = []
    for row in rows:
        cat = row[0]
        count = int(row[1] or 0)
        result.append({
            'id': cat.id,
            'name': cat.name,
            'description': cat.description,
            'created_at': cat.created_at,
            'updated_at': cat.updated_at,
            'product_count': count,
            # if there are no products -> Inactive, else Active
            'is_active': count > 0
        })
    return result


@router.get("/{category_id}", response_model=CategorySchema)
def get_category(category_id: int, db: Session = Depends(get_db)):
    """Get a specific category by ID"""
    row = db.query(
        Category,
        func.count(Product.id).label('product_count')
    ).outerjoin(Product, Product.category_id == Category.id)\
     .filter(Category.id == category_id)\
     .group_by(Category.id)\
     .first()
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")
    cat, count = row
    return {
        'id': cat.id,
        'name': cat.name,
        'description': cat.description,
        'created_at': cat.created_at,
        'updated_at': cat.updated_at,
        'product_count': int(count or 0),
        'is_active': (int(count or 0) > 0)
    }


@router.post("/", response_model=CategorySchema)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    """Create a new category"""
    # Check if category name already exists
    existing_category = db.query(Category).filter(Category.name == category.name).first()
    if existing_category:
        raise HTTPException(status_code=400, detail="Category name already exists")
    
    db_category = Category(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


@router.put("/{category_id}", response_model=CategorySchema)
def update_category(category_id: int, category: CategoryUpdate, db: Session = Depends(get_db)):
    """Update a category"""
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if new name already exists (if name is being updated)
    if category.name and category.name != db_category.name:
        existing_category = db.query(Category).filter(Category.name == category.name).first()
        if existing_category:
            raise HTTPException(status_code=400, detail="Category name already exists")
    
    # Update category fields
    update_data = category.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_category, field, value)
    
    db.commit()
    db.refresh(db_category)
    return db_category


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """Delete a category"""
    db_category = db.query(Category).filter(Category.id == category_id).first()
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if category has products
    products_count = db.query(Product).filter(Product.category_id == category_id).count()
    if products_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete category. It has {products_count} products associated with it."
        )
    
    db.delete(db_category)
    db.commit()
    return {"message": "Category deleted successfully"}


@router.get("/{category_id}/products-count")
def get_category_products_count(category_id: int, db: Session = Depends(get_db)):
    """Get the number of products in a category"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    products_count = db.query(Product).filter(Product.category_id == category_id).count()
    return {"category_id": category_id, "products_count": products_count}