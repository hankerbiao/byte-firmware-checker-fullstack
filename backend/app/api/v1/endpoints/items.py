"""
项目路由
处理项目相关的 API 端点
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.item_service import item_service
from app.api.dependencies import get_current_active_user
from app.schemas.item import Item, ItemCreate, ItemUpdate

router = APIRouter()


@router.post(
    "/",
    response_model=Item,
    status_code=status.HTTP_201_CREATED,
    summary="创建项目",
    description="创建新项目"
)
async def create_item(
    item_in: ItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> Item:
    """
    创建新项目

    - **title**: 项目标题
    - **description**: 项目描述（可选）
    - **is_active**: 是否活跃（可选）

    需要在请求头中包含：
    - **Authorization**: Bearer {token}
    """
    item = await item_service.create_item(db, item_in, current_user.id)
    return item


@router.get(
    "/",
    response_model=List[Item],
    summary="获取项目列表",
    description="获取所有项目列表（需要认证）"
)
async def read_items(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> List[Item]:
    """
    获取项目列表

    - **skip**: 跳过的记录数（分页）
    - **limit**: 返回的最大记录数（默认 100）

    需要在请求头中包含：
    - **Authorization**: Bearer {token}
    """
    items = await item_service.get_items(db, skip, limit)
    return items


@router.get(
    "/me",
    response_model=List[Item],
    summary="获取我的项目",
    description="获取当前用户的所有项目"
)
async def read_user_items(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> List[Item]:
    """
    获取当前用户的项目

    - **skip**: 跳过的记录数（分页）
    - **limit**: 返回的最大记录数（默认 100）

    需要在请求头中包含：
    - **Authorization**: Bearer {token}
    """
    items = await item_service.get_items_by_owner(db, current_user.id, skip, limit)
    return items


@router.get(
    "/{item_id}",
    response_model=Item,
    summary="获取项目",
    description="根据 ID 获取项目信息"
)
async def read_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> Item:
    """
    根据 ID 获取项目

    - **item_id**: 项目 ID

    需要在请求头中包含：
    - **Authorization**: Bearer {token}
    """
    item = await item_service.get_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目未找到"
        )
    return item


@router.patch(
    "/{item_id}",
    response_model=Item,
    summary="更新项目",
    description="更新项目信息"
)
async def update_item(
    item_id: int,
    item_in: ItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
) -> Item:
    """
    更新项目信息

    - **item_id**: 项目 ID
    - **item_in**: 要更新的项目数据

    需要在请求头中包含：
    - **Authorization**: Bearer {token}

    注意：只能更新自己创建的项目
    """
    item = await item_service.get_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目未找到"
        )

    if item.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足"
        )

    updated_item = await item_service.update_item(db, item_id, item_in)
    return updated_item


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除项目",
    description="删除项目"
)
async def delete_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """
    删除项目

    - **item_id**: 项目 ID

    需要在请求头中包含：
    - **Authorization**: Bearer {token}

    注意：只能删除自己创建的项目
    """
    item = await item_service.get_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目未找到"
        )

    if item.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足"
        )

    await item_service.delete_item(db, item_id)