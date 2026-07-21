# DDCourse 架构说明

DDCourse 是本地优先的课程视频播放器。同一套 React 界面运行于 Web/PWA 和 Electron，视频文件始终由用户设备直接读取。

## 分层

```mermaid
flowchart TD
  Page["app/page.tsx：组合与界面"]
  Library["课程文件与合集"]
  Player["usePlayer：播放与定时保存"]
  Progress["useProgress：进度与备份"]
  Study["useStudyTime：每周学习时间"]
  Appearance["useAppearance：字体与界面缩放"]
  Notes["useNotesAndBookmarks"]
  List["useLocalStorageList"]
  Keys["useKeyboardShortcuts"]
  Bridge["useDesktopBridge"]
  Storage["storage.ts / localStorage"]
  Electron["preload.cjs / IPC / main.cjs"]

  Page --> Library
  Page --> Player
  Page --> Progress
  Page --> Study
  Page --> Appearance
  Page --> Notes
  Page --> Keys
  Page --> Bridge
  Player --> Progress
  Notes --> List
  Progress --> Storage
  List --> Storage
  Bridge --> Electron
```

`page.tsx` 负责组合状态和跨能力操作。课程库状态位于 `useCourseLibrary`，课程侧栏、播放器舞台和笔记面板分别位于 `CourseSidebar`、`PlayerStage` 与 `NotesPanel`。播放器、进度、快捷键、周统计、笔记列表、桌面笔记同步、PWA 安装及人声增强分别由 Hook 管理。共享数据结构位于 `types.ts`，存储键、SSR 安全读写和偏好运行时归一化位于 `storage.ts`。

## 播放与进度

课程记录以“相对路径 + 文件大小”作为 ID，兼顾浏览器、桌面端和跨设备备份。播放器以实际媒体源对应的文件快照保存进度，并屏蔽程序化停止产生的延迟 `pause`，避免切换后把旧媒体时间写入新课程。播放器在暂停、切换、播放结束、页面隐藏或离开时保存；连续播放时每前进约 5 秒节流保存一次。`timeupdate` 不会无条件写入存储。

进度导入采用合并语义：导入文件中的同 ID 记录覆盖本机记录，React 状态随即更新，因此列表、统计和当前播放器不需要重新启动应用。

## 周学习时间

周标识使用本地时区的周一日期，不经过 UTC 转换。每次累计前都会重新判断周标识，应用跨周持续运行时也会自动归零。

## 笔记和收藏

Web/PWA 以 localStorage 为主存储。桌面端以“文档/DDCourse/学习笔记.json”为持久文件，同时保留 localStorage 缓存。启动时两边按照稳定 UUID 和 `updatedAt` 合并，兼容没有 UUID 或 `updatedAt` 的旧记录；IPC 两端使用运行时 schema，渲染进程对保存进行 debounce，主进程将写入串行化。桌面文件采用临时文件写入后替换，并限制单次数据为 5 MiB。

## Electron 安全边界

BrowserWindow 启用 `contextIsolation`、禁用 `nodeIntegration` 并启用 sandbox。渲染进程只能通过 preload 暴露的有限接口选择/恢复目录和读写笔记。目录扫描使用异步文件 API，跳过符号链接；单个目录或文件读取失败时记录警告并继续。

## 资源生命周期

本地视频使用 object URL 或桌面 `file:` URL。统一的停止生命周期会在切换目录、合集、刷新、重置和组件卸载时保存进度、暂停视频、清空媒体源并撤销 object URL。人声增强使用单个 AudioContext 和 DynamicsCompressorNode。下载备份创建的临时 URL 会延迟撤销，避免浏览器尚未读取完成。

PWA 的本地正式构建使用 Workbox 根据 `dist/client` 的真实产物生成预缓存清单，Service Worker 以构建出的本地页面作为离线导航回退。浏览器测试会启用 Service Worker、切断网络并重新载入应用，验证离线冷启动。项目不再维护或发布官方 Web 托管站点。

课程合集同时保留可见 `files` 和包含软隐藏项的 `allFiles`：列表与相邻播放使用前者，统计、重置和报告使用后者。搜索索引覆盖全部合集；课程数超过阈值时，侧栏只渲染当前滚动窗口。预览缩略图使用 60 项 LRU，避免长视频持续占用内存。

自定义字体通过 FontFace API 激活，并以 ArrayBuffer 保存在 IndexedDB。字体系列和界面比例通过 CSS 自定义属性应用，避免组件直接维护大量字号分支。

## 后续边界

稳定组件不再为了行数继续拆分；新增能力应按数据所有权或副作用边界进入对应 Hook，避免重新把浏览器、媒体和桌面持久化生命周期堆回组合页。
