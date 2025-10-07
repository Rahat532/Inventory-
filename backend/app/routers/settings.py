from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import shutil
import os
from datetime import datetime
from app.database import get_db, DATABASE_URL
from app.paths import get_data_dir
import sqlite3
from app.models import Settings as SettingsModel
from app.schemas import Settings as SettingsSchema, SettingsCreate, SettingsUpdate

router = APIRouter()


# Default settings
DEFAULT_SETTINGS = {
    "theme": "light",
    "currency": "BDT",
    "currency_symbol": "Tk",
    "company_name": "My Company",
    "company_address": "",
    "company_phone": "",
    "company_email": "",
    "company_tax_id": "",  # e.g., VAT/GST/TIN
    "tax_rate": "0.0",
    "low_stock_threshold": "10",
    "backup_frequency": "weekly",
    "auto_backup": "true",
    "invoice_footer_notes": ""
}


def ensure_default_settings(db: Session):
    """Ensure all default settings exist in the database"""
    for key, value in DEFAULT_SETTINGS.items():
        existing = db.query(SettingsModel).filter(SettingsModel.key == key).first()
        if not existing:
            setting = SettingsModel(
                key=key,
                value=value,
                description=f"Default {key.replace('_', ' ').title()} setting"
            )
            db.add(setting)
    db.commit()


@router.get("/", response_model=List[SettingsSchema])
def get_all_settings(db: Session = Depends(get_db)):
    """Get all settings"""
    ensure_default_settings(db)
    settings = db.query(SettingsModel).all()
    return settings


@router.get("/dict")
def get_settings_dict(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get all settings as a dictionary"""
    ensure_default_settings(db)
    settings = db.query(SettingsModel).all()
    return {setting.key: setting.value for setting in settings}


@router.put("/bulk")
def update_multiple_settings(settings: Dict[str, str], db: Session = Depends(get_db)):
    """Update multiple settings at once"""
    updated_settings = []
    
    for key, value in settings.items():
        db_setting = db.query(SettingsModel).filter(SettingsModel.key == key).first()
        if not db_setting:
            # Create if doesn't exist
            db_setting = SettingsModel(
                key=key,
                value=value,
                description=f"Setting for {key}"
            )
            db.add(db_setting)
        else:
            # Update existing
            db_setting.value = value
        
        updated_settings.append({
            "key": key,
            "value": value,
            "updated": True
        })
    
    db.commit()
    return {"updated_settings": updated_settings}


@router.get("/{key}", response_model=SettingsSchema)
def get_setting(key: str, db: Session = Depends(get_db)):
    """Get a specific setting by key"""
    setting = db.query(SettingsModel).filter(SettingsModel.key == key).first()
    if not setting:
        # Return default if exists
        if key in DEFAULT_SETTINGS:
            setting = SettingsModel(
                key=key,
                value=DEFAULT_SETTINGS[key],
                description=f"Default {key.replace('_', ' ').title()} setting"
            )
            db.add(setting)
            db.commit()
            db.refresh(setting)
            return setting
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting


@router.post("/", response_model=SettingsSchema)
def create_setting(setting: SettingsCreate, db: Session = Depends(get_db)):
    """Create a new setting"""
    # Check if setting already exists
    existing = db.query(SettingsModel).filter(SettingsModel.key == setting.key).first()
    if existing:
        raise HTTPException(status_code=400, detail="Setting key already exists")
    
    db_setting = SettingsModel(**setting.model_dump())
    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting


@router.put("/{key}", response_model=SettingsSchema)
def update_setting(key: str, setting: SettingsUpdate, db: Session = Depends(get_db)):
    """Update a setting"""
    db_setting = db.query(SettingsModel).filter(SettingsModel.key == key).first()
    if not db_setting:
        # Create if doesn't exist
        db_setting = SettingsModel(
            key=key,
            value=setting.value,
            description=setting.description or f"Setting for {key}"
        )
        db.add(db_setting)
    else:
        # Update existing
        db_setting.value = setting.value
        if setting.description:
            db_setting.description = setting.description
    
    db.commit()
    db.refresh(db_setting)
    return db_setting


@router.delete("/{key}")
def delete_setting(key: str, db: Session = Depends(get_db)):
    """Delete a setting (only non-default settings)"""
    if key in DEFAULT_SETTINGS:
        raise HTTPException(status_code=400, detail="Cannot delete default setting")
    
    db_setting = db.query(SettingsModel).filter(SettingsModel.key == key).first()
    if not db_setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    db.delete(db_setting)
    db.commit()
    return {"message": "Setting deleted successfully"}


@router.post("/backup")
def create_backup(db: Session = Depends(get_db)):
    """Create a backup of the database using SQLite backup API"""
    try:
        # Get database file path
        db_path = DATABASE_URL.replace("sqlite:///", "")

        # Backups under the data dir for portability
        backup_dir = get_data_dir('database')
        backup_dir = os.path.join(backup_dir, 'backups')
        os.makedirs(backup_dir, exist_ok=True)

        # Create backup filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"inventory_backup_{timestamp}.db"
        backup_path = os.path.join(backup_dir, backup_filename)

        # Use sqlite backup to avoid copying a locked file
        src = sqlite3.connect(db_path)
        dst = sqlite3.connect(backup_path)
        with dst:
            src.backup(dst)
        src.close()
        dst.close()

        return {
            "message": "Backup created successfully",
            "backup_file": backup_filename,
            "backup_path": backup_path,
            "created_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create backup: {str(e)}")


@router.get("/backups/list")
def list_backups():
    """List all available backups"""
    try:
        # Get backup directory (data dir)
        backup_dir = os.path.join(get_data_dir('database'), "backups")

        if not os.path.exists(backup_dir):
            return {"backups": []}

        # List all backup files
        backups = []
        for filename in os.listdir(backup_dir):
            if filename.endswith(".db") and filename.startswith("inventory_backup_"):
                file_path = os.path.join(backup_dir, filename)
                file_stat = os.stat(file_path)

                backups.append({
                    "filename": filename,
                    "size": file_stat.st_size,
                    "created_at": datetime.fromtimestamp(file_stat.st_ctime).isoformat(),
                    "modified_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat()
                })

        # Sort by creation time (newest first)
        backups.sort(key=lambda x: x["created_at"], reverse=True)

        return {"backups": backups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list backups: {str(e)}")


@router.post("/restore/{backup_filename}")
def restore_backup(backup_filename: str, db: Session = Depends(get_db)):
    """Restore from a backup file"""
    try:
        # Get paths
        db_path = DATABASE_URL.replace("sqlite:///", "")
        backup_dir = os.path.join(get_data_dir('database'), "backups")
        backup_path = os.path.join(backup_dir, backup_filename)
        
        # Check if backup file exists
        if not os.path.exists(backup_path):
            raise HTTPException(status_code=404, detail="Backup file not found")
        
        # Close current database connection
        db.close()
        
        # Create a backup of current database before restore
        current_backup = f"pre_restore_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        current_backup_path = os.path.join(backup_dir, current_backup)
        shutil.copy2(db_path, current_backup_path)
        
        # Restore from backup
        shutil.copy2(backup_path, db_path)
        
        return {
            "message": "Database restored successfully",
            "restored_from": backup_filename,
            "current_backup": current_backup,
            "restored_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore backup: {str(e)}")


@router.post("/reset")
def reset_settings(db: Session = Depends(get_db)):
    """Reset all settings to default values"""
    try:
        # Delete all existing settings
        db.query(SettingsModel).delete()
        
        # Add default settings
        for key, value in DEFAULT_SETTINGS.items():
            setting = SettingsModel(
                key=key,
                value=value,
                description=f"Default {key.replace('_', ' ').title()} setting"
            )
            db.add(setting)
        
        db.commit()
        
        return {"message": "Settings reset to defaults successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset settings: {str(e)}")


@router.get("/export/json")
def export_settings(db: Session = Depends(get_db)):
    """Export all settings as JSON"""
    settings = db.query(SettingsModel).all()
    settings_dict = {}
    
    for setting in settings:
        settings_dict[setting.key] = {
            "value": setting.value,
            "description": setting.description,
            "updated_at": setting.updated_at.isoformat() if setting.updated_at else None
        }
    
    return {
        "settings": settings_dict,
        "exported_at": datetime.now().isoformat()
    }