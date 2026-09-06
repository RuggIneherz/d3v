# A Gift For User · 创作工具箱（ES Module 拆分 + 流式输出版）

人设生成 / 取名器 / 衣柜与穿搭 三模块单页工具，玻璃拟态风格。
本版本由原单文件 `1_创作工具箱融合版.html` 拆分为标准 Web 项目，并新增 **SSE 流式输出**（默认开启，可在「API 设置」中随时关闭）。

## 目录结构

```
创作工具箱项目/
├── index.html                 # 入口骨架（面板/模态框结构沿用原版）
├── css/
│   └── style.css              # 全部样式（与原版 <style> 一致，未改视觉）
├── js/
│   ├── main.js                # 入口：Tab / 背景图库 / 悬浮球 / API 设置弹窗 / 模块初始化
│   ├── utils.js               # 公共工具、全局 Toast、fetchChatStream（流式）、fetchChat（非流式）
│   ├── api-config.js          # 多份 API 配置档案（含 stream_enabled 流式开关）
│   └── modules/
│       ├── persona.js         # 人设生成（initPersona，支持流式逐字显示）
│       ├── namegen.js         # 取名器（initNameGen，九语种；AI 收集完整响应后解析）
│       └── wardrobe.js        # 衣柜与穿搭（initWardrobe，穿搭流式、识图非流式）
└── README.md
```

## 如何运行（重要）

项目使用 ES Module + importmap，且模块路径为绝对路径 `/js/...`，**不能直接双击 index.html（file:// 下无法加载模块）**，请用任意 HTTP 服务器以本目录为根打开：

```powershell
# 方式一：Python（本机自带）
cd 创作工具箱项目
python -m http.server 8000
# 浏览器访问 http://127.0.0.1:8000/

# 方式二：VS Code 的 Live Server 插件，右键 index.html → Open with Live Server
```

部署到 GitHub Pages 等静态托管时，把本目录内容作为站点根目录即可。

## 流式输出说明

- 每个 API 配置档案新增 `stream_enabled` 字段，**默认 true（开启）**。
- 「API 设置」弹窗温度滑块下方有复选框「启用流式输出」，取消勾选并保存后，人设生成 / 穿搭生成改为一次性返回；重新勾选即恢复逐字显示。
- 请求层 `fetchChatStream` 具备两级兜底：
  1. 自动轮试 `/v1/chat/completions`、`/chat/completions` 等候选地址；
  2. 若服务端无视 `stream:true`、直接返回 `application/json`，自动按一次性结果处理；
  3. 流式整体失败时，业务层会再降级为一次非流式请求。
- 取名器结果为短列表、识图结果为短描述，按设计统一走非流式，收集完整响应后再解析。

## 数据与兼容性

- 所有数据仍存于浏览器 localStorage，键名与旧版完全一致（如 `shared_api_profiles_v1`、`pp_*`、`ng_*`、`wd_*`、`user_bg_*`），旧数据无缝迁移。
- 旧版缺少 `stream_enabled` 的配置档案会自动补默认值，不影响已有地址 / 密钥 / 模型。

## 署名

悄quill · 本作品遵循 [CC BY-NC 4.0 协议](https://creativecommons.org/licenses/by-nc/4.0/)。
