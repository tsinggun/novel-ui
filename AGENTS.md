# AGENTS.md · 给接手这个仓库的 AI 看的说明书

> 这个文件是**操作手册**：怎么跑、能改哪、绝对不能碰什么。
> 产品需求与目录结构见 [doc.md](./doc.md)。

---

## 1. 这是什么

一个「积木式小说构建器」：把人物卡 / 场景卡 / 技法卡 / 情节卡排列组合，编译成一段给 AI 用的写作提示词，再由用户自己拿这段提示词去外部 AI 写正文。

**它不是 AI 客户端**：仓库里没有任何模型调用、没有 key、没有联网写作。别自作主张加。

三份形态共用一套业务代码：

| 形态 | 入口 | 存储 |
|---|---|---|
| 网页版 | `https://tsinggun.github.io/novel-ui/` | localStorage |
| 便携版（开发/日常） | `node client/server.mjs`，窗口在 `http://127.0.0.1:23871/` | 本机文件（单文件 json 或作品目录） |
| 单文件 exe | `release/小说构建器.exe` | 同上，运行时解到 `%LOCALAPPDATA%\NovelUI\app\<版本>\` |
| Tauri 客户端（半成品） | `src-tauri/` | 本机文件；**本机编不出安装包**（缺 MSVC 链接器），别浪费时间 |

---

## 2. 怎么跑

```bash
npm install

npm run dev          # 纯前端，端口 5199，没有 /plot-api（不能读写本地文件）
npm run client       # 构建 + 起便携版，自动开窗口（日常用这个）
npm run client:run   # 只起便携版，不重新构建
npm run lint         # oxlint src
npm run build        # 构建 dist（客户端用，base 为 /）
npm run exe          # 打包单文件 exe → release/小说构建器.exe
```

**必须用真 Node**：`C:\nvm4w\nodejs\node.exe`（v24）。AI 沙箱里 PATH 上的 `node` 是沙箱自带的，路径不同、行为不同。

**Windows 上的 git 不在 PATH**：用 `C:\Program Files\Git\cmd\git.exe`。

---

## 3. 代码地图

```
client/server.mjs          便携版服务端：静态服务 + /plot-api + 开窗 + 单实例
src/App.jsx                外壳：顶栏、左导航、视图切换、全局字号
src/App.css                所有布局与配色（~1400 行，改之前先读对应段落）
src/prompt.js              ★ 提示词编译器：卡片 → 提示词正文（改这里就是改产品核心）
src/useNovelData.js        数据模型：增删改 + normalize 默认值 + 持久化
src/persist.js             存储门面，业务层只从这里取函数
src/storage/{index,web,tauri}.js   存储适配层（web=HTTP 桥，tauri=Rust 命令）
src/pages/{Builder,Character,Scene,Technique}Page.jsx   四个视图
src/components/            NavTabs / DataBar / EntityCard / DetailModal / PromptPreview / CardSearch …
pack/                      单文件 exe 的打包工程（.NET 启动器 + 构建脚本）
```

**改提示词 → 只改 `src/prompt.js`。**
**改存储 → 只改 `client/server.mjs` 与 `src/storage/*`，UI 不该动。**

---

## 4. 存储模型（两套，都活着）

启动时按路径判断，**不要只实现一种**：

- 路径是 `.json` 文件 → **单文件模式**：整库读写，写前备份到同目录 `_novelui-backups/`（保留 10 份）
- 路径是文件夹且含 `manifest.json` → **作品目录模式**：一卡一文件

目录模式的三条铁律（写代码时不要破）：

1. **只写脏文件**：`writeWorkspace` 与上一份快照逐条对比，没变的卡一个字节都不碰
2. **原子写**：先写 `.<名字>.tmp` 再 `rename`，不允许出现半截文件
3. **改前留旧版**：每个文件在 `.history/<kind>/` 留最近 20 份，删卡也要先备份

`manifest.json` 存「索引 + 非卡片字段」：`files{kinds:{id:文件名}}` 与 `meta{inBuilder,inContext,notes,characterNotes,promptIntro,previousRecap,plotFontSize,title}`。

---

## 5. 绝对不要做的事

### 数据安全

- **不要读写用户真实的作品文件**。测试一律用 `%USERPROFILE%\Documents\NovelUI\sandbox\` 下自建的库。
- 不要用破坏性捷径（删库、清空、覆盖）来"解决"问题；先查根因。
- 迁移类操作必须**只读源文件**，并做**深度对比校验**，不一致就回滚目标目录。

### UI 硬约束（踩过坑）

- **`.topbar` 不能加 `backdrop-filter: blur()`** —— 会让设置下拉被画到工作区**下面**（DOM 在、尺寸正常但看不见）。
- **点击不能让列表项跳位**：标签筛选顺序恒定（按使用次数），选中只加高亮；导航顺序按数据派生，不按点击。
- **列表卡片必须等高**：`.card-grid { align-items: stretch }` + `.card__actions { margin-top: auto }`，否则同排按钮一高一低。
- **添加/编辑一律弹窗**，不要退回内联草稿卡。
- 顶栏按钮统一 `height:30px; padding:0 12px`，别让高度参差。
- 全站字号只走 `--fs` 变量（`useFontScale`），不要写死 px。

### 打包/启动

- 启动器必须是**隐藏窗口**，不能弹黑窗；双击不能出现两个窗口（单实例逻辑在 `server.mjs` 里）。
- `.cmd` / `.vbs` 启动器用 **ASCII + CRLF**，中文容易乱码。
- 弹系统文件框的结果**不能用 stdout 回传**（PS 5.1 是 GBK，中文路径会变成 `?`）：写到临时文件再用 UTF-8 读。
- vite 构建客户端用默认 base `/`；**`--mode pages` 会把 dist 覆盖成 `/novel-ui/`，会让便携版白屏**。

---

## 6. 交付流程（每次改完都走一遍）

```bash
npx oxlint src            # 必须 0 error
npx vite build            # 前端产物
# 重启便携版：杀掉跑 client\server.mjs 的 node → 杀标题为「小说构建器」的 chrome → 等 3s → 重新起
# 用浏览器验证（127.0.0.1:23871），确认窗口数为 1
# 需要出包时：npm run exe
git add -A && git commit -m "..." && git push
```

出问题时看两个日志：

- `%USERPROFILE%\Documents\NovelUI\client.log` —— 服务端（数据文件、开窗）
- `%USERPROFILE%\Documents\NovelUI\launcher.log` —— 单文件 exe 的启动器（解压、node PID、退出码）

---

## 7. 判断标准（写代码时用这几条自检）

- 一次编辑只应影响一个文件（目录模式）
- 提示词里每条情节都要能看到「技法名 + 用法说明」，不能只剩名字
- 102 张卡的库要能秒筛、秒滚，布局不抖
- 任何"批量"操作（选中、筛选、排序）都不允许让用户正在看的位置发生位移
- 新功能要么能写进提示词，要么能减少一次手工操作；否则不做
