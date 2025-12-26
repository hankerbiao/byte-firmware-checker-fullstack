/**
 * API 客户端
 * 处理所有 HTTP 请求，包括认证 Token 的自动携带
 */

// ==================== 类型定义 ====================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user?: {
    id: number;
    email: string;
    name: string;
    is_active: boolean;
  };
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

// ==================== 配置常量 ====================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Token 存储键名
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// ==================== Token 管理 ====================

export class TokenManager {
  /**
   * 获取存储的 Token
   */
  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * 存储 Token
   */
  static setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * 清除 Token
   */
  static clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /**
   * 获取用户信息
   */
  static getUser(): any | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * 存储用户信息
   */
  static setUser(user: any): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  /**
   * 检查是否已登录
   */
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

// ==================== HTTP 客户端 ====================

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * 创建带认证的头部
   */
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

  /**
   * 通用请求方法
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        ...this.createAuthHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      // 处理 401 未授权
      if (response.status === 401) {
        TokenManager.clearToken();
        // 触发自定义事件，通知应用需要重新登录
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        throw new Error('认证已过期，请重新登录');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('网络请求失败');
    }
  }

  /**
   * GET 请求
   */
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST 请求
   */
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH 请求
   */
  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE 请求
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// ==================== API 服务 ====================

const apiClient = new ApiClient(API_BASE_URL);

/**
 * 认证相关 API
 */
export const authApi = {
  /**
   * 用户登录
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const formData = new URLSearchParams({
      username: credentials.email, // FastAPI OAuth2PasswordRequestForm 使用 username 字段
      password: credentials.password,
    });

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || '登录失败');
    }

    const data = await response.json();

    // 存储 Token
    TokenManager.setToken(data.access_token);

    // 获取用户信息
    try {
      const user = await this.getCurrentUser();
      TokenManager.setUser(user);
      data.user = user;
    } catch (error) {
      console.warn('获取用户信息失败:', error);
    }

    return data;
  },

  /**
   * 用户注册
   */
  async register(userData: {
    email: string;
    password: string;
    name: string;
  }) {
    return apiClient.post('/auth/register', userData);
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUser() {
    return apiClient.get<{
      id: number;
      email: string;
      name: string;
      is_active: boolean;
    }>('/auth/me');
  },

  /**
   * 登出
   */
  logout(): void {
    TokenManager.clearToken();
    window.dispatchEvent(new CustomEvent('auth:logout'));
  },
};

/**
 * 用户相关 API
 */
export const userApi = {
  /**
   * 获取我的信息
   */
  async getMe() {
    return apiClient.get('/users/me');
  },

  /**
   * 获取用户列表
   */
  async getUsers(skip = 0, limit = 100) {
    return apiClient.get(`/users/?skip=${skip}&limit=${limit}`);
  },

  /**
   * 获取特定用户
   */
  async getUser(userId: number) {
    return apiClient.get(`/users/${userId}`);
  },

  /**
   * 更新用户
   */
  async updateUser(userId: number, userData: any) {
    return apiClient.patch(`/users/${userId}`, userData);
  },

  /**
   * 删除用户
   */
  async deleteUser(userId: number) {
    return apiClient.delete(`/users/${userId}`);
  },
};

/**
 * 项目/Item 相关 API
 */
export const itemApi = {
  /**
   * 创建项目
   */
  async createItem(itemData: {
    title: string;
    description?: string;
    is_active?: boolean;
  }) {
    return apiClient.post('/items/', itemData);
  },

  /**
   * 获取项目列表
   */
  async getItems(skip = 0, limit = 100) {
    return apiClient.get(`/items/?skip=${skip}&limit=${limit}`);
  },

  /**
   * 获取我的项目
   */
  async getMyItems(skip = 0, limit = 100) {
    return apiClient.get(`/items/me?skip=${skip}&limit=${limit}`);
  },

  /**
   * 获取特定项目
   */
  async getItem(itemId: number) {
    return apiClient.get(`/items/${itemId}`);
  },

  /**
   * 更新项目
   */
  async updateItem(itemId: number, itemData: any) {
    return apiClient.patch(`/items/${itemId}`, itemData);
  },

  /**
   * 删除项目
   */
  async deleteItem(itemId: number) {
    return apiClient.delete(`/items/${itemId}`);
  },
};

// ==================== 使用示例 ====================

/**
 * 示例：在 React 组件中使用
 */
export const usageExamples = `
import { authApi, userApi, itemApi, TokenManager } from './api/client';

// 1. 登录
const handleLogin = async (email: string, password: string) => {
  try {
    const response = await authApi.login({ email, password });

    // Token 已自动存储
    console.log('登录成功:', response);

    // 存储的用户信息
    console.log('当前用户:', TokenManager.getUser());
  } catch (error) {
    console.error('登录失败:', error);
  }
};

// 2. 获取当前用户信息
const fetchCurrentUser = async () => {
  try {
    const user = await authApi.getCurrentUser();
    console.log('用户信息:', user);
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
};

// 3. 创建项目（自动携带 Token）
const createProject = async () => {
  try {
    const project = await itemApi.createItem({
      title: '固件审计项目',
      description: 'BIOS 固件安全审计',
    });
    console.log('项目创建成功:', project);
  } catch (error) {
    console.error('创建项目失败:', error);
  }
};

// 4. 获取项目列表（自动携带 Token）
const fetchProjects = async () => {
  try {
    const projects = await itemApi.getItems();
    console.log('项目列表:', projects);
  } catch (error) {
    console.error('获取项目列表失败:', error);
  }
};

// 5. 检查登录状态
const isLoggedIn = TokenManager.isAuthenticated();
console.log('是否已登录:', isLoggedIn);

// 6. 登出
const handleLogout = () => {
  authApi.logout();
  console.log('已登出');
};
`;

// ==================== 监听认证事件 ====================

/**
 * 监听认证状态变化
 */
if (typeof window !== 'undefined') {
  // Token 过期监听
  window.addEventListener('auth:unauthorized', () => {
    console.warn('认证已过期，页面将跳转到登录页');
    // 这里可以触发路由跳转或显示登录模态框
    // 例如：window.location.href = '/login';
  });

  // 登出监听
  window.addEventListener('auth:logout', () => {
    console.info('用户已登出');
    // 清理应用状态，跳转到登录页等
  });
}

export default apiClient;