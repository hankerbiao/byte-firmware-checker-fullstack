"""
安全相关功能：密码哈希、JWT 令牌处理
"""

from datetime import datetime, timedelta
from typing import Optional, Union, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

# 密码哈希上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT 算法
ALGORITHM = settings.ALGORITHM


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    创建 JWT 访问令牌

    Args:
        data: 要编码的数据
        expires_delta: 过期时间增量

    Returns:
        编码后的 JWT 令牌字符串
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=ALGORITHM
    )
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码

    Args:
        plain_password: 原始密码
        hashed_password: 哈希密码

    Returns:
        密码是否匹配
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    获取密码哈希值

    Args:
        password: 原始密码

    Returns:
        哈希后的密码字符串
    """
    return pwd_context.hash(password)


def verify_token(token: str) -> Optional[Union[str, Any]]:
    """
    验证 JWT 令牌并返回载荷

    Args:
        token: JWT 令牌字符串

    Returns:
        解码后的数据或 None（如果令牌无效）
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        return user_id
    except JWTError:
        return None