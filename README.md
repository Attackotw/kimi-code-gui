花了两天，使用mimo + open design，以及kimi2.7 code + opencode 检查并更新相关功能。
但是最后的效果只能说差强人意，完成度不高，本意是想要参考 cc gui项目的模式，但是实现的不是很好，最后只实现了对kimi code gui 工具调用和对话的优化，未能实现对思考内容的展示，也没实现对选择模式，危险模式等等的选择，以及模型的修改。
暂时就想到这么多了，总归是一个学习ai的练手项目，效果只能说差点意思。体感上，还是学习一下基本的代码知识之后再做项目可能会更好吧。
以下是ai直接查看代码生成的，感觉不太准，审批交互是没有的，内置终端我没测试，其他倒是没问题。



# Kimi Code GUI

桌面端图形界面客户端，为 [kimi-code](https://github.com/MoonshotAI/Kimi-Code) CLI 提供可视化交互界面。

## 功能特性

- 💬 **智能对话** — 与 Kimi Code 进行自然语言交互，支持流式输出
- 📁 **文件浏览器** — 可视化浏览项目文件结构
- 🖥️ **内置终端** — 集成终端，实时查看命令执行结果
- ⚙️ **工具调用可视化** — 清晰展示 Agent 的工具调用过程
- ✅ **审批交互** — 支持对敏感操作进行确认审批
- 🎨 **深色/浅色主题** — 内置主题切换
- ⚡ **Electron 桌面应用** — 跨平台桌面原生体验

## 技术栈

- **前端框架**：React 19 + TypeScript
- **状态管理**：Zustand
- **构建工具**：Vite 7
- **桌面框架**：Electron 42
- **UI 图标**：Lucide React
- **Markdown 渲染**：react-markdown + remark-gfm

## 快速开始

### 环境要求

- Node.js >= 18
- npm 或 pnpm

### 安装

```bash
git clone https://github.com/Attackotw/kimi-code-gui.git
cd kimi-code-gui
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建桌面应用

```bash
npm run electron:build
```

构建产物位于 `dist/` 目录。

## 项目结构

```
├── electron/          # Electron 主进程代码
├── src/
│   ├── components/    # React 组件
│   ├── hooks/         # 自定义 Hooks
│   ├── stores/        # Zustand 状态管理
│   └── types/         # TypeScript 类型定义
├── designs/           # 设计稿
└── dist/              # 构建产物
```

## 许可证

MIT
