"""
快速开始示例
演示如何使用 FastAPI 模板创建简单的 API 端点
"""

from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.user_service import user_service
from app.schemas.user import UserCreate, User

# 创建 FastAPI 应用
app = FastAPI(
    title="快速开始示例",
    description="演示如何使用 FastAPI 模板",
    version="1.0.0"
)


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "欢迎使用 FastAPI 模板！",
        "docs": "/docs"
    }


@app.post("/demo/user")
async def create_demo_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    创建演示用户

    这是一个简单的示例，展示如何使用 Service 层
    """
    user = await user_service.create_user(db, user_data)
    return user


@app.get("/demo/users")
async def get_demo_users(
    skip: int = 0,
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """
    获取用户列表

    这是一个简单的示例，展示如何使用 Repository 层
    """
    users = await user_service.repository.get_multi(db, skip, limit)
    return {"users": users, "total": len(users)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "examples.quick_start:app",
        host="0.0.0.0",
        port=8001,
        reload=True
    )