/**
 * 创作工具箱 · SillyTavern 面板
 * ---------------------------------------------------------------------------
 * 状态球（可拖动 / 可自定义）+ 覆盖式面板。面板里放的是**原生挂载**的工具箱
 * （影子根），不是 iframe 网页窗口；配色跟随酒馆主题，并支持日夜阶段。
 */
import { EXT_VERSION, getSettings, saveSettings, writeOpenState, LOG_PREFIX } from './st-host.js';
import { mountToolbox } from './st-mount.js';
import { createOrb } from './st-orb.js';
import { applyThemeToPanel, applyThemeToToolboxHost, watchTavernTheme, currentPhase } from './st-theme.js';

const OVERLAY_ID = 'd3v_overlay';
const HOST_ID = 'd3v_toolbox';

let orb = null;
let overlay = null;
let panelWindow = null;
let toolboxHost = null;
let mounted = false;
let mounting = null;
let panelOpen = false;
let onKeyDownHandler = null;
let stopThemeWatch = null;
let busyObserver = null;
let busyTimer = 0;

export function isPanelOpen() {
    return panelOpen;
}

// ------------------------------------------------------------------ 主题

/** 重新读取酒馆主题与日夜阶段，刷新面板、状态球与工具箱配色 */
export function refreshTheme() {
    const phase = currentPhase(getSettings().dayNightMode);
    const theme = applyThemeToPanel(overlay, phase);
    applyThemeToPanel(orb?.element, phase);
    if (!getSettings().followTavernTheme) {
        for (const element of [overlay, orb?.element]) {
            element?.style.setProperty('--d3v-accent', '#8ba4ff');
            element?.style.setProperty('--d3v-tint', 'rgba(13, 15, 22, 0.96)');
        }
    }
    applyThemeToToolboxHost(toolboxHost, theme, phase);
    orb?.element.classList.toggle('d3v-orb-tavern', !!getSettings().followTavernTheme);
}

// ------------------------------------------------------------------ 状态球

export function buildOrb() {
    if (orb) return orb;
    orb = createOrb({
        getSettings,
        onClick: togglePanel,
        onMove: (pos) => saveSettings({ orbPos: pos }),
        shouldIgnoreDrag: () => false,
    });
    applyOrbVisibility();
    orb.setBusy(false);
    return orb;
}

export function applyOrbVisibility() {
    orb?.setVisible(!!getSettings().showFab);
}

/** 面板打开且全屏时把球藏起来，避免压在工具箱上 */
function syncOrbDuringPanel() {
    const hidden = panelOpen && panelWindow?.classList.contains('d3v-window-full');
    orb?.setVisible(!hidden && !!getSettings().showFab);
}

export function refreshOrb() {
    orb?.refresh();
    applyOrbVisibility();
}

export function resetOrbPosition() {
    orb?.resetPosition();
}

// ------------------------------------------------------------------ 面板

function applyFullscreen(on) {
    if (!panelWindow) return;
    panelWindow.classList.toggle('d3v-window-full', !!on);
    const btn = document.getElementById('d3v_btn_full');
    if (btn) {
        btn.classList.toggle('d3v-btn-active', !!on);
        btn.title = on ? '退出全屏' : '全屏';
    }
    syncOrbDuringPanel();
}

export function setFullscreen(on) {
    applyFullscreen(on);
}

function showMountError(error) {
    if (!toolboxHost) return;
    toolboxHost.innerHTML = `<div class="d3v-mount-error">工具箱加载失败：${String(error?.message || error)}</div>`;
}

/** 生成中检测：工具箱的 #uxToast 拿到 show 类时点亮状态球 */
function watchBusy(shadow) {
    busyObserver?.disconnect();
    if (!shadow) return;
    busyObserver = new MutationObserver(() => {
        clearTimeout(busyTimer);
        busyTimer = setTimeout(() => {
            orb?.setBusy(!!shadow.querySelector('#uxToast.show'));
        }, 60);
    });
    busyObserver.observe(shadow, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}

/** 首次打开时挂载；失败也只在面板内报错，不影响 ST */
export async function ensureMounted(force = false) {
    if (!toolboxHost) return null;
    if (!force && mounted) return toolboxHost.shadowRoot;
    if (mounting) return mounting;
    mounting = mountToolbox(toolboxHost, { force })
        .then((shadow) => {
            mounted = true;
            toolboxHost.classList.add('d3v-toolbox-ready');
            refreshTheme();
            watchBusy(shadow);
            return shadow;
        })
        .catch((error) => {
            console.error(`${LOG_PREFIX} 挂载工具箱失败`, error);
            showMountError(error);
            return null;
        })
        .finally(() => { mounting = null; });
    return mounting;
}

export function openPanel() {
    if (!overlay) return;
    panelOpen = true;
    overlay.classList.add('d3v-overlay-open');
    document.body.classList.add('d3v-panel-open');
    applyFullscreen(panelWindow?.classList.contains('d3v-window-full') ?? getSettings().defaultFullscreen);
    refreshTheme();
    void ensureMounted();
    writeOpenState(true);
    requestAnimationFrame(() => toolboxHost?.focus?.());
}

export function closePanel() {
    if (!overlay) return;
    panelOpen = false;
    overlay.classList.remove('d3v-overlay-open');
    document.body.classList.remove('d3v-panel-open');
    syncOrbDuringPanel();
    writeOpenState(false);
}

export function togglePanel() {
    if (panelOpen) closePanel();
    else openPanel();
}

/** 原生挂载下的「重置」：重新注入结构与脚本，工具箱回到初始状态 */
export function reloadFrame() {
    mounted = false;
    void ensureMounted(true);
}

export function openInNewTab() {
    window.open(new URL('./index.html', import.meta.url).href, '_blank', 'noopener');
}

// ------------------------------------------------------------------ 构建

const TITLEBAR_HTML = `
    <div class="d3v-titlebar">
        <div class="d3v-title"><span class="d3v-dot"></span><span>创作工具箱 · A Gift For User</span>
            <span class="d3v-badge" id="d3v_backend_badge"></span>
        </div>
        <div class="d3v-tools">
            <button type="button" class="d3v-btn" id="d3v_btn_reload" title="重置工具箱（回到初始状态）">⟳</button>
            <button type="button" class="d3v-btn" id="d3v_btn_full" title="全屏">⤢</button>
            <button type="button" class="d3v-btn" id="d3v_btn_tab" title="在新标签页打开原版单页">⧉</button>
            <button type="button" class="d3v-btn d3v-btn-close" id="d3v_btn_close" title="关闭（Esc）">✕</button>
        </div>
    </div>`;

function buildOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'd3v-overlay';
    overlay.innerHTML = `
        <div class="d3v-window" id="d3v_window" role="dialog" aria-modal="true" aria-label="创作工具箱">
            ${TITLEBAR_HTML}
            <div class="d3v-stage"><div id="${HOST_ID}" class="d3v-toolbox" tabindex="-1"></div></div>
        </div>`;
    document.body.appendChild(overlay);

    panelWindow = overlay.querySelector('#d3v_window');
    toolboxHost = overlay.querySelector(`#${HOST_ID}`);
    const badge = overlay.querySelector('#d3v_backend_badge');
    if (badge) badge.textContent = `v${EXT_VERSION} · 原生挂载`;

    overlay.querySelector('#d3v_btn_close').addEventListener('click', closePanel);
    overlay.querySelector('#d3v_btn_reload').addEventListener('click', reloadFrame);
    overlay.querySelector('#d3v_btn_full').addEventListener('click', () => {
        applyFullscreen(!panelWindow.classList.contains('d3v-window-full'));
    });
    overlay.querySelector('#d3v_btn_tab').addEventListener('click', openInNewTab);

    onKeyDownHandler = (event) => {
        if (event.key !== 'Escape' || !panelOpen) return;
        // 工具箱自己的弹窗开着时，把 Esc 留给它
        if (toolboxHost?.shadowRoot?.querySelector('.modal.show')) return;
        if (event.target?.closest?.('textarea, input, select, [contenteditable="true"]')) return;
        closePanel();
    };
    document.addEventListener('keydown', onKeyDownHandler, true);
    stopThemeWatch = watchTavernTheme(refreshTheme);
    refreshTheme();
    return overlay;
}

export function buildUi() {
    buildOrb();
    buildOverlay();
    return { orb: orb.element, overlay, window: panelWindow, toolboxHost };
}

// ------------------------------------------------------------------ 释放

export function disposePanel() {
    closePanel();
    clearTimeout(busyTimer);
    busyObserver?.disconnect();
    busyObserver = null;
    stopThemeWatch?.();
    stopThemeWatch = null;
    orb?.destroy();
    orb = null;
    overlay?.remove();
    document.body.classList.remove('d3v-panel-open');
    if (onKeyDownHandler) document.removeEventListener('keydown', onKeyDownHandler, true);
    overlay = null;
    panelWindow = null;
    toolboxHost = null;
    mounted = false;
    mounting = null;
    onKeyDownHandler = null;
}
