from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import Return, ReturnItem, Product, Sale
from app.schemas import Return as ReturnSchema, ReturnCreate
import uuid

router = APIRouter(prefix="/returns", tags=["returns"])


def generate_return_number():
    """Generate a unique return number"""
    return f"RET-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"


@router.get("/", response_model=List[ReturnSchema])
def get_returns(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all returns with optional filtering"""
    query = db.query(Return)
    
    if status:
        query = query.filter(Return.status == status)
    
    returns = query.offset(skip).limit(limit).all()
    return returns


@router.get("/{return_id}", response_model=ReturnSchema)
def get_return(return_id: int, db: Session = Depends(get_db)):
    """Get a specific return by ID"""
    return_order = db.query(Return).filter(Return.id == return_id).first()
    if not return_order:
        raise HTTPException(status_code=404, detail="Return not found")
    return return_order


@router.post("/", response_model=ReturnSchema)
def create_return(return_data: ReturnCreate, db: Session = Depends(get_db)):
    """Create a new return"""
    
    # Validate products exist and calculate total
    total_amount = 0
    for item in return_data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        total_amount += item.quantity * item.unit_price
    
    # Create return record
    db_return = Return(
        return_number=generate_return_number(),
        original_sale_id=return_data.original_sale_id,
        total_amount=total_amount,
        refund_method=return_data.refund_method,
        reason=return_data.reason,
        status=return_data.status
    )
    
    db.add(db_return)
    db.flush()  # Get the return ID
    
    # Create return items
    for item in return_data.items:
        db_item = ReturnItem(
            return_id=db_return.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.quantity * item.unit_price,
            condition=item.condition
        )
        db.add(db_item)
    
    db.commit()
    db.refresh(db_return)
    return db_return


@router.put("/{return_id}/status")
def update_return_status(
    return_id: int,
    status: str,
    db: Session = Depends(get_db)
):
    """Update return status (approve, reject, complete)"""
    return_order = db.query(Return).filter(Return.id == return_id).first()
    if not return_order:
        raise HTTPException(status_code=404, detail="Return not found")
    
    return_order.status = status
    
    # If approving return, update stock quantities
    if status == "approved":
        for item in return_order.return_items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                # Add returned items back to stock if condition is good
                if item.condition == "good":
                    product.stock_quantity += item.quantity
        
        return_order.processed_at = datetime.now()
    
    db.commit()
    return {"message": f"Return status updated to {status}"}


@router.delete("/{return_id}")
def delete_return(return_id: int, db: Session = Depends(get_db)):
    """Delete a return"""
    return_order = db.query(Return).filter(Return.id == return_id).first()
    if not return_order:
        raise HTTPException(status_code=404, detail="Return not found")
    
    db.delete(return_order)
    db.commit()
    return {"message": "Return deleted successfully"}


@router.get("/sale/{sale_id}/items")
def get_sale_items_for_return(sale_id: int, db: Session = Depends(get_db)):
    """Get items from a sale that can be returned"""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    return sale.sales_items