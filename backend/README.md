# FastAPI 模板项目

这是一个生产就绪的 FastAPI 项目模板，遵循最佳实践，包含异步模式、依赖注入和全面的错误处理。

## 功能特性

- ✅ 异步/等待模式
- ✅ 依赖注入
- ✅ Repository 模式
- ✅ Service 层
- ✅ 用户认证与授权（JWT）
- ✅ 用户管理 API
- ✅ 项目管理 API
- ✅ 完整的测试套件
- ✅ Pydantic 数据验证
- ✅ SQLAlchemy ORM
- ✅ SQLite/PostgreSQL 支持

## 项目结构

```
app/
├── api/                    # API 路由
│   ├── v1/
│   │   ├── endpoints/
│   │   │   ├── auth.py    # 认证端点
│   │   │   ├── users.py   # 用户端点
│   │   │   └── items.py   # 项目端点
│   │   └── router.py      # 主路由器
│   └── dependencies.py    # 共享依赖
├── core/                   # 核心功能
│   ├── config.py          # 配置
│   ├── database.py        # 数据库连接
│   └── security.py        # 安全相关
├── models/                 # 数据库模型
│   ├── user.py
│   └── item.py
├── schemas/                # Pydantic 模式
│   ├── user.py
│   └── item.py
├── services/               # 业务逻辑
│   ├── user_service.py
│   └── item_service.py
├── repositories/           # 数据访问层
│   ├── base_repository.py
│   ├── user_repository.py
│   └── item_repository.py
└── main.py                 # 应用入口

tests/                      # 测试
├── conftest.py
├── test_auth.py
├── test_users.py
└── test_items.py
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境

复制环境变量文件并修改：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置你的 `SECRET_KEY` 等配置。

### 3. 运行应用

```bash
# 开发模式
uvicorn app.main:app --reload

# 或者
python -m uvicorn app.main:app --reload
```

### 4. 访问应用

- API 文档: http://localhost:8000/docs
- ReDoc 文档: http://localhost:8000/redoc
- 健康检查: http://localhost:8000/health

## API 端点

### 认证端点

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `GET /api/v1/auth/me` - 获取当前用户

### 用户端点

- `GET /api/v1/users/me` - 获取当前用户
- `GET /api/v1/users/` - 获取用户列表
- `GET /api/v1/users/{user_id}` - 获取用户详情
- `PATCH /api/v1/users/{user_id}` - 更新用户
- `DELETE /api/v1/users/{user_id}` - 删除用户

### 项目端点

- `POST /api/v1/items/` - 创建项目
- `GET /api/v1/items/` - 获取项目列表
- `GET /api/v1/items/me` - 获取我的项目
- `GET /api/v1/items/{item_id}` - 获取项目详情
- `PATCH /api/v1/items/{item_id}` - 更新项目
- `DELETE /api/v1/items/{item_id}` - 删除项目

## 使用示例

### 注册用户

```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "张三"
  }'
```

### 登录

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'username=user@example.com&password=password123'
```

### 获取用户信息

```bash
curl -X GET "http://localhost:8000/api/v1/users/me" \
  -H "Authorization: Bearer {token}"
```

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并查看详细输出
pytest -v

# 运行特定测试文件
pytest tests/test_auth.py -v

# 运行测试并生成覆盖率报告
pytest --cov=app tests/
```

## 数据库配置

### SQLite（默认）

默认使用 SQLite，适合开发和测试：

```bash
DATABASE_URL="sqlite+aiosqlite:///./app.db"
```

### PostgreSQL（生产环境推荐）

```bash
DATABASE_URL="postgresql+asyncpg://user:password@localhost:5432/dbname"
```

## 生产环境部署

### 使用 Gunicorn

```bash
gunicorn app.main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 使用 Docker

创建 `Dockerfile`：

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

构建和运行：

```bash
docker build -t fastapi-template .
docker run -p 8000:8000 fastapi-template
```

## 最佳实践

1. **异步所有操作**：数据库、外部 API 调用都使用 async/await
2. **依赖注入**：利用 FastAPI 的 Depends 系统
3. **Repository 模式**：将数据访问逻辑与业务逻辑分离
4. **Service 层**：封装复杂的业务逻辑
5. **类型提示**：充分利用 FastAPI 的类型检查
6. **错误处理**：统一处理异常和错误响应
7. **测试**：编写全面的单元测试和集成测试

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 参考资料

- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [SQLAlchemy 文档](https://docs.sqlalchemy.org/)
- [Pydantic 文档](https://docs.pydantic.dev/)