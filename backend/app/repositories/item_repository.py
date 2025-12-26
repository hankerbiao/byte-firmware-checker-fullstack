"""
项目 Repository
提供项目特定的数据访问操作
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate
from app.repositories.base_repository import BaseRepository


class ItemRepository(BaseRepository[Item, ItemCreate, ItemUpdate]):
    """
    项目 Repository

    扩展基础 Repository，提供项目特定的操作
    """

    async def get_by_owner(
        self,
        db: AsyncSession,
        owner_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[Item]:
        """
        根据所有者获取项目列表

        Args:
            db: 数据库会话
            owner_id: 所有者 ID
            skip: 跳过的记录数
            limit: 返回的最大记录数

        Returns:
            项目列表
        """
        result = await db.execute(
            select(Item)
            .where(Item.owner_id == owner_id)
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()

    async def get_multi_by_owner_count(
        self,
        db: AsyncSession,
        owner_id: int
    ) -> int:
        """
        计算指定所有者的项目数量

        Args:
            db: 数据库会话
            owner_id: 所有者 ID

        Returns:
            项目数量
        """
        result = await db.execute(
            select(Item).where(Item.owner_id == owner_id)
        )
        return len(result.scalars().all())

    async def get_active(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100
    ) -> List[Item]:
        """
        获取活跃项目列表

        Args:
            db: 数据库会话
            skip: 跳过的记录数
            limit: 返回的最大记录数

        Returns:
            活跃项目列表
        """
        result = await db.execute(
            select(Item)
            .where(Item.is_active == True)
            .offset(skip)
            .limit(limit)
        )
        return result.scalars().all()


# 创建项目 Repository 实例
item_repository = ItemRepository(Item)