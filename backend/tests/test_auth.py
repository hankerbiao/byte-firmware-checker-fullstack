"""
认证 API 测试
测试登录、注册功能
"""

import pytest


@pytest.mark.asyncio
async def test_register_and_login_flow(client):
    """测试完整的注册和登录流程"""
    # 注册用户
    register_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "flowtest@example.com",
            "password": "testpass123",
            "name": "Flow Test User"
        }
    )
    assert register_response.status_code == 201
    user_data = register_response.json()
    assert user_data["email"] == "flowtest@example.com"

    # 登录
    login_response = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "flowtest@example.com",
            "password": "testpass123"
        }
    )
    assert login_response.status_code == 200
    token_data = login_response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"

    # 使用令牌获取当前用户
    token = token_data["access_token"]
    me_response = await client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_response.status_code == 200
    me_data = me_response.json()
    assert me_data["email"] == "flowtest@example.com"
    assert me_data["name"] == "Flow Test User"