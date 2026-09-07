# MongoDB 数据迁移

`sync_mongodb_data.py` 只会从旧库 `firmware_audit` 迁移到新集群的
`byte-firmware-checker`，不支持通过参数或环境变量改写来源或目标。

启动后端服务和迁移前，都要在各自的运行环境注入目标库密码。迁移前还需停止旧服务的写入：

```sh
export MONGO_PASSWORD='实际密码'
cd backend
uv run python scripts/sync_mongodb_data.py
uv run python scripts/sync_mongodb_data.py --apply --source-quiesced
```

第一次命令为预检查，不写入数据。第二次命令会复制集合选项、文档和索引，保留
`_id`；结束时核对各集合的源、目标文档数。若进程中断，保持旧库停止写入后运行：

```sh
uv run python scripts/sync_mongodb_data.py --apply --source-quiesced --resume
```

`--resume` 是单向 upsert，不会从目标删除已在旧库删除的文档，因此只能用于同一
次维护窗口内的中断恢复。
