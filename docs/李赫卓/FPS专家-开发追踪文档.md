# FPS 专家开发追踪文档

> 会话日期：2026-09-18
> 主题：从零创建一个 FPS 数据教练专家，并探索"给别人用"的分发路径
> 用途：记录问题、结论与卡点，便于后续追踪

---

## 一、一句话总结

把一个 FPS 数据教练专家从零做完并注册成功，但在"怎么让别人用上"这一步撞上了三层结构性障碍：**概念边界不清 → 分发机制不通用 → 网页集成需要自建桥**。

---

## 二、决策时间线

| 阶段 | 做的事 | 产出 | 结论 |
|---|---|---|---|
| 1 | 创建专家 | `fps-data-coach` 专家包，Agent 型 | ✅ 成功注册，专家中心可见 |
| 2 | 生成头像 | 占位 PNG（512×512）+ 推荐 prompt | ⚠️ 图像生成工具不可用，只能占位 |
| 3 | 澄清"网页端链接" | 三种理解对照 | ✅ homepage 可加 / 平台链接可作数据源 / 独立网页版做不到 |
| 4 | 澄清专家 vs Skill | 结构对比 | ✅ 专家=谁在做，Skill=怎么做，专家可携带 Skill |
| 5 | 澄清 Skill 能否用链接调用 | 四条链接相关路径 | ✅ 本体不能变 URL，只能"链接送包" |
| 6 | 澄清网页调本机 Skill | 桥接架构 | ✅ "半个是"：需本机进程，但只应监听 127.0.0.1 |
| 7 | 打包分发 | zip + 免 Python 安装说明 | ✅ 可用，但只对有客户端的少数人 |

---

## 三、问题与结论清单

### Q1｜创建一个 FPS 游戏专家，擅长根据玩家游戏数据提供合理建议（经验：资深玩家）

**结论**：产出 `fps-data-coach`（花名「鹰瞳 / Hawkeye」，职业「FPS 数据教练」）。

关键设定：
- **类型**：Agent 型单人专家（`expertType: "agent"`）
- **分类**：`03-GameSpatial`（核心输出是游戏竞技改进方案、服务对象是 FPS 玩家，故归游戏类）
- **数据入口**：以战绩截图识别为主，通用 FPS 全适配
- **方法论**：四层诊断（生存 → 输出 → 交换 → 决策）+ 五类根因（机械 / 运动 / 认知 / 决策 / 协同）+ 七段式输出模板
- **表达基线**：默认按资深玩家水平，不解释基础概念，只讲边际收益

> 路径：`C:\Users\Administrator\.learnbuddy\plugins\marketplaces\my-experts\plugins\fps-data-coach`

---

### Q2｜这个专家是 AGENT 吗？可以给它一个网页端使用链接吗？

**第一个问题：是 Agent 型。**

依据：`expertType: "agent"`，`agents` 数组只有 1 个 MD 文件，没有 `teamInfo` / `members` / `settings.json`（这三样是 Team 型专属）。

**第二个问题：取决于"链接"指什么。**

| 理解 | 能否 | 说明 |
|---|---|---|
| `homepage` 元数据字段 | ✅ | 展示在专家详情页，点开跳浏览器。只是元数据，不给专家任何新能力 |
| 战绩平台链接作为数据源 | ✅ | 需改 prompt。目前只写了"截图优先"，遇到链接不一定会主动抓 |
| 独立网页版专家 | ❌ | 专家是客户端里的一份配置，不是 Web 服务 |

---

### Q3｜专家和 Skill 是一个东西吗？

**不是。Skill 是"怎么做"的能力包，专家是"谁在做"的角色包。**

| 维度 | Skill | 专家 Expert |
|---|---|---|
| 本质 | 能力 / 知识包 | 角色 / 人格 |
| 核心文件 | `SKILL.md` | `.codebuddy-plugin/plugin.json` + `agents/*.md` |
| 存放位置 | `~/.learnbuddy/skills/` 或项目级 | `$WORKBUDDY_CONFIG_DIR/plugins/marketplaces/my-experts/plugins/<name>/` |
| 是否出现在专家中心 | ❌ | ✅ |
| 是否有头像 / 开场白 / 推荐问法 | ❌ | ✅ |
| 触发方式 | AI 按需加载，可叠加多个 | 用户主动选择，构成会话主人格 |

**唯一交集**：专家的 `plugin.json` 有 `skills` 字段，可以预加载技能。类比——专家是员工（有姓名工位），Skill 是操作手册（谁需要谁翻），员工可以背包里塞几本手册。

---

### Q4｜Skill 可以用网页调用吗，通过链接使用？

**不能。Skill 没有"打开链接就能用"的运行地址。**

但链接跟 Skill 有四条真实关联：

| 链接的用法 | 能否 | 说明 |
|---|---|---|
| 介绍页链接 | ✅ | 注册表里的 `homepage`，是说明页不是运行入口 |
| 装 Skill 的来源 | ✅ | 注册表 zip 下载 / npm 风格仓库 / 客户端市场 |
| Skill 内部访问网页 | ✅ | 脚本 `curl` API 或让 agent 抓页面。方向是 Skill **用**网页 |
| Skill 产出网页链接 | ✅ | 那是**产物**的链接，与 Skill 本体无关 |
| Skill 本体变成 URL | ❌ | 没有服务端托管这一层 |

**根因**：Skill 跑起来依赖三样本机东西——文件系统、运行环境（Python/Node）、agent 循环。这三样都不在浏览器里。

---

### Q5｜Web 应用要调用本机 Skill，是不是需要让本机成为服务器？

**答案是"半个是"。**

需要的是一个**运行在本机、监听回环地址的进程**。如果走 HTTP，那个进程技术上就是服务器——但只是**本地回环服务器**，不是对外服务器。

**为什么绕不开这层桥**，浏览器沙箱卡在三件事上：

1. 读不了本地文件（`skills/*/SKILL.md` 对网页不可见）
2. 起不了本地进程（不能 `spawn` 去跑 Skill 里的脚本）
3. 跑不了 agent 循环（LLM 读说明 → 选工具 → 看结果 → 再决策，这套只在宿主里存在）

**四种桥的形态**：

| 形态 | 做法 | 适用 |
|---|---|---|
| 本地 HTTP 服务 | FastAPI 监听 `127.0.0.1:18899`，网页 fetch | 最通用，要处理 CORS |
| 网页也由本机服务提供 | 同一服务既发静态页又发 API | 最省事，同源无跨域 |
| 客户端 IPC 注入桥 | Electron preload 暴露 `window.api` | 桌面客户端内嵌网页的正解 |
| 扩展 / 自定义协议 | native messaging、`myapp://` | 网页在公网又想触达本机时的折中 |

**安全红线**：
- 只绑 `127.0.0.1`，永远不要 `0.0.0.0`（否则同局域网任何人都能调你本机能力）
- 校验 `Origin` 头，只放行自己域名
- 加启动时随机 token，防其他本地页面偷调
- 不要用内网穿透把本地端口直接暴露公网

---

### Q6｜我要给别人用，需要怎么做？

**最硬的约束：对方必须装了 WorkBuddy 客户端。** 这一条决定所有路线。

| 路线 | 做法 | 适用 | 成本 |
|---|---|---|---|
| **A 发 zip** | 打包 → 对方解压放目录 → 改 `marketplace.json` → 重启 | 少数装了客户端的人 | ✅ 已完成，最低 |
| **B git 市场仓库** | 推到仓库 → 对方添加市场源 → 你 push 即更新 | 一批人 + 持续更新 | 一个下午 |
| **C 网页版云服务** | 方法论搬到服务端，上传截图返回报告 | 对方不装客户端 | 等于重做，且要付 API 费 + 担隐私责任 |

**当前建议：先走 A。** 发一个朋友试装，验证"在别人机器上确实能装、确实好用"，再决定是否投入 B 或 C。

---

## 四、开发困境清单（按层面归类）

### 困境 1：概念边界不清 —— 专家 / Skill / 市场 / 客户端

**表现**：一开始会以为专家和 Skill 是同一层的东西，或者以为"专家"本身就是一个应用。

**真相**：这是四个不同的层级。
- **客户端**：提供运行环境与 agent 循环，是所有东西的宿主
- **市场（marketplace）**：一个带 `.codebuddy-plugin/marketplace.json` 的目录或 zip / git 仓库，负责"分发"
- **专家（Expert）**：市场里的一个条目，有身份、有头像、可被用户选中
- **Skill**：能力包，被 agent 按需加载，没有身份

**踩点**：专家是入口（用户能找到你），Skill 是装备（干活更专业）。**先有专家，再考虑加 Skill。**

---

### 困境 2：分发落差 —— 本机资产 ≠ 可获得链接使用的服务

**表现**：直觉上觉得"云文档能发链接，专家应该也能"。

**真相**：专家和 Skill 都是**本机资产**。能通过链接分发的只是"包"（zip / git 仓库），**能不能用还是取决于本地环境**。

**推论**：想让别人用你的专家 → 正确做法是打包发 zip 或建市场仓库，**发链接没用**。

---

### 困境 3：集成断层 —— 网页要调本机能力，必须自建桥

**表现**：以为网页可以直接读写本机文件或调用 Skill。

**真相**：浏览器沙箱是硬边界，必须有一层本机进程做桥。而且这条桥一旦建错（绑 `0.0.0.0`），就是**严重安全风险**。

**取舍**：如果只是自己用，**做网页不划算**——专家已装好，直接丢截图就行。真正值得做网页版的情形只有一个：**你要给别人用，而别人不愿意装客户端**。

---

### 困境 4：环境限制 —— 工具缺失与文档不一致

| 卡点 | 现象 | 绕法 |
|---|---|---|
| 图像生成工具不可用 | ToolSearch 查不到 `ImageGen` | 用纯 Python（zlib + struct）生成 512×512 PNG 占位图，README 附推荐 prompt 供后续替换 |
| 技能文档与实际脚本不一致 | `expert-manager` 的 SKILL.md 写 `.workbuddy-plugin/`，`init_expert.py` 实际生成 `.codebuddy-plugin/`，`validate_expert.py` 校验的也是后者 | **以脚本行为为准**，别照文档建错目录 |
| 配置目录不确定 | 官方文档写 `~/.workbuddy`，实际由 `WORKBUDDY_CONFIG_DIR` 决定 | 本机为 `C:\Users\Administrator\.learnbuddy` |
| Git Bash 路径转换 | `/tmp/x.py` 传给 Windows python.exe 被解析为 `c:\tmp\x.py` | 先 `cp` 到工作区，或用 `cygpath -w` |
| 市场源添加入口未验证 | `known_marketplaces.json` 支持 `type: directory \| zip`，但添加自定义源的 UI 入口没验证过 | **待确认**，别凭空给截图 |

---

### 困境 5：产品决策悬空 —— "给谁用"决定技术路线

**表现**：在"要不要做网页版"上反复权衡，因为目标用户是谁还没定。

**真相**：这个决策不该由技术难度决定，而由**目标用户是否愿意装客户端**决定。

- 愿意装 → 路线 A / B，成本极低
- 不愿意装 → 只能路线 C，成本高，且要承担 API 费用和隐私责任

**结论**：先用 A 做小范围验证，拿到真实反馈再投入。

---

## 五、环境事实速查

| 项目 | 值 |
|---|---|
| 配置目录 | `C:\Users\Administrator\.learnbuddy`（由 `WORKBUDDY_CONFIG_DIR` 决定） |
| 专家目录 | `...\plugins\marketplaces\my-experts\plugins\` |
| 专家包路径 | `...\my-experts\plugins\fps-data-coach\` |
| 用户级 Skill 目录 | `C:\Users\Administrator\.learnbuddy\skills\` |
| 市场源配置 | `~\.learnbuddy\plugins\known_marketplaces.json` |
| 打包产物 | `C:\Users\Administrator\learnbuddy\temp\dist\fps-data-coach.zip`（4 文件，106.9 KB） |
| 安装说明 | `C:\Users\Administrator\learnbuddy\temp\dist\安装说明.md`（免 Python 版） |

**专家包结构**：

```
fps-data-coach\
├── .codebuddy-plugin\plugin.json   # 身份、展示名、头像路径、标签、推荐问法
├── agents\fps-data-coach.md        # 角色 prompt（专家的人格与方法论）
├── avatars\expert.png              # 头像（当前为占位图）
├── README.md
└── .created-by-session
```

**关键命令**：

```bash
# 校验
python3 scripts/validate_expert.py <expert-dir>

# 注册（必须，否则专家中心不可见）
python3 scripts/register_expert.py <expert-dir> --session-id <id>

# 打包
python3 scripts/package_expert.py <expert-dir> [output-dir]
```

---

## 六、未决事项

- [ ] **目标用户是谁**：几个人用？他们现在有 WorkBuddy 客户端吗？（决定走 A 还是 C）
- [ ] **自定义市场源的添加入口**：客户端里"添加市场"的 UI 位置待验证
- [ ] **专家头像待替换**：目前是程序生成的占位图，README 里有推荐 prompt
- [ ] **是否补上"战绩平台链接抓取"能力**：改 prompt 即可，能让用户直接发 Leetify / Tracker.gg / 5E 主页链接
- [ ] **是否给专家挂 Skill**：如果"各游戏指标基准表"变长，可抽成 `skills/fps-metrics/`

---

## 七、下一步（按路线）

**如果走路线 A（推荐先做）**
1. 把 `fps-data-coach.zip` + `安装说明.md` 发给一个朋友
2. 让他照文档装，记录卡在哪一步
3. 拿到反馈后再决定是否投入 B / C

**如果走路线 B**
1. 建一个 git 仓库，根目录放 `.codebuddy-plugin/marketplace.json` 和 `plugins/fps-data-coach/`
2. 推到 GitHub
3. 让用户在客户端里添加市场源
4. 后续 `git push` 即可更新

**如果走路线 C**
1. 先把 `agents/fps-data-coach.md` 的方法论抽成服务端 prompt
2. 搭"上传截图 → 返回诊断报告"的最小闭环
3. 再考虑账户、计费、隐私清理
