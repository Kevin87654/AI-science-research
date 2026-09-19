# 开发分支规范

> 团队 3 人 ｜ 更新日期 2026-09-19
> 一句话：**代码走个人分支、测试通过后合并；文档小改可直接提交 `main`。`main` 始终可部署。**

## 1. 分支划分

| 分支 | 归属 | 用途 |
|---|---|---|
| `main` | 全队共有 | 只接受已验证的代码合并；**文档小改可直接提交** |
| `dev/kevin` | [@Kevin87654](https://github.com/Kevin87654) | Kevin 的个人开发分支 |
| `dev/waixr016` | [@waixr016](https://github.com/waixr016) | waixr016 的个人开发分支 |
| `dev/fodenspider` | [@fodenspider](https://github.com/fodenspider) | fodenspider 的个人开发分支 |

## 2. 两条路径

| 改动类型 | 走哪条路 |
|---|---|
| **文档小改** —— 只动 `*.md`：错别字、格式、补一句说明、更新索引 | ✅ **可直接提交 `main`** |
| **其他一切** —— 代码、配置（`package.json` / `next.config.ts` / `.env.example`）、依赖、SQL 迁移、删除或重命名文件 | ✅ **走 `dev/<自己>` → PR → 合并** |

**拿不准就走分支。** 多花两分钟，比事后回滚便宜。

## 3. 路径 A：文档小改，直接提交 `main`

```bash
git checkout main
git pull origin main                    # 必须先拉，否则最容易冲突
# 编辑文档
git add -A
git commit -m "docs: 修正 xx 说明中的错别字"
git push origin main
```

- 如果 `push` 被拒（远端有别人的新提交）：先 `git pull --rebase origin main` 再推，**不要 `--force`**。
- 提交后顺手看一眼 diff，确认没把别人的改动覆盖掉。

## 4. 路径 B：代码改动，走个人分支

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
# ⑥ 至少 1 名队友确认、测试全部通过后合并（Squash merge）
```

## 5. 关键约定

1. **无论走哪条路，动手前先拉取。**
2. **`main` 必须始终可部署** —— 任何时刻从 `main` 部署都不应报错。
3. **代码合并前必须全过**：`pnpm lint` · 类型检查 · `pnpm build`；涉及核心流程的改动还要跑测试。
4. 代码改动由**本人发起 PR**，合并前**至少 1 名队友确认**，用 **Squash merge** 保持历史干净。
5. 冲突**在自己分支上解决**；**永远不要 `--force` 推送到 `main`**。
6. 分支合并进 `main` 后**不要删除远程分支**，保留开发痕迹（可作为"技术演进可追溯"的证据）。
7. **本仓库是 Public** —— 绝不提交 `.env.local`、真实密钥、API Key。
8. `main` **不设强制分支保护，靠三人自觉**。正因为没有系统兜底，规则外的情况请默认走分支。

## 6. 提交信息格式

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

## 7. 禁止事项

- ❌ 直接向 `main` 提交**代码、配置、依赖或 SQL 迁移**（文档小改除外）
- ❌ 使用 `git push --force`（确需强推时只在自己的分支上，并先通知队友）
- ❌ 提交 `.env.local`、真实密钥、API Key
- ❌ 把未通过构建的代码合并进 `main`
- ❌ **不拉取就直接改文件** —— 这是冲突的主要来源

## 8. 遇到问题

- 冲突不会解 → 先停手，在群里说清楚，不要乱 `reset`
- 怀疑提交了敏感内容 → **立刻说**，越早处理越好（仓库是公开的）
