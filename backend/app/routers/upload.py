from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import os
import uuid
from typing import List

from app.database import get_db
from app.paths import get_data_dir
from app.models import Product

router = APIRouter(prefix="/upload", tags=["upload"])

# Create uploads directory under data dir if it doesn't exist
UPLOAD_DIR = get_data_dir('uploads')

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def get_file_extension(filename: str) -> str:
    """Get file extension from filename"""
    return os.path.splitext(filename)[1].lower()


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename while preserving extension"""
    extension = get_file_extension(original_filename)
    unique_name = str(uuid.uuid4())
    return f"{unique_name}{extension}"


@router.post("/product-image/{product_id}")
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a product image"""
    
    # Validate product exists
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Validate file type
    if get_file_extension(file.filename) not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Allowed: jpg, jpeg, png, gif, webp"
        )
    
    # Validate file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size too large (max 5MB)")
    
    # Generate unique filename
    filename = generate_unique_filename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        buffer.write(contents)
    
    # Update product image URL
    image_url = f"/uploads/{filename}"
    product.image_url = image_url
    db.commit()
    
    return {
        "message": "Image uploaded successfully",
        "image_url": image_url,
        "filename": filename
    }


@router.post("/product-images/{product_id}")
async def upload_multiple_product_images(
    product_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """Upload multiple product images"""
    
    # Validate product exists
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images allowed")
    
    uploaded_images = []
    
    for file in files:
        # Validate file type
        if get_file_extension(file.filename) not in ALLOWED_EXTENSIONS:
            continue  # Skip invalid files
        
        # Validate file size
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            continue  # Skip large files
        
        # Generate unique filename
        filename = generate_unique_filename(file.filename)
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        
        image_url = f"/uploads/{filename}"
        uploaded_images.append(image_url)
    
    # Update product images (store as JSON string)
    import json
    current_images = json.loads(product.images) if product.images else []
    current_images.extend(uploaded_images)
    product.images = json.dumps(current_images)
    
    # Set main image if not already set
    if not product.image_url and uploaded_images:
        product.image_url = uploaded_images[0]
    
    db.commit()
    
    return {
        "message": f"Uploaded {len(uploaded_images)} images successfully",
        "uploaded_images": uploaded_images,
        "total_images": len(current_images)
    }


@router.delete("/product-image/{product_id}")
async def delete_product_image(
    product_id: int,
    image_url: str,
    db: Session = Depends(get_db)
):
    """Delete a product image"""
    
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Remove from main image
    if product.image_url == image_url:
        product.image_url = None
    
    # Remove from additional images
    if product.images:
        import json
        current_images = json.loads(product.images)
        if image_url in current_images:
            current_images.remove(image_url)
            product.images = json.dumps(current_images)
    
    # Delete physical file
    filename = image_url.split('/')[-1]
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    db.commit()
    return {"message": "Image deleted successfully"}