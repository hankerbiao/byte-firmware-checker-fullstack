"""
应用启动脚本
"""

from app.main import app
from app.core.database import create_tables
import uvicorn


async def init_db():
    """初始化数据库"""
    await create_tables()


if __name__ == "__main__":
    import asyncio

    # 初始化数据库
    asyncio.run(init_db())

    # 启动服务器
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )