"""
用户 Repository
提供用户特定的数据访问操作
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User, UserCreate, UserUpdate]):
    """
    用户 Repository

    扩展基础 Repository，提供用户特定的操作
    """

    async def get_by_email(
        self,
        db: AsyncSession,
        email: str
    ) -> Optional[User]:
        """
        根据邮箱获取用户

        Args:
            db: 数据库会话
            email: 用户邮箱

        Returns:
            找到的用户或 None
        """
        result = await db.execute(
            select(User).where(User.email == email)
        )
        return result.scalars().first()

    async def is_active(self, db: AsyncSession, user_id: int) -> bool:
        """
        检查用户是否活跃

        Args:
            db: 数据库会话
            user_id: 用户 ID

        Returns:
            用户是否活跃
        """
        user = await self.get(db, user_id)
        return user.is_active if user else False

    async def authenticate(
        self,
        db: AsyncSession,
        email: str,
        password: str
    ) -> Optional[User]:
        """
        认证用户（密码验证）

        Args:
            db: 数据库会话
            email: 用户邮箱
            password: 用户密码

        Returns:
            认证成功返回用户，失败返回 None
        """
        from app.core.security import verify_password

        user = await self.get_by_email(db, email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user


# 创建用户 Repository 实例
user_repository = UserRepository(User)