"""
项目 Pydantic 模式
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ItemBase(BaseModel):
    """项目基础模式"""
    title: str
    description: Optional[str] = None
    is_active: Optional[bool] = True


class ItemCreate(ItemBase):
    """项目创建模式"""
    pass


class ItemUpdate(BaseModel):
    """项目更新模式"""
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class Item(ItemBase):
    """项目完整模式"""
    id: int
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True