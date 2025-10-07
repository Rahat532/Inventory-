from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, date
from app.database import get_db
from app.models import Sale, SalesItem, Product, StockMovement
from app.schemas import Sale as SaleSchema, SaleCreate

router = APIRouter()


def generate_sale_number():
    """Generate a unique sale number"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"SALE-{timestamp}"


@router.get("/", response_model=List[SaleSchema])
def get_sales(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all sales with optional date filtering"""
    query = db.query(Sale)
    
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
        query = query.filter(Sale.created_at >= start_dt)
    
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        query = query.filter(Sale.created_at <= end_dt)
    
    sales = query.order_by(desc(Sale.created_at)).offset(skip).limit(limit).all()
    return sales


@router.get("/{sale_id}", response_model=SaleSchema)
def get_sale(sale_id: int, db: Session = Depends(get_db)):
    """Get a specific sale by ID"""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale


@router.post("/", response_model=SaleSchema)
def create_sale(sale: SaleCreate, db: Session = Depends(get_db)):
    """Create a new sale"""
    if not sale.items:
        raise HTTPException(status_code=400, detail="Sale must have at least one item")
    
    # Calculate totals
    total_amount = 0
    for item in sale.items:
        # Verify product exists and has sufficient stock
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product with ID {item.product_id} not found")
        
        if product.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for product {product.name}. Available: {product.stock_quantity}, Required: {item.quantity}"
            )
        
        total_amount += item.quantity * item.unit_price
    
    # Calculate final amount
    final_amount = total_amount - sale.discount + sale.tax
    
    # Create sale
    db_sale = Sale(
        sale_number=generate_sale_number(),
        total_amount=total_amount,
        discount=sale.discount,
        tax=sale.tax,
        final_amount=final_amount,
        payment_method=sale.payment_method,
        notes=sale.notes
    )
    
    db.add(db_sale)
    db.flush()  # Get the sale ID
    
    # Create sale items and update stock
    for item in sale.items:
        # Create sales item
        db_item = SalesItem(
            sale_id=db_sale.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.quantity * item.unit_price
        )
        db.add(db_item)
        
        # Update product stock
        product = db.query(Product).filter(Product.id == item.product_id).first()
        previous_stock = product.stock_quantity
        new_stock = previous_stock - item.quantity
        product.stock_quantity = new_stock
        
        # Create stock movement
        stock_movement = StockMovement(
            product_id=item.product_id,
            movement_type="out",
            quantity=item.quantity,
            previous_stock=previous_stock,
            new_stock=new_stock,
            reference_id=db_sale.id,
            notes=f"Sale #{db_sale.sale_number}"
        )
        db.add(stock_movement)
    
    db.commit()
    db.refresh(db_sale)
    return db_sale


@router.delete("/{sale_id}")
def cancel_sale(sale_id: int, db: Session = Depends(get_db)):
    """Cancel a sale and restore stock"""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Restore stock for each item
    for item in sale.sales_items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            previous_stock = product.stock_quantity
            new_stock = previous_stock + item.quantity
            product.stock_quantity = new_stock
            
            # Create stock movement for reversal
            stock_movement = StockMovement(
                product_id=item.product_id,
                movement_type="in",
                quantity=item.quantity,
                previous_stock=previous_stock,
                new_stock=new_stock,
                reference_id=sale.id,
                notes=f"Sale #{sale.sale_number} cancelled"
            )
            db.add(stock_movement)
    
    # Delete the sale (cascade will delete sales items)
    db.delete(sale)
    db.commit()
    
    return {"message": "Sale cancelled and stock restored"}


@router.get("/today/summary")
def get_today_sales_summary(db: Session = Depends(get_db)):
    """Get today's sales summary"""
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    result = db.query(
        func.count(Sale.id).label('count'),
        func.coalesce(func.sum(Sale.final_amount), 0).label('total')
    ).filter(
        Sale.created_at >= today_start,
        Sale.created_at <= today_end
    ).first()
    
    return {
        "total_sales": float(result.total),
        "sales_count": result.count,
        "date": today.isoformat()
    }


@router.get("/monthly/summary")
def get_monthly_sales_summary(
    year: int = None,
    month: int = None,
    db: Session = Depends(get_db)
):
    """Get monthly sales summary"""
    if not year:
        year = datetime.now().year
    if not month:
        month = datetime.now().month
    
    # Get sales data grouped by day for the month
    sales_data = db.query(
        func.date(Sale.created_at).label('date'),
        func.count(Sale.id).label('count'),
        func.coalesce(func.sum(Sale.final_amount), 0).label('total')
    ).filter(
        func.extract('year', Sale.created_at) == year,
        func.extract('month', Sale.created_at) == month
    ).group_by(
        func.date(Sale.created_at)
    ).order_by(
        func.date(Sale.created_at)
    ).all()
    
    return {
        "year": year,
        "month": month,
        "daily_sales": [
            {
                "date": row.date.isoformat(),
                "total": float(row.total),
                "count": row.count
            } for row in sales_data
        ]
    }