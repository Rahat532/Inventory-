from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, date, timedelta
from typing import List
from app.database import get_db
from app.models import Product, Sale, Category, SalesItem, Return
from app.schemas import (
    DashboardKPIs, SalesChartData, CategoryDistribution, LowStockProduct
)

router = APIRouter()


@router.get("/kpis", response_model=DashboardKPIs)
def get_dashboard_kpis(db: Session = Depends(get_db)):
    """Get key performance indicators for the dashboard"""
    
    # Total products (active only)
    total_products = db.query(Product).filter(Product.is_active).count()
    
    # Today's sales
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    today_sales = db.query(
        func.coalesce(func.sum(Sale.final_amount), 0).label('total'),
        func.count(Sale.id).label('count')
    ).filter(
        Sale.created_at >= today_start,
        Sale.created_at <= today_end
    ).first()

    # Today's refunded returns (subtract from revenue when payment is actually made)
    today_refunds = db.query(
        func.coalesce(func.sum(Return.total_amount), 0)
    ).filter(
        Return.status == 'refunded',
        Return.processed_at.isnot(None),  # only processed refunds
        Return.processed_at >= today_start,
        Return.processed_at <= today_end,
    ).scalar() or 0
    
    # Low stock count
    low_stock_count = db.query(Product).filter(
        Product.stock_quantity <= Product.min_stock_level,
        Product.is_active
    ).count()
    
    # This month's revenue
    first_day_of_month = today.replace(day=1)
    month_start = datetime.combine(first_day_of_month, datetime.min.time())
    
    monthly_sales = db.query(
        func.coalesce(func.sum(Sale.final_amount), 0)
    ).filter(
        Sale.created_at >= month_start
    ).scalar() or 0

    monthly_refunds = db.query(
        func.coalesce(func.sum(Return.total_amount), 0)
    ).filter(
        Return.status == 'refunded',
        Return.processed_at.isnot(None),
        Return.processed_at >= month_start
    ).scalar() or 0

    # Net values
    total_sales_today_net = float(today_sales.total) - float(today_refunds)
    monthly_revenue = float(monthly_sales) - float(monthly_refunds)
    
    return DashboardKPIs(
        total_products=total_products,
        total_sales_today=max(total_sales_today_net, 0.0),
        total_sales_count_today=today_sales.count,
        low_stock_count=low_stock_count,
        total_revenue_this_month=float(monthly_revenue)
    )


@router.get("/sales-chart", response_model=List[SalesChartData])
def get_sales_chart_data(days: int = 7, db: Session = Depends(get_db)):
    """Sales data for charts with smart aggregation:
    - days == 1: last 24 hours, hourly buckets
    - days == 12: last 12 months, monthly buckets
    - else: last N days, daily buckets
    Uses SQLite-friendly strftime grouping and returns label strings in `date`.
    """
    now = datetime.now()

    # Hourly: last 24 hours
    if days == 1:
        start_dt = now - timedelta(hours=24)
        key_expr = func.strftime('%Y-%m-%d %H:00', Sale.created_at)
        rows = (
            db.query(key_expr.label('k'), func.coalesce(func.sum(Sale.final_amount), 0).label('total'))
            .filter(Sale.created_at >= start_dt)
            .group_by('k')
            .order_by('k')
            .all()
        )
        data_map = {r.k: float(r.total) for r in rows}
        out: List[SalesChartData] = []
        cur = start_dt.replace(minute=0, second=0, microsecond=0)
        end_dt = now.replace(minute=0, second=0, microsecond=0)
        while cur <= end_dt:
            label = cur.strftime('%Y-%m-%dT%H:00:00')
            k = cur.strftime('%Y-%m-%d %H:00')
            out.append(SalesChartData(date=label, sales=data_map.get(k, 0.0)))
            cur += timedelta(hours=1)
        return out

    # Monthly: last 12 months
    if days == 12:
        start_dt = (now - timedelta(days=365)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        key_expr = func.strftime('%Y-%m', Sale.created_at)
        rows = (
            db.query(key_expr.label('k'), func.coalesce(func.sum(Sale.final_amount), 0).label('total'))
            .filter(Sale.created_at >= start_dt)
            .group_by('k')
            .order_by('k')
            .all()
        )
        data_map = {r.k: float(r.total) for r in rows}
        out: List[SalesChartData] = []
        cur = start_dt
        def add_month(d: datetime) -> datetime:
            y = d.year + (1 if d.month == 12 else 0)
            m = 1 if d.month == 12 else d.month + 1
            return d.replace(year=y, month=m, day=1)
        while cur <= now:
            k = cur.strftime('%Y-%m')
            # represent as first day of month at midnight
            label = cur.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime('%Y-%m-01T00:00:00')
            out.append(SalesChartData(date=label, sales=data_map.get(k, 0.0)))
            cur = add_month(cur)
        return out

    # Daily: last N days (7, 30, etc.)
    end_d = date.today()
    start_d = end_d - timedelta(days=days - 1)
    key_expr = func.strftime('%Y-%m-%d', Sale.created_at)
    rows = (
        db.query(key_expr.label('k'), func.coalesce(func.sum(Sale.final_amount), 0).label('total'))
        .filter(key_expr >= start_d.strftime('%Y-%m-%d'), key_expr <= end_d.strftime('%Y-%m-%d'))
        .group_by('k')
        .order_by('k')
        .all()
    )
    data_map = {r.k: float(r.total) for r in rows}
    out: List[SalesChartData] = []
    cur_d = start_d
    while cur_d <= end_d:
        k = cur_d.strftime('%Y-%m-%d')
        label = cur_d.strftime('%Y-%m-%dT00:00:00')
        out.append(SalesChartData(date=label, sales=data_map.get(k, 0.0)))
        cur_d += timedelta(days=1)
    return out


@router.get("/category-distribution", response_model=List[CategoryDistribution])
def get_category_distribution(db: Session = Depends(get_db)):
    """Get product distribution by category for pie chart"""
    
    # Get product count by category
    category_data = db.query(
        Category.name.label('category'),
        func.count(Product.id).label('count')
    ).join(Product, Category.id == Product.category_id)\
     .filter(Product.is_active)\
     .group_by(Category.id, Category.name)\
     .order_by(desc(func.count(Product.id)))\
     .all()
    
    total_products = sum(row.count for row in category_data)
    
    if total_products == 0:
        return []
    
    distribution = []
    for row in category_data:
        percentage = (row.count / total_products) * 100
        distribution.append(CategoryDistribution(
            category=row.category,
            count=row.count,
            percentage=round(percentage, 2)
        ))
    
    return distribution


@router.get("/low-stock-products", response_model=List[LowStockProduct])
def get_low_stock_products(limit: int = 10, db: Session = Depends(get_db)):
    """Get products with low stock for alerts"""
    
    products = db.query(
        Product.id,
        Product.name,
        Product.sku,
        Product.stock_quantity,
        Product.min_stock_level,
        Category.name.label('category_name')
    ).join(Category, Product.category_id == Category.id)\
     .filter(
         Product.stock_quantity <= Product.min_stock_level,
         Product.is_active
     ).order_by(Product.stock_quantity)\
     .limit(limit)\
     .all()
    
    return [
        LowStockProduct(
            id=product.id,
            name=product.name,
            sku=product.sku,
            stock_quantity=product.stock_quantity,
            min_stock_level=product.min_stock_level,
            category_name=product.category_name
        ) for product in products
    ]


@router.get("/recent-sales")
def get_recent_sales(limit: int = 5, db: Session = Depends(get_db)):
    """Get recent sales for dashboard"""
    
    recent_sales = db.query(Sale)\
        .order_by(desc(Sale.created_at))\
        .limit(limit)\
        .all()
    
    return [
        {
            "id": sale.id,
            "sale_number": sale.sale_number,
            "final_amount": sale.final_amount,
            "items_count": len(sale.sales_items),
            "created_at": sale.created_at.isoformat()
        } for sale in recent_sales
    ]


@router.get("/top-selling-products")
def get_top_selling_products(limit: int = 5, db: Session = Depends(get_db)):
    """Get top selling products by quantity"""
    
    # Get sales data for last 30 days
    thirty_days_ago = datetime.now() - timedelta(days=30)
    
    top_products = db.query(
        Product.id,
        Product.name,
        Product.sku,
        func.sum(SalesItem.quantity).label('total_sold'),
        func.sum(SalesItem.total_price).label('total_revenue')
    ).join(SalesItem, Product.id == SalesItem.product_id)\
     .join(Sale, SalesItem.sale_id == Sale.id)\
     .filter(Sale.created_at >= thirty_days_ago)\
     .group_by(Product.id, Product.name, Product.sku)\
     .order_by(desc(func.sum(SalesItem.quantity)))\
     .limit(limit)\
     .all()
    
    return [
        {
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "total_sold": product.total_sold,
            "total_revenue": float(product.total_revenue)
        } for product in top_products
    ]


@router.get("/sales-vs-returns")
def get_sales_vs_returns_data(period: str = "7", db: Session = Depends(get_db)):
    """Get sales vs returns comparison data for different periods (SQLite-safe)."""
    end_dt = datetime.now()

    if period == "1":  # Last 24 hours
        start_dt = end_dt - timedelta(days=1)
        fmt = "%Y-%m-%d %H:00"
        step = "hour"
        key_expr = func.strftime('%Y-%m-%d %H:00', Sale.created_at)
        r_key_expr = func.strftime('%Y-%m-%d %H:00', Return.created_at)
    elif period == "12":  # Last 12 months
        start_dt = end_dt - timedelta(days=365)
        fmt = "%Y-%m"
        step = "month"
        key_expr = func.strftime('%Y-%m', Sale.created_at)
        r_key_expr = func.strftime('%Y-%m', Return.created_at)
    else:  # 7 or 30 days
        days = 7 if period == "7" else 30
        start_dt = end_dt - timedelta(days=days)
        fmt = "%Y-%m-%d"
        step = "day"
        key_expr = func.strftime('%Y-%m-%d', Sale.created_at)
        r_key_expr = func.strftime('%Y-%m-%d', Return.created_at)

    # Sales sums grouped by key
    s_rows = (
        db.query(key_expr.label('k'), func.coalesce(func.sum(Sale.final_amount), 0).label('total'))
        .filter(Sale.created_at >= start_dt)
        .group_by('k')
        .order_by('k')
        .all()
    )
    # Returns sums grouped by key
    r_rows = (
        db.query(r_key_expr.label('k'), func.coalesce(func.sum(Return.total_amount), 0).label('total'))
        .filter(Return.created_at >= start_dt)
        .group_by('k')
        .order_by('k')
        .all()
    )

    s_dict = {row.k: float(row.total) for row in s_rows}
    r_dict = {row.k: float(row.total) for row in r_rows}

    # Build complete range
    out: List[dict] = []
    cur = start_dt

    def add_month(d: datetime) -> datetime:
        y = d.year + (1 if d.month == 12 else 0)
        m = 1 if d.month == 12 else d.month + 1
        # keep day within month by clamping to 1st
        return d.replace(year=y, month=m, day=1, hour=0, minute=0, second=0, microsecond=0)

    while cur <= end_dt:
        if step == "hour":
            key = cur.replace(minute=0, second=0, microsecond=0).strftime(fmt)
            cur = cur + timedelta(hours=1)
        elif step == "month":
            # normalize to first of month
            cur = cur.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            key = cur.strftime(fmt)
            cur = add_month(cur)
        else:  # day
            key = cur.date().strftime(fmt)
            cur = cur + timedelta(days=1)

        out.append({
            "period": key,
            "sales": s_dict.get(key, 0.0),
            "returns": r_dict.get(key, 0.0),
        })

    return out