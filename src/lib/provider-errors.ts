/**
 * 第三方模型厂商错误信息统一转换
 * 把 HTTP 状态码翻译成可操作的中文提示，避免直接把原始报文抛给用户
 */

/** 根据 HTTP 状态码生成处理建议（不含厂商名） */
export function describeProviderStatus(status: number): string {
  if (status === 401 || status === 403) {
    return 'API Key 无效或已过期，请到厂商控制台重新生成后再填写';
  }
  if (status === 402) {
    return '账户余额不足，请先到厂商控制台充值';
  }
  if (status === 429) {
    return '调用频率超限或账户额度不足，请稍后重试或提升额度';
  }
  if (status === 404) {
    return '接口地址不存在，请检查 Base URL 是否填写正确';
  }
  if (status === 400 || status === 422) {
    return '请求被拒绝，可能是模型未开通或模型名称不被该端点支持';
  }
  if (status >= 500) {
    return '厂商服务暂时不可用，请稍后重试';
  }
  return `调用失败（HTTP ${status}）`;
}

/** 带厂商名的完整错误文案 */
export function friendlyProviderError(providerName: string, status: number): string {
  return `${providerName} ${describeProviderStatus(status)}`;
}
