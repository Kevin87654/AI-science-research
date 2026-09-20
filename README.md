# AI Science Research

> 粤港澳大湾区 AI Coding 创新大赛 · 赛题方向二：AI + 学术科研助手

项目文档在 [`docs/`](docs/) 目录，赛事原始材料在 [`赛事手册/`](赛事手册/) 目录。
开发协作规则见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 本地启动

使用 Node.js 24 与 pnpm 11.19.0。在项目目录运行：

```bash
pnpm install --frozen-lockfile
pnpm dev
```

打开 http://localhost:3000。Windows 也可双击 `run-dev.bat`。
当前工程不需要密钥即可启动；首页是产品介绍预览，尚未实现测评、AI 或数据保存。

```bash
pnpm check       # 代码规范、类型检查、生产构建
pnpm test        # 单元测试（Node 自带测试运行器，无需额外依赖）
pnpm start       # 构建成功后，本地启动生产版本
```

`GET /api/ping` 检查应用存活，明确返回数据库与 AI 尚未接入；不发起外部调用。
`POST /api/session` 建立匿名会话（HttpOnly Cookie）；`GET|POST /api/progress` 读写本人任务进度。
**当前进度存在内存里，进程重启即丢** —— 它是让第一条流程先跑通用的骨架，真实存储见下一步。
后续接入配置见 `.env.example`，真实值只放 `.env.local` 或部署平台环境变量。

工程边界、建议分工和开发顺序见 [`docs/工程起步与分工路线.md`](docs/工程起步与分工路线.md)。

## 团队

深圳大学 · 计算机与软件学院 · 3 人

| 成员 | GitHub | 专业 |
|---|---|---|
| Kevin | [@Kevin87654](https://github.com/Kevin87654) | 软件工程 |
| waixr016 | [@waixr016](https://github.com/waixr016) | 计算机科学与技术 |
| fodenspider | [@fodenspider](https://github.com/fodenspider) | 软件工程 |

## 开源协议

[MIT](LICENSE)
