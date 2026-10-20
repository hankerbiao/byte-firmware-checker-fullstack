import logging
import os
import shutil
import subprocess
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, HTTPException, UploadFile, status

from app.core.config import settings
from app.pdf_report import generate_audit_report_pdf_file


logger = logging.getLogger(__name__)


class AuditService:
    """
    审计业务服务类。

    负责固件审计相关的核心业务流程，包括：
    - 管理上传文件及存储路径
    - 初始化和更新 MongoDB 中的审计文档
    - 调用外部固件检查脚本
    - 提供审计详情、日志与报告的查询能力
    """

    def __init__(self, db: Any) -> None:
        """
        :param db: 已连接的 MongoDB 数据库句柄（通常来自 get_mongo_db）
        """
        self.db = db

    @staticmethod
    def _utc_now_iso() -> str:
        """
        返回当前 UTC 时间的 ISO8601 字符串表示。

        所有写入 MongoDB 的时间字段应统一使用该格式，
        以保证排序与比较行为的一致性。
        """
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _parse_created_at(value: Any) -> datetime | None:
        """
        将 MongoDB 中 createdAt 字段解析为带时区的 datetime。

        历史数据格式不统一：可能是 BSON Date、ISO8601 字符串（含 Z / +00:00），
        也可能是固件检查脚本写入的 "YYYY-MM-DD_HH:MM:SS"（下划线分隔、无时区）。
        无法解析时返回 None。
        """
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if not isinstance(value, str) or not value:
            return None
        raw = value.strip()
        if "_" in raw:
            raw = raw.replace("_", "T", 1)
        try:
            dt = datetime.fromisoformat(raw)
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    @staticmethod
    def _format_timestamp_local(value: str | None) -> str | None:
        if not value:
            return None
        raw = str(value)
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(raw)
        except Exception:
            return raw
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt_local = dt.astimezone(timezone(timedelta(hours=8)))
        return dt_local.strftime("%Y-%m-%d %H:%M:%S")

    def _mark_audit_failed(self, audit_id: str, reason: str) -> None:
        """
        当后台处理失败时，尽最大努力更新对应审计任务的文档。

        - 只记录日志，不向外抛出异常，避免导致后台任务整体崩溃
        - 只更新 status、completedAt 和 errorMessage 这几个字段
        """
        try:
            self.db["audits"].update_one(
                {"id": audit_id},
                {
                    "$set": {
                        "status": "FAILED",
                        "completedAt": self._utc_now_iso(),
                        "errorMessage": reason,
                    }
                },
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("标记审计任务 %s 失败状态时出错: %s", audit_id, exc)

    def run_check_script(self, audit_id: str, zip_path: str, bmc_type: str) -> None:
        """
        为指定审计任务执行外部固件检查脚本。

        优先根据审计文档上记录的脚本名称选择脚本，
        若未指定则回退到全局配置的默认脚本路径。
        """
        audit = self.db["audits"].find_one({"id": audit_id}, {"checkScript": 1})
        script_name = (audit or {}).get("checkScript")

        if script_name:
            base_dir = Path(settings.FWAUDIT_SCRIPT_PATH).resolve().parent
            script_path = base_dir / script_name
        else:
            script_path = Path(settings.FWAUDIT_SCRIPT_PATH)
        if not script_path.is_file():
            reason = f"检查脚本不存在: {script_path}"
            logger.error("[audit %s] %s", audit_id, reason)
            self._mark_audit_failed(audit_id, reason)
            return

        cmd = [
            settings.PYTHON_EXECUTABLE,
            str(script_path),
            "-f",
            zip_path,
            "-t",
            bmc_type,
            "-a",
            audit_id,
        ]

        try:
            # The checker already writes structured progress/results to MongoDB.
            # Discarding its very chatty console output avoids a large json-file
            # Docker log write for every PDF and ZIP entry it inspects.
            subprocess.run(
                cmd,
                check=True,
                timeout=settings.FWAUDIT_SCRIPT_TIMEOUT,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.STDOUT,
            )
        except subprocess.TimeoutExpired:
            reason = f"检查脚本在 {settings.FWAUDIT_SCRIPT_TIMEOUT} 秒后超时"
            logger.error("[audit %s] %s", audit_id, reason)
            self._mark_audit_failed(audit_id, reason)
        except subprocess.CalledProcessError as exc:  # noqa: BLE001
            reason = f"检查脚本以非零退出码结束: {exc.returncode}"
            logger.error("[audit %s] %s", audit_id, reason)
            self._mark_audit_failed(audit_id, reason)
        except Exception as exc:  # noqa: BLE001
            reason = f"检查脚本执行异常: {exc}"
            logger.error("[audit %s] %s", audit_id, reason)
            self._mark_audit_failed(audit_id, reason)

    async def create_audit(
        self,
        background_tasks: BackgroundTasks,
        file: UploadFile,
        firmware_type: str,
        product_name: str | None,
        version: str | None,
        bmc_type: str,
        script_name: str | None,
        user_id: str | None = None,
        user_name: str | None = None,
    ) -> dict:
        """
        创建新的固件审计任务：
        - 将上传的 ZIP 文件持久化到独立目录
        - 在 Mongo 中初始化状态为 PENDING 的审计文档
        - 记录本次任务选择的检查脚本名称（如有）
        - 将固件检查脚本加入后台任务队列

        返回结果仅表示“任务已被接受”，并不意味着分析流程已经完成。
        """
        original_filename = file.filename or "firmware.zip"
        if not original_filename.lower().endswith(".zip"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only .zip files are supported",
            )

        audit_id = uuid.uuid4().hex

        upload_base = Path(settings.FWAUDIT_UPLOAD_DIR)
        upload_base.mkdir(parents=True, exist_ok=True)
        upload_dir = upload_base / audit_id
        upload_dir.mkdir(parents=True, exist_ok=True)

        safe_name = os.path.basename(original_filename)
        safe_name = safe_name.replace(os.sep, "_")
        if os.altsep:
            safe_name = safe_name.replace(os.altsep, "_")
        if not safe_name.lower().endswith(".zip"):
            safe_name = f"{safe_name}.zip"

        target_path = upload_dir / safe_name

        try:
            with target_path.open("wb") as f:
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
        except Exception as exc:  # noqa: BLE001
            logger.error("[audit %s] 持久化上传文件失败: %s", audit_id, exc)
            if target_path.exists():
                try:
                    target_path.unlink()
                except Exception:  # noqa: BLE001
                    pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store uploaded file",
            ) from exc

        now = self._utc_now_iso()
        effective_script_name = script_name or Path(settings.FWAUDIT_SCRIPT_PATH).name
        audit_doc = {
            "id": audit_id,
            "status": "PENDING",
            "createdAt": now,
            "completedAt": None,
            "firmwareType": firmware_type,
            "productName": product_name,
            "version": version,
            "checkScript": effective_script_name,
            "userId": user_id,
            "userName": user_name,
            "summary": {
                "total": 0,
                "passed": 0,
                "warning": 0,
                "failed": 0,
            },
        }
        try:
            self.db["audits"].update_one({"id": audit_id}, {"$set": audit_doc}, upsert=True)
        except Exception as exc:  # noqa: BLE001
            logger.error("[audit %s] 初始化审计文档失败: %s", audit_id, exc)
            if target_path.exists():
                try:
                    target_path.unlink()
                except Exception:  # noqa: BLE001
                    pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize audit task",
            ) from exc

        background_tasks.add_task(
            self.run_check_script,
            audit_id=audit_id,
            zip_path=str(target_path),
            bmc_type=bmc_type,
        )

        return {
            "id": audit_id,
            "status": "PENDING",
            "firmwareType": firmware_type,
            "productName": product_name,
            "version": version,
        }

    def get_audit(self, audit_id: str) -> dict | None:
        """
        根据审计 ID 获取单条审计文档。

        若不存在则返回 None，由上层决定是否返回 404。
        """
        return self.db["audits"].find_one({"id": audit_id}, {"_id": 0})

    def get_audit_logs(self, audit_id: str, limit: int, since: str | None) -> list[dict]:
        """
        获取指定审计任务的日志列表。

        - limit 控制返回的最大条数
        - since 用于基于 timestamp 字段的增量拉取
        """
        query: dict[str, Any] = {"auditId": audit_id}
        if since:
            query["timestamp"] = {"$gt": since}
        cursor = (
            self.db["audit_logs"]
            .find(query, {"_id": 0})
            .sort("timestamp", 1)
            .limit(limit)
        )
        return list(cursor)

    def get_audit_report(self, audit_id: str) -> dict | None:
        """
        基于审计主文档与检查结果集合构建一份“综合审计报告”视图。

        若对应审计不存在则返回 None，由上层负责返回 404。
        """
        checks_cursor = self.db["audit_checks"].find({"auditId": audit_id}, {"_id": 0})
        checks = list(checks_cursor)
        audit = self.db["audits"].find_one({"id": audit_id}, {"_id": 0})
        if not audit:
            return None
        raw_timestamp = audit.get("completedAt") or audit.get("createdAt")
        friendly_timestamp = self._format_timestamp_local(raw_timestamp)
        return {
            "id": audit_id,
            "timestamp": friendly_timestamp or raw_timestamp,
            "firmwareType": audit.get("firmwareType"),
            "productName": audit.get("productName"),
            "version": audit.get("version"),
            "summary": audit.get("summary", {}),
            "checks": checks,
        }

    def init_chunked_audit_upload(
        self,
        original_filename: str | None,
        firmware_type: str,
        product_name: str | None,
        version: str | None,
        bmc_type: str,
        script_name: str | None,
        total_size: int,
        total_chunks: int,
        chunk_size: int,
        user_id: str | None = None,
        user_name: str | None = None,
    ) -> dict:
        if total_size <= 0 or total_chunks <= 0 or chunk_size <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid chunk upload parameters",
            )

        base_name = original_filename or "firmware.zip"
        safe_name = os.path.basename(base_name)
        safe_name = safe_name.replace(os.sep, "_")
        if os.altsep:
            safe_name = safe_name.replace(os.altsep, "_")
        if not safe_name.lower().endswith(".zip"):
            safe_name = f"{safe_name}.zip"

        upload_id = uuid.uuid4().hex

        base_dir = Path(settings.FWAUDIT_UPLOAD_DIR)
        chunk_root = base_dir / "chunk_uploads"
        chunk_dir = chunk_root / upload_id
        try:
            chunk_dir.mkdir(parents=True, exist_ok=False)
        except FileExistsError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize upload directory",
            )

        payload_path = chunk_dir / "payload.bin"
        try:
            with payload_path.open("wb") as payload:
                payload.truncate(int(total_size))
        except Exception as exc:  # noqa: BLE001
            shutil.rmtree(chunk_dir, ignore_errors=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize upload file",
            ) from exc

        effective_script_name = script_name or Path(settings.FWAUDIT_SCRIPT_PATH).name
        doc = {
            "uploadId": upload_id,
            "firmwareType": firmware_type,
            "productName": product_name,
            "version": version,
            "bmcType": bmc_type,
            "checkScript": effective_script_name,
            "totalSize": int(total_size),
            "totalChunks": int(total_chunks),
            "chunkSize": int(chunk_size),
            "createdAt": self._utc_now_iso(),
            "originalFilename": safe_name,
            "userId": user_id,
            "userName": user_name,
        }
        self.db["audit_uploads"].update_one(
            {"uploadId": upload_id},
            {"$set": doc},
            upsert=True,
        )
        return {"uploadId": upload_id}

    async def append_chunk_to_upload(
        self,
        upload_id: str,
        chunk_index: int,
        total_chunks: int,
        chunk_file: UploadFile,
    ) -> None:
        meta = self.db["audit_uploads"].find_one({"uploadId": upload_id})
        if not meta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload session not found",
            )

        expected_total = int(meta.get("totalChunks", 0))
        if expected_total <= 0 or expected_total != int(total_chunks):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Chunk count mismatch",
            )

        if chunk_index < 0 or chunk_index >= expected_total:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid chunk index",
            )

        expected_size = min(
            int(meta.get("chunkSize", 0)),
            int(meta.get("totalSize", 0)) - chunk_index * int(meta.get("chunkSize", 0)),
        )
        if expected_size <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid chunk size",
            )

        base_dir = Path(settings.FWAUDIT_UPLOAD_DIR)
        chunk_root = base_dir / "chunk_uploads"
        chunk_dir = chunk_root / upload_id
        if not chunk_dir.is_dir():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload directory not found",
            )

        payload_path = chunk_dir / "payload.bin"
        marker_path = chunk_dir / f"{chunk_index:06d}.done"

        try:
            if not payload_path.is_file():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Upload file not found",
                )

            offset = chunk_index * int(meta.get("chunkSize", 0))
            received_size = 0
            with payload_path.open("r+b", buffering=0) as payload:
                while True:
                    data = await chunk_file.read(4 * 1024 * 1024)
                    if not data:
                        break
                    if received_size + len(data) > expected_size:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Chunk is larger than expected",
                        )
                    os.pwrite(payload.fileno(), data, offset + received_size)
                    received_size += len(data)

            if received_size != expected_size:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Chunk size mismatch",
                )

            marker_path.touch()
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.error("[upload %s] 写入分片失败(%s): %s", upload_id, chunk_index, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store chunk",
            ) from exc

    async def finalize_chunked_audit_upload(
        self,
        background_tasks: BackgroundTasks,
        upload_id: str,
    ) -> dict:
        meta = self.db["audit_uploads"].find_one({"uploadId": upload_id})
        if not meta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload session not found",
            )

        base_dir = Path(settings.FWAUDIT_UPLOAD_DIR)
        chunk_root = base_dir / "chunk_uploads"
        chunk_dir = chunk_root / upload_id
        if not chunk_dir.is_dir():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload directory not found",
            )

        total_chunks = int(meta.get("totalChunks", 0))
        if total_chunks <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid upload metadata",
            )

        done_markers = [
            chunk_dir / f"{index:06d}.done"
            for index in range(total_chunks)
        ]
        legacy_parts = [
            chunk_dir / f"{index:06d}.part"
            for index in range(total_chunks)
        ]
        if not all(marker.is_file() for marker in done_markers) and not all(
            part.is_file() for part in legacy_parts
        ):
            missing_index = next(
                (
                    index
                    for index, marker in enumerate(done_markers)
                    if not marker.is_file()
                ),
                0,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing chunk {missing_index}",
            )

        payload_path = chunk_dir / "payload.bin"
        using_direct_upload = payload_path.is_file() and all(
            marker.is_file() for marker in done_markers
        )
        if using_direct_upload and payload_path.stat().st_size < int(meta.get("totalSize", 0)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is incomplete",
                )

        audit_id = uuid.uuid4().hex
        upload_dir = base_dir / audit_id
        upload_dir.mkdir(parents=True, exist_ok=False)

        filename = str(meta.get("originalFilename") or f"{audit_id}.zip")
        target_path = upload_dir / filename

        try:
            if using_direct_upload:
                # payload.bin and the final file live on the same filesystem,
                # so this is an O(1) rename instead of copying the whole ZIP.
                os.replace(payload_path, target_path)
            else:
                # Keep compatibility with uploads created before the direct
                # write optimization was deployed.
                with target_path.open("wb") as dest:
                    for part_path in legacy_parts:
                        with part_path.open("rb") as src:
                            shutil.copyfileobj(src, dest, length=4 * 1024 * 1024)
        except Exception as exc:  # noqa: BLE001
            logger.error("[upload %s] 合并分片失败: %s", upload_id, exc)
            if target_path.exists():
                try:
                    target_path.unlink()
                except Exception:  # noqa: BLE001
                    pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to assemble uploaded file",
            ) from exc

        now = self._utc_now_iso()
        audit_doc = {
            "id": audit_id,
            "status": "PENDING",
            "createdAt": now,
            "completedAt": None,
            "firmwareType": meta.get("firmwareType"),
            "productName": meta.get("productName"),
            "version": meta.get("version"),
            "checkScript": meta.get("checkScript"),
            "userId": meta.get("userId"),
            "userName": meta.get("userName"),
            "summary": {
                "total": 0,
                "passed": 0,
                "warning": 0,
                "failed": 0,
            },
        }
        try:
            self.db["audits"].update_one({"id": audit_id}, {"$set": audit_doc}, upsert=True)
        except Exception as exc:  # noqa: BLE001
            logger.error("[audit %s] 初始化审计文档失败: %s", audit_id, exc)
            if target_path.exists():
                try:
                    target_path.unlink()
                except Exception:  # noqa: BLE001
                    pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize audit task",
            ) from exc

        background_tasks.add_task(
            self.run_check_script,
            audit_id=audit_id,
            zip_path=str(target_path),
            bmc_type=str(meta.get("bmcType") or ""),
        )

        try:
            self.db["audit_uploads"].delete_one({"uploadId": upload_id})
        except Exception as exc:  # noqa: BLE001
            logger.error("[upload %s] 清理上传会话元数据失败: %s", upload_id, exc)

        try:
            shutil.rmtree(chunk_dir, ignore_errors=True)
        except Exception as exc:  # noqa: BLE001
            logger.error("[upload %s] 清理分片目录失败: %s", upload_id, exc)

        return {
            "id": audit_id,
            "status": "PENDING",
            "firmwareType": audit_doc["firmwareType"],
            "productName": audit_doc["productName"],
            "version": audit_doc["version"],
        }

    def generate_audit_report_pdf(self, audit_id: str) -> str | None:
        """
        为指定审计任务生成 PDF 审计报告。

        设计思路：
        1. 复用 get_audit_report 的结构化审计数据（时间、固件类型、汇总统计、检查项列表）
        2. 按 audit_id 命名生成的 PDF 文件，统一存放在 FWAUDIT_REPORT_DIR 目录下
        3. 采用“按需生成 + 静态复用”策略：
           - 如果磁盘上已存在对应 audit_id.pdf，则直接返回路径（避免重复生成）
           - 否则基于当前审计数据重新渲染一份新的 PDF
        4. 字体策略：
           - 优先尝试使用 FWAUDIT_PDF_FONT_PATH 指向的中文字体文件（TTF/OTF）
           - 失败时回退到 ReportLab 内置的 CJK 字体 STSong-Light
           - 若环境不支持上述字体则退回 Helvetica（此时中文可能乱码）
        布局风格：
        - 顶部深色横幅 + 中英文标题
        - 审计元信息卡片：任务 ID / 时间 / 固件类型 / 产品名称 / 版本号
        - 审计结果概览卡片：总数 / 合规 / 警告 / 错误
        - 详细检查项列表：状态 + 分类 + 名称 + 描述 + 规范条目
        """
        report = self.get_audit_report(audit_id)
        if report is None:
            return None

        return generate_audit_report_pdf_file(audit_id, report)

    def list_audits(
        self,
        status: list[str] | None,
        firmware_type: str | None,
        limit: int,
        offset: int,
        user_id: str | None = None,
    ) -> dict:
        """
        查询审计任务列表（用于审计历史）。

        - 支持按状态和固件类型筛选
        - 按 createdAt 倒序排序
        - 使用 limit/offset 实现简单分页
        """
        query: dict[str, Any] = {}

        if status:
            query["status"] = {"$in": status}

        if firmware_type:
            query["firmwareType"] = firmware_type

        if user_id:
            query["userId"] = user_id

        total = self.db["audits"].count_documents(query)

        cursor = (
            self.db["audits"]
            .find(query, {"_id": 0})
            .sort("createdAt", -1)
            .skip(offset)
            .limit(limit)
        )
        items = list(cursor)

        return {"items": items, "total": total}

    # ------------------------------------------------------------------
    # Statistics methods
    # ------------------------------------------------------------------

    def get_usage_stats(
        self,
        days: int = 30,
        user_id: str | None = None,
        firmware_type: str | None = None,
        status: str | None = None,
    ) -> dict:
        """
        返回运行看板统计数据，支持按时间、用户、固件类型和任务状态筛选。
        """
        now = datetime.now(timezone.utc)
        audit_query: dict = {}

        if days > 0:
            audit_query["createdAt"] = {
                "$gte": (now - timedelta(days=days)).isoformat(),
            }
        if user_id:
            audit_query["userId"] = user_id
        if firmware_type:
            audit_query["firmwareType"] = firmware_type
        if status == "ACTIVE":
            audit_query["status"] = {"$in": ["ANALYZING", "PENDING", "UPLOADING"]}
        elif status:
            audit_query["status"] = status

        # --- overall counts ---
        total_audits = self.db["audits"].count_documents(audit_query)
        completed = self.db["audits"].count_documents({**audit_query, "status": "COMPLETED"})
        failed = self.db["audits"].count_documents({**audit_query, "status": "FAILED"})
        analyzing = self.db["audits"].count_documents(
            {**audit_query, "status": {"$in": ["ANALYZING", "PENDING", "UPLOADING"]}}
        )

        # --- pass rate among completed ---
        pass_rate = round((completed / total_audits * 100), 1) if total_audits > 0 else 0

        # --- firmware type distribution ---
        type_pipeline = [
            {"$match": audit_query},
            {"$group": {"_id": "$firmwareType", "count": {"$sum": 1}}},
        ]
        type_dist: dict[str, int] = {}
        for doc in self.db["audits"].aggregate(type_pipeline):
            key = doc["_id"] or "UNKNOWN"
            type_dist[key] = doc["count"]

        # --- last 7 days trend ---
        seven_days_ago = now - timedelta(days=7)
        daily_counter: dict[str, dict[str, int]] = {}
        for doc in self.db["audits"].find(audit_query, {"createdAt": 1, "status": 1}):
            ts = self._parse_created_at(doc.get("createdAt"))
            if ts is None or ts < seven_days_ago:
                continue
            day = ts.date().isoformat()
            entry = daily_counter.setdefault(day, {"total": 0, "passed": 0, "failed": 0})
            entry["total"] += 1
            if doc.get("status") == "COMPLETED":
                entry["passed"] += 1
            elif doc.get("status") == "FAILED":
                entry["failed"] += 1
        daily_rows: list[dict] = [
            {"date": day, **counts}
            for day, counts in sorted(daily_counter.items())
        ]

        # --- check category distribution ---
        audit_ids = [
            doc["id"]
            for doc in self.db["audits"].find(audit_query, {"_id": 0, "id": 1})
        ]
        category_pipeline = [
            {"$match": {"auditId": {"$in": audit_ids}}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ]
        category_dist: list[dict] = []
        for doc in self.db["audit_checks"].aggregate(category_pipeline):
            category_dist.append({"category": doc["_id"], "count": doc["count"]})

        # --- registered user usage ---
        user_usage_pipeline = [
            {
                "$match": {
                    **audit_query,
                    "userId": {"$exists": True, "$nin": [None, ""]},
                }
            },
            {
                "$group": {
                    "_id": "$userId",
                    "totalAudits": {"$sum": 1},
                    "completedAudits": {
                        "$sum": {"$cond": [{"$eq": ["$status", "COMPLETED"]}, 1, 0]}
                    },
                    "failedAudits": {
                        "$sum": {"$cond": [{"$eq": ["$status", "FAILED"]}, 1, 0]}
                    },
                    "analyzingAudits": {
                        "$sum": {
                            "$cond": [
                                {"$in": ["$status", ["ANALYZING", "PENDING", "UPLOADING"]]},
                                1,
                                0,
                            ]
                        }
                    },
                    "lastActive": {"$max": "$createdAt"},
                }
            },
        ]
        usage_by_user = {
            row["_id"]: row
            for row in self.db["audits"].aggregate(user_usage_pipeline)
            if row.get("_id")
        }

        user_stats: list[dict] = []
        registered_itcodes: set[str] = set()
        for user_doc in self.db["users"].find({}, {"itcode": 1, "profile": 1}):
            itcode = user_doc.get("itcode")
            if not itcode:
                continue
            registered_itcodes.add(itcode)
            profile = user_doc.get("profile") or {}
            usage = usage_by_user.get(itcode, {})
            user_stats.append(
                {
                    "itcode": itcode,
                    "name": profile.get("姓名") or profile.get("真实姓名") or profile.get("name") or itcode,
                    "department": profile.get("部门") or "",
                    "totalAudits": usage.get("totalAudits", 0),
                    "completedAudits": usage.get("completedAudits", 0),
                    "failedAudits": usage.get("failedAudits", 0),
                    "analyzingAudits": usage.get("analyzingAudits", 0),
                    "lastActive": usage.get("lastActive"),
                }
            )

        # Preserve usage records for accounts that predate user profile creation.
        for itcode, usage in usage_by_user.items():
            if itcode in registered_itcodes:
                continue
            user_stats.append(
                {
                    "itcode": itcode,
                    "name": itcode,
                    "department": "",
                    "totalAudits": usage.get("totalAudits", 0),
                    "completedAudits": usage.get("completedAudits", 0),
                    "failedAudits": usage.get("failedAudits", 0),
                    "analyzingAudits": usage.get("analyzingAudits", 0),
                    "lastActive": usage.get("lastActive"),
                }
            )

        user_stats.sort(key=lambda item: item["totalAudits"], reverse=True)
        unique_user_count = len(user_stats)

        return {
            "totalAudits": total_audits,
            "completedAudits": completed,
            "failedAudits": failed,
            "analyzingAudits": analyzing,
            "passRate": pass_rate,
            "firmwareTypeDistribution": type_dist,
            "dailyTrend": daily_rows,
            "categoryDistribution": category_dist,
            "uniqueUsers": unique_user_count,
            "userStats": user_stats,
            "updatedAt": now.isoformat(),
        }
