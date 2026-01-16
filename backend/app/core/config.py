import os
import sys
from pathlib import Path

from pydantic import BaseModel


class Settings(BaseModel):
    APP_NAME: str = "Firmware Check Service"
    VERSION: str = "0.1.0"

    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://10.17.154.252:27018")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "firmware_audit")

    FWAUDIT_SCRIPT_TIMEOUT: int = int(os.getenv("FWAUDIT_SCRIPT_TIMEOUT", "3600"))
    FWAUDIT_SCRIPT_PATH: str = os.getenv(
        "FWAUDIT_SCRIPT_PATH",
        str(Path(__file__).resolve().parents[1] / "CheckFWFile_v1.3.1.py"),
    )
    FWAUDIT_UPLOAD_DIR: str = os.getenv(
        "FWAUDIT_UPLOAD_DIR",
        str(Path.cwd() / "uploads"),
    )
    # PDF 报告输出目录：
    # - 用于存放后端生成的审计报告 PDF 文件
    # - 默认位于当前工作目录下的 reports 子目录
    FWAUDIT_REPORT_DIR: str = os.getenv(
        "FWAUDIT_REPORT_DIR",
        str(Path.cwd() / "reports"),
    )
    # PDF 报告中文字体文件路径：
    # - 可配置任意支持中文的 TTF/OTF 字体，例如 NotoSansCJK / 思源黑体
    # - 若未配置或路径无效，则会退回使用内置的 CJK 字体 STSong-Light
    # - 若两者都不可用则最终退回 Helvetica（此时中文会乱码）
    FWAUDIT_PDF_FONT_PATH: str | None = os.getenv("FWAUDIT_PDF_FONT_PATH") or None
    PYTHON_EXECUTABLE: str = os.getenv("PYTHON_EXECUTABLE", sys.executable)
    OA_JWT_SECRET: str = os.getenv("OA_JWT_SECRET", "YWNnw5hwP1e3tSFx6CFYeRvWRSSJhRiC")
    OA_APP_NAME: str = os.getenv("OA_APP_NAME", "bytespkgcheck")
    OA_LOGIN_BASE_URL: str = os.getenv(
        "OA_LOGIN_BASE_URL",
        "http://tl.cooacloud.com/springboard_v3/login_proxy",
    )
    SESSION_EXPIRE_HOURS: int = int(os.getenv("SESSION_EXPIRE_HOURS", "8"))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))


settings = Settings()
