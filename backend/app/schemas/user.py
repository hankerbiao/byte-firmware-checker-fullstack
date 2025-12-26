"""
用户 Pydantic 模式
"""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    """用户基础模式"""
    email: EmailStr
    name: str
    is_active: Optional[bool] = True


class UserCreate(UserBase):
    """用户创建模式"""
    password: str


class UserUpdate(BaseModel):
    """用户更新模式"""
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class User(UserBase):
    """用户完整模式"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserInDBBase(UserBase):
    """数据库用户基础模式"""
    id: int
    hashed_password: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    """令牌模式"""
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """令牌数据模式"""
    user_id: Optional[int] = None