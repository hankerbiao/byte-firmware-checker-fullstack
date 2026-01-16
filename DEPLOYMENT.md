# 智能固件合规审计系统 - 部署文档

## 目录

- [系统简介](#系统简介)
- [环境要求](#环境要求)
- [快速部署](#快速部署)
- [详细配置](#详细配置)
- [运维管理](#运维管理)
- [故障排查](#故障排查)

---

## 系统简介

智能固件合规审计系统是一个 AI 驱动的 BMC/BIOS 固件包合规性自动检查平台。

### 核心组件

| 组件 | 技术栈 | 端口 | 说明 |
|------|--------|------|------|
| 前端 | React 19 + Vite | 3000 | 用户界面 |
| 后端 | FastAPI + Python | 8000 | API 服务 |
| 数据库 | MongoDB | 27017 | 数据存储 |

---

## 环境要求

### 基础环境

- **Docker**: >= 20.10
- **Docker Compose**: >= 2.0
- **Git**: >= 2.0

### 系统资源

| 资源 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 2 核心 | 4 核心 |
| 内存 | 4 GB | 8 GB |
| 磁盘 | 20 GB | 50 GB |

### 检查 Docker 环境

```bash
# 检查 Docker 版本
docker --version
# 预期输出: Docker version 20.10.x 或更高

# 检查 Docker Compose 版本
docker compose version
# 预期输出: Docker Compose version v2.x.x 或更高

# 验证 Docker 服务状态
docker info
```

---

## 快速部署

### 步骤 1: 克隆项目

```bash
git clone <repository-url>
cd BytesPkgCheck
```

### 步骤 2: 启动服务

```bash
# 构建并启动所有服务 (后台运行)
docker compose up -d --build

# 查看启动状态
docker compose ps
```

### 步骤 4: 验证部署

访问以下地址确认服务正常运行:

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:3000 | 审计系统界面 |
| 后端 API | http://localhost:8000/docs | Swagger API 文档 |
| 健康检查 | http://localhost:8000/health | 后端健康状态 |

```bash
# 单独检查后端健康状态
curl http://localhost:8000/health
# 预期输出: {"status":"ok"}
```

---

## 详细配置

### 服务配置详解

#### MongoDB 服务

```yaml
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"    # 映射到宿主机的端口
    environment:
      MONGO_INITDB_DATABASE: firmware_audit  # 初始化数据库名
    volumes:
      - mongodb_data:/data/db  # 数据持久化
```

**默认配置**:
- 端口: `27017`
- 数据库: `firmware_audit`
- 数据存储: Docker volume `mongodb_data`

#### 后端服务

```yaml
services:
  backend:
    environment:
      # MongoDB 连接字符串
      - MONGO_URI=mongodb://mongodb:27017
      - MONGO_DB_NAME=firmware_audit

      # 审计脚本配置
      - FWAUDIT_SCRIPT_PATH=/app/CheckFWFile_v1.3.1.py
      - FWAUDIT_SCRIPT_TIMEOUT=3600

      # 文件存储配置
      - FWAUDIT_UPLOAD_DIR=/app/uploads
      - FWAUDIT_REPORT_DIR=/app/reports
```

**环境变量说明**:

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MONGO_URI` | `mongodb://mongodb:27017` | MongoDB 连接地址 |
| `MONGO_DB_NAME` | `firmware_audit` | 数据库名称 |
| `FWAUDIT_SCRIPT_PATH` | `/app/CheckFWFile_v1.3.1.py` | 审计脚本路径 |
| `FWAUDIT_SCRIPT_TIMEOUT` | `3600` | 脚本超时时间(秒) |
| `FWAUDIT_UPLOAD_DIR` | `/app/uploads` | 上传文件目录 |
| `FWAUDIT_REPORT_DIR` | `/app/reports` | 报告生成目录 |

### 自定义端口

如需修改默认端口，编辑 `docker-compose.yml`:

```yaml
services:
  mongodb:
    ports:
      - "27018:27017"    # 改为 27018

  backend:
    ports:
      - "8080:8000"      # 改为 8080

  frontend:
    ports:
      - "8081:3000"      # 改为 8081
```

### 持久化目录

项目使用 Docker volume 持久化数据:

```bash
# 查看所有 volume
docker volume ls | grep firmware

# 备份 MongoDB 数据
docker run --rm -v firmware-audit_mongodb_data:/data -v $(pwd)/backup:/backup ubuntu tar czf /backup/mongo-backup.tar.gz -C /data .

# 恢复 MongoDB 数据
docker run --rm -v firmware-audit_mongodb_data:/data -v $(pwd)/backup:/backup ubuntu tar xzf /backup/mongo-backup.tar.gz -C /data .
```

---

## 运维管理

### 服务管理

```bash
# 启动所有服务
docker compose up -d

# 停止所有服务
docker compose down

# 重启所有服务
docker compose restart

# 重启指定服务
docker compose restart backend

# 查看服务日志
docker compose logs -f

# 查看指定服务日志
docker compose logs -f backend
```

### 服务状态检查

```bash
# 检查所有容器运行状态
docker compose ps

# 检查容器资源使用
docker stats

# 检查后端健康状态
curl http://localhost:8000/health
```

### 更新服务

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker compose up -d --build

# 清理旧镜像
docker image prune -f
```

### 日志管理

```bash
# 查看后端日志 (最近 100 行)
docker compose logs --tail=100 backend

# 查看实时日志
docker compose logs -f backend

# 日志轮转配置 (在 /etc/docker/daemon.json 中配置)
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

---

## 故障排查

### 常见问题

#### 1. MongoDB 连接失败

**症状**: 后端日志显示 `pymongo.errors.ServerSelectionTimeoutError`

**排查步骤**:

```bash
# 检查 MongoDB 容器状态
docker compose ps mongodb

# 查看 MongoDB 日志
docker compose logs mongodb

# 测试 MongoDB 连接
docker exec -it firmware-audit-mongodb mongosh --eval "db.runCommand('ping')"
```

**解决方案**:

```bash
# 重启 MongoDB 服务
docker compose restart mongodb
```

#### 2. 后端启动失败

**症状**: 容器状态为 `Exited` 或 `Restarting`

**排查步骤**:

```bash
# 查看后端详细日志
docker compose logs backend

# 检查端口占用
lsof -i :8000
```

**常见原因**:
- MongoDB 未启动完成 (等待健康检查)
- 端口已被占用
- 环境变量配置错误

#### 3. 前端无法访问后端 API

**症状**: 前端界面显示网络错误或 API 请求超时

**排查步骤**:

```bash
# 检查后端是否正常运行
curl http://localhost:8000/docs

# 检查后端 CORS 配置
# 确保允许前端域名访问
```

**解决方案**: 修改 `backend/app/main.py` 中的 CORS 配置:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 修改为前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### 4. 镜像构建失败

**症状**: `docker compose build` 报错

**排查步骤**:

```bash
# 查看详细构建日志
docker compose build --no-cache --progress=verbose
```

**常见原因**:
- 网络问题导致依赖下载失败
- Docker 缓存损坏
- 磁盘空间不足

**解决方案**:

```bash
# 清理 Docker 缓存
docker system prune -a

# 清理磁盘空间
docker volume prune -f
```

### 性能优化建议

1. **MongoDB 性能**:
   - 分配足够内存给 MongoDB 容器
   - 定期清理过期数据

2. **后端性能**:
   - 根据需要调整 `FWAUDIT_SCRIPT_TIMEOUT`
   - 使用工作队列处理长时间任务

3. **前端性能**:
   - 使用生产模式构建 (`NODE_ENV=production`)
   - 配置 CDN 加速静态资源

### 安全建议

1. **修改默认配置**:
   - 设置强密码
   - 限制 CORS 来源
   - 使用 HTTPS

2. **敏感信息管理**:
   - 使用 `.env` 文件管理环境变量
   - 不要将密钥提交到版本控制

3. **网络隔离**:
   - 配置防火墙规则
   - 使用 Docker 网络隔离

---

## 快速参考

### 常用命令速查表

| 命令 | 说明 |
|------|------|
| `docker compose up -d` | 启动所有服务 |
| `docker compose down` | 停止所有服务 |
| `docker compose restart` | 重启所有服务 |
| `docker compose logs -f` | 查看实时日志 |
| `docker compose exec backend sh` | 进入后端容器 |
| `docker compose ps` | 查看服务状态 |
| `curl http://localhost:8000/health` | 健康检查 |

### 端口映射

| 服务 | 容器端口 | 主机端口 |
|------|----------|----------|
| MongoDB | 27017 | 27017 |
| 后端 | 8000 | 8000 |
| 前端 | 3000 | 3000 |

---

## 联系支持

如遇到本文档未覆盖的问题，请:

1. 查看[故障排查](#故障排查)章节
2. 查看项目 Issues
3. 联系系统管理员