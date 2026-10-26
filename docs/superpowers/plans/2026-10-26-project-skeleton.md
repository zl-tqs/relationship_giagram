# 项目骨架初始化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在项目根目录 `D:\relationship_giagram` 初始化可构建、可运行的项目骨架：前端（Vite + React + TS + Tauri 2）与后端（NestJS），并通过构建与冒烟验证。

**Architecture:** 双包结构（非 npm workspace，各自独立管理依赖）：`frontend/` 为 React 单页应用 + Tauri 2 桌面壳（`src-tauri/` 内嵌），`backend/` 为 NestJS REST 服务。骨架阶段不实现业务功能，仅保证脚手架可构建、可启动、可测试。

**Tech Stack:** Node 24 + npm、React 18 + TypeScript + Vite、Tauri 2、@xyflow/react、Zustand、Ant Design、react-hotkeys-hook、NestJS 10。

**Spec:** `小说人物关系图工具-技术设计文档.md`（项目根目录 `D:\relationship_giagram`，第 2、3 章定义技术栈与目录结构；本计划只实现其中"项目骨架"切片，业务模块由后续计划实现）

## Global Constraints

- 包管理器：npm（本机 pnpm/yarn 未安装）
- 后端 API 全局前缀：`api/v1`（spec 6.1）
- 数据库 PostgreSQL 16+（本机 18.6；骨架阶段仅预留 `DATABASE_URL` 环境变量，不接入 ORM）
- UI 文案使用中文
- 前端运行时依赖锁定：@xyflow/react（12.x）、zustand（4.x）、antd（5.x）、react-hotkeys-hook（4.x）
- 项目根目录已存在 `小说人物关系图工具-技术设计文档.md`，不得移动或删除

---

### Task 1: 脚手架前端（create-tauri-app）

**Files:**
- Create: `frontend/`（工具生成：Vite + React + TS + src-tauri，含 package.json、vite.config.ts、tsconfig、src/、src-tauri/）

**Interfaces:**
- Consumes: 无（首个任务）
- Produces: `frontend/package.json`（scripts: dev/build/preview/tauri）、`frontend/src-tauri/tauri.conf.json`、`frontend/src-tauri/Cargo.toml`

- [ ] **Step 1: 运行脚手架命令**

```bash
cd "D:/relationship_giagram"
npm create tauri-app@latest frontend -- --template react-ts --manager npm --yes
```

预期：命令自动完成 npm install，生成 `frontend/` 目录及 `node_modules`。

- [ ] **Step 2: 校验生成物**

```bash
ls frontend/package.json frontend/src-tauri/tauri.conf.json frontend/src-tauri/Cargo.toml frontend/src/App.tsx
```

预期：四个文件全部存在。

- [ ] **Step 3: 修改 Tauri 应用标识与窗口**

修改 `frontend/src-tauri/tauri.conf.json`（使用 Edit 工具，键值修改）：

- `productName`: `"frontend"` → `"人物关系图工具"`
- `identifier`: 默认值（形如 `com.tauri.dev`）→ `"com.relationmap.app"`
- `app.windows[0].title`: `"frontend"` → `"人物关系图工具"`
- `app.windows[0].width`: `800` → `1280`
- `app.windows[0].height`: `600` → `800`

- [ ] **Step 4: 验证前端可构建**

```bash
cd frontend && npm run build
```

预期：`tsc && vite build` 成功，退出码 0，生成 `frontend/dist/`。

### Task 2: 安装前端运行时依赖

**Files:**
- Modify: `frontend/package.json`（dependencies 新增 4 项）

**Interfaces:**
- Consumes: Task 1 的 `frontend/package.json`
- Produces: 依赖可供后续业务任务直接 import：`@xyflow/react`、`zustand`、`antd`、`react-hotkeys-hook`

- [ ] **Step 1: 安装依赖**

```bash
cd frontend && npm install @xyflow/react zustand antd react-hotkeys-hook
```

- [ ] **Step 2: 校验依赖版本**

```bash
node -e "const p=require('./package.json'); console.log(p.dependencies)"
```

预期：输出包含 `@xyflow/react: ^12.x`、`zustand: ^4.x`（或 ^5，若默认安装 5.x 则保留 5.x）、`antd: ^5.x`、`react-hotkeys-hook: ^4.x`。

- [ ] **Step 3: 回归构建**

```bash
npm run build
```

预期：仍构建成功（依赖未使用不影响构建通过）。

### Task 3: 脚手架后端（NestJS）

**Files:**
- Create: `backend/`（工具生成：src/main.ts、src/app.module.ts、src/app.controller.ts、src/app.service.ts、test/、package.json、tsconfig、eslint、jest 配置）

**Interfaces:**
- Consumes: 无（与 Task 1/2 并行）
- Produces: `backend/package.json`（scripts: start/start:dev/build/test）

- [ ] **Step 1: 运行脚手架命令**

```bash
cd "D:/relationship_giagram"
npx -y @nestjs/cli@latest new backend --package-manager npm --skip-git --strict
```

预期：自动 npm install 完成。

- [ ] **Step 2: 校验生成物**

```bash
ls backend/src/main.ts backend/src/app.module.ts backend/package.json
```

预期：全部存在。

- [ ] **Step 3: 验证初始测试通过**

```bash
cd backend && npm test
```

预期：脚手架自带的 AppController 测试 PASS。

### Task 4: 后端基础配置（ConfigModule + ValidationPipe + health 端点）

**Files:**
- Modify: `backend/src/main.ts`（全局前缀 + 校验管道）
- Modify: `backend/src/app.module.ts`（引入 ConfigModule）
- Modify: `backend/src/app.controller.ts`（getHello → health）
- Modify: `backend/src/app.service.ts`（getHello → health）
- Modify: `backend/src/app.controller.spec.ts`（对应 health 断言）
- Create: `backend/.env.example`

**Interfaces:**
- Consumes: Task 3 的 NestJS 脚手架
- Produces: 健康检查端点 `GET /api/v1/health` → `{ status: 'ok', service: 'relationmap-backend' }`；后续模块可依赖全局 `ConfigModule`（isGlobal）读取环境变量

- [ ] **Step 1: 安装依赖**

```bash
cd backend && npm install @nestjs/config class-validator class-transformer
```

- [ ] **Step 2: 修改 main.ts**

`backend/src/main.ts` 整体替换为：

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
```

- [ ] **Step 3: 修改 app.module.ts**

`backend/src/app.module.ts` 整体替换为：

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 4: 修改 controller 与 service**

`backend/src/app.controller.ts` 整体替换为：

```typescript
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  health() {
    return this.appService.health();
  }
}
```

`backend/src/app.service.ts` 整体替换为：

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  health() {
    return { status: 'ok', service: 'relationmap-backend' };
  }
}
```

- [ ] **Step 5: 更新测试**

`backend/src/app.controller.spec.ts` 整体替换为：

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return status ok', () => {
      expect(appController.health()).toEqual({
        status: 'ok',
        service: 'relationmap-backend',
      });
    });
  });
});
```

- [ ] **Step 6: 创建 .env.example**

`backend/.env.example`：

```env
# 服务端口
PORT=3000
# PostgreSQL 连接串（数据库接入由后续任务实现，骨架阶段不读取）
DATABASE_URL=postgres://postgres:postgres@localhost:5432/relationmap
```

- [ ] **Step 7: 运行测试与构建**

```bash
cd backend && npm test && npm run build
```

预期：测试 PASS（health 返回 status ok），`tsc` 构建成功生成 `dist/`。

### Task 5: 根目录文档与 Git 初始化

**Files:**
- Create: `README.md`（项目结构、环境要求、启动命令）
- Create: `.gitignore`（根级）

**Interfaces:**
- Consumes: Task 1-4 的产物路径
- Produces: 新成员可通过 README 完成启动；git 仓库就绪供后续任务按任务提交

- [ ] **Step 1: 创建 README.md**

`README.md`：

````markdown
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
````

- [ ] **Step 2: 创建根 .gitignore**

`.gitignore`：

```gitignore
node_modules/
dist/
target/
.env
*.log
.DS_Store
```

- [ ] **Step 3: Git 初始化与首次提交**

```bash
git init -b main
git add .gitignore README.md frontend backend
git commit -m "chore: 初始化项目骨架（前端 Tauri 2 + 后端 NestJS）"
```

预期：`git status` 干净；提交中不包含 node_modules/dist/target（被 .gitignore 排除）。

### Task 6: 全链路验证

**Files:**
- 无新增文件（纯验证任务）

**Interfaces:**
- Consumes: Task 1-5 全部产物
- Produces: 验证结论（全部通过方可声明骨架完成）

- [ ] **Step 1: 前端构建**

```bash
cd frontend && npm run build
```

预期：退出码 0。

- [ ] **Step 2: Tauri 编译检查（验证 Rust + MSVC + Tauri 集成，首次需下载依赖，耗时 5-10 分钟）**

```bash
cd frontend/src-tauri && cargo check
```

预期：退出码 0，无 error。

- [ ] **Step 3: 后端构建与测试**

```bash
cd backend && npm run build && npm test
```

预期：构建成功，测试 PASS。

- [ ] **Step 4: 后端服务冒烟**

```bash
cd backend && node dist/main.js &
sleep 5
curl -s http://localhost:3000/api/v1/health
```

预期：返回 `{"status":"ok","service":"relationmap-backend"}`。验证后终止该后台进程。

- [ ] **Step 5: 前端 dev server 冒烟**

```bash
cd frontend && npm run dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
```

预期：输出 `200`。验证后终止该后台进程。

- [ ] **Step 6: 收尾检查**

```bash
git status
```

预期：无未提交的业务改动（如验证产生临时文件则清理或忽略）。

## Self-Review 记录

1. **Spec coverage**：本计划仅实现骨架切片（spec 第 3.2/3.3 章目录结构、6.1 章 API 前缀）；业务模块（画布、角色、时间轴等）不在本计划范围，spec 未遗漏本切片内的要求。
2. **Placeholder scan**：无 TBD/TODO；所有代码与命令为完整可执行内容。
3. **Type consistency**：`health()` 返回值在 controller/service/spec 三处一致（`{ status: 'ok', service: 'relationmap-backend' }`）；全局前缀 `api/v1` 与 spec 6.1 一致。
