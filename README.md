# 小说构建器 · novel-ui

用「积木」拼小说的工作台：把**场景、人物、情节、技法**拆成一张张卡片，按顺序拼成"这一章"，再把排列结果自动拼成一段提示词，交给 AI 写成连贯的正文。

界面是深色网格 + 描边方框的工程图纸风格，四个 tab：

| Tab | 作用 |
| --- | --- |
| **构造器** | 本章的组装台：选场景、选人物、排情节、写备注，最后生成提示词 |
| **人物卡** | 卡片库：姓名 + 人物故事（背景） |
| **场景卡** | 卡片库：场景名 + 场景描述 |
| **技法卡** | 卡片库：技法名称 + 用法说明 + 标签，可按标签筛选 |

## 功能一览

### 全局
- **全局字号**：导航下方右侧的 `字号 A− / 100% / A＋`，范围 85%–150%、每档 5%，点百分比一键回到 100%。
  所有文案字号都写成 `calc(Npx * var(--fs))`，所以只放大文字、不动边框和间距（情节正文的独立字号也会跟着缩放）。
  比例存在 `localStorage`（`novel-ui.fontScale.v1`），刷新后保留。

### 构造器
- **分区 tab**：标题下是 `前情提要 / 场景 / 人物 / 情节` 四个分区 tab（各带数量），一次只展开一块，不再把所有卡片堆在一起；切 tab 不影响已填内容。
- **前情提要**（可选）：上一章结尾或必要前情，写进提示词的 `【前情提要】` 块；留空则整块不输出，建议 100–300 字。
- **场景卡**：列出已加入的场景（完整描述），一个全局「本章备注」（基调/时间/氛围/转折）。
- **人物卡**：每个在构建器里的人物是**独立卡片**，各自一块「本章备注 · 衣服 / 心情 / 状态」，互不干扰。
- **已在上下文开关（省 token）**：已加入构建器的人物 / 场景都能勾「已在上下文」——
  - 勾上后，提示词里这张卡**只留名字**（写成 `（人物设定已在上下文，不再重复）`），不再重复贴人物背景 / 场景描述；
  - **本章备注照常发**，且备注优先于卡片设定：`【人物卡】` 头会写明「人物背景与本章备注冲突时，以本章备注为准」，场景备注块同理；
  - 提示词预览标题会显示 `N 项已在上下文，少发 M 字`；
  - 移出构建器会自动取消该标记，「清空构造器」会一并清掉。
- **情节卡**：
  - 每条情节独立保存**指定字数**和**若干个技法**（多选，点一下选中、再点取消）；
  - `↑ ↓` 调整顺序，`编辑` 原位展开修改，`×` 删除；
  - 底部「添加情节」打开弹窗：**约 340px 高的大号正文框**（标题旁 A− / A＋ 直接调节正文字号 12–22px，与列表共用同一个字号设置）+ 指定字数 + 「使用技法」；
  - 「使用技法」：已选的技法以标签排开，**点标签上的 × 直接取消**；「选择技法」打开**二层弹窗**（样式复用技法卡页面：搜索 + 按标签筛选 + 每张卡显示名称/标签/用法说明），选中即生效，再点同一张即取消；
  - 二层弹窗 `z-index: 60` 盖在情节弹窗（`z-index: 40`）之上，**Esc / 点遮罩只关技法这一层**，下面的情节草稿不受影响；
  - 弹窗「取消 / Esc / 点遮罩」只关闭，**草稿保留**；只有「保存情节」才清空草稿并写入列表；
  - 「情节字号」A− / A＋ 调节 12–22px，列表正文和编辑框同步。
- **顶部工具**：
  - 事件统计（人物 / 场景 / 情节数量）；
  - `提示词预览`：查看拼好的全文，开头指令可改并「恢复默认」，支持复制全文；
  - `导出 / 导入` JSON（Harness 环境直接写磁盘，浏览器环境走下载）；
  - `清空构造器`（红色按钮，二次确认）：只清本章的情节、已加入的人物场景和备注，卡片库不受影响。
- 卡片可整块点击弹出详情弹窗（全文 + 加入/移出构建器、编辑、删除），按钮点击不会误触发。

### 卡片库
- 三个页面共用同一套卡片组件；点卡片或点「编辑」都打开**同一个放大弹窗**，在里面直接改姓名/名称、详情、标签，保存才写回，取消不保存；新建卡片仍在原位出现表单卡。
- 每个卡片页顶部都有**检索条**，按有没有标签分两种形态：
  - **技法卡（有标签）**：多条件，输入后「回车 / 失焦 / 逗号」即变成一个条件 chip，可点 `×` 单独移除、也可「清空」全部；多条件为「全都要命中」，匹配「技法名 + 标签」。
  - **人物卡 / 场景卡（无标签）**：普通单框搜索，边打边过滤名称，右侧显示 `命中 x / 总数 张` 和「清空」。
  - 技法页的检索与标签筛选可叠加（同时满足）。
- 技法卡多一个**标签**字段：回车/逗号提交、× 删除、去重，页面顶部可按标签筛选（多个标签为"任一匹配"）。
- 标签多了不糊：筛选区按使用次数排序，超过 12 个自动折叠成「展开全部」，8 个以上出现**标签搜索框**，已选标签始终排在最前；卡片上最多平铺 4 个标签，其余折成 `+N`，弹窗里可看可改全部。
- 删除技法会自动把它从情节上摘掉；删除人物会同时清理其本章备注。

### 提示词生成规则（`src/prompt.js`）
按 `buildPrompt()` 输出，结构固定为：

1. 开头指令（**可编辑**，默认文本包含两句）：
   ```
   你是一名擅长结合积木要素来写小说的作家，现在根据排列的提示词来生成小说。

   写作方式：请写成连贯的一章正文，按下面的顺序推进，不要逐条罗列或分段复述；不要改变已给出的人设、时间线和场景细节，也不要新增设定；直接输出正文，不要标题、要点、说明、字数统计或总结。
   ```
   在「提示词预览」弹窗里可直接改，也能「恢复默认」。
2. `【前情提要】` → 上一章结尾 / 必要前情（留空则不出现）
3. `【场景卡】` → 名称 + 场景描述
4. `【本章基调与备注】` → 全局场景备注，独立成块
5. `【人物卡】` → 姓名 + 人物背景 + 本章备注；勾了「已在上下文」的人物只输出 `姓名（人物设定已在上下文，不再重复）` + 本章备注，块头声明「备注优先于人物背景」
6. `【情节卡】` → 每条：情节内容 + `写作要求：约 N 字；用「技法」来写（技法用法说明）。`
   - 技法说明**直接写在情节这一行**，不再单列 `【本章技法】` 块，避免 AI 只读到技法名
   - 一条情节挂多条技法时写 `同时用「A」、「B」来写（「A」：说明；「B」：说明）`
   - 技法卡没写「用法说明」时只剩名字，预览弹窗会红框提示是哪些技法，并可一键跳去技法卡页补

## 快速开始

```bash
pnpm install        # 或 npm install
pnpm dev            # http://localhost:5173
pnpm dev -- --port 5199   # 本机常用的 5199
pnpm build          # 生产构建到 dist/
pnpm lint -- src    # oxlint（直接 npm run lint 会扫到 dist，报一堆噪音）
pnpm preview
```

> Git 在本机位于 `C:\Program Files\Git\cmd`，若终端里 `git` 找不到，把该目录加进 PATH。

## 目录结构

```
novel-ui/
├─ index.html
├─ vite.config.js            # 常规浏览器调试
├─ vite.harness.config.js    # 打成 Harness 单文件插件
├─ src/
│  ├─ main.jsx               # 浏览器入口
│  ├─ harness.jsx            # Harness 入口：把 UI 渲染进 Shadow DOM
│  ├─ App.jsx                # 四个 tab 的切换
│  ├─ useNovelData.js        # 全部数据 + 动作 + 持久化
│  ├─ persist.js             # Harness 磁盘桥（/plot-api/state、/plot-api/export）
│  ├─ prompt.js              # 提示词拼装
│  ├─ index.css / App.css    # 设计 token、网格背景、页面排版
│  ├─ components/
│  │  ├─ Card.jsx/.css           # 通用卡片容器
│  │  ├─ NavTabs.jsx             # 顶部导航
│  │  ├─ EntityCard.jsx          # 人物/场景/技法的展示卡（含详情弹窗）
│  │  ├─ EntityFormCard.jsx      # 共用的创建/编辑表单卡（含标签编辑器）
│  │  ├─ DetailModal.jsx/.css    # 卡片详情弹窗
│  │  ├─ PromptPreview.jsx/.css  # 提示词预览弹窗
│  │  └─ TechniqueField.jsx      # 情节的技法字段（已选标签 + 二层选择弹窗）
│  ├─ storage/                   # 存储适配层（见下文）
│  │  ├─ index.js                # 按运行环境选实现
│  │  ├─ web.js                  # Harness HTTP 桥 + localStorage 兜底
│  │  └─ tauri.js               # 客户端本地文件（预留）
│  └─ pages/
│     ├─ BuilderPage.jsx         # 构造器
│     ├─ CharacterPage.jsx       # 人物卡
│     ├─ ScenePage.jsx           # 场景卡
│     └─ TechniquePage.jsx       # 技法卡（带标签筛选）
└─ harness-dist/             # Harness 打包产物（已 gitignore）
```

## 存储适配层（为客户端做准备）

业务层只从 `src/persist.js` 取 `loadRemoteState` / `saveRemoteState` / `exportToDisk` / `importFromDisk`，具体落哪由 `src/storage/index.js` 按运行环境选：

| 环境 | 判定 | 实现 |
|---|---|---|
| 网页 / Harness | 无 `window.__TAURI_INTERNALS__` | `web.js`：`/plot-api/state` 读写 + 导出，失败退回 `localStorage` |
| Tauri 客户端 | 有 `window.__TAURI_INTERNALS__` | `tauri.js`：本地作品目录（`project.json` + `backups/`） |

`platform = { name, isDesktop }` 可直接给 UI 用来区分形态；IO 状态事件仍走 `novel-ui:persist`。

客户端侧 Rust 命令（已实现在 `src-tauri/src/main.rs`）：

```text
novel_load_state()              -> { data, path, updatedAt } | null
novel_save_state({ data })      -> { ok, path }         写临时文件后改名，写前自动备份
novel_export_file({ payload })  -> { path } | null
novel_pick_project()            -> { path, data } | null
novel_project_slug()            -> String
novel_switch_project({ slug })  -> String
```

目录式作品存储布局（客户端与便携版共用）：

```text
<文档>/NovelUI/
  current-project.txt           # 当前作品名（默认 default）
  <作品>/
    project.json                # 卡片库 + 构造器状态
    backups/project-<时间>.json # 自动备份，保留最近 10 份
    exports/*.json              # 手动导出
```

## 客户端（两种形态）

### 1. 便携版（今天就能用，不需要编译器）

本机装了 Node + Edge 即可：

```bash
npm run client          # 构建 dist 并开窗口（等于 双击「启动小说构建器.cmd」）
npm run client:build    # 只构建
npm run client:run      # 只起服务（dist 已构建过）
```

原理是 `client/server.mjs`：本机随机端口起静态服务 + 复刻 `/plot-api` 接口（数据落 `<文档>/NovelUI/<作品>/`），再用 `msedge --app=` 开一个无地址栏窗口，关窗即退出进程。窗口用独立 profile（`NovelUI/.window-profile`），不干扰你日常的 Edge。

- 数据位置：`%USERPROFILE%\Documents\NovelUI\default\project.json`
- 备份：每次写盘前先把旧文件拷进 `backups/`，只留最近 10 份
- 换作品：设环境变量 `NOVEL_PROJECT=我的长篇` 再启动

### 2. Tauri 打包版（需要 C++ 工具链）

工程已就绪：`src-tauri/`（`Cargo.toml`、`tauri.conf.json`、`capabilities/default.json`、图标），先自查环境：

```bash
node scripts/tauri.mjs          # 检查 cargo / rustc / std / MSVC 链接器
node scripts/tauri.mjs build    # 条件齐了才真正打包（NSIS 安装包）
npm run icons                   # 重新生成 src-tauri/icons
```

当前这台机器的缺口（脚本会直接告诉你）：Rust 缺 `x86_64-pc-windows-msvc` 的 std 组件，且没有 MSVC 链接器（Visual Studio 里没勾「使用 C++ 的桌面开发」）。补齐方式：

```text
rustup target add x86_64-pc-windows-msvc
Visual Studio Installer → 修改 → 勾选「使用 C++ 的桌面开发」→ 安装
```

补齐后再跑 `node scripts/tauri.mjs build`，产物在 `src-tauri/target/release/bundle/nsis/`。

## 数据与持久化

浏览器里存在 `localStorage`（key `novel-ui.builder.v1`），每次改动整包写回；同时 `storage/web.js` 会把数据 debounce 600ms 落盘到 Harness 的 `/plot-api/state`（`novel-ui.json`），换端口（localStorage 按源隔离）时也能读回磁盘那份。

数据结构：

```jsonc
{
  "characters":  [{ "id": "", "name": "", "detail": "", "createdAt": 0 }],
  "scenes":      [{ "id": "", "name": "", "detail": "", "createdAt": 0 }],
  "techniques":  [{ "id": "", "name": "", "detail": "", "tags": [], "createdAt": 0 }],
  "plots":       [{ "id": "", "content": "", "wordCount": 0, "techniqueIds": [] }],
  "inBuilder":   { "characters": [], "scenes": [] },
  "inContext":   { "characters": [], "scenes": [] },
  "notes":       { "character": "", "scene": "" },
  "characterNotes": { "<人物 id>": "这一章的衣服 / 心情 / 状态" },
  "promptIntro": null,          // null 表示用默认开头指令
  "plotFontSize": 14,           // 情节内容字号
  "previousRecap": ""           // 前情提要，空串表示不输出
}
```

`normalize()` 会在读取/导入时补齐缺字段（老数据里的技法会自动得到 `tags: []`），所以 JSON 少字段也能导入。

## Harness 插件模式

`vite.harness.config.js` 会把整个 UI（React 运行时 + 样式）打成单文件 `harness-dist/client.js`，通过 `window.__ModuleLoader__` 注册成「情节构造器」面板：主区域渲染完整界面，侧栏给一个图标；CSS 会被内联进 Shadow DOM，与宿主样式完全隔离。

```bash
pnpm vite build --config vite.harness.config.js
```

## 交互约定

- 弹窗：`Esc`、点遮罩、右上 `×` 都能关闭；表单类弹窗关闭不清数据（只有明确保存才写库）。
- 卡片的按钮区（加入/移出、编辑、删除）不会触发「点击卡片看详情」。
- 所有数据操作立即持久化，没有"保存全局"按钮。
