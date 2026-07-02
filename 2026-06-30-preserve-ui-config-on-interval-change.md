# Goal: Preserve UI Config On Interval Change

## Goal Mode Objective

Follow the saved goal file at `/home/czc/projects/working/stock/KLineForge/2026-06-30-preserve-ui-config-on-interval-change.md`; complete the task only when the verification section passes, and stop to ask if any listed stop condition occurs.

## Full Prompt

### Objective

在 KLineForge 中实现：切换左右图表周期时，不改变应保持的界面配置，默认沿用切换前当前图表的配置；同时程序重启后尽量恢复上一次关闭前的 UI 偏好状态。

### Context

项目位于 `/home/czc/projects/working/stock/KLineForge`。当前前端主要在 `src/App.tsx`，类型在 `src/services/types.ts`，预览后端在 `src/services/backend.ts`，Tauri/Rust 设置和导入导出相关代码在 `src-tauri/src/domain.rs`、`src-tauri/src/commands.rs`、`src-tauri/src/db.rs`。

当前指标实例按 `chartId + interval` 存储。切换周期时，新周期会重新加载该周期自己的指标实例，未初始化时会使用默认指标，这会导致指标个数、参数、启用状态、样式、顺序等界面配置变化。

现有设置只持久化 `market`、`symbol`、`leftInterval`、`rightInterval`、`theme`、`language`。需要扩展为可恢复更多 UI 偏好状态，并纳入配置导入/导出。

### Brainstorming Direction

采用已确认的方案 1：保留现有 `chartId + interval` 指标实例模型，但切换周期时以前一个周期的当前图表配置为准，将配置覆盖/应用到目标周期。左右图表独立处理：左图只沿用左图当前配置，右图只沿用右图当前配置。

### Discovery Summary

已确认：
- 指标配置必须延续：指标个数、启用状态、参数、颜色/线型、顺序。
- 目标周期已有旧配置时，也用切换前当前配置覆盖。
- 只针对周期切换；市场或交易对切换不触发该配置延续语义。
- 重启后尽量恢复偏好类 UI 状态。
- 不恢复临时交互状态，例如打开中的弹窗、未保存表单内容、搜索框输入。
- 不要求切周期后延续缩放/可见范围。
- 画线/标注不跨周期延续。
- 新增 UI 偏好状态必须纳入配置导入/导出。
- 旧配置文件或旧数据库缺少新增字段时必须严格校验失败。
- 严格校验失败时，应用仍应可打开，并在界面显示明确错误状态，不得静默使用默认值。
- 自动化验证优先。

### Scope

可以修改：
- `src/App.tsx` 中周期切换、设置持久化、UI 状态恢复、错误展示、指标配置复制/覆盖逻辑。
- `src/services/types.ts` 与 `src/services/backend.ts` 中 `AppSettings`、预览模式设置、导入导出处理。
- `src-tauri/src/domain.rs`、`src-tauri/src/commands.rs`、`src-tauri/src/db.rs` 中设置结构、严格校验、配置导入导出。
- 相关单元测试和必要的测试辅助逻辑。
- 必要时更新文档中与配置导入导出或 UI 状态恢复直接冲突的说明。

实现要求：
- 切换左图周期时，复制/覆盖左图当前指标配置到新左图周期；右图同理。
- 复制后的指标实例应保留语义配置，但更新 `chartId`、`interval`、唯一 `id`、`position`、`updatedAt` 等必要字段，避免主键冲突。
- 程序关闭前已保存的偏好类 UI 状态，重启后应恢复。
- 新增设置字段必须由前端、预览模式、Tauri 后端、配置导入导出共同支持。
- 严格校验失败必须有可见 UI 错误状态。

### Out Of Scope

- 不引入账号、交易、API key、私有交易所数据、云同步或远程配置存储。
- 不要求画线/标注跨周期延续。
- 不要求图表缩放、可见时间范围跨周期延续。
- 不恢复临时交互状态：打开中的 modal、未保存编辑内容、搜索框输入等。
- 不把“市场/交易对切换”改成周期切换同样的配置覆盖语义。
- 不做大范围 UI 重设计。

### Verification

必须运行并通过：
- `npm run test`
- `npm run typecheck`

如果修改 Rust 代码，额外运行：
- `npm run rust:test`
- `npm run rust:fmt`
- `npm run rust:clippy`

自动化测试至少覆盖：
- 切换左图周期后，左图当前指标配置覆盖到目标周期，指标数量、启用状态、参数、样式、顺序保持一致。
- 右图周期切换独立于左图。
- 目标周期已有旧指标配置时，被切换前当前配置覆盖。
- 画线/标注不因切周期而跨周期复制。
- 新增 UI 偏好状态可保存、重启/重新加载设置后恢复。
- 导出配置包含新增 UI 偏好状态，导入配置可恢复这些状态。
- 缺少新增必填设置字段的旧配置文件或旧数据库设置会严格校验失败，并能在 UI 中显示明确错误状态。

### Stop Conditions

停止并询问用户，不要自行扩大范围，如果：
- 必须新增或迁移 SQLite 表结构才能完成。
- 严格校验旧数据库缺字段会导致应用无法打开并显示可恢复的错误状态。
- 需要改变画线/标注跨周期语义。
- 需要改变图表缩放/可见范围跨周期语义。
- 需要破坏现有配置导入/导出的基本 JSON envelope。
- “尽量恢复所有 UI 偏好状态”会不可避免地扩展到临时交互状态或未保存表单内容。
- 自动化验证无法运行，且无法用等价命令替代。

## Notes

- Created for Codex Goal mode.
- Do not mark complete until the verification section passes or the user explicitly changes the completion standard.
