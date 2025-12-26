"""
项目 API 测试
测试项目 CRUD 操作
"""

import pytest
from app.schemas.item import Item


@pytest.mark.asyncio
async def test_create_item(client, test_user):
    """测试创建项目"""
    # 先登录
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpass123"
        }
    )
    token = login_response.json()["access_token"]

    # 创建项目
    response = await client.post(
        "/api/v1/items/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Test Item",
            "description": "Test Description"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Item"
    assert data["description"] == "Test Description"
    assert data["owner_id"] == test_user.id


@pytest.mark.asyncio
async def test_read_items(client, test_user):
    """测试获取项目列表"""
    # 先登录
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpass123"
        }
    )
    token = login_response.json()["access_token"]

    # 获取项目列表
    response = await client.get(
        "/api/v1/items/",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_read_item(client, test_user):
    """测试获取单个项目"""
    # 先登录
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpass123"
        }
    )
    token = login_response.json()["access_token"]

    # 创建项目
    create_response = await client.post(
        "/api/v1/items/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Test Item",
            "description": "Test Description"
        }
    )
    item_id = create_response.json()["id"]

    # 获取项目
    response = await client.get(
        f"/api/v1/items/{item_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Item"


@pytest.mark.asyncio
async def test_update_item(client, test_user):
    """测试更新项目"""
    # 先登录
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpass123"
        }
    )
    token = login_response.json()["access_token"]

    # 创建项目
    create_response = await client.post(
        "/api/v1/items/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Old Title",
            "description": "Old Description"
        }
    )
    item_id = create_response.json()["id"]

    # 更新项目
    response = await client.patch(
        f"/api/v1/items/{item_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "New Title",
            "description": "New Description"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "New Title"
    assert data["description"] == "New Description"


@pytest.mark.asyncio
async def test_delete_item(client, test_user):
    """测试删除项目"""
    # 先登录
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpass123"
        }
    )
    token = login_response.json()["access_token"]

    # 创建项目
    create_response = await client.post(
        "/api/v1/items/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Test Item",
            "description": "Test Description"
        }
    )
    item_id = create_response.json()["id"]

    # 删除项目
    response = await client.delete(
        f"/api/v1/items/{item_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 204

    # 验证项目已被删除
    response = await client.get(
        f"/api/v1/items/{item_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_read_user_items(client, test_user):
    """测试获取用户的项目"""
    # 先登录
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpass123"
        }
    )
    token = login_response.json()["access_token"]

    # 获取用户项目
    response = await client.get(
        "/api/v1/items/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)