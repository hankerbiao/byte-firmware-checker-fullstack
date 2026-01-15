from enum import Enum
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field


class CheckStatus(str, Enum):
    PASS = "PASS"
    WARNING = "WARNING"
    FAIL = "FAIL"


class CheckItem(BaseModel):
    id: str = Field(..., description="检查项唯一标识")
    category: str = Field(..., description="检查类别")
    name: str = Field(..., description="检查项名称")
    status: CheckStatus = Field(..., description="检查结果状态")
    description: str = Field(..., description="本次检查结果说明")
    standard: Optional[str] = Field(
        None,
        description="关联的标准或规范",
    )
    suggestion: Optional[str] = Field(
        None,
        description="当状态为 FAIL 或 WARNING 时的整改建议",
    )
    step: Optional[int] = Field(
        None,
        description="对应旧脚本中的步骤编号",
    )
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="额外细节信息",
    )


class FirmwareInfo(BaseModel):
    manufacturer: str = Field(..., description="厂商标识")
    product: str = Field(..., description="产品型号")
    fw_type: str = Field(..., description="固件类型")
    version: str = Field(..., description="固件版本号")
    zip_filename: str = Field(..., description="固件压缩包文件名")


class CheckRunSummary(BaseModel):
    total: int = Field(..., description="检查项总数")
    passed: int = Field(..., description="通过数量")
    warning: int = Field(..., description="告警数量")
    failed: int = Field(..., description="失败数量")
    started_at: Optional[str] = Field(
        None,
        description="检查开始时间",
    )
    finished_at: Optional[str] = Field(
        None,
        description="检查结束时间",
    )
    duration_ms: Optional[int] = Field(
        None,
        description="检查耗时毫秒数",
    )


class CheckReport(BaseModel):
    firmware: FirmwareInfo = Field(..., description="固件基础信息")
    summary: CheckRunSummary = Field(..., description="检查汇总信息")
    items: List[CheckItem] = Field(..., description="具体检查项列表")
    extra: Optional[Dict[str, Any]] = Field(
        default=None,
        description="附加信息",
    )

