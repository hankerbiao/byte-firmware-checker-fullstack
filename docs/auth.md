# 身份验证实现文档

## 概述

本文档详细说明了智能固件合规审计系统的身份验证实现方案。该系统基于 **JWT (JSON Web Token)** 和 **FastAPI OAuth2** 实现的完整认证授权体系。

## 🔍 认证架构

### 整体设计

```
┌─────────────────────────────────────────────────────────┐
│                    客户端请求                             │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              FastAPI 依赖注入层                           │
│           (get_current_active_user)                     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              JWT Token 验证层                            │
│             (verify_token)                              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              用户服务层                                  │
│            (user_service)                               │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              数据库层                                    │
│              (SQLAlchemy ORM)                           │
└─────────────────────────────────────────────────────────┘
```

## 📋 实现详情

### 1. 依赖注入机制

**文件位置**: `app/api/dependencies.py`

定义了两个核心依赖函数：

```python
# OAuth2 密码 Bearer 令牌模式
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"  # 令牌获取端点
)

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    获取当前认证用户
    验证 JWT 令牌有效性并获取用户信息
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
    检查用户账户是否处于活跃状态
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户账户已被禁用"
        )
    return current_user
```

### 2. JWT Token 实现

**文件位置**: `app/core/security.py`

```python
from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext

# JWT 配置
SECRET_KEY = "your-secret-key"  # 生产环境应使用环境变量
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(
    subject: Union[str, Any], expires_delta: timedelta = None
) -> str:
    """
    创建访问令牌

    Args:
        subject: 用户 ID 或其他标识符
        expires_delta: 令牌过期时间

    Returns:
        JWT 访问令牌
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[str]:
    """
    验证访问令牌

    Args:
        token: JWT 令牌

    Returns:
        用户 ID（令牌有效）或 None（令牌无效）
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        return user_id
    except jwt.JWTError:
        return None


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """获取密码哈希值"""
    return pwd_context.hash(password)
```

### 3. 接口保护示例

**所有需要认证的接口**都使用 `get_current_active_user` 依赖：

```python
@router.get("/", response_model=List[User])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)  # 关键依赖
) -> List[User]:
    """获取用户列表（需要认证）"""
    users = await user_service.repository.get_multi(db, skip, limit)
    return users
```

## 🔄 认证流程

### 1. 用户注册流程

```mermaid
sequenceDiagram
    participant C as 客户端
    participant A as API
    participant D as 数据库

    C->>A: POST /auth/register (email, password, name)
    A->>A: 验证邮箱格式和密码强度
    A->>D: 检查邮箱是否已存在
    D-->>A: 查询结果
    alt 邮箱已存在
        A-->>C: 400 Bad Request
    else 邮箱可用
        A->>A: 密码哈希加密
        A->>D: 创建新用户记录
        D-->>A: 确认创建
        A-->>C: 201 Created (User)
    end
```

### 2. 用户登录流程

```mermaid
sequenceDiagram
    participant C as 客户端
    participant A as API
    participant D as 数据库

    C->>A: POST /auth/login (username=email, password)
    A->>D: 查询用户邮箱
    D-->>A: 用户记录
    alt 用户不存在或密码错误
        A-->>C: 401 Unauthorized
    else 用户存在且密码正确
        A->>A: 验证密码哈希
        A->>A: 创建 JWT 令牌
        A->>A: 检查用户是否活跃
        A-->>C: 200 OK (Token)
    end
```

### 3. 访问受保护接口流程

```mermaid
sequenceDiagram
    participant C as 客户端
    participant A as API
    participant S as 安全模块
    participant D as 数据库

    C->>A: GET /api/v1/items (Authorization: Bearer <token>)
    A->>A: 解析 Authorization 头部
    A->>S: 验证 JWT 令牌 (verify_token)
    S-->>A: 用户 ID 或 None
    alt 令牌无效
        A-->>C: 401 Unauthorized
    else 令牌有效
        A->>D: 根据用户 ID 获取用户信息
        D-->>A: 用户记录
        A->>A: 检查 is_active 状态
        alt 用户未激活
            A-->>C: 400 Bad Request
        else 用户已激活
            A->>A: 执行业务逻辑
            A-->>C: 200 OK (数据)
        end
    end
```

## 📊 接口认证统计

### 总览

| 分类 | 总数 | 需认证 | 无需认证 | 认证比例 |
|------|------|--------|----------|----------|
| 认证路由 | 3 | 1 | 2 | 33.3% |
| 用户路由 | 6 | 6 | 0 | 100% |
| 项目路由 | 6 | 6 | 0 | 100% |
| **总计** | **15** | **13** | **2** | **86.7%** |

### 详细列表

#### 无需认证接口 (2个)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/v1/auth/register` | 用户注册 |
| POST | `/api/v1/auth/login` | 用户登录 |

#### 需认证接口 (13个)

| 方法 | 路径 | 描述 | 权限控制 |
|------|------|------|----------|
| GET | `/api/v1/auth/me` | 获取当前用户 | - |
| GET | `/api/v1/users/` | 获取用户列表 | - |
| GET | `/api/v1/users/{user_id}` | 获取用户 | - |
| GET | `/api/v1/users/me` | 获取当前用户 | - |
| PATCH | `/api/v1/users/{user_id}` | 更新用户 | 仅本人 |
| DELETE | `/api/v1/users/{user_id}` | 删除用户 | 仅本人 |
| POST | `/api/v1/items/` | 创建项目 | - |
| GET | `/api/v1/items/` | 获取项目列表 | - |
| GET | `/api/v1/items/me` | 获取我的项目 | - |
| GET | `/api/v1/items/{item_id}` | 获取项目 | - |
| PATCH | `/api/v1/items/{item_id}` | 更新项目 | 仅创建者 |
| DELETE | `/api/v1/items/{item_id}` | 删除项目 | 仅创建者 |

## 🔐 安全特性

### 1. 令牌安全

- **算法**: HS256 (HMAC + SHA-256)
- **过期时间**: 30分钟
- **传输方式**: HTTP Authorization 头部 (Bearer Token)
- **存储**: 客户端本地存储（建议使用安全存储）

### 2. 密码安全

- **哈希算法**: bcrypt (通过 passlib 实现)
- **加盐**: 自动加盐处理
- **验证**: 客户端输入与存储哈希值比较

### 3. 权限控制

#### 用户级权限
```python
# 用户只能修改自己的信息
if current_user.id != user_id:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="权限不足"
    )
```

#### 项目所有权
```python
# 项目创建者才能修改/删除
if item.owner_id != current_user.id:
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="权限不足"
    )
```

## 🧪 测试认证

### 使用 HTTP 头部

#### 无认证请求（会失败）
```bash
curl http://localhost:8000/api/v1/users/me
# 响应: 401 Unauthorized
```

#### 带认证请求（成功）
```bash
# 1. 先登录获取 token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com&password=secret123"

# 2. 使用 token 访问
curl http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Python 测试示例

```python
from httpx import AsyncClient

async def test_authentication():
    async with AsyncClient() as client:
        # 1. 注册
        register_response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "password": "secret123",
                "name": "Test User"
            }
        )

        # 2. 登录
        login_response = await client.post(
            "/api/v1/auth/login",
            data={
                "username": "test@example.com",
                "password": "secret123"
            }
        )

        token = login_response.json()["access_token"]

        # 3. 访问受保护接口
        user_response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        print(user_response.json())
```

## 🚀 最佳实践

### 1. 前端集成

```typescript
// API 客户端封装
class ApiClient {
  private token: string | null = null;

  async login(email: string, password: string) {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: email, password })
    });

    const data = await response.json();
    this.token = data.access_token;
    localStorage.setItem('token', this.token);
  }

  async getUsers() {
    const response = await fetch('/api/v1/users/', {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });
    return response.json();
  }
}
```

### 2. Token 管理

```typescript
// Token 过期处理
class AuthManager {
  async request(url: string, options: RequestInit = {}) {
    const token = this.getToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });

    // Token 过期检测
    if (response.status === 401) {
      this.refreshToken();
      return this.request(url, options);
    }

    return response;
  }
}
```

### 3. 安全建议

1. **生产环境配置**
   - 使用强 SECRET_KEY（建议 32+ 字符随机字符串）
   - 启用 HTTPS 传输
   - 设置合理的 Token 过期时间
   - 使用环境变量存储敏感信息

2. **密码策略**
   - 最小长度：8 字符
   - 复杂度要求：数字、大小写字母、特殊字符
   - 定期密码更新提醒

3. **防护措施**
   - 登录失败次数限制
   - 账户锁定机制
   - 审计日志记录
   - JWT 刷新机制（可选）

## 📝 环境配置

### .env 配置示例

```bash
# JWT 配置
SECRET_KEY=your-very-secure-secret-key-min-32-chars
ACCESS_TOKEN_EXPIRE_MINUTES=30

# 数据库配置
DATABASE_URL=sqlite+aiosqlite:///./app.db

# 其他配置
ALGORITHM=HS256
```

## 🎯 总结

本系统实现了完整的 JWT 认证授权体系，具有以下特点：

✅ **安全可靠**: 使用业界标准的 JWT + bcrypt 方案
✅ **架构清晰**: 依赖注入 + 装饰器模式
✅ **职责分离**: API 层、服务层、仓储层明确分工
✅ **易于测试**: 依赖注入便于单元测试
✅ **权限细粒度**: 支持用户级和资源级权限控制
✅ **符合规范**: 遵循 OAuth 2.0 和 JWT 标准

通过 FastAPI 的强大依赖注入机制，实现了简洁、安全、可维护的认证系统。