from fastapi import APIRouter, Depends, HTTPException, Response
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import Return, ReturnItem, Product, Sale, Settings as SettingsModel
from app.schemas import Return as ReturnSchema, ReturnCreate
import uuid

router = APIRouter(prefix="/returns", tags=["returns"])


def generate_return_number():
    """Generate a unique return number"""
    return f"RET-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"

# -------- Return Invoice (PDF) Generation --------


def _get_setting(db: Session, key: str, default: str = "") -> str:
    s = db.query(SettingsModel).filter(SettingsModel.key == key).first()
    return s.value if s and s.value is not None else default


def _build_return_invoice_pdf(db: Session, ret: Return) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # Company info
    company = _get_setting(db, "company_name", "My Company")
    address = _get_setting(db, "company_address", "")
    phone = _get_setting(db, "company_phone", "")
    email = _get_setting(db, "company_email", "")
    tax_id = _get_setting(db, "company_tax_id", "")
    currency_symbol = _get_setting(db, "currency_symbol", "$")
    footer_notes = _get_setting(db, "invoice_footer_notes", "")

    top = height - 20 * mm
    c.setFont("Helvetica-Bold", 16)
    c.drawString(20 * mm, top, company)
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, top - 6 * mm, address)
    c.drawString(20 * mm, top - 11 * mm, phone)
    if email:
        c.drawString(20 * mm, top - 16 * mm, email)
    if tax_id:
        c.drawString(20 * mm, top - 21 * mm, f"Tax ID: {tax_id}")

    # Header
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(width - 20 * mm, top, "RETURN INVOICE")
    c.setFont("Helvetica", 10)
    c.drawRightString(width - 20 * mm, top - 6 * mm, f"Return #: {ret.return_number}")
    c.drawRightString(width - 20 * mm, top - 11 * mm, f"Date: {ret.created_at.strftime('%Y-%m-%d %H:%M')}")

    # Table headers
    y = top - 28 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20 * mm, y, "Product")
    c.drawRightString(140 * mm, y, "Qty")
    c.drawRightString(165 * mm, y, "Unit Price")
    c.drawRightString(width - 20 * mm, y, "Subtotal")
    c.line(20 * mm, y - 2 * mm, width - 20 * mm, y - 2 * mm)

    # Items
    c.setFont("Helvetica", 10)
    y -= 8 * mm
    for item in ret.return_items:
        product = item.product if getattr(item, 'product', None) else None
        name = product.name if product else str(item.product_id)
        sku = f" ({product.sku})" if product and getattr(product, 'sku', None) else ""
        qty = item.quantity
        unit_price = float(item.unit_price or 0)
        subtotal = float(item.total_price or (qty * unit_price))

        c.drawString(20 * mm, y, (name + sku)[:70])
        c.drawRightString(140 * mm, y, str(qty))
        c.drawRightString(165 * mm, y, f"{currency_symbol} {unit_price:,.2f}")
        c.drawRightString(width - 20 * mm, y, f"{currency_symbol} {subtotal:,.2f}")
        y -= 7 * mm
        if y < 30 * mm:
            c.showPage()
            y = height - 20 * mm

    # Totals
    y -= 4 * mm
    c.line(120 * mm, y, width - 20 * mm, y)
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(165 * mm, y, "Refund:")
    c.drawRightString(width - 20 * mm, y, f"{currency_symbol} {float(ret.total_amount or 0):,.2f}")

    # Footer
    c.setFont("Helvetica", 9)
    c.drawString(20 * mm, 20 * mm, "Processed by Inventory Management System")
    if footer_notes:
        c.drawString(20 * mm, 15 * mm, footer_notes[:100])
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.getvalue()



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


@router.get("/{return_id}/invoice")
def download_return_invoice(return_id: int, db: Session = Depends(get_db)):
    """Download PDF invoice for a return"""
    ret = db.query(Return).filter(Return.id == return_id).first()
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    pdf_bytes = _build_return_invoice_pdf(db, ret)
    filename = f"return_{ret.return_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/sale/{sale_id}/items")
def get_sale_items_for_return(sale_id: int, db: Session = Depends(get_db)):
    """Get items from a sale that can be returned"""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    return sale.sales_items