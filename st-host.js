/**
 * 创作工具箱 · SillyTavern 宿主适配层
 * ---------------------------------------------------------------------------
 * 只负责「和 SillyTavern 打交道」的公共部分：
 *   - 常量（版本号 / 存储键 / 原版页面地址）
 *   - 扩展自己的开关读写：优先 ST 的 extension_settings，取不到退回 localStorage
 *   - 把文本送回 ST 输入框
 * 生成能力在 st-backend.js，界面在 st-ui.js / st-drawer.js。
 */

export const LOG_PREFIX = '[创作工具箱]';
export const EXT_VERSION = '1.3.0';            // 需与 manifest.json 的 version 一致
export const EXT_KEY = 'd3v';                  // extension_settings 里的键名
export const SETTINGS_KEY = 'd3v_st_settings_v1';
export const OPEN_STATE_KEY = 'd3v_st_open_v1';
export const PAGE_URL = new URL('./index.html', import.meta.url).href;

export const DEFAULT_SETTINGS = Object.freeze({
    showFab: true,            // 显示状态球
    openOnStart: false,       // 启动后自动打开
    defaultFullscreen: false, // 默认全屏
    rememberLastOpened: true, // 刷新页面后恢复上次开关状态
    orbIcon: '',              // 自定义文字/emoji；留空 = 内置 SVG 小箱子
    orbImage: '',             // 自定义图片（dataURL，透明底 PNG / GIF）
    orbSize: 46,              // 直径（px，28 - 96）
    orbOpacity: 1,            // 0.3 - 1
    orbPos: null,             // { x, y } 视口比例；null 表示默认位置
    followTavernTheme: true,  // 跟随酒馆主题配色
    dayNightMode: 'auto',     // auto（按北京时间）| day | night | off
});

/** ST 的扩展模块（`../../../extensions.js`），取不到时为 null */
let st = null;
let settings = { ...DEFAULT_SETTINGS };

export function getSettings() {
    return settings;
}

export function readLocalJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        console.debug(LOG_PREFIX, '读取本地设置失败', error);
        return fallback;
    }
}

export function writeLocalJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.debug(LOG_PREFIX, '写入本地设置失败（隐私模式或配额已满）', error);
        return false;
    }
}

/** 动态取 ST 的扩展模块；不同 ST 版本路径一致，但失败时不能影响扩展加载 */
async function loadStApi() {
    try {
        const mod = await import('../../../extensions.js');
        if (mod && mod.extension_settings && typeof mod.extension_settings === 'object') {
            return mod;
        }
    } catch (error) {
        console.debug(LOG_PREFIX, '未取到 SillyTavern 扩展模块，改用 localStorage 保存设置', error);
    }
    return null;
}

export async function loadSettings() {
    st = await loadStApi();
    const stored = st?.extension_settings?.[EXT_KEY];
    const local = readLocalJson(SETTINGS_KEY, {});
    settings = {
        ...DEFAULT_SETTINGS,
        ...(local && typeof local === 'object' ? local : {}),
        ...(stored && typeof stored === 'object' ? stored : {}),
    };
    return migrateLegacySettings(settings);
}

/**
 * 旧存档迁移（只在确实是老格式时动手）：
 *  - 老版 orbSize 是 'small'|'medium'|'large' → 换算成像素；
 *  - 老版默认图标是 emoji '🎁'（当时没有内置 SVG 箱子），迁移时清掉它，
 *    否则用户升级后会一直看到那个 emoji，以为没换新图标。
 */
export function migrateLegacySettings(current) {
    if (typeof current.orbSize === 'string') {
        const legacy = { small: 38, medium: 46, large: 60 };
        current.orbSize = legacy[current.orbSize] || 46;
        if (current.orbIcon === '🎁' && !current.orbImage) current.orbIcon = '';
    }
    return current;
}

export function saveSettings(patch = {}) {
    Object.assign(settings, patch);
    writeLocalJson(SETTINGS_KEY, settings);
    if (st?.extension_settings) {
        st.extension_settings[EXT_KEY] = { ...settings };
        st.saveSettingsDebounced?.();
    }
    return settings;
}

export function isStSettingsAvailable() {
    return !!st?.extension_settings;
}

export function readOpenState() {
    try {
        return sessionStorage.getItem(OPEN_STATE_KEY) === '1';
    } catch {
        return false;
    }
}

export function writeOpenState(open) {
    try {
        sessionStorage.setItem(OPEN_STATE_KEY, open ? '1' : '0');
    } catch { /* 忽略 */ }
}

/** 把文本追加到 SillyTavern 的输入框 */
export function insertToStInput(text) {
    if (!text) return false;
    const target = document.getElementById('send_textarea');
    if (!target) return false;
    const current = target.value || '';
    const joiner = current && !current.endsWith('\n') ? '\n' : '';
    target.value = `${current}${joiner}${text}`;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.focus?.();
    return true;
}
