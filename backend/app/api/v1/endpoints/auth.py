"""
认证路由
处理用户登录、注册等认证相关操作
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.services.user_service import user_service
from app.schemas.user import UserCreate, User, Token
from app.api.dependencies import get_current_active_user

router = APIRouter()


@router.post(
    "/register",
    response_model=User,
    status_code=status.HTTP_201_CREATED,
    summary="用户注册",
    description="创建新用户账户"
)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    用户注册

    - **email**: 用户邮箱（必须是有效邮箱格式）
    - **password**: 用户密码（至少 6 位字符）
    - **name**: 用户姓名
    """
    try:
        user = await user_service.create_user(db, user_in)
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post(
    "/login",
    response_model=Token,
    summary="用户登录",
    description="登录并获取访问令牌"
)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
) -> Token:
    """
    用户登录

    使用 OAuth2 密码模式提交表单：
    - **username**: 邮箱地址
    - **password**: 密码
    """
    user = await user_service.authenticate(
        db,
        email=form_data.username,
        password=form_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户账户已被禁用"
        )

    # 创建访问令牌
    access_token = await user_service.create_access_token(user.id)

    return Token(
        access_token=access_token,
        token_type="bearer"
    )


@router.get(
    "/me",
    response_model=User,
    summary="获取当前用户",
    description="获取当前认证用户的信息"
)
async def read_users_me(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    获取当前用户信息

    需要在请求头中包含：
    - **Authorization**: Bearer {token}
    """
    return current_user