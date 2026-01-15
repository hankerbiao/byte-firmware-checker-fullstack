from fastapi import APIRouter, UploadFile, File, HTTPException, status, Form, BackgroundTasks, Query
from fastapi.responses import JSONResponse, FileResponse
from pymongo import MongoClient

from app.audit_service import AuditService
from app.core.config import settings


router = APIRouter()


_mongo_client: MongoClient | None = None


def get_mongo_db():
    """
    返回一个可复用的 MongoDB 数据库句柄。

    该辅助函数集中管理与 Mongo 相关的配置，方便人类开发者和 AI：
    - 快速定位并修改连接 URI
    - 快速定位并修改数据库名称
    - 统一管理客户端复用策略
    """
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(settings.MONGO_URI)
    return _mongo_client[settings.MONGO_DB_NAME]


def get_audit_service() -> AuditService:
    """
    构造审计业务服务对象。

    当前实现直接基于 Mongo 数据库句柄创建服务实例，
    如未来需要接入依赖注入框架，可以在此统一扩展。
    """
    db = get_mongo_db()
    return AuditService(db)


@router.post(
    "/audits",
    status_code=status.HTTP_201_CREATED,
)
async def create_audit(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    firmwareType: str = Form("UNKNOWN"),
    productName: str | None = Form(None),
    version: str | None = Form(None),
    bmcType: str = Form("OpenBMC"),
    checkScript: str = Form("CheckFWFile_v1.3.1.py"),
):
    """
    创建新的固件审计任务。

    该端点本身只负责参数解析与调用业务服务，具体业务逻辑由 AuditService 承担。
    """
    service = get_audit_service()
    response_body = await service.create_audit(
        background_tasks=background_tasks,
        file=file,
        firmware_type=firmwareType,
        product_name=productName,
        version=version,
        bmc_type=bmcType,
        script_name=checkScript,
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=response_body)


@router.get("/audits")
async def list_audits(
    status: list[str] | None = Query(None),
    firmwareType: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    查询审计任务历史列表。

    - 支持按状态和固件类型筛选
    - 按创建时间倒序
    - 使用 limit/offset 进行分页
    """
    service = get_audit_service()
    return service.list_audits(
        status=status,
        firmware_type=firmwareType,
        limit=limit,
        offset=offset,
    )


@router.get("/audits/{audit_id}")
async def get_audit(audit_id: str):
    """
    根据审计 ID 获取单条审计文档。

    具体数据访问由业务服务负责，本端点仅负责 HTTP 层面的 404 返回等。
    """
    service = get_audit_service()
    doc = service.get_audit(audit_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit not found")
    return doc


@router.get("/audits/{audit_id}/logs")
async def get_audit_logs(
    audit_id: str,
    limit: int = Query(200, ge=1, le=1000),
    since: str | None = None,
):
    """
    按时间顺序返回指定审计任务的“控制台风格”日志记录。

    - limit 控制返回的日志条数上限（范围为 1..1000）
    - 当提供 since 时，会以 $gt 方式与 timestamp 字段比较做增量拉取
    """
    service = get_audit_service()
    return service.get_audit_logs(audit_id=audit_id, limit=limit, since=since)


@router.get("/audits/{audit_id}/report")
async def get_audit_report(audit_id: str):
    """
    基于审计主文档与检查结果集合构建一份“综合审计报告”视图。

    具体的组合逻辑由业务服务实现，本端点负责 HTTP 协议层的行为定义。
    """
    service = get_audit_service()
    report = service.get_audit_report(audit_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit not found")
    return report


@router.get("/audits/{audit_id}/report.pdf")
async def get_audit_report_pdf(audit_id: str):
    """
    为指定审计任务返回后端生成的 PDF 审计报告。

    行为说明：
    - 首次访问时：
      调用 AuditService.generate_audit_report_pdf 生成 audit_id 对应的 PDF 文件，
      并将生成结果保存在 FWAUDIT_REPORT_DIR 目录下。
    - 后续访问时：
      若磁盘上已存在对应文件，则直接读取并通过 FileResponse 返回给前端。

    注意：
    - 若指定的审计任务不存在，则返回 404。
    - 媒体类型固定为 application/pdf，前端可选择直接预览或下载。
    """
    service = get_audit_service()
    pdf_path = service.generate_audit_report_pdf(audit_id)
    if pdf_path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit not found")
    filename = f"audit-{audit_id}.pdf"
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=filename,
    )
