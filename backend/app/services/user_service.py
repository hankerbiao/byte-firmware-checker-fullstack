"""
用户 Service
处理用户相关的业务逻辑
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_repository import user_repository
from app.schemas.user import UserCreate, UserUpdate, User
from app.core.security import get_password_hash, create_access_token
from app.core.config import settings
from datetime import timedelta


class UserService:
    """
    用户 Service

    处理用户注册、认证、更新等业务逻辑
    """

    def __init__(self):
        """初始化 Service"""
        self.repository = user_repository

    async def create_user(
        self,
        db: AsyncSession,
        user_in: UserCreate
    ) -> User:
        """
        创建新用户

        Args:
            db: 数据库会话
            user_in: 用户创建数据

        Returns:
            创建的用户

        Raises:
            ValueError: 如果邮箱已存在
        """
        # 检查邮箱是否已存在
        existing = await self.repository.get_by_email(db, user_in.email)
        if existing:
            raise ValueError("邮箱已被注册")

        # 转换数据并设置密码哈希
        user_dict = user_in.model_dump()
        password = user_dict.pop("password")
        user_dict["hashed_password"] = get_password_hash(password)

        # 创建用户
        user = await self.repository.create(db, UserCreate(**user_dict))
        return user

    async def authenticate(
        self,
        db: AsyncSession,
        email: str,
        password: str
    ) -> Optional[User]:
        """
        认证用户

        Args:
            db: 数据库会话
            email: 用户邮箱
            password: 用户密码

        Returns:
            认证成功返回用户，失败返回 None
        """
        return await self.repository.authenticate(db, email, password)

    async def get_user(
        self,
        db: AsyncSession,
        user_id: int
    ) -> Optional[User]:
        """
        获取用户

        Args:
            db: 数据库会话
            user_id: 用户 ID

        Returns:
            找到的用户或 None
        """
        return await self.repository.get(db, user_id)

    async def update_user(
        self,
        db: AsyncSession,
        user_id: int,
        user_in: UserUpdate
    ) -> Optional[User]:
        """
        更新用户

        Args:
            db: 数据库会话
            user_id: 用户 ID
            user_in: 用户更新数据

        Returns:
            更新后的用户或 None
        """
        user = await self.repository.get(db, user_id)
        if not user:
            return None

        # 如果更新密码，先哈希密码
        if user_in.password:
            user_dict = user_in.model_dump(exclude_unset=True)
            user_dict["hashed_password"] = get_password_hash(
                user_dict.pop("password")
            )
            user_in = UserUpdate(**user_dict)

        return await self.repository.update(db, user, user_in)

    async def create_access_token(
        self,
        user_id: int
    ) -> str:
        """
        创建访问令牌

        Args:
            user_id: 用户 ID

        Returns:
            JWT 访问令牌
        """
        return create_access_token(
            data={"sub": str(user_id)},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )


# 创建用户 Service 实例
user_service = UserService()