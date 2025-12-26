"""
项目 Service
处理项目相关的业务逻辑
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.item_repository import item_repository
from app.schemas.item import ItemCreate, ItemUpdate, Item


class ItemService:
    """
    项目 Service

    处理项目创建、更新、查询等业务逻辑
    """

    def __init__(self):
        """初始化 Service"""
        self.repository = item_repository

    async def create_item(
        self,
        db: AsyncSession,
        item_in: ItemCreate,
        owner_id: int
    ) -> Item:
        """
        创建新项目

        Args:
            db: 数据库会话
            item_in: 项目创建数据
            owner_id: 所有者 ID

        Returns:
            创建的项目
        """
        item_dict = item_in.model_dump()
        item_dict["owner_id"] = owner_id
        return await self.repository.create(db, ItemCreate(**item_dict))

    async def get_item(
        self,
        db: AsyncSession,
        item_id: int
    ) -> Optional[Item]:
        """
        获取项目

        Args:
            db: 数据库会话
            item_id: 项目 ID

        Returns:
            找到的项目或 None
        """
        return await self.repository.get(db, item_id)

    async def get_items(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100
    ) -> List[Item]:
        """
        获取项目列表

        Args:
            db: 数据库会话
            skip: 跳过的记录数
            limit: 返回的最大记录数

        Returns:
            项目列表
        """
        return await self.repository.get_multi(db, skip, limit)

    async def get_items_by_owner(
        self,
        db: AsyncSession,
        owner_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[Item]:
        """
        获取指定所有者的项目列表

        Args:
            db: 数据库会话
            owner_id: 所有者 ID
            skip: 跳过的记录数
            limit: 返回的最大记录数

        Returns:
            项目列表
        """
        return await self.repository.get_by_owner(db, owner_id, skip, limit)

    async def update_item(
        self,
        db: AsyncSession,
        item_id: int,
        item_in: ItemUpdate
    ) -> Optional[Item]:
        """
        更新项目

        Args:
            db: 数据库会话
            item_id: 项目 ID
            item_in: 项目更新数据

        Returns:
            更新后的项目或 None
        """
        item = await self.repository.get(db, item_id)
        if not item:
            return None

        return await self.repository.update(db, item, item_in)

    async def delete_item(
        self,
        db: AsyncSession,
        item_id: int
    ) -> bool:
        """
        删除项目

        Args:
            db: 数据库会话
            item_id: 项目 ID

        Returns:
            是否成功删除
        """
        return await self.repository.delete(db, item_id)


# 创建项目 Service 实例
item_service = ItemService()