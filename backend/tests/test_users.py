"""
用户 API 测试
测试用户注册、登录、CRUD 操作
"""

import pytest
from app.schemas.user import User


@pytest.mark.asyncio
async def test_register_user(client):
    """测试用户注册"""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "testpass123",
            "name": "New User"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["name"] == "New User"
    assert "id" in data
    assert "hashed_password" not in data


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    """测试重复邮箱注册"""
    # 先注册一个用户
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "duplicate@example.com",
            "password": "testpass123",
            "name": "User One"
        }
    )

    # 尝试注册相同邮箱
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "duplicate@example.com",
            "password": "testpass123",
            "name": "User Two"
        }
    )
    assert response.status_code == 400
    assert "邮箱已被注册" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_user(client, test_user):
    """测试用户登录"""
    response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpass123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    """测试无效凭据登录"""
    response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "wrong@example.com",
            "password": "wrongpass"
        }
    )
    assert response.status_code == 401
    assert "邮箱或密码错误" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_current_user(client, test_user):
    """测试获取当前用户"""
    # 先登录获取令牌
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpass123"
        }
    )
    token = login_response.json()["access_token"]

    # 获取当前用户
    response = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"


@pytest.mark.asyncio
async def test_update_user(client, test_user):
    """测试更新用户"""
    # 先登录
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpass123"
        }
    )
    token = login_response.json()["access_token"]

    # 更新用户
    response = await client.patch(
        f"/api/v1/users/{test_user.id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Updated User"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated User"
    assert data["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_delete_user(client, test_user):
    """测试删除用户"""
    # 先登录
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "test@example.com",
            "password": "testpass123"
        }
    )
    token = login_response.json()["access_token"]

    # 删除用户
    response = await client.delete(
        f"/api/v1/users/{test_user.id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 204

    # 验证用户已被删除
    response = await client.get(
        f"/api/v1/users/{test_user.id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 404