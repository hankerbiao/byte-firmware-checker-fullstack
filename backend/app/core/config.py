"""
应用程序配置设置
"""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用程序设置类"""
    # 应用基本配置
    APP_NAME: str = "FastAPI 模板项目"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # 数据库配置
    DATABASE_URL: str = "sqlite+aiosqlite:///./app.db"
    # PostgreSQL 示例: postgresql+asyncpg://user:password@localhost:5432/dbname

    # JWT 安全配置
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # API 配置
    API_V1_STR: str = "/api/v1"

    # 密码哈希配置
    PWD_CONTEXT: str = "bcrypt"

    class Config:
        """Pydantic 配置"""
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """获取缓存的设置实例"""
    return Settings()


# 创建全局设置实例
settings = get_settings()