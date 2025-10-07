from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


# Category Schemas
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class Category(CategoryBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class CategoryWithStats(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    product_count: int = 0
    is_active: bool = True


# Product Schemas
class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    sku: str
    barcode: Optional[str] = None
    category_id: int
    price: float
    cost: float
    stock_quantity: int = 0
    min_stock_level: int = 10
    unit: str = "pcs"
    image_url: Optional[str] = None
    images: Optional[str] = None  # JSON string of image URLs
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category_id: Optional[int] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    stock_quantity: Optional[int] = None
    min_stock_level: Optional[int] = None
    unit: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[str] = None
    is_active: Optional[bool] = None


class Product(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    category: Category
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProductSimple(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    sku: str
    price: float
    stock_quantity: int
    image_url: Optional[str] = None


# Sales Schemas
class SalesItemBase(BaseModel):
    product_id: int
    quantity: int
    unit_price: float


class SalesItemCreate(SalesItemBase):
    pass


class SalesItem(SalesItemBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    total_price: float
    product: ProductSimple


class SaleBase(BaseModel):
    discount: float = 0.0
    tax: float = 0.0
    payment_method: str = "cash"
    notes: Optional[str] = None


class SaleCreate(SaleBase):
    items: List[SalesItemCreate]


class Sale(SaleBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    sale_number: str
    total_amount: float
    final_amount: float
    created_at: datetime
    sales_items: List[SalesItem]


# Stock Movement Schemas
class StockMovementBase(BaseModel):
    product_id: int
    movement_type: str
    quantity: int
    notes: Optional[str] = None


class StockMovementCreate(StockMovementBase):
    pass


class StockMovement(StockMovementBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    previous_stock: int
    new_stock: int
    reference_id: Optional[int] = None
    created_at: datetime
    product: ProductSimple


# Return Schemas
class ReturnItemBase(BaseModel):
    product_id: int
    quantity: int
    unit_price: float
    condition: str = "good"


class ReturnItemCreate(ReturnItemBase):
    pass


class ReturnItem(ReturnItemBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    total_price: float
    product: ProductSimple


class ReturnBase(BaseModel):
    original_sale_id: Optional[int] = None
    refund_method: str = "cash"
    reason: Optional[str] = None
    status: str = "pending"


class ReturnCreate(ReturnBase):
    items: List[ReturnItemCreate]


class Return(ReturnBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    return_number: str
    total_amount: float
    created_at: datetime
    processed_at: Optional[datetime] = None
    return_items: List[ReturnItem]


# Dashboard Schemas
class DashboardKPIs(BaseModel):
    total_products: int
    total_sales_today: float
    total_sales_count_today: int
    low_stock_count: int
    total_revenue_this_month: float


class SalesChartData(BaseModel):
    date: str
    sales: float


class CategoryDistribution(BaseModel):
    category: str
    count: int
    percentage: float


class LowStockProduct(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    sku: str
    stock_quantity: int
    min_stock_level: int
    category_name: str


# Settings Schemas
class SettingsBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None


class SettingsCreate(SettingsBase):
    pass


class SettingsUpdate(BaseModel):
    value: str
    description: Optional[str] = None


class Settings(SettingsBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    updated_at: Optional[datetime] = None


# Report Schemas
class ReportRequest(BaseModel):
    report_type: str  # 'sales', 'inventory', 'categories', 'low_stock'
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    format: str = 'pdf'  # 'pdf' or 'excel' or 'csv'