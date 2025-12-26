# 数据库操作指南

本文档详细介绍了智能固件合规审计系统的数据库设计和操作方法。

## 目录

1. [数据库概述](#数据库概述)
2. [数据库模型](#数据库模型)
3. [Repository 模式](#repository-模式)
4. [数据库连接](#数据库连接)
5. [CRUD 操作](#crud-操作)
6. [事务管理](#事务管理)
7. [数据库初始化](#数据库初始化)
8. [测试数据库](#测试数据库)
9. [常用命令](#常用命令)

---

## 数据库概述

### 技术栈

- **数据库引擎**：SQLAlchemy 2.0（异步）
- **数据库驱动**：
  - 开发：aiosqlite（SQLite 异步驱动）
- **ORM**：SQLAlchemy Async ORM
- **连接池**：StaticPool（SQLite）

### 数据库类型

| 环境 | 数据库 | 连接字符串 | 用途 |
|------|--------|------------|------|
| 开发 | SQLite | `sqlite+aiosqlite:///./app.db` | 本地开发，轻量级 |
| 测试 | SQLite | `sqlite+aiosqlite:///./test.db` | 单元测试，内存或文件 |

---

## 数据库模型

### 用户模型（User）

**位置**：`app/models/user.py`

```python
class User(Base):
    """用户模型"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
```

**字段说明**：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | Integer | PK, Auto | 主键，自增 |
| `email` | String(255) | Unique, Index | 用户邮箱（唯一索引） |
| `hashed_password` | String(255) | Not Null | 哈希密码 |
| `name` | String(255) | Not Null | 用户姓名 |
| `is_active` | Boolean | Default=True | 是否激活账户 |
| `created_at` | DateTime | Default=now() | 创建时间 |
| `updated_at` | DateTime | Default=now(), onupdate=now() | 更新时间 |

### 项目模型（Item）

**位置**：`app/models/item.py`

```python
class Item(Base):
    """项目模型"""
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(String(500), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 关系
    owner = relationship("User", back_populates="items")
```

**字段说明**：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | Integer | PK, Auto | 主键，自增 |
| `title` | String(255) | Not Null, Index | 项目标题 |
| `description` | String(500) | Nullable | 项目描述 |
| `owner_id` | Integer | FK → users.id | 外键，关联用户 |
| `is_active` | Boolean | Default=True | 是否激活 |
| `created_at` | DateTime | Default=now() | 创建时间 |
| `updated_at` | DateTime | Default=now(), onupdate=now() | 更新时间 |

### 模型关系

```
User (1) ──── (N) Item
```

- 一个用户可以有多个项目
- 项目通过 `owner_id` 外键关联用户

---

## Repository 模式

### 概述

Repository 模式是一种数据访问层设计模式，封装了所有数据库操作逻辑，提供统一的接口供业务层调用。

**优势**：
- 解耦业务逻辑与数据访问
- 便于单元测试
- 代码复用
- 易于维护和扩展

### BaseRepository 实现

**位置**：`app/repositories/base_repository.py`

```python
class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """基础 Repository 类"""

    def __init__(self, model: Type[ModelType]):
        self.model = model

    # 核心方法：
    # - get(id)          : 根据 ID 获取单条记录
    # - get_multi()      : 获取多条记录（支持分页）
    # - create()         : 创建新记录
    # - update()         : 更新记录
    # - delete()         : 删除记录
    # - count()          : 统计记录总数
```

### 具体实现

#### 用户仓库（UserRepository）

**位置**：`app/repositories/user_repository.py`

```python
class UserRepository(BaseRepository[User, UserCreate, UserUpdate]):
    """用户仓库"""

    def __init__(self):
        super().__init__(User)
```

#### 项目仓库（ItemRepository）

**位置**：`app/repositories/item_repository.py`

```python
class ItemRepository(BaseRepository[Item, ItemCreate, ItemUpdate]):
    """项目仓库"""

    def __init__(self):
        super().__init__(Item)

    async def get_by_owner(
        self,
        db: AsyncSession,
        owner_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[Item]:
        """获取指定用户的所有项目"""
        result = await db.execute(
            select(self.model)
            .where(self.model.owner_id == owner_id)
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()
```

---

## 数据库连接

### 核心组件

**位置**：`app/core/database.py`

```python
# 1. 异步引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    poolclass=StaticPool if "sqlite" in settings.DATABASE_URL else None,
)

# 2. 会话工厂
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False,
)

# 3. 基础模型类
Base = declarative_base()

# 4. 依赖注入函数
async def get_db() -> AsyncSession:
    """获取数据库会话（依赖注入）"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### 连接池配置

#### SQLite（StaticPool）

```python
# 适用于单线程应用
poolclass=StaticPool
```

- **特点**：固定大小连接池
- **优势**：轻量级，无需额外配置
- **适用**：开发、测试环境

#### PostgreSQL（QueuePool）

```python
# 默认使用 QueuePool
# 无需显式配置
```

- **特点**：队列式连接池
- **优势**：支持多线程，性能高
- **适用**：生产环境

### 生命周期管理

**位置**：`app/main.py`

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用程序生命周期"""
    # 启动时：SQLAlchemy 引擎自动管理连接池
    yield
    # 关闭时：清理连接池资源
    await engine.dispose()
```

**⚠️ 重要**：必须调用 `engine.dispose()` 确保连接池资源正确释放，避免数据库连接泄漏。

---

## CRUD 操作

### 通用操作

所有模型都继承自 `BaseRepository`，提供以下通用方法：

#### 1. 读取单条记录（Get）

```python
async def get(self, db: AsyncSession, id: int) -> Optional[ModelType]:
    """根据 ID 获取记录"""
    result = await db.execute(
        select(self.model).where(self.model.id == id)
    )
    return result.scalars().first()
```

**使用示例**：

```python
# 在路由中
@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    user_repo = UserRepository()
    user = await user_repo.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user
```

#### 2. 读取多条记录（Get Multi）

```python
async def get_multi(
    self,
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100
) -> List[ModelType]:
    """获取多个记录（分页）"""
    result = await db.execute(
        select(self.model).offset(skip).limit(limit)
    )
    return result.scalars().all()
```

**使用示例**：

```python
@router.get("/items/")
async def get_items(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    item_repo = ItemRepository()
    items = await item_repo.get_multi(db, skip=skip, limit=limit)
    return items
```

#### 3. 创建记录（Create）

```python
async def create(
    self,
    db: AsyncSession,
    obj_in: CreateSchemaType
) -> ModelType:
    """创建新记录"""
    db_obj = self.model(**obj_in.model_dump())
    db.add(db_obj)
    await db.flush()
    await db.refresh(db_obj)
    return db_obj
```

**使用示例**：

```python
@router.post("/users/")
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    user_repo = UserRepository()
    user = await user_repo.create(db, user_data)
    return user
```

**注意**：
- `model_dump()`：Pydantic v2 方法，将模型转换为字典
- `flush()`：刷新变更到数据库，但未提交
- `refresh()`：从数据库重新加载对象，获取生成的主键

#### 4. 更新记录（Update）

```python
async def update(
    self,
    db: AsyncSession,
    db_obj: ModelType,
    obj_in: UpdateSchemaType
) -> ModelType:
    """更新记录"""
    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    await db.flush()
    await db.refresh(db_obj)
    return db_obj
```

**使用示例**：

```python
@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db)
):
    user_repo = UserRepository()
    user = await user_repo.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    updated_user = await user_repo.update(db, user, user_data)
    return updated_user
```

#### 5. 删除记录（Delete）

```python
async def delete(self, db: AsyncSession, id: int) -> bool:
    """删除记录"""
    obj = await self.get(db, id)
    if obj:
        await db.delete(obj)
        return True
    return False
```

**使用示例**：

```python
@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    user_repo = UserRepository()
    success = await user_repo.delete(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"message": "删除成功"}
```

#### 6. 统计总数（Count）

```python
async def count(self, db: AsyncSession) -> int:
    """计算记录总数"""
    result = await db.execute(select(self.model))
    return len(result.scalars().all())
```

### 自定义查询

#### 根据条件查询

```python
# 在 Repository 中添加自定义方法
class ItemRepository(BaseRepository[Item, ItemCreate, ItemUpdate]):
    async def get_by_owner(
        self,
        db: AsyncSession,
        owner_id: int
    ) -> List[Item]:
        """获取指定用户的所有项目"""
        result = await db.execute(
            select(self.model)
            .where(self.model.owner_id == owner_id)
            .order_by(self.model.created_at.desc())
        )
        return result.scalars().all()

    async def search(
        self,
        db: AsyncSession,
        keyword: str
    ) -> List[Item]:
        """搜索项目"""
        result = await db.execute(
            select(self.model)
            .where(self.model.title.contains(keyword))
        )
        return result.scalars().all()
```

#### 复杂查询示例

```python
# 获取活跃用户的前 10 个项目
async def get_active_user_items(
    db: AsyncSession,
    user_id: int
) -> List[Item]:
    result = await db.execute(
        select(Item)
        .join(User)  # 内连接
        .where(
            and_(
                Item.owner_id == user_id,
                Item.is_active == True,
                User.is_active == True
            )
        )
        .order_by(Item.created_at.desc())
        .limit(10)
    )
    return result.scalars().all()
```

---

## 事务管理

### 自动事务处理

在 `get_db()` 依赖注入函数中，已经内置了事务管理：

```python
async def get_db() -> AsyncSession:
    """获取数据库会话（自动事务管理）"""
    async with AsyncSessionLocal() as session:
        try:
            yield session  # 使用会话
            await session.commit()  # 成功则提交
        except Exception:
            await session.rollback()  # 失败则回滚
            raise
        finally:
            await session.close()  # 始终关闭会话
```

### 手动事务控制

对于需要显式控制的场景：

```python
@router.post("/items/batch")
async def create_items_batch(
    items_data: List[ItemCreate],
    db: AsyncSession = Depends(get_db)
):
    try:
        # 手动开始事务
        for item_data in items_data:
            item_repo = ItemRepository()
            await item_repo.create(db, item_data)

        # 手动提交
        await db.commit()
        return {"message": "批量创建成功"}
    except Exception as e:
        # 回滚所有更改
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
```

### 并发控制

```python
# 乐观锁示例（使用 version 字段）
class VersionedItem(Base):
    __tablename__ = "versioned_items"

    id = Column(Integer, primary_key=True)
    title = Column(String(255))
    version = Column(Integer, default=1)  # 版本号
    updated_at = Column(DateTime)

async def update_with_version(
    db: AsyncSession,
    item_id: int,
    new_title: str,
    expected_version: int
) -> VersionedItem:
    # 获取当前记录
    item = await db.get(VersionedItem, item_id)

    # 检查版本号
    if item.version != expected_version:
        raise HTTPException(
            status_code=409,
            detail="记录已被其他用户修改"
        )

    # 更新并增加版本号
    item.title = new_title
    item.version += 1

    await db.flush()
    return item
```

---

## 数据库初始化

### 启动时自动初始化

推荐使用 `run.py` 启动应用：

```bash
cd backend
python run.py
```

**内部流程**：

```python
# run.py
async def init_db():
    """初始化数据库"""
    await create_tables()

if __name__ == "__main__":
    import asyncio

    # 1. 初始化数据库
    asyncio.run(init_db())

    # 2. 启动服务器
    uvicorn.run(...)
```

### 表创建函数

**位置**：`app/core/database.py`

```python
async def create_tables():
    """创建所有数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

### 表删除函数

```python
async def drop_tables():
    """删除所有数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

### 手动初始化

```bash
# 方式 1：使用 run.py
python run.py

# 方式 2：使用 Makefile
make run

# 方式 3：直接使用 uvicorn（不会自动创建表）
uvicorn app.main:app --reload
```

### 迁移管理

**当前未使用 Alembic**，建议在生产环境中集成：

```bash
# 安装 Alembic
pip install alembic

# 初始化迁移环境
alembic init migrations

# 生成迁移文件
alembic revision --autogenerate -m "添加用户表"

# 应用迁移
alembic upgrade head
```

---

## 测试数据库

### 测试配置

**位置**：`backend/pytest.ini`

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
addopts = -v
markers =
    unit: 单元测试
    integration: 集成测试
    slow: 慢速测试
```

### 测试夹具（Fixtures）

**位置**：`backend/tests/conftest.py`

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal, engine
from app.main import app
from httpx import AsyncClient

@pytest.fixture
async def db():
    """测试数据库会话"""
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()
        await session.close()

@pytest.fixture
async def client(db):
    """测试客户端"""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def test_user(db: AsyncSession):
    """测试用户"""
    from app.models.user import User
    from app.schemas.user import UserCreate
    from app.repositories.user_repository import UserRepository

    user_data = UserCreate(
        email="test@example.com",
        password="testpass",
        name="Test User"
    )
    repo = UserRepository()
    return await repo.create(db, user_data)
```

### 内存数据库测试

测试使用独立的 SQLite 数据库：

```python
# conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

# 使用内存数据库
SQLITE_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_engine(
    SQLITE_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
```

### 运行测试

```bash
# 运行所有测试
make test

# 运行测试并生成覆盖率报告
make test-cov

# 运行特定测试
pytest tests/test_auth.py -v

# 运行特定标记的测试
pytest -m unit
pytest -m integration
```

---

## 常用命令

### 开发环境

```bash
# 进入后端目录
cd backend

# 安装依赖
make install

# 启动开发服务器（自动初始化数据库）
python run.py
# 或
make run

# 代码检查
make lint

# 代码格式化
make format
```

### 数据库操作

```bash
# 查看数据库文件
ls -lh app.db

# 查看数据库表
sqlite3 app.db ".tables"

# 查看表结构
sqlite3 app.db ".schema users"

# 查看表数据
sqlite3 app.db "SELECT * FROM users;"

# 重置数据库（删除所有数据）
make clean
```

### Docker 操作

```bash
# 生产环境（PostgreSQL）
docker-compose up -d

# 开发环境（热重载）
docker-compose -f docker-compose.dev.yml up

# 构建镜像
make docker-build

# 查看日志
docker-compose logs -f app
```

### 测试操作

```bash
# 运行所有测试
make test

# 运行测试并查看覆盖率
make test-cov

# 运行特定测试文件
pytest tests/test_auth.py -v

# 运行特定测试函数
pytest tests/test_users.py::test_create_user -v

# 生成 HTML 覆盖率报告
pytest --cov=app --cov-report=html
# 报告位置：htmlcov/index.html
```

---

## 性能优化

### 1. 数据库索引

```python
# 已创建的索引
class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)  # 索引

# 手动创建复合索引
class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True)
    owner_id = Column(Integer, index=True)
    is_active = Column(Boolean, index=True)

# 创建复合索引
__table_args__ = (
    Index('idx_owner_active', 'owner_id', 'is_active'),
)
```

### 2. 查询优化

```python
# 避免 N+1 查询（使用 join）
async def get_items_with_owner(db: AsyncSession):
    result = await db.execute(
        select(Item, User)  # 选择多个模型
        .join(User, Item.owner_id == User.id)  # 连接
        .options(selectinload(Item.owner))  # 预加载关系
    )
    return result.all()

# 分页查询
async def get_items_paginated(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20
):
    skip = (page - 1) * page_size
    result = await db.execute(
        select(Item)
        .offset(skip)
        .limit(page_size)
        .order_by(Item.created_at.desc())
    )
    return result.scalars().all()
```

### 3. 连接池调优

```python
# PostgreSQL 生产环境配置
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,          # 连接池大小
    max_overflow=30,       # 最大溢出连接
    pool_timeout=30,       # 获取连接超时时间（秒）
    pool_recycle=3600,     # 连接回收时间（秒）
    pool_pre_ping=True,    # 连接预检
)
```

### 4. 读写分离

```python
# 主从复制配置
DATABASE_MASTER_URL = "postgresql+asyncpg://user:pass@master:5432/db"
DATABASE_SLAVE_URL = "postgresql+asyncpg://user:pass@slave:5432/db"

# 主引擎（写入）
master_engine = create_async_engine(DATABASE_MASTER_URL)

# 从引擎（读取）
slave_engine = create_async_engine(DATABASE_SLAVE_URL)

# 使用示例
async def create_user(db: AsyncSession):  # 写入（主）
    ...

async def get_user(user_id: int):  # 读取（从）
    with slave_engine.begin() as conn:
        ...
```

---

## 故障排除

### 1. 连接池耗尽

**错误**：```sqlalchemy.pool.PoolTimeout: QueuePool limit of size 10 overflow 10 reached```

**解决方案**：

```python
# 增加连接池大小
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=30,
)
```

### 2. 数据库锁

**错误**：```database is locked```

**解决方案**：

```python
# SQLite 配置
engine = create_async_engine(
    "sqlite+aiosqlite:///./app.db",
    poolclass=StaticPool,
    connect_args={"check_same_thread": False}  # 允许跨线程
)
```

### 3. 事务超时

**错误**：```sqlalchemy.exc.TimeoutError```

**解决方案**：

```python
# 设置事务超时时间
async with db.begin() as transaction:
    db.expire_on_commit = False
    # ... 操作 ...
    await transaction.commit(timeout=30)
```

### 4. 乐观锁冲突

**错误**：```sqlalchemy.exc.IntegrityError```

**解决方案**：

```python
# 使用重试机制
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
async def update_with_retry():
    # 更新操作
    ...
```

---

## 最佳实践

### 1. 代码组织

```
app/
├── models/          # 数据模型
│   ├── __init__.py
│   ├── user.py      # 用户模型
│   └── item.py      # 项目模型
│
├── schemas/         # Pydantic 模式
│   ├── __init__.py
│   ├── user.py      # 用户模式
│   └── item.py      # 项目模式
│
├── repositories/    # 数据访问层
│   ├── __init__.py
│   ├── base_repository.py
│   ├── user_repository.py
│   └── item_repository.py
│
├── services/        # 业务逻辑层
│   ├── __init__.py
│   ├── user_service.py
│   └── item_service.py
│
└── api/            # 接口层
    ├── v1/
    │   ├── endpoints/
    │   │   ├── auth.py
    │   │   ├── users.py
    │   │   └── items.py
    │   └── router.py
    └── dependencies.py
```

### 2. 依赖注入

```python
# 正确的依赖注入
@router.post("/items/")
async def create_item(
    item_data: ItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item_repo = ItemRepository()
    item = await item_repo.create(
        db,
        ItemCreate(**item_data.model_dump(), owner_id=current_user.id)
    )
    return item
```

### 3. 错误处理

```python
@router.get("/items/{item_id}")
async def get_item(
    item_id: int,
    db: AsyncSession = Depends(get_db)
):
    item_repo = ItemRepository()
    item = await item_repo.get(db, item_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"项目 ID {item_id} 不存在"
        )

    return item
```

### 4. 数据验证

```python
# 在模式中使用验证
from pydantic import validator, Field

class UserCreate(BaseModel):
    email: str = Field(..., regex=r'^[^@]+@[^@]+\.[^@]+$')
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1, max_length=50)

    @validator('email')
    def validate_email(cls, v):
        if '@' not in v:
            raise ValueError('邮箱格式无效')
        return v.lower()
```

### 5. 日志记录

```python
import logging

logger = logging.getLogger(__name__)

@router.post("/items/")
async def create_item(
    item_data: ItemCreate,
    db: AsyncSession = Depends(get_db)
):
    try:
        item_repo = ItemRepository()
        item = await item_repo.create(db, item_data)
        logger.info(f"成功创建项目 ID: {item.id}")
        return item
    except Exception as e:
        logger.error(f"创建项目失败: {str(e)}")
        raise
```

---

## 总结

本系统使用 **SQLAlchemy 2.0 异步 ORM** + **Repository 模式** 构建数据库访问层，提供：

- ✅ **类型安全**：Pydantic 模式验证
- ✅ **异步操作**：高性能非阻塞 I/O
- ✅ **事务管理**：自动提交/回滚
- ✅ **连接池**：优化数据库连接
- ✅ **Repository 模式**：解耦业务逻辑
- ✅ **测试友好**：独立测试数据库

通过本指南，您可以快速掌握系统的数据库设计和操作方法。如有疑问，请参考 [SQLAlchemy 官方文档](https://docs.sqlalchemy.org/)。

---

**文档更新日期**：2025-12-26
**版本**：v1.0.0