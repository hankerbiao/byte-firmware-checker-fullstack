"""
API v1 主路由器
包含所有 v1 API 路由
"""

from fastapi import APIRouter
from app.api.v1.endpoints import users, items, auth

# 创建主 API 路由器
api_router = APIRouter()

# 包含认证路由
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["认证"]
)

# 包含用户路由
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["用户"]
)

# 包含项目路由
api_router.include_router(
    items.router,
    prefix="/items",
    tags=["项目"]
)