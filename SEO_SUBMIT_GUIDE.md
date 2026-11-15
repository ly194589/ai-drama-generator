# 搜索引擎提交指南

## 网站信息

- **网站地址**: https://c83a4e2e-ca15-492b-84b3-1972ca00f056.dev.coze.site
- **Sitemap**: https://c83a4e2e-ca15-492b-84b3-1972ca00f056.dev.coze.site/sitemap.xml
- **Robots.txt**: https://c83a4e2e-ca15-492b-84b3-1972ca00f056.dev.coze.site/robots.txt

---

## 一、百度站长平台

### 1. 访问平台
https://ziyuan.baidu.com/

### 2. 添加网站
1. 登录百度账号
2. 点击「用户中心」→「站点管理」→「添加网站」
3. 输入网站地址

### 3. 验证网站 ✅ 已完成
- 验证文件: `/baidu_verify_codeva-KooX3W28Cg.html`
- 访问地址: https://c83a4e2e-ca15-492b-84b3-1972ca00f056.dev.coze.site/baidu_verify_codeva-KooX3W28Cg.html
- 点击「完成验证」

### 4. 提交 Sitemap
验证成功后：
1. 进入「数据引入」→「链接提交」
2. 选择「sitemap」方式
3. 输入: `https://c83a4e2e-ca15-492b-84b3-1972ca00f056.dev.coze.site/sitemap.xml`
4. 点击「提交」

### 5. 主动推送（可选）
```bash
# 百度主动推送接口（需在平台获取token）
curl -H 'Content-Type:text/plain' --data-binary @urls.txt "http://data.zz.baidu.com/urls?site=你的域名&token=你的token"
```

---

## 二、Google Search Console

### 1. 访问平台
https://search.google.com/search-console

### 2. 添加网站
1. 登录 Google 账号
2. 点击「添加资源」
3. 选择「网址前缀」，输入网站地址
4. 选择「HTML 文件验证」

### 3. 验证方式
**方式一：HTML 文件验证**
- 下载 Google 提供的验证文件
- 放到 `public/` 目录下
- 重新部署后点击验证

**方式二：HTML 标签验证（推荐）**
已在 `layout.tsx` 中添加 meta 标签支持

### 4. 提交 Sitemap
验证成功后：
1. 左侧菜单「站点地图」
2. 输入: `sitemap.xml`
3. 点击「提交」

### 5. 请求索引
1. 使用「网址检查」工具
2. 输入重要页面 URL
3. 点击「请求编入索引」

---

## 三、搜狗站长平台

### 1. 访问平台
https://zhanzhang.sogou.com/

### 2. 添加网站
1. 登录搜狗账号
2. 点击「添加网站」
3. 输入网站地址

### 3. 验证网站
**方式：文件验证**
1. 下载搜狗提供的验证文件
2. 放到 `public/` 目录
3. 重新部署后点击验证

### 4. 提交 Sitemap
搜狗暂不支持 Sitemap 提交，需通过「链接提交」手动提交重要页面

---

## 四、360 站长平台

### 1. 访问平台
https://zhanzhang.so.com/

### 2. 添加网站
1. 登录 360 账号
2. 点击「添加网站」
3. 输入网站地址

### 3. 验证网站
**方式：文件验证**
1. 下载 360 提供的验证文件
2. 放到 `public/` 目录
3. 重新部署后点击验证

### 4. 提交 Sitemap
1. 进入「数据提交」→「sitemap 提交」
2. 输入 Sitemap 地址
3. 点击「提交」

---

## 五、必应 Bing Webmaster Tools

### 1. 访问平台
https://www.bing.com/webmasters

### 2. 添加网站
1. 登录微软账号
2. 点击「添加站点」
3. 输入网站地址

### 3. 验证方式
**方式一：XML 文件验证**
下载验证文件放到 `public/` 目录

**方式二：Meta 标签验证**
在 `layout.tsx` 中添加 meta 标签

### 4. 提交 Sitemap
1. 进入「站点地图」
2. 点击「提交站点地图」
3. 输入: `sitemap.xml`

---

## 六、神马站长平台（移动搜索）

### 1. 访问平台
https://zhanzhang.sm.cn/

### 2. 添加网站
1. 登录账号
2. 添加网站并验证

### 3. 提交方式
神马暂不支持 Sitemap，需通过 MIP 提交或自然抓取

---

## 验证状态

| 平台 | 验证状态 | Sitemap 提交 |
|------|---------|-------------|
| 百度 | ✅ 文件已就绪 | 待提交 |
| Google | ⏳ 需添加验证文件 | 待提交 |
| 搜狗 | ⏳ 需添加验证文件 | 不支持 |
| 360 | ⏳ 需添加验证文件 | 待提交 |
| Bing | ⏳ 需添加验证文件 | 待提交 |

---

## 提交后优化建议

1. **定期更新 Sitemap** - 每次重要更新后重新提交
2. **监控收录情况** - 各平台查看收录数量和索引状态
3. **修复抓取错误** - 关注平台报告的 404、5xx 错误
4. **优化页面质量** - 提升内容原创性和用户体验
5. **增加外链** - 通过优质外链提升网站权重
