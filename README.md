# 凑空 · coukong

和朋友逛漫展时对日程、找共同空闲的小工具。纯前端、无账号、无后端，数据只存在自己手机里。为 REDLAND（上海·复兴岛，10.02–10.06）做的，换个展也能用。

## 能做什么

- 录入自己的活动预约：从场次库点选，或手动填写
- 截图识别：上传「预约成功」弹窗或「我的预约」列表截图，自动解析时间、摊位、活动，识别后逐场校对
- 查看自己的日程：按天排列，时间重叠会被拦下，每场前后留出移动时间
- 分享日程：生成链接、二维码或字符串，朋友导入即可看到；同名再次导入会覆盖
- 凑空：勾选一位或多位朋友，按天给出所有人都空着的时间段，时间轴同时标出每个人的忙碌块

## 技术栈

Vite + React + TypeScript，PWA（可加到主屏、离线打开外壳），状态用 zustand + persist，OCR 用 tesseract.js（worker、核心、语言包本地化，不依赖运行时 CDN），分享码用 lz-string 压缩，二维码用 qrcode.react。

## 本地开发

```bash
npm install      # postinstall 会自动拉取 OCR 资源到 public/tesseract
npm run dev
npm run build
npm run preview
```

OCR 资源在安装时从 CDN 拉取并随站点一起部署，因此现场网络环境无法访问 jsdelivr 也不影响识别。想跳过拉取可设置环境变量后手动运行 `node scripts/fetch-tesseract.mjs`。

## 部署到 Vercel

点下面的按钮，会克隆本仓库并创建项目，框架预设会自动识别为 Vite，无需额外配置。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FXinglan233%2Fcoukong&project-name=coukong&repository-name=coukong)

也可以在 Vercel 导入仓库后全部保持默认：

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`（会触发 OCR 资源拉取）

## 数据与隐私

所有日程、设置都保存在浏览器 localStorage，不会上传到任何服务器。分享码里只包含你填写的名字、参展日期和预约内容。清空数据在「我的 → 清空全部」。

## 补全活动场次库

各活动的准确场次写在 `src/lib/catalog.ts`，按现有格式追加即可。OCR 识别出时间后会自动按场次库匹配并修正活动名。
