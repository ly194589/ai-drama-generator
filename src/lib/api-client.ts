/**
 * 前端 API 客户端
 * 
 * 自动在请求中添加用户身份信息
 * - 从 localStorage 获取用户信息
 * - 自动添加 x-user-id 请求头
 */

// 用户信息接口
interface UserInfo {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
}

/**
 * 从 localStorage 获取当前用户信息
 */
function getCurrentUser(): UserInfo | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return null;
    }
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * 获取默认请求头（包含用户身份信息）
 */
export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  const user = getCurrentUser();
  if (user?.id) {
    headers['x-user-id'] = user.id;
  }
  
  return headers;
}

/**
 * API 请求选项
 */
export interface ApiRequestOptions extends RequestInit {
  /** 是否需要认证（默认 true） */
  requireAuth?: boolean;
}

/**
 * 发起 API 请求
 * 
 * @param url 请求URL
 * @param options 请求选项
 * @returns Response 对象
 */
export async function apiRequest(
  url: string,
  options: ApiRequestOptions = {}
): Promise<Response> {
  const { requireAuth = true, ...fetchOptions } = options;
  
  // 合并请求头
  const headers = new Headers(fetchOptions.headers);
  
  // 添加认证头
  if (requireAuth) {
    const authHeaders = getAuthHeaders();
    for (const [key, value] of Object.entries(authHeaders)) {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    }
  }
  
  // 发起请求
  return fetch(url, {
    ...fetchOptions,
    headers,
  });
}

/**
 * GET 请求
 */
export async function apiGet<T = unknown>(url: string): Promise<T> {
  const response = await apiRequest(url);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * POST 请求
 */
export async function apiPost<T = unknown>(url: string, data?: unknown): Promise<T> {
  const response = await apiRequest(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * PUT 请求
 */
export async function apiPut<T = unknown>(url: string, data?: unknown): Promise<T> {
  const response = await apiRequest(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * DELETE 请求
 */
export async function apiDelete<T = unknown>(url: string): Promise<T> {
  const response = await apiRequest(url, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * 流式请求（用于 SSE）
 */
export async function apiStream(
  url: string,
  data?: unknown
): Promise<Response> {
  const headers = getAuthHeaders();
  headers['Accept'] = 'text/event-stream';
  
  return fetch(url, {
    method: 'POST',
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * 创建带用户信息的 FormData
 */
export function createFormDataWithAuth(data: Record<string, string | Blob>): FormData {
  const formData = new FormData();
  
  const user = getCurrentUser();
  if (user?.id) {
    formData.append('userId', user.id);
  }
  
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  
  return formData;
}

// 导出便捷方法
export { getCurrentUser };
