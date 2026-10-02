# A Gift For User · 创作工具箱（ES Module 拆分 + 流式输出版）

人设生成 / 取名器 / 衣柜与穿搭 三模块单页工具，玻璃拟态风格。
本版本由原单文件 `1_创作工具箱融合版.html` 拆分为标准 Web 项目，并新增 **SSE 流式输出**（默认开启，可在「API 设置」中随时关闭）。

**同时它也是一个 SillyTavern 扩展**：克隆本仓库后可直接在 SillyTavern 的「扩展」面板里用 URL 安装，
工具箱会**原生挂进 ST 页面**（不是套一个网页窗口），生成可以二选一：

- **SillyTavern 当前 API** —— 直接用 ST 此刻连接的模型，不用再填地址 / 密钥；
- **自定义 API** —— 沿用工具箱原有的多份 API 档案（地址 / 密钥 / 模型 / 流式开关）。

详见 [SILLYTAVERN.md](SILLYTAVERN.md)。

**在酒馆里可以做的事**

- `⤒ 从酒馆读取`（1.4.0 新增）：把**角色卡**（含卡内世界书）、**世界书**（只取启用中的条目）、**我的人设**读进工具箱的「角色上下文」，
  生成时作为约束参与；同一份素材重复读只保留一份，不同素材会叠加；
- 人设**已有描述就走「优化」**（保留既有设定、补全细化、不推翻重写），**没有描述就走「新写」**；
- `⤓ 写入酒馆人设`（1.3.0 新增）：把生成结果写进酒馆某个人设的描述，只改 `description`，其它字段原样保留。

## 目录结构

```
d3v/
├── manifest.json              # ★ SillyTavern 扩展清单（新增）
├── index.js                   # ★ ST 扩展入口：生命周期装配（新增）
├── st-host.js                 # ★ 与 ST 交互：常量 / 设置读写 / 回填输入框（新增）
├── st-backend.js              # ★ ST 生成后端：连接管理器 + generateRaw 兜底（新增）
├── st-theme.js                # ★ 酒馆主题桥：读 --SmartTheme* 变量 + 日夜阶段（新增）
├── st-orb.js                  # ★ 可拖动、可自定义的状态球（新增）
├── st-mount.js                # ★ 把原版工具箱原生挂载进影子根（新增）
├── st-ui.js                   # ★ 悬浮球 + 覆盖式面板（新增）
├── st-menus.js                # ★ 标题栏两个小面板：写入人设 / 从酒馆读取（新增）
├── st-persona.js              # ★ 酒馆人设（Persona）读写（新增）
├── st-source.js               # ★ 从酒馆读角色卡 / 世界书 / 我的人设（新增）
├── st-drawer.js               # ★ ST「扩展设置」里的抽屉（新增）
├── st-style.css               # ★ 只作用于 ST 主界面的样式，d3v- 前缀收口（新增）
├── index.html                 # 工具箱入口骨架（新增了「生成后端」选择与「发到 ST 输入框」）
├── css/
│   └── style.css              # 全部样式（视觉与原版一致，末尾新增后端选择的样式）
├── js/
│   ├── main.js                # 入口：Tab / 背景图库 / 状态球 / API 设置弹窗 / 模块初始化
│   ├── utils.js               # 公共工具、DOM 根切换、生成后端分发、fetchChatStream / fetchChat
│   ├── api-config.js          # 多份 API 配置档案（含 stream_enabled 与 backend 字段）
│   └── modules/               # 三个功能各自按「状态 / 提示词 / 解析 / 渲染 / 交互」分层
│       ├── persona/           # 人设生成（initPersona，流式逐字显示）
│       ├── namegen/           # 取名器（initNameGen，九语种词库在 data.js）
│       └── wardrobe/          # 衣柜与穿搭（initWardrobe，穿搭流式、识图非流式）
├── tests/
│   ├── selfcheck.mjs          # 静态自检：manifest / 资源引用 / ST 路径解析 / 版本号一致
│   └── source.test.mjs        # 「从酒馆读取」的纯逻辑单测（不需要浏览器）
├── SILLYTAVERN.md             # 安装说明、双后端说明、FAQ 与后续路线
└── README.md
```

> `manifest.json` / `index.js` / `st-*.js` / `st-style.css` 只服务 SillyTavern，不影响下面这种纯网页用法。
> 其中 `js/` 是工具箱自身的逻辑（DOM 根可切换），`st-*.js` 是扩展侧代码。

## 如何在 SillyTavern 里安装

1. 打开 SillyTavern → 顶部 **扩展**（拼图图标）→ **Install extension**；
2. 粘贴本仓库地址：`https://github.com/RuggIneherz/d3v`
3. 安装完成后在扩展列表里启用 **创作工具箱 (A Gift For User)**，刷新页面；
4. 右下角出现「小箱子」状态球（可拖动、可换图标 / 上传自己的透明底 PNG·GIF），点开即用；扩展设置抽屉里也能打开 / 在新标签页打开。
5. 面板标题栏 `⤒` 可以**直接从酒馆读取角色卡 / 世界书 / 我的人设**填进「角色上下文」，`⤓` 把生成结果**写回酒馆人设**。

完整步骤、选项说明与常见问题见 [SILLYTAVERN.md](SILLYTAVERN.md)。

## 国内网络安装（镜像加速）

SillyTavern 的「Install extension」本质是让**服务端**执行 `git clone <你填的地址>`，再读仓库根目录的 `manifest.json`。
所以只要地址能 clone 到本仓库就行 —— **仓库名带不带连字符、是不是 github.com 都不影响**（`d3v` 这个名字完全可用）。

直连 GitHub 不畅时，可以用下面这些地址（2026-10 实测可 clone，返回的提交与官方一致；第三方服务随时可能失效）：

| 安装地址 | 说明 |
| --- | --- |
| `https://gitee.com/RuggIneherz/d3v` | **国内镜像（推荐）**，国内直连，随本仓库自动同步 |
| `https://github.com/RuggIneherz/d3v` | 官方源 |
| `https://ghfast.top/https://github.com/RuggIneherz/d3v.git` | 加速代理，实测可用 |
| `https://gh-proxy.com/https://github.com/RuggIneherz/d3v.git` | 加速代理，实测可用 |
| `https://ghproxy.net/https://github.com/RuggIneherz/d3v.git` | 加速代理，实测可用 |
| `https://gh.llkk.cc/https://github.com/RuggIneherz/d3v.git` | 加速代理，实测可用 |

Gitee 镜像由 `.github/workflows/mirror-to-gitee.yml` 维护：每次 push 到 `main` 自动同步，另有每日兜底同步。

- 用哪种地址装，目录名都是 `d3v`（ST 取仓库名），彼此可互换；
- 之后点「Update」会沿用**安装时那个地址**去 `git pull`，镜像失效时换个地址重装一次即可；
- 加速代理是第三方转发/缓存服务（Gitee 镜像是本仓库的自动副本），扩展代码会在你的酒馆里运行；
  介意供应链风险的话，用官方地址或 Gitee 镜像。

## 如何运行（纯网页版，重要）

项目使用 ES Module + importmap，模块路径为相对路径（`./js/main.js`、`css/style.css`），
因此**不能直接双击 index.html（file:// 下无法加载模块）**，请用任意 HTTP 服务器以本目录为根打开：

```powershell
# 方式一：Python（本机自带）
cd d3v
python -m http.server 8000
# 浏览器访问 http://127.0.0.1:8000/

# 方式二：VS Code 的 Live Server 插件，右键 index.html → Open with Live Server
```

部署到 GitHub Pages 等静态托管时，把本目录内容作为站点根目录即可；
SillyTavern 会把同一份文件通过 `/scripts/extensions/third-party/d3v/` 静态路由读进**影子根**，
两边的入口（网页版 / 扩展版）互不干扰。

## 流式输出说明

- 每个 API 配置档案有 `stream_enabled` 字段，**默认 true（开启）**；`backend` 字段记录生成后端（`st` / `custom`）。
- 「API 设置」弹窗里可切换生成后端，可关闭流式输出：关掉后人设 / 穿搭改为一次性返回。
- 自定义后端下，`fetchChatStream` 具备两级兜底：
  1. 自动轮试 `/v1/chat/completions`、`/chat/completions` 等候选地址；
  2. 若服务端无视 `stream:true`、直接返回 `application/json`，自动按一次性结果处理；
  3. 流式整体失败时，业务层会再降级为一次非流式请求。
- SillyTavern 后端下，流式由连接管理器提供；若服务端忽略流式标记，会自动降级为一次性结果。
- 取名器结果为短列表、识图结果为短描述，按设计统一走非流式，收集完整响应后再解析。

## 数据与兼容性

- 所有数据仍存于浏览器 localStorage，键名与旧版完全一致（如 `shared_api_profiles_v1`、`pp_*`、`ng_*`、`wd_*`、`user_bg_*`），旧数据无缝迁移。
- 旧版缺少 `stream_enabled` / `backend` 的配置档案按既有行为补默认值，不影响已有地址 / 密钥 / 模型。
- 在 SillyTavern 里运行时与 ST 共用同一份 localStorage；键名全部带 `pp_` / `ng_` / `wd_` / `user_bg_` 等前缀，不会与 ST 自身设置冲突。
- ST 扩展自身的开关项另外存于 `extension_settings.d3v`（并冗余一份到 localStorage 的 `d3v_st_settings_v1`）。

## 自检

```powershell
node tests/selfcheck.mjs        # 静态自检：manifest / 资源引用 / ST 路径 / 版本号一致
node tests/source.test.mjs      # 「从酒馆读取」纯逻辑单测（24 项，不需要浏览器）
```

## 版本记录

| 版本 | 内容 |
| --- | --- |
| 1.4.0 | 与酒馆双向互通：新增**「从酒馆读取」**（`⤒`）——把**角色卡**（含卡内世界书）、**世界书**（只取启用条目）、**我的人设**读进「角色上下文」；人设**有描述=优化模式**（保留原设定改写）、**无描述=新写模式**，素材按标题去重叠加、可反复读不同角色卡与世界书。状态球**自定义图片不再被拘在圆里**：上传透明底 PNG / GIF 后去掉圆形底色、边框、投影与日夜光晕，图形本体就是按钮（生成中改整图呼吸）。新增 `st-source.js` / `st-menus.js` 与 `tests/source.test.mjs`（24 项纯逻辑单测），`selfcheck` 增加版本号一致性检查。 |
| 1.3.0 | 界面与体验：状态球**可拖动**（贴边吸附、按视口比例记忆位置）、**可自定义**（图标 / 大小 / 不透明度），生成中亮起旋转光环；面板与状态球**跟随酒馆主题配色**（读 `--SmartTheme*`）并带**日夜阶段**。同时把三个功能模块按「状态 / 提示词 / 解析 / 渲染 / 交互」彻底分层重构（`js/modules/{persona,namegen,wardrobe}/`），函数与文件规模全部收进约定（单文件 ≤400 行、单函数 ≤50 行）；对外行为、元素 id、localStorage 键名一律未变。 |
| 1.2.0 | 工具箱改为**原生挂载**进 SillyTavern（影子根隔离，不再用 iframe 套网页），并新增**双生成后端**：SillyTavern 当前 API（连接管理器，流式）/ 自定义 API；新增 `st-backend.js`、`st-mount.js`，新增「发到 ST 输入框」。 |
| 1.0.0 | 由单文件 `1_创作工具箱融合版.html` 拆分为 ES Module 项目，新增 SSE 流式输出（默认开启，可在「API 设置」中关闭）。 |

## 署名

悄quill · 本作品遵循 [CC BY-NC 4.0 协议](https://creativecommons.org/licenses/by-nc/4.0/)。
