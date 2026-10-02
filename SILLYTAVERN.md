# 创作工具箱 × SillyTavern 扩展说明

本扩展把「人设生成 / 取名器 / 衣柜与穿搭」**原生挂进 SillyTavern 页面**（不是套一层网页窗口），
并且生成可以二选一：**用 SillyTavern 此刻连接的模型**，或**用工具箱自己的自定义 API**。
它还能**直接读取酒馆的角色卡 / 世界书 / 我的人设**当素材，并把生成结果**写回酒馆人设**。

---

## 一、安装

### 方式 1：用 URL 安装（推荐，可跟随仓库更新）

1. 打开 SillyTavern，点击顶部工具栏的 **扩展**（拼图 / 插件图标），展开 **Install extension** 区域；
2. 粘贴仓库地址（`.git` 可带可不带）：

   ```
   https://github.com/RuggIneherz/d3v
   ```

3. 点 **Install extension**。SillyTavern 会执行
   `git clone --depth 1 <url> data/<用户>/extensions/d3v`，并校验仓库根目录的 `manifest.json`；
4. 安装完成后在扩展列表里确认 **创作工具箱 (A Gift For User)** 处于启用状态；
5. **刷新页面**（F5）。右下角出现内置「小箱子」图标的状态球即可使用。

> 目录名由仓库名决定，所以会装成 `d3v`；扩展内所有资源地址都由 `import.meta.url` 推导，改名也能正常工作。
>
> **国内网络**：这里的地址只要能 `git clone` 就行（与仓库名、域名无关），可用加速前缀替换，实测列表见 [README 的「国内网络安装」](README.md#国内网络安装镜像加速)。

### 方式 2：手动放置（离线 / 内网）

把本仓库全部文件放进 `<SillyTavern>/data/<用户目录>/extensions/d3v/`（默认用户目录是 `default-user`），
刷新页面后在扩展列表里启用。

### 更新 / 卸载

- 更新：扩展面板里点该扩展的 **Update**（`manifest.json` 里 `auto_update: true`，走 `git pull`），或手动 `git pull` 后刷新；
- 卸载：扩展面板里点 **Delete**，或先关闭开关再删除目录，刷新页面即恢复原状。

---

## 二、用法

- **状态球**：右下角的球，**可拖动**（贴边自动吸附、位置按视口比例记忆，双击不生效，复位在设置里），
  **可自定义**（图标、**像素大小滑杆** 28–96px、不透明度），生成中会亮起一圈旋转光环；
  也可以**上传自己的图片**当球面（透明底 PNG 会自动压到 ≤128px 并保留透明；GIF 动图 ≤220KB）——
  用图片时**不再套圆形底色、边框、投影与日夜光晕**，图形本体就是按钮（生成中改为整图呼吸）；
- **扩展设置**：SillyTavern 扩展面板里找到「创作工具箱」抽屉，可开关状态球、设置启动自动打开 / 默认全屏 / 刷新后恢复上次状态，
  调整状态球外观与位置，切换主题跟随与日夜模式，并显示**当前 SillyTavern 连接**（例如 `GG · gemini-3.1-pro-preview`）；
- **面板标题栏**：`⤒` 从酒馆读取素材、`⤓` 把结果写入酒馆人设、`⟳` 重置工具箱（回到初始状态）、`⤢` 全屏 / 窗口、
  `⧉` 在新标签页打开原版单页、`✕` 关闭（也可按 `Esc`）；
- **结果回流**：工具箱悬浮菜单里多了「发到 ST 输入框」，可把当前结果直接送进 SillyTavern 的输入框（只在 ST 内显示）。

### 从酒馆读取素材（`⤒`）

点标题栏 `⤒` 打开小面板，三块素材都读进工具箱的「角色上下文」，生成时作为约束参与：

| 分区 | 读到什么 | 说明 |
| --- | --- | --- |
| 我的人设 | 酒馆侧边栏里各个人设的描述 | **有描述 = 优化模式**（保留既有设定、补全细化、不推翻重写）；**没有描述 = 新写模式** |
| 角色卡 | 当前 / 指定的角色卡：名称、描述、性格、场景、对话示例、系统提示，以及**卡内世界书** | 只取关键字段，不整卡原文粘贴 |
| 世界书 | 酒馆世界书列表，**只取启用中的条目**（被禁用的不读） | 一本世界书算一份素材 |

- 素材按标题去重：同一张卡 / 同一本世界书重复点只保留一份，**不同的会叠加**（可以"这张角色卡 + 那本世界书 + 我的人设"一起用）；
- 读完直接点工具箱里的「按模板生成」即可；「角色上下文」是普通文本框，读进去之后还能手动改；
- 全程**只读**：不会改动酒馆的角色卡、世界书或设置。

### 把结果写回酒馆人设（`⤓`）

点标题栏 `⤓`，选一个人设，当前结果就写进那个人的**描述**（`description`）：
只改描述，`position` 等其它字段原样保留，写完会调用酒馆自己的保存。

| 扩展设置项 | 默认 | 说明 |
| --- | --- | --- |
| 显示状态球 | 开 | 关掉后仍可从「扩展设置」抽屉里的按钮打开 |
| 打开 SillyTavern 后自动打开工具箱 | 关 | 每次刷新自动弹出 |
| 默认全屏显示 | 关 | 否则是 96vw × 94vh 的居中面板 |
| 刷新页面后恢复上次的开关状态 | 开 | 记在 `sessionStorage`，仅当前标签页有效 |
| 状态球：图标 | 空（内置小箱子） | 手填任意字符/emoji；留空用内置 SVG 小箱子 |
| 状态球：自定义图片 | 未设置 | PNG / GIF / WebP / JPG，透明底保留；用图片时无圆底无边框 |
| 状态球：大小 | 46px | 滑杆 28–96px（旧存档的 small/medium/large 会自动换算） |
| 状态球：不透明度 | 100% | 30%–100% |
| 状态球复位 | — | 回到右下角默认位置（拖动后自动吸附到最近的左右边） |
| 跟随酒馆主题配色 | 开 | 读 ST 主题变量着色，关掉则用工具箱自己的深色玻璃配色 |
| 日夜 | 跟随北京时间 | 7:00–18:00 判为白昼；也可固定常亮 / 常暗 / 不干预 |


---

## 三、两种生成后端

在工具箱的 **API 设置 → 生成后端** 里切换，选择会记在配置档案里：

### 1. SillyTavern 当前 API（默认，推荐）

用 SillyTavern 此刻连接的模型，**不需要再填地址和密钥**：

1. 优先走 ST 内置的**连接管理器**：取「当前选中的连接配置」，按其 provider / 模型 / 密钥发请求，支持流式逐字显示；
2. 若连接管理器不可用（未选择配置 / 扩展被禁用），退回 ST 自带的 `generateRaw`（用主 API 设置，一次性返回）。

首次在 SillyTavern 里运行、且自定义 API 还是空白时，会自动选到这一项。

### 2. 自定义 API

沿用工具箱原有的能力：多份 API 档案（地址 / 密钥 / 模型 / 温度 / 流式开关），
直连任何 OpenAI 兼容端点，并保留 `/v1` 自动补齐、流式失败自动降级等兜底。
原版单页（GitHub Pages）始终使用这一种。

> 备用识图 API 仍然只在「自定义 API」下生效；选 ST 后端时识图会走 ST 当前模型（模型支持视觉才行）。

---

## 四、它是怎么工作的

| 关注点 | 实现 |
| --- | --- |
| 安装入口 | 仓库根目录 `manifest.json`（ST 的安装接口只认这一种形式） |
| 入口脚本 | `manifest.json` 的 `js: "index.js"`，由 ST 以 ES Module 方式 `import()` |
| 界面 | 状态球 + 覆盖式面板（`st-ui.js` / `st-orb.js`），面板内是一个**影子根宿主** |
| 主题融合 | `st-theme.js` 只读地取 ST 主题变量（`--SmartThemeBodyColor` / `--SmartThemeBlurTintColor` / `--SmartThemeQuoteColor` / `--SmartThemeBorderColor` / `--SmartThemeShadowColor`），映射成 `--d3v-*` 写到面板、状态球与工具箱宿主上；面板背景、边框、强调色、滚动条随之变化 |
| 日夜 | 北京时间 7:00–18:00 为白昼，否则深夜；只影响光晕与背景明暗，不改变工具箱结构与配色语言 |
| 主题变化监听 | `MutationObserver` 观察 `:root` / `body` 的 style 与 `<head>` 里新增的样式表，再加 60 秒兜底 tick，主题一改就跟着刷新 |
| 生成中状态 | 观察影子根里工具箱的 `#uxToast` 是否带 `show` 类，据此点亮状态球的旋转光环 |
| 工具箱本体 | `st-mount.js` 取原版 `index.html` 的结构与 `css/style.css`，注入影子根，再把工具箱的 DOM 根切到影子根，最后加载原版 `js/main.js` |
| 样式隔离 | 全部工具箱样式只在影子根内生效；`st-style.css` 只服务面板外壳，类名统一 `d3v-` 前缀 |
| 生成后端 | `st-backend.js` 提供 ST 侧实现，`js/utils.js` 用它替换直连请求，未注入时自动回到自定义 API |
| 结果回流 | `insertToStInput()` 写入 `#send_textarea` 并派发 `input` 事件 |
| 写入人设 | `st-persona.js` 只改 `power_user.persona_descriptions[avatar].description`，再调 `saveSettingsDebounced()` |
| 从酒馆读取 | `st-source.js` 读 `getContext().characters` / `characterId`、`getWorldInfoNames()` + `loadWorldInfo()`（异步）、`powerUserSettings.personas` / `persona_descriptions` / `default_persona`，整理成带 `【标题】` 的素材块；`st-menus.js` 按标题去重后写进工具箱的 `#roleContextInput`，并派发 `input` 事件让工具箱保存自己的草稿 |

几个容易被忽略但已处理的细节：

- **`position: fixed` 不会跑出面板**：工具箱的背景层 / 弹窗 / 提示都是固定定位，
  在影子宿主上用 `transform: translateZ(0)` 建立包含块，把它们约束在面板内，而不是铺满整个 ST 窗口；
- **影子根里没有 `body`**：注入时把 `:root` 与 `body, html` 选择器映射到 `:host`，尺寸交给宿主元素；
- **原版代码改动极小**：只把 `document.xxx(` 换成 `$(...)` / `$all(...)`（DOM 根可切换），
  以及两处「API 是否就绪」的判断改为按后端判定；业务逻辑、数据结构、localStorage 键名都没动。

已核对过 SillyTavern 1.19.0 源码的几点：

1. 扩展目录静态可访问：`src/users.js` 中
   `router.use('/scripts/extensions/third-party/*', extensionsEnabledFeatureGuard, createExtensionsRouteHandler(...))`；
2. 没有 CSP 限制：`src/server-main.js` 使用 `helmet({ contentSecurityPolicy: false })`；
3. 生成接口：`public/scripts/extensions/shared.js` 的 `ConnectionManagerRequestService.sendRequest(profileId, prompt, maxTokens, { stream, signal })`
   与 `public/script.js` 的 `generateRaw({ systemPrompt, prompt, responseLength })`，两者都通过 `SillyTavern.getContext()` 拿得到。

---

## 五、常见问题

**安装时报 `Directory already exists`**
目录已存在，先删掉旧目录再安装，或直接走「更新」。

**装完扩展列表里没有 / 页面 403**
在 `config.yaml` 里检查 `extensions.enabled: true`；若开了白名单，确保通过 `127.0.0.1` 访问或在 `whitelist` 里放行。

**选「SillyTavern 当前 API」后生成报错**
先在 SillyTavern 里确认连接配置可用（发一条普通消息能出结果），再看报错信息：
连接管理器未选择配置时会退回 `generateRaw`，两者都不可用才会报「没有可用的生成接口」。

**用自定义 API 时页面报 `Mixed Content`**
ST 是 HTTPS 访问、而自定义 API 地址是 `http://`。这是浏览器对混合内容的限制，与扩展无关：
换成 HTTPS 地址，或改用 `http://127.0.0.1:<端口>` 访问 ST，也可以直接切到「SillyTavern 当前 API」。

**会不会影响我原来的工具箱数据？**
不会。所有数据仍在 localStorage，键名与旧版完全一致（`shared_api_profiles_v1`、`pp_*`、`ng_*`、`wd_*`、`user_bg_*`），
只是在活动档案里多了一个 `backend` 字段（缺省视为自定义 API）。在 ST 里运行时与 ST 共用同一份 localStorage，
键名前缀不同不会冲突；扩展自身的开关另存 `extension_settings.d3v`。

---

## 六、后续路线（可选）

1. **去面板化**：把面板外壳换成 ST 的抽屉 / 弹窗样式，视觉与 ST 主题完全统一；
2. ~~读回酒馆素材~~ / **写回酒馆**：已在 1.4.0 完成「读角色卡 / 世界书 / 我的人设」与 1.3.0 的「写回人设描述」；
   再往下可以按需**新建角色卡 / 世界书条目**（需要 ST 的保存接口，改动面比只读大）；
3. **识图走 ST**：把备用识图 API 也接到 ST 的多模态源上，不再要求单独配置；
4. ~~原版模块瘦身~~：已在 1.3.0 完成——三个功能模块按「状态 / 提示词 / 解析 / 渲染 / 交互」分层，
   单文件 ≤400 行、单函数 ≤50 行，元素 id 与 localStorage 键名保持不变。

---

## 七、自检与回归

```powershell
node tests/selfcheck.mjs        # manifest / 资源引用 / ST 路径解析 / 版本号一致性
node tests/source.test.mjs      # 「从酒馆读取」的纯逻辑单测（24 项，用替身酒馆上下文）
```

`selfcheck` 校验 `manifest.json` 合法性、`index.html` / `index.js` / `st-*.js` / `st-style.css` 的资源引用是否存在、
`EXT_VERSION` 与 `manifest.version` 是否一致，以及 `../../../extensions.js` 是否按 ST 的 URL 规则解析到 `/scripts/extensions.js`。
改动后跑一次，能挡掉大多数「装上却加载失败」的问题。
