/**
 * 创作工具箱（A Gift For User）· SillyTavern 扩展入口
 * ---------------------------------------------------------------------------
 * 工具箱是**原生挂进 SillyTavern 页面**的（影子根隔离），不是套一个网页窗口；
 * 面板与状态球跟随酒馆主题配色，并带日夜阶段；状态球可拖动、可自定义。
 * 生成可以二选一：
 *   · SillyTavern 当前 API —— 用 ST 此刻连接的模型（连接管理器 / generateRaw）
 *   · 自定义 API —— 沿用工具箱原有的地址 / 密钥 / 模型档案
 * 原版单页（GitHub Pages）不受影响，仍按自定义 API 运行。
 *
 * 模块划分：
 *   st-host.js     与 ST 打交道：常量 / 设置读写 / 回填输入框
 *   st-backend.js  ST 生成后端（连接管理器 + generateRaw 兜底）
 *   st-theme.js    酒馆主题桥 + 日夜阶段
 *   st-orb.js      可拖动可自定义的状态球
 *   st-mount.js    把原版工具箱原生挂载进影子根
 *   st-ui.js       状态球 + 面板装配
 *   st-menus.js    标题栏两个小面板：写入酒馆人设 / 从酒馆读取素材
 *   st-persona.js  酒馆人设（Persona）读写
 *   st-source.js   从酒馆读角色卡 / 世界书 / 我的人设 → 角色上下文
 *   st-drawer.js   ST 扩展设置里的抽屉
 *   index.js       本文件：生命周期装配
 */

import {
    LOG_PREFIX, EXT_VERSION,
    loadSettings, getSettings, readOpenState,
} from './st-host.js';
import { buildUi, openPanel, disposePanel } from './st-ui.js';
import { mountSettingsDrawer, disposeSettingsDrawer } from './st-drawer.js';

let booted = false;

function whenReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
        callback();
    }
}

async function boot() {
    if (booted) return;
    booted = true;
    try {
        await loadSettings();

        buildUi();
        mountSettingsDrawer();

        // 刷新后恢复上次开关状态；openOnStart 打开时总是弹出（挂载在首次打开时才做）
        const restore = getSettings().rememberLastOpened && readOpenState();
        if (getSettings().openOnStart || restore) {
            openPanel();
        }

        console.info(`${LOG_PREFIX} 扩展已加载 v${EXT_VERSION}（原生挂载 + 双后端 + 酒馆主题）`);
    } catch (error) {
        booted = false;
        console.error(`${LOG_PREFIX} 扩展初始化失败`, error);
    }
}

function teardown() {
    disposePanel();
    disposeSettingsDrawer();
    booted = false;
}

// --- manifest.json 里声明的 hooks ---
export function onActivate() { whenReady(boot); }
export function onEnable() { whenReady(boot); }
export function onDisable() { teardown(); }

// --- 顶层兜底：即使 hooks 未被调用也能工作 ---
whenReady(boot);
