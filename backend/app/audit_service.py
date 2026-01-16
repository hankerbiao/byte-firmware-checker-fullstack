import logging
import os
import subprocess
import uuid
from datetime import datetime, timezone
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
            subprocess.run(cmd, check=True, timeout=settings.FWAUDIT_SCRIPT_TIMEOUT)
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
        return {
            "id": audit_id,
            "timestamp": audit.get("completedAt") or audit.get("createdAt"),
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

        base_dir = Path(settings.FWAUDIT_UPLOAD_DIR)
        chunk_root = base_dir / "chunk_uploads"
        chunk_dir = chunk_root / upload_id
        if not chunk_dir.is_dir():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload directory not found",
            )

        part_path = chunk_dir / f"{chunk_index:06d}.part"

        try:
            with part_path.open("wb") as f:
                while True:
                    data = await chunk_file.read(1024 * 1024)
                    if not data:
                        break
                    f.write(data)
        except Exception as exc:  # noqa: BLE001
            logger.error("[upload %s] 写入分片失败(%s): %s", upload_id, chunk_index, exc)
            if part_path.exists():
                try:
                    part_path.unlink()
                except Exception:  # noqa: BLE001
                    pass
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

        for index in range(total_chunks):
            if not (chunk_dir / f"{index:06d}.part").is_file():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Missing chunk",
                )

        audit_id = uuid.uuid4().hex
        upload_dir = base_dir / audit_id
        upload_dir.mkdir(parents=True, exist_ok=False)

        filename = str(meta.get("originalFilename") or f"{audit_id}.zip")
        target_path = upload_dir / filename

        try:
            with target_path.open("wb") as dest:
                for index in range(total_chunks):
                    part_path = chunk_dir / f"{index:06d}.part"
                    with part_path.open("rb") as src:
                        while True:
                            buf = src.read(1024 * 1024)
                            if not buf:
                                break
                            dest.write(buf)
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
            for index in range(total_chunks):
                part_path = chunk_dir / f"{index:06d}.part"
                if part_path.exists():
                    try:
                        part_path.unlink()
                    except Exception:  # noqa: BLE001
                        pass
            try:
                chunk_dir.rmdir()
            except Exception:  # noqa: BLE001
                pass
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
