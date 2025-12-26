"""
测试配置和夹具
为测试提供数据库、客户端等资源
"""

import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings

# 测试数据库配置
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_db():
    """创建测试数据库"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 创建测试会话工厂
    AsyncTestingSessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=True,
        autocommit=False,
    )

    yield AsyncTestingSessionLocal

    # 清理
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(test_db):
    """创建数据库会话"""
    async with test_db() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    """创建测试客户端"""
    async def override_get_db():
        yield db_session

    # 覆盖依赖
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

    # 清理覆盖
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session):
    """创建测试用户"""
    from app.services.user_service import user_service
    from app.schemas.user import UserCreate

    user_data = UserCreate(
        email="test@example.com",
        password="testpass123",
        name="Test User"
    )

    user = await user_service.create_user(db_session, user_data)
    return user