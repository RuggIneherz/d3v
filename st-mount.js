/**
 * 创作工具箱 · 原生挂载
 * ---------------------------------------------------------------------------
 * 把原版工具箱「搬进」SillyTavern 页面本身，而不是套一层网页窗口：
 *   1. 取原版 index.html 的 body 结构与 css/style.css；
 *   2. 注入面板里的**影子根**（Shadow DOM）——工具箱样式不外泄、ST 样式不内侵；
 *   3. 把工具箱的 DOM 根指到影子根，并注入 SillyTavern 生成后端；
 *   4. 最后加载原版 js/main.js，三大模块照常初始化。
 * 原版单页（GitHub Pages）仍照旧运行：不注入后端时自动使用自定义 API。
 */
import { PAGE_URL, LOG_PREFIX } from './st-host.js';
import { createStBackend } from './st-backend.js';
import { themeBridgeCss } from './st-theme.js';

const TOOLBOX_CSS_URL = new URL('./css/style.css', import.meta.url).href;
const TOOLBOX_UTILS_URL = new URL('./js/utils.js', import.meta.url).href;
const TOOLBOX_MAIN_URL = new URL('./js/main.js', import.meta.url).href;

/** 影子根里补的适配样式：影子根没有 body/html，把尺寸挂到宿主与内层容器上 */
const ADAPTER_CSS = `
    #d3v-page { position: absolute; inset: 0; }
`;

let mountToken = 0;

/**
 * 把工具箱挂进 host（一个普通元素，函数内部给它的影子根填充内容）
 * @param {HTMLElement} host
 * @param {{ force?: boolean }} [options] force=true 时重新注入结构与脚本（相当于刷新）
 */
export async function mountToolbox(host, { force = false } = {}) {
    if (!host) throw new Error('缺少挂载容器');
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    if (shadow.__d3vMounted && !force) return shadow;

    const token = ++mountToken;
    const [html, css] = await Promise.all([
        fetch(PAGE_URL).then((r) => r.text()),
        fetch(TOOLBOX_CSS_URL).then((r) => r.text()),
    ]);
    if (token !== mountToken) return shadow;   // 期间又刷新了一次，丢弃本次结果

    const doc = new DOMParser().parseFromString(html, 'text/html');
    // 原版是用 <script type="module" src="./js/main.js"> 启动的，这里改由扩展 import
    doc.querySelectorAll('script, link[rel="stylesheet"]').forEach((el) => el.remove());
    // 影子根里 :root / body 不会命中，改挂到宿主元素上
    const scopedCss = css.replace(/:root\b/g, ':host').replace(/body\s*,\s*html/g, ':host');
    shadow.innerHTML = `<style>${scopedCss}</style><style>${ADAPTER_CSS}</style><style>${themeBridgeCss()}</style><div id="d3v-page">${doc.body.innerHTML}</div>`;
    shadow.__d3vMounted = true;

    // 1) DOM 根指向影子根；2) 注入 SillyTavern 生成后端
    const utils = await import(TOOLBOX_UTILS_URL);
    utils.setDomRoot(shadow);
    utils.useStBackend(createStBackend());

    // 3) 启动原版入口（force 时带查询串，绕过模块缓存重新初始化）
    const entry = force ? `${TOOLBOX_MAIN_URL}?r=${Date.now()}` : TOOLBOX_MAIN_URL;
    document.dispatchEvent(new CustomEvent('d3v:before-toolbox-init', { detail: { shadow } }));
    await import(entry);
    console.info(`${LOG_PREFIX} 工具箱已原生挂载到 SillyTavern 页面（影子根隔离）`);
    return shadow;
}
