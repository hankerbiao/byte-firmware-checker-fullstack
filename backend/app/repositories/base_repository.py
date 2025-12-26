"""
基础 Repository 类
提供通用的 CRUD 操作
"""

from typing import Generic, TypeVar, Type, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

# 类型变量定义
ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    基础 Repository 类

    提供所有模型通用的 CRUD 操作
    """

    def __init__(self, model: Type[ModelType]):
        """
        初始化 Repository

        Args:
            model: SQLAlchemy 模型类
        """
        self.model = model

    async def get(self, db: AsyncSession, id: int) -> Optional[ModelType]:
        """
        根据 ID 获取记录

        Args:
            db: 数据库会话
            id: 记录 ID

        Returns:
            找到的记录或 None
        """
        result = await db.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalars().first()

    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """
        获取多个记录

        Args:
            db: 数据库会话
            skip: 跳过的记录数
            limit: 返回的最大记录数

        Returns:
            记录列表
        """
        result = await db.execute(
            select(self.model).offset(skip).limit(limit)
        )
        return result.scalars().all()

    async def create(
        self,
        db: AsyncSession,
        obj_in: CreateSchemaType
    ) -> ModelType:
        """
        创建新记录

        Args:
            db: 数据库会话
            obj_in: 创建数据

        Returns:
            新创建的记录
        """
        db_obj = self.model(**obj_in.model_dump())
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        db_obj: ModelType,
        obj_in: UpdateSchemaType
    ) -> ModelType:
        """
        更新记录

        Args:
            db: 数据库会话
            db_obj: 数据库中的记录
            obj_in: 更新数据

        Returns:
            更新后的记录
        """
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, id: int) -> bool:
        """
        删除记录

        Args:
            db: 数据库会话
            id: 记录 ID

        Returns:
            是否成功删除
        """
        obj = await self.get(db, id)
        if obj:
            await db.delete(obj)
            return True
        return False

    async def count(self, db: AsyncSession) -> int:
        """
        计算记录总数

        Args:
            db: 数据库会话

        Returns:
            记录总数
        """
        result = await db.execute(select(self.model))
        return len(result.scalars().all())