# AI Science Research

> 粤港澳大湾区 AI Coding 创新应用大赛 · **赛题方向二：AI + 学术科研助手**

把一个研究问题变成可检索、可追溯、可复用的知识——不是"输入问题 → 吐一段答案"的一问一答，而是一个会**自己决定调用哪个工具、把中间过程摊开给你看、把确认过的结论沉淀下来**的科研助手。

## 项目状态

🚧 **早期开发中。** 具体的选题正在收窄，Web 应用骨架尚未搭建，因此本仓库目前只有项目文档与工程约束。

## 技术栈

| 用途 | 选型 |
|---|---|
| 全栈框架 | Next.js（App Router）+ TypeScript，Node.js `22.x` |
| 界面 | Tailwind CSS + shadcn/ui |
| 模型调用 | Vercel AI SDK（流式 + function calling） |
| 数据库 | Postgres（Neon / Supabase，**必须走连接池**）+ pgvector |
| 对象存储 | Vercel Blob（客户端直传） |
| 图谱可视化 | Cytoscape.js / react-force-graph |
| 部署 | Vercel，函数区域 `hkg1`（中国香港） |

技术选型不是"哪个火用哪个"，每一条都对应赛事平台的真实约束（见下方文档）。例如：函数区域必须手动改成 `hkg1`，因为默认是美东，而评委在深圳。

## 目录结构

```
.
├── docs/          项目文档（含最高优先级的《开发约束规范》）
├── content/       单一事实来源：提示词 / schema / 领域知识（待创建）
├── app/           Next.js 应用，唯一可部署单元（待创建）
├── 赛事手册/       赛事原始材料（只读）
├── LICENSE        开源协议（赛事强制要求）
└── README.md
```

## 本地开发

`app/` 初始化后补充。

## 文档

- [**开发约束规范**](docs/开发约束规范.md) —— 本项目的第一约束，优先级高于个人偏好和任何 AI 建议。**写任何代码之前先读它。**

## 团队

| 成员 | GitHub |
|---|---|
| Huang Yu | [@Kevin87654](https://github.com/Kevin87654) |

<!-- 其余成员待补充 -->

## 开源协议

[MIT](LICENSE)
