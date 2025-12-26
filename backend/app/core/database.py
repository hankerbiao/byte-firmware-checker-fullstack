"""
数据库连接和会话管理
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.pool import StaticPool

from app.core.config import settings

# 创建异步数据库引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    # SQLite 特定配置
    poolclass=StaticPool if "sqlite" in settings.DATABASE_URL else None,
)

# 创建异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False,
)

# 创建基础模型类
Base = declarative_base()

# 全局数据库连接引用（用于生命周期管理）
database = engine


async def get_db() -> AsyncSession:
    """
    依赖注入函数：获取数据库会话

    使用 Depends 在路由中使用：
        async def route(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    """创建所有数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_tables():
    """删除所有数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)