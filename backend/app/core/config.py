import os
import sys
from pathlib import Path

from pydantic import BaseModel

DEFAULT_MONGO_URI = (
    "mongodb://10.17.159.232:27017,10.17.159.228:27017,"
    "10.17.158.254:27017/?authSource=admin"
)


class Settings(BaseModel):
    APP_NAME: str = "Firmware Check Service"
    VERSION: str = "0.1.0"

    MONGO_URI: str = os.getenv("MONGO_URI", DEFAULT_MONGO_URI)
    MONGO_DB_NAME: str = "byte-firmware-checker"
    MONGO_USERNAME: str | None = os.getenv("MONGO_USERNAME", "byte-firmware-checker") or None
    MONGO_PASSWORD: str | None = os.getenv("MONGO_PASSWORD") or None
    MONGO_AUTH_SOURCE: str | None = os.getenv("MONGO_AUTH_SOURCE", "admin") or None

    def mongo_client_kwargs(self) -> dict[str, str]:
        """Return optional authentication arguments for :class:`MongoClient`."""
        if self.MONGO_USERNAME and not self.MONGO_PASSWORD:
            raise RuntimeError("MONGO_PASSWORD must be set before connecting to MongoDB.")

        kwargs: dict[str, str] = {}
        if self.MONGO_USERNAME:
            kwargs["username"] = self.MONGO_USERNAME
        if self.MONGO_PASSWORD:
            kwargs["password"] = self.MONGO_PASSWORD
        if self.MONGO_AUTH_SOURCE:
            kwargs["authSource"] = self.MONGO_AUTH_SOURCE
        return kwargs

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

    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin")


settings = Settings()
