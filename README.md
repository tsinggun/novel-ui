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

### 构造器
- **场景卡**：列出已加入的场景（完整描述），一个全局「本章备注」（基调/时间/氛围/转折）。
- **人物卡**：每个在构建器里的人物是**独立卡片**，各自一块「本章备注 · 衣服 / 心情 / 状态」，互不干扰。
- **情节卡**：
  - 每条情节独立保存**指定字数**和**一个技法**（点新的换旧的，再点取消）；
  - `↑ ↓` 调整顺序，`编辑` 原位展开修改，`×` 删除；
  - 底部「添加情节」打开弹窗：大号正文框 + 指定字数 + 技法选择（支持按**技法名或标签**搜索）；
  - 弹窗「取消 / Esc / 点遮罩」只关闭，**草稿保留**；只有「保存情节」才清空草稿并写入列表；
  - 「情节字号」A− / A＋ 调节 12–22px，列表正文和编辑框同步。
- **顶部工具**：
  - 事件统计（人物 / 场景 / 情节数量）；
  - `提示词预览`：查看拼好的全文，开头指令可改并「恢复默认」，支持复制全文；
  - `导出 / 导入` JSON（Harness 环境直接写磁盘，浏览器环境走下载）；
  - `清空构造器`（红色按钮，二次确认）：只清本章的情节、已加入的人物场景和备注，卡片库不受影响。
- 卡片可整块点击弹出详情弹窗（全文 + 加入/移出构建器、编辑、删除），按钮点击不会误触发。

### 卡片库
- 三个页面共用同一套卡片组件；**就地编辑**：正在编辑的那张在原位置变成表单，不会复制出一张新卡。
- 技法卡多一个**标签**字段：回车/逗号提交、× 删除、去重，页面顶部可按标签筛选（多个标签为"任一匹配"）。
- 删除技法会自动把它从情节上摘掉；删除人物会同时清理其本章备注。

### 提示词生成规则（`src/prompt.js`）
按 `buildPrompt()` 输出，结构固定为：

1. 开头指令（默认：*你是一名擅长结合积木要素来写小说的作家，现在根据排列的提示词来生成小说。*，可自定义）
2. `写作方式：按下面的顺序写成连贯的一章正文，不要逐条罗列或分段复述；人物与场景只用下列内容，不要新增设定。`
3. `【场景卡】` → 名称 + 场景描述
4. `【本章场景备注】` → 全局场景备注，独立成块
5. `【人物卡】` → 姓名 + 人物背景 + 本章备注
6. `【情节卡】` → 全章合计字数（有字数时），每条：情节内容 + `写作要求：约 N 字；用「技法」来写 —— 用法说明`；同一技法第二次起只写名字，不重复长说明

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
│  │  └─ TechniquePicker.jsx     # 情节的技法选择（可搜索）
│  └─ pages/
│     ├─ BuilderPage.jsx         # 构造器
│     ├─ CharacterPage.jsx       # 人物卡
│     ├─ ScenePage.jsx           # 场景卡
│     └─ TechniquePage.jsx       # 技法卡（带标签筛选）
└─ harness-dist/             # Harness 打包产物（已 gitignore）
```

## 数据与持久化

浏览器里存在 `localStorage`（key `novel-ui.builder.v1`），每次改动整包写回；同时 `persist.js` 会把数据 debounce 600ms 落盘到 Harness 的 `/plot-api/state`（`novel-ui.json`），换端口（localStorage 按源隔离）时也能读回磁盘那份。

数据结构：

```jsonc
{
  "characters":  [{ "id": "", "name": "", "detail": "", "createdAt": 0 }],
  "scenes":      [{ "id": "", "name": "", "detail": "", "createdAt": 0 }],
  "techniques":  [{ "id": "", "name": "", "detail": "", "tags": [], "createdAt": 0 }],
  "plots":       [{ "id": "", "content": "", "wordCount": 0, "techniqueIds": [] }],
  "inBuilder":   { "characters": [], "scenes": [] },
  "notes":       { "character": "", "scene": "" },
  "characterNotes": { "<人物 id>": "这一章的衣服 / 心情 / 状态" },
  "promptIntro": null,          // null 表示用默认开头指令
  "plotFontSize": 14            // 情节内容字号
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
