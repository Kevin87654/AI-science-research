# 开发分支规范

> 团队 3 人 ｜ 更新日期 2026-09-19
> 一句话：**每人一条自己的分支开发，测试通过后才合并到 `main`。`main` 始终可部署。**

## 1. 分支划分

| 分支 | 归属 | 用途 |
|---|---|---|
| `main` | 全队共有 | **只接受已通过的合并**，是提交给赛事的版本 |
| `dev/kevin` | [@Kevin87654](https://github.com/Kevin87654) | Kevin 的个人开发分支 |
| `dev/waixr016` | [@waixr016](https://github.com/waixr016) | waixr016 的个人开发分支 |
| `dev/fodenspider` | [@fodenspider](https://github.com/fodenspider) | fodenspider 的个人开发分支 |

**任何人不直接在 `main` 上开发或提交。**

## 2. 日常工作流

```bash
# ① 拉取最新 main
git checkout main
git pull origin main

# ② 同步到自己的分支
git checkout dev/<你的名字>
git merge main

# ③ 开发，并在本地跑完测试
pnpm lint && pnpm exec tsc --noEmit && pnpm build

# ④ 提交并推送到自己的分支
git add -A
git commit -m "feat: 说明这次做了什么"
git push origin dev/<你的名字>

# ⑤ 在 GitHub 上发起 PR：dev/<你的名字> → main
# ⑥ 至少 1 名队友确认、测试全部通过后合并
```

## 3. 关键约定

1. **先拉取，再提交。** 每天开工前、每次推送前，都先同步 `main`。
2. **只在 `main` 上合并，不在 `main` 上直接改。**
3. **合并前必须全部通过**：`pnpm lint` · 类型检查 · `pnpm build`；涉及核心流程的改动还要跑测试。
4. 合并由**改动者本人发起 PR**，合并前**至少 1 名队友确认**。
5. 合并方式用 **Squash merge**，保持 `main` 历史干净（一个功能一个提交）。
6. **`main` 必须始终可部署。** 任何时刻从 `main` 部署都不应报错。
7. 冲突**在自己分支上解决**；**永远不要 `--force` 推送到 `main`**。
8. 分支合并进 `main` 后，**不要删除远程分支**，保留开发痕迹（可作为"技术演进可追溯"的证据）。

## 4. 提交信息格式

```
<类型>: <一句话说明>
```

| 类型 | 含义 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修复缺陷 |
| `docs` | 只改文档 |
| `refactor` | 重构，不改外部行为 |
| `test` | 测试相关 |
| `chore` | 构建、依赖、配置等杂项 |

例：`feat: 新增科研认知测评页面与规则评分`

## 5. 禁止事项

- ❌ **不直接向 `main` 推送**
- ❌ 不使用 `git push --force`（确需强推时，只在自己的分支上，并先通知队友）
- ❌ 不提交 `.env.local`、真实密钥、API Key —— **本仓库是 Public，所有人可见**
- ❌ 不把未通过构建的代码合并进 `main`
- ❌ 不在 `main` 上做"临时改一下"这类提交

## 6. 遇到问题

- 分支冲突不会解 → 先停手，在群里说清楚，不要乱 `reset`
- 怀疑提交了敏感内容 → **立刻说**，越早处理越好（仓库是公开的）
