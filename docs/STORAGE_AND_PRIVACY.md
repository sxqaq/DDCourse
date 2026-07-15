# 存储与隐私

DDCourse 不上传课程视频，也没有账号和云同步。视频直接从用户选择的文件或目录读取。

## 本地数据

- 播放进度：`lumacourse_progress_v1`
- 最近课程：`lumacourse_last_v1`
- 每周学习时间：`lumacourse_week_v1`
- 播放速度：`lumacourse_speed_v1`
- 笔记：`ddcourse_notes_v1`
- 收藏：`ddcourse_bookmarks_v1`

这些键位于浏览器或 Electron 渲染环境的 localStorage。清除站点数据会移除它们，因此应定期导出进度。

字体选项和字号保存在 localStorage；用户导入的字体二进制保存在本机 IndexedDB，不会上传。字体版权责任和许可范围参见[字体与版权说明](./FONTS_AND_LICENSING.md)。

桌面端另外维护“文档/DDCourse/学习笔记.json”，启动时与 localStorage 按每条记录的 `updatedAt` 合并。它不包含视频或播放进度。读取和写入均经过运行时结构校验；旧记录缺少 `updatedAt` 时会使用创建时间迁移。

## 匹配规则

视频进度 ID 由相对路径和文件大小组成。移动、改名或改变文件大小可能导致旧进度无法匹配；同路径、同大小的新文件则可能继承旧进度。`lastModified` 和视频时长目前只适合作为未来的冲突提示元数据，不应直接加入主 ID，否则会破坏跨设备迁移。

## 导入与错误

进度导入会与本地记录合并并立即刷新界面。文件夹刷新只重新扫描视频，不会清空进度。存储空间不足或目录权限异常时，应用会提示本次更改可能未保存。
