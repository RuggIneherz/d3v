/**
 * 创作工具箱 · 酒馆主题桥
 * ---------------------------------------------------------------------------
 * 只读地读取 SillyTavern 当前主题的 CSS 变量，映射成面板与工具箱共用的
 * --d3v-* 变量，并按时间给出日夜阶段。不修改 ST 自身样式，也不依赖任何扩展。
 *
 * 变量来源（ST 主题系统）：
 *   --SmartThemeBodyColor / --SmartThemeBlurTintColor / --SmartThemeBorderColor
 *   --SmartThemeShadowColor / --SmartThemeQuoteColor / --SmartThemeBlurStrength
 */
import { LOG_PREFIX } from './st-host.js';

const VAR_MAP = {
    text: '--SmartThemeBodyColor',
    tint: '--SmartThemeBlurTintColor',
    border: '--SmartThemeBorderColor',
    shadow: '--SmartThemeShadowColor',
    accent: '--SmartThemeQuoteColor',
    blur: '--SmartThemeBlurStrength',
};

const FALLBACK = {
    text: '#e9e9ee',
    tint: 'rgba(23, 23, 23, 0.92)',
    border: 'rgba(255, 255, 255, 0.14)',
    shadow: 'rgba(0, 0, 0, 0.5)',
    accent: '#8ba4ff',
    blur: '10px',
};

const PHASE_CLASS = { day: 'd3v-phase-day', night: 'd3v-phase-night' };

/** 读一个 ST 主题变量的计算值，读不到就用兜底 */
function readVar(name, fallback) {
    try {
        const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return value || fallback;
    } catch {
        return fallback;
    }
}

/** 把 rgb/rgba 颜色转成 0-255 的感知亮度；解析不了返回 null */
function luminance(color) {
    const match = String(color).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (!match) return null;
    const [r, g, b] = match.slice(1, 4).map(Number);
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** 读当前酒馆主题 */
export function readTavernTheme() {
    const theme = {};
    for (const [key, varName] of Object.entries(VAR_MAP)) {
        theme[key] = readVar(varName, FALLBACK[key]);
    }
    const bodyLum = luminance(theme.text);
    const tintLum = luminance(theme.tint);
    // 文字亮、底色暗 → 深色酒馆主题；两者都亮 → 浅色主题
    theme.isDark = tintLum === null ? (bodyLum ?? 220) > 140 : tintLum < 128;
    return theme;
}

/** 北京时间小时（UTC+8），与工具箱里的昼夜判断保持一致 */
export function beijingHour(date = new Date()) {
    return (date.getUTCHours() + 8) % 24;
}

/**
 * 当前阶段：'day' | 'night'
 * mode: 'auto' 按北京时间（7:00-18:00 白昼）｜'day' 常亮｜'night' 常暗｜'off' 不干预
 */
export function currentPhase(mode = 'auto') {
    if (mode === 'day') return 'day';
    if (mode === 'night') return 'night';
    if (mode === 'off') return null;
    const hour = beijingHour();
    return hour >= 7 && hour < 18 ? 'day' : 'night';
}

/** 把主题与昼夜写到面板元素上（只写 --d3v-* 与阶段 class） */
export function applyThemeToPanel(element, phase) {
    if (!element) return null;
    const theme = readTavernTheme();
    element.style.setProperty('--d3v-text', theme.text);
    element.style.setProperty('--d3v-tint', theme.tint);
    element.style.setProperty('--d3v-border', theme.border);
    element.style.setProperty('--d3v-shadow', theme.shadow);
    element.style.setProperty('--d3v-accent', theme.accent);
    element.style.setProperty('--d3v-blur', theme.blur);
    element.classList.toggle(PHASE_CLASS.day, phase === 'day');
    element.classList.toggle(PHASE_CLASS.night, phase === 'night');
    return theme;
}

/**
 * 工具箱影子根里的“酒馆化”补丁样式：
 * 只做轻微着色（底色 / 边框 / 强调色 / 滚动条），不动原版布局与视觉语言。
 */
export function themeBridgeCss() {
    return `
    :host {
        background-color: color-mix(in srgb, var(--d3v-tint, #050505) 88%, #000 12%);
        color: var(--d3v-text, #f5f5f7);
    }
    #bg-layer { background-color: transparent; }
    :host(.d3v-tavern-day) #bg-layer { filter: brightness(1.06) saturate(1.04); }
    :host(.d3v-tavern-night) #bg-layer { filter: brightness(0.86) saturate(0.92); }
    .header-bar, .glass-tabs, .glass-panel > .panel-title {
        border-color: color-mix(in srgb, var(--d3v-border, rgba(255,255,255,.14)) 100%, transparent);
    }
    .tab-btn.active, .glass-chip.active {
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--d3v-accent, #8ba4ff) 55%, transparent);
    }
    ::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--d3v-accent, #8ba4ff) 35%, transparent); }
    `;
}

/** 把主题桥变量与阶段写到工具箱宿主上（影子根内的样式会读取它们） */
export function applyThemeToToolboxHost(host, theme, phase) {
    if (!host || !theme) return;
    host.style.setProperty('--d3v-text', theme.text);
    host.style.setProperty('--d3v-tint', theme.tint);
    host.style.setProperty('--d3v-border', theme.border);
    host.style.setProperty('--d3v-accent', theme.accent);
    host.classList.toggle('d3v-tavern-dark', !!theme.isDark);
    host.classList.toggle('d3v-tavern-day', phase === 'day');
    host.classList.toggle('d3v-tavern-night', phase === 'night');
}

/**
 * 监听酒馆主题变化：ST 把主题变量写在 :root 上，也可能注入新的 <style>。
 * 返回取消监听的函数。
 */
export function watchTavernTheme(callback) {
    let timer = 0;
    const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            try { callback(); } catch (error) { console.debug(LOG_PREFIX, '主题刷新失败', error); }
        }, 120);
    };

    const observer = new MutationObserver((records) => {
        const styleChanged = records.some((r) => [...r.addedNodes].some((n) => /^(STYLE|LINK)$/.test(n.nodeName)));
        if (styleChanged || records.some((r) => r.type === 'attributes')) schedule();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    if (document.head) observer.observe(document.head, { childList: true });

    const tick = setInterval(schedule, 60000);   // 日夜切换兜底
    schedule();

    return () => {
        clearTimeout(timer);
        clearInterval(tick);
        observer.disconnect();
    };
}
