"""
API 依赖
提供认证和权限相关的依赖函数
"""

from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import verify_token
from app.services.user_service import user_service
from app.schemas.user import User, Token

# OAuth2 密码 Bearer 令牌模式
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    获取当前认证用户

    Args:
        db: 数据库会话
        token: JWT 令牌

    Returns:
        当前用户

    Raises:
        HTTPException: 令牌无效或用户不存在
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 验证令牌并获取用户 ID
    user_id = verify_token(token)
    if user_id is None:
        raise credentials_exception

    # 获取用户
    user = await user_service.get_user(db, int(user_id))
    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    获取当前活跃用户

    Args:
        current_user: 当前用户

    Returns:
        当前活跃用户

    Raises:
        HTTPException: 用户不活跃
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户账户已被禁用"
        )
    return current_user