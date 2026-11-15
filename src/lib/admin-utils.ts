/**
 * 管理员相关工具函数
 */

/**
 * 管理员专用模型列表
 * Seedance 2.0 已全量启用，不再受限
 */
export const ADMIN_ONLY_MODELS: string[] = [];

/**
 * 检查模型是否为管理员专用
 */
export function isAdminOnlyModel(model: string): boolean {
  return ADMIN_ONLY_MODELS.includes(model);
}

/**
 * 检查当前用户是否为管理员
 */
export function isAdmin(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return false;
    }

    const user = JSON.parse(userStr);
    return user.isAdmin === true;
  } catch (error) {
    console.error('检查管理员权限失败:', error);
    return false;
  }
}
