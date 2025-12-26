# 前端认证与 API 请求指南

## 概述

本文档详细说明前端如何向后端 API 请求时携带登录认证信息。

## 🔐 认证机制

### JWT Bearer Token 认证

后端使用 **JWT Bearer Token** 机制进行身份验证：

```http
Authorization: Bearer <your-jwt-token>
```

## 📦 API 客户端实现

### 核心文件：`frontend/src/api/client.ts`

该文件提供了完整的 API 客户端实现，包括：

1. **Token 管理**：自动存储、获取、清除 Token
2. **HTTP 拦截器**：每个请求自动携带 Authorization 头部
3. **API 服务**：封装所有业务 API 调用
4. **错误处理**：处理 401 未授权等认证错误

## 🔑 Token 管理

### TokenManager 类

提供 Token 的完整生命周期管理：

```typescript
import { TokenManager } from './api/client';

// 1. 存储 Token
TokenManager.setToken('your-jwt-token');

// 2. 获取 Token
const token = TokenManager.getToken();

// 3. 检查登录状态
if (TokenManager.isAuthenticated()) {
  console.log('用户已登录');
}

// 4. 清除 Token（登出）
TokenManager.clearToken();
```

### Token 存储位置

- **存储介质**：浏览器 localStorage
- **存储键名**：`auth_token`
- **存储格式**：`string` (JWT Token)

## 🚀 HTTP 请求处理

### 自动携带 Token

API 客户端在每个请求中**自动**添加认证头部：

```typescript
private createAuthHeaders(): HeadersInit {
  const token = TokenManager.getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

// 发送请求时自动应用
const response = await fetch(url, {
  headers: {
    ...this.createAuthHeaders(), // 自动包含 Authorization
    ...options.headers,
  },
});
```

## 📋 API 服务使用

### 1. 认证 API

```typescript
import { authApi } from './api/client';

// 登录
const loginResponse = await authApi.login({
  email: 'admin@example.com',
  password: 'secret123'
});

// 注册
await authApi.register({
  email: 'user@example.com',
  password: 'secret123',
  name: 'John Doe'
});

// 获取当前用户
const currentUser = await authApi.getCurrentUser();

// 登出
authApi.logout();
```

### 2. 用户 API

```typescript
import { userApi } from './api/client';

// 获取我的信息（自动携带 Token）
const me = await userApi.getMe();

// 获取用户列表（自动携带 Token）
const users = await userApi.getUsers(0, 100);

// 更新用户（自动携带 Token）
await userApi.updateUser(userId, { name: '新名字' });

// 删除用户（自动携带 Token）
await userApi.deleteUser(userId);
```

### 3. 项目/Item API

```typescript
import { itemApi } from './api/client';

// 创建项目（自动携带 Token）
const project = await itemApi.createItem({
  title: '固件审计项目',
  description: 'BIOS 安全审计',
  is_active: true
});

// 获取项目列表（自动携带 Token）
const projects = await itemApi.getItems();

// 获取我的项目（自动携带 Token）
const myProjects = await itemApi.getMyItems();

// 获取特定项目（自动携带 Token）
const project = await itemApi.getItem(projectId);

// 更新项目（自动携带 Token）
await itemApi.updateItem(projectId, { title: '新标题' });

// 删除项目（自动携带 Token）
await itemApi.deleteItem(projectId);
```

## 🔄 认证状态处理

### 自动处理 401 未授权

API 客户端自动检测 401 状态码并处理：

```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, config);

  // 自动处理 401
  if (response.status === 401) {
    TokenManager.clearToken();
    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('认证已过期，请重新登录');
  }

  return await response.json();
}

// 在 React 组件中监听认证事件
useEffect(() => {
  const handleUnauthorized = () => {
    // 显示登录提示或跳转到登录页
    alert('登录已过期，请重新登录');
  };

  window.addEventListener('auth:unauthorized', handleUnauthorized);
  return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
}, []);
```

## 💻 集成示例

### 在 React 组件中使用

```tsx
import React, { useState, useEffect } from 'react';
import { authApi, userApi, TokenManager } from './api/client';

const UserProfile: React.FC = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // 自动携带 Token，无需手动添加
        const userData = await userApi.getMe();
        setUser(userData);
      } catch (error) {
        console.error('获取用户信息失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      // 1. 调用登录 API
      const response = await authApi.login({ email, password });

      // 2. Token 已自动存储
      console.log('登录成功:', response);

      // 3. 获取用户信息（自动携带新 Token）
      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('登录失败:', error);
      alert('登录失败，请检查邮箱和密码');
    }
  };

  const handleLogout = () => {
    // 清除 Token 并清理状态
    authApi.logout();
    setUser(null);
  };

  return (
    <div>
      {loading ? (
        <p>加载中...</p>
      ) : user ? (
        <div>
          <h2>欢迎, {user.name}</h2>
          <button onClick={handleLogout}>登出</button>
        </div>
      ) : (
        <LoginForm onLogin={handleLogin} />
      )}
    </div>
  );
};
```

### 在 React Hook 中使用

```typescript
import { useState, useEffect } from 'react';
import { authApi, itemApi, TokenManager } from './api/client';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (TokenManager.isAuthenticated()) {
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
        } catch (error) {
          // Token 过期，清理状态
          TokenManager.clearToken();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    setUser(response.user);
    return response;
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  return { user, login, logout, loading };
};
```

## 🧪 测试 API 请求

### 使用 curl 命令测试

```bash
# 1. 先登录获取 Token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com&password=secret123"

# 响应：
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "token_type": "bearer"
# }

# 2. 使用 Token 访问受保护的接口
curl http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 3. 创建项目（自动携带 Token）
curl -X POST http://localhost:8000/api/v1/items/ \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "固件审计项目",
    "description": "BIOS 安全审计",
    "is_active": true
  }'
```

### 浏览器开发者工具测试

```javascript
// 在浏览器控制台执行

// 1. 登录
fetch('http://localhost:8000/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'username=admin@example.com&password=secret123'
})
.then(res => res.json())
.then(data => {
  console.log('Token:', data.access_token);

  // 2. 存储 Token
  localStorage.setItem('auth_token', data.access_token);

  // 3. 使用 Token 访问接口
  return fetch('http://localhost:8000/api/v1/users/me', {
    headers: {
      'Authorization': `Bearer ${data.access_token}`
    }
  });
})
.then(res => res.json())
.then(user => {
  console.log('用户信息:', user);
});
```

## 🔍 最佳实践

### 1. 环境变量配置

```typescript
// .env.local
VITE_API_URL=http://localhost:8000/api/v1
```

```typescript
// 使用环境变量
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
```

### 2. 错误处理

```typescript
try {
  const projects = await itemApi.getItems();
  console.log(projects);
} catch (error) {
  if (error.message.includes('认证已过期')) {
    // 处理认证过期
    handleReauth();
  } else {
    // 处理其他错误
    console.error('API 错误:', error);
  }
}
```

### 3. 请求拦截器（高级）

```typescript
// 使用 axios（替代 fetch）实现请求拦截器
import axios from 'axios';

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
});

// 请求拦截器：自动添加 Token
apiClient.interceptors.request.use((config) => {
  const token = TokenManager.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      TokenManager.clearToken();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);
```

## 📝 配置项

### 环境变量

在 `frontend/.env.local` 中配置：

```bash
# API 基础 URL
VITE_API_URL=http://localhost:8000/api/v1

# 其他配置
VITE_APP_TITLE=智能固件合规审计系统
```

### package.json 依赖

```json
{
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

## 🎯 总结

### 关键要点

1. **Token 存储**：使用 localStorage 持久化
2. **自动携带**：每个请求自动添加 `Authorization: Bearer <token>` 头部
3. **自动处理**：401 错误自动清理 Token 并通知应用
4. **类型安全**：TypeScript 提供完整的类型支持
5. **易于使用**：封装好的 API 服务，无需关心认证细节

### 请求流程图

```
┌─────────────┐
│   前端组件   │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  API 客户端      │
│ authApi/login()  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐     ┌──────────────────┐
│  FastAPI 后端    │────▶│  验证 JWT Token  │
│  /auth/login     │     │  获取用户信息    │
└──────────────────┘     └──────────────────┘
       │                         │
       ▼                         ▼
┌──────────────────┐     ┌──────────────────┐
│  获取 Token      │     │  返回用户数据    │
│  存储到 localStorage│     │  200 OK         │
└──────────────────┘     └──────────────────┘
       │                         │
       ▼                         ▼
┌──────────────────┐     ┌──────────────────┐
│  API 请求        │◀────┤  响应数据        │
│  (自动携带 Token)│     │                  │
└──────────────────┘     └──────────────────┘
```

通过这套完整的认证体系，前端开发者可以轻松实现安全的 API 调用，**无需手动处理 Token 的添加和管理**。