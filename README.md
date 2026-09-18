# AI Science Research

> 粤港澳大湾区 AI Coding 创新应用大赛 · **赛题方向二：AI + 学术科研助手**

把一个研究问题变成可检索、可追溯、可复用的知识——不是"输入问题 → 吐一段答案"的一问一答，而是一个会**自己决定调用哪个工具、把中间过程摊开给你看、把确认过的结论沉淀下来**的科研助手。

## 项目状态

🚧 **早期开发中。** 具体的选题正在收窄，Web 应用骨架尚未搭建，因此本仓库目前只有项目文档与开发经验记录。

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
├── docs/          项目文档（按成员分目录）
├── content/       单一事实来源：提示词 / schema / 领域知识（待创建）
├── app/           Next.js 应用，唯一可部署单元（待创建）
├── 赛事手册/       赛事原始材料（只读）
├── LICENSE        开源协议（赛事强制要求）
├── README.md
├── .gitignore
└── .gitattributes
```

## 本地开发

`app/` 初始化后补充。

## 文档

- [**项目决策记录**](docs/项目决策记录.md) —— **本项目现行的唯一决策依据。** 作品形态（双轨）、赛事口径、Vercel 平台事实、技术栈与工程约束、待确认与待验证清单都在这里。**动手之前先读它。**
- [**技术经验与开发规范建议**](docs/黄瑜/技术经验与开发规范建议.md) —— 实测经验与工程方法论：Vercel + CodeBuddy Agent SDK 的实测结论、探针制度、错误可见性、提交前检查清单。
- [**FPS 专家开发追踪文档**](docs/李赫卓/FPS专家-开发追踪文档.md) —— 平台内专家 / Skill 的能力边界与分发机制探路结论，《项目决策记录》§5 的依据。

## 团队

深圳大学 · 计算机与软件学院 · 3 人

| 成员 | GitHub | 专业 |
|---|---|---|
| Kevin | [@Kevin87654](https://github.com/Kevin87654) | 软件工程 |
| waixr016 | [@waixr016](https://github.com/waixr016) | 计算机科学与技术 |
| fodenspider | [@fodenspider](https://github.com/fodenspider) | 软件工程 |

## 开源协议

[MIT](LICENSE)
