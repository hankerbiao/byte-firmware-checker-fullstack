"""
FastAPI 主应用程序入口
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database import database
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用程序生命周期事件"""
    # 启动时
    await database.connect()
    yield
    # 关闭时
    await database.disconnect()


# 创建 FastAPI 应用实例
app = FastAPI(
    title="FastAPI 模板项目",
    description="生产就绪的 FastAPI 项目模板，包含异步模式、依赖注入和全面错误处理",
    version="1.0.0",
    lifespan=lifespan,
)

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 包含 API 路由器
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "欢迎使用 FastAPI 模板项目",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy"}