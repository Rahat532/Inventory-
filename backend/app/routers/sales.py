from fastapi import APIRouter, Depends, HTTPException, Response
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, date
from app.database import get_db
from app.models import Sale, SalesItem, Product, StockMovement, Settings as SettingsModel
from app.schemas import Sale as SaleSchema, SaleCreate

router = APIRouter()


def generate_sale_number():
    """Generate a unique sale number"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"SALE-{timestamp}"


# -------- Invoice (PDF) Generation --------


def _get_setting(db: Session, key: str, default: str = "") -> str:
    s = db.query(SettingsModel).filter(SettingsModel.key == key).first()
    return s.value if s and s.value is not None else default


def _build_sale_invoice_pdf(db: Session, sale: Sale) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    # Company/Store info
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

    # Invoice header
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(width - 20 * mm, top, "SALES INVOICE")
    c.setFont("Helvetica", 10)
    c.drawRightString(width - 20 * mm, top - 6 * mm, f"Sale #: {sale.sale_number}")
    c.drawRightString(width - 20 * mm, top - 11 * mm, f"Date: {sale.created_at.strftime('%Y-%m-%d %H:%M')}")

    # Table headers
    y = top - 28 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(20 * mm, y, "Product (SKU)")
    c.drawRightString(140 * mm, y, "Qty")
    c.drawRightString(165 * mm, y, "Unit Price")
    c.drawRightString(width - 20 * mm, y, "Subtotal")
    c.line(20 * mm, y - 2 * mm, width - 20 * mm, y - 2 * mm)

    # Items
    c.setFont("Helvetica", 10)
    y -= 8 * mm
    for item in sale.sales_items:
        prod = item.product if getattr(item, 'product', None) else None
        name = prod.name if prod else str(item.product_id)
        sku = f" ({prod.sku})" if prod and getattr(prod, 'sku', None) else ""
        qty = item.quantity
        unit_price = float(item.unit_price or 0)
        subtotal = float(item.total_price or (qty * unit_price))

        c.drawString(20 * mm, y, (name + sku)[:70])
        c.drawRightString(140 * mm, y, str(qty))
        c.drawRightString(165 * mm, y, f"{currency_symbol} {unit_price:,.2f}")
        c.drawRightString(width - 20 * mm, y, f"{currency_symbol} {subtotal:,.2f}")
        y -= 7 * mm
        if y < 30 * mm:  # new page if needed
            c.showPage()
            y = height - 20 * mm

    # Optional customer notes (e.g., name/email)
    if sale.notes:
        y -= 4 * mm
        c.setFont("Helvetica", 9)
        c.drawString(20 * mm, y, f"Customer: {str(sale.notes)[:80]}")
        y -= 4 * mm

    # Totals
    y -= 4 * mm
    c.line(120 * mm, y, width - 20 * mm, y)
    y -= 8 * mm
    c.setFont("Helvetica", 10)
    c.drawRightString(165 * mm, y, "Total:")
    c.drawRightString(width - 20 * mm, y, f"{currency_symbol} {float(sale.total_amount or 0):,.2f}")
    y -= 6 * mm
    c.drawRightString(165 * mm, y, "Discount:")
    c.drawRightString(width - 20 * mm, y, f"{currency_symbol} {float(sale.discount or 0):,.2f}")
    y -= 6 * mm
    c.drawRightString(165 * mm, y, "Tax:")
    c.drawRightString(width - 20 * mm, y, f"{currency_symbol} {float(sale.tax or 0):,.2f}")
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(165 * mm, y, "Amount Due:")
    c.drawRightString(width - 20 * mm, y, f"{currency_symbol} {float(sale.final_amount or sale.total_amount or 0):,.2f}")

    # Footer
    c.setFont("Helvetica", 9)
    c.drawString(20 * mm, 20 * mm, "Thank you for your business!")
    if footer_notes:
        c.drawString(20 * mm, 15 * mm, footer_notes[:100])
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


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


@router.get("/{sale_id}/invoice")
def download_sale_invoice(sale_id: int, db: Session = Depends(get_db)):
    """Download PDF invoice for a sale"""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    pdf_bytes = _build_sale_invoice_pdf(db, sale)
    filename = f"invoice_{sale.sale_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


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