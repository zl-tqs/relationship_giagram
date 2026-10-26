# 小说人物关系图工具

用于展示小说人物关系的关系图工具（类思维导图），支持 Web 端与 PC 桌面端（Tauri 2 打包为可执行文件）。

技术设计见 [小说人物关系图工具-技术设计文档.md](小说人物关系图工具-技术设计文档.md)。

## 项目结构

```
frontend/   # 前端：Vite + React 18 + TypeScript + Tauri 2（src-tauri/ 为桌面壳）
backend/    # 后端：NestJS + PostgreSQL
```

## 环境要求

- Node.js 20+（本机 v24.8.0）
- Rust（MSVC 工具链）+ Visual Studio 2022 C++ 桌面开发（Tauri 构建必需）
- PostgreSQL 16+（本机 18.6）
- WebView2 Runtime（Windows 10/11 自带）

## 启动开发环境

```bash
# 前端（Web 模式，http://localhost:5173）
cd frontend && npm run dev

# 前端（PC 桌面模式，需已安装 Rust）
cd frontend && npm run tauri dev

# 后端（http://localhost:3000/api/v1/health）
cd backend && npm run start:dev
```

## 常用命令

| 目录 | 命令 | 说明 |
| --- | --- | --- |
| frontend | `npm run build` | 类型检查 + 产物构建 |
| frontend | `npm run tauri build` | 打包桌面可执行文件 |
| backend | `npm test` | 单元测试 |
| backend | `npm run build` | 编译到 dist/ |
