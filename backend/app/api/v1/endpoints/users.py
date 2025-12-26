"""
用户路由
处理用户相关的 API 端点
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.user_service import user_service
from app.api.dependencies import get_current_active_user
from app.schemas.user import User, UserUpdate

router = APIRouter()


@router.get(
    "/me",
    response_model=User,
    summary="获取当前用户",
    description="获取当前认证用户的详细信息"
)
async def read_users_me(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    获取当前用户信息

    返回当前登录用户的完整信息

    需要在请求头中包含：
    - **Authorization**: Bearer {token}
    """
    return current_user


@router.get(
    "/",
    response_model=List[User],
    summary="获取用户列表",
    description="获取所有用户列表（需要认证）"
)
async def read_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> List[User]:
    """
    获取用户列表

    - **skip**: 跳过的记录数（分页）
    - **limit**: 返回的最大记录数（默认 100）

    需要在请求头中包含：
    - **Authorization**: Bearer {token}
    """
    users = await user_service.repository.get_multi(db, skip, limit)
    return users


@router.get(
    "/{user_id}",
    response_model=User,
    summary="获取用户",
    description="根据 ID 获取用户信息"
)
async def read_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    根据 ID 获取用户

    - **user_id**: 用户 ID

    需要在请求头中包含：
    - **Authorization**: Bearer {token}
    """
    user = await user_service.get_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户未找到"
        )
    return user


@router.patch(
    "/{user_id}",
    response_model=User,
    summary="更新用户",
    description="更新用户信息"
)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    更新用户信息

    - **user_id**: 用户 ID
    - **user_in**: 要更新的用户数据

    需要在请求头中包含：
    - **Authorization**: Bearer {token}

    注意：用户只能更新自己的信息
    """
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足"
        )

    user = await user_service.update_user(db, user_id, user_in)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户未找到"
        )
    return user


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除用户",
    description="删除用户账户"
)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    删除用户

    - **user_id**: 用户 ID

    需要在请求头中包含：
    - **Authorization**: Bearer {token}

    注意：用户只能删除自己的账户
    """
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足"
        )

    deleted = await user_service.repository.delete(db, user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户未找到"
        )