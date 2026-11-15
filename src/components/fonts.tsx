'use client';

// 非阻塞加载 Plus Jakarta Sans：preconnect + media 切换技巧，避免阻塞首屏渲染
// 国内环境使用官方 .cn 域，海外使用 .com
const isCN = true;
const gStatic = isCN ? 'https://fonts.gstatic.cn' : 'https://fonts.gstatic.com';
const fontCss = isCN
  ? 'https://fonts.googleapis.cn/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap'
  : 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap';

export default function Fonts() {
  return (
    <>
      <link rel="preconnect" href={isCN ? 'https://fonts.googleapis.cn' : 'https://fonts.googleapis.com'} crossOrigin="anonymous" />
      <link rel="preconnect" href={gStatic} crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href={fontCss}
        // 先以非匹配 media 加载（不阻塞渲染），加载完成后切回 all
        media="print"
        onLoad={(e) => {
          e.currentTarget.media = 'all';
        }}
      />
    </>
  );
}
