# 智能固件合规审计系统 - 源码运行

## 环境要求

- Python 3.12 或更高，推荐使用 [uv](https://docs.astral.sh/uv/)
- Node.js 20 或更高，并启用 Corepack
- pnpm 10
- 可访问的 MongoDB 实例

前端默认运行在 `http://127.0.0.1:9000`，后端默认运行在
`http://127.0.0.1:9001`，API 基地址为 `http://127.0.0.1:9001/api/v1`。

## 配置 MongoDB

后端和固件检查子进程共用同一组 MongoDB 环境变量。复制示例文件并填入目标集群密码：

```bash
cd backend
cp .env.example .env
# 编辑 .env，设置 MONGO_PASSWORD
```

`MONGO_URI`、`MONGO_DB_NAME`、`MONGO_USERNAME` 和 `MONGO_AUTH_SOURCE` 可按目标实例调整。
`.env` 不会被提交；启动后端前需要将其导出到当前 shell。

## 启动后端

在第一个终端中：

```bash
cd backend
set -a
source .env
set +a
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 9001 --reload
```

不用 uv 时，创建虚拟环境后执行：

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
set -a
source .env
set +a
python -m uvicorn app.main:app --host 127.0.0.1 --port 9001 --reload
```

健康检查：

```bash
curl http://127.0.0.1:9001/api/v1/health
```

接口文档：`http://127.0.0.1:9001/docs`。

## 启动前端

在第二个终端中：

```bash
cd frontend
corepack enable
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 9000
```

浏览器访问 `http://127.0.0.1:9000`。开发环境的前端 API 地址已指向本地后端。

若前端与后端不在同一主机运行，设置 `VITE_API_BASE_URL` 后重新启动前端，例如：

```bash
VITE_API_BASE_URL=http://backend.example.internal:9001/api/v1 pnpm dev --host 0.0.0.0
```

## 更新与运维

更新代码后，重新执行 `uv sync` 和 `pnpm install --frozen-lockfile`，然后重启两个源码进程。
上传文件和 PDF 报告默认保存在从 `backend/` 启动时的 `uploads/` 与 `reports/` 目录；需要保留数据时，使用
`FWAUDIT_UPLOAD_DIR` 和 `FWAUDIT_REPORT_DIR` 配置持久化目录。

若需要迁移历史数据，可先进行只读检查：

```bash
cd backend
set -a
source .env
set +a
uv run python scripts/sync_mongodb_data.py
```

确认输出后再追加 `--apply`。目标数据库已有集合时，只有确认可安全幂等写入后才使用 `--allow-nonempty-target`。
