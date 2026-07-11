# 开发与维护

## 环境与命令

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
npm run desktop:build
```

## 目录

- `app/`：React 页面、Hooks、存储和数据格式。
- `desktop/`：Electron 渲染端构建入口。
- `electron/`：主进程与安全 preload 桥接。
- `public/`：PWA manifest、Service Worker 和图标。
- `worker/`：Cloudflare/vinext Worker 入口。
- `tests/`：Node 单元与工程约束测试。

`dist/`、`desktop-dist/`、`release/`、`.wrangler/` 和 TypeScript 增量缓存均为可再生成产物，不应提交。

## 修改原则

- 播放器读取媒体元素状态，进度 Hook 负责数据持久化。
- 新的 localStorage 键统一加入 `storage.ts`。
- 修改备份结构时必须提升格式版本并更新 `PROGRESS_FORMAT.md`。
- 新增 Electron 能力必须经 preload 暴露最小接口，并校验输入规模和结构。
- 文件系统操作不得阻塞主进程；扫描应容忍单项失败并跳过符号链接。
- 数据保存失败必须进入统一日志或用户提示，不得无条件静默忽略。

## 发布前检查

依次执行类型检查、测试、lint、Web 正式构建和桌面构建。手工验证目录刷新、断点续播、进度导入、跨周统计以及桌面笔记恢复。
