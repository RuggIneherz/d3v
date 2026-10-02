/**
 * 创作工具箱 · SillyTavern 扩展设置抽屉
 * ---------------------------------------------------------------------------
 * 往 ST 的「扩展设置」里注入一块原生 inline-drawer（折叠展开交给 ST 自己的
 * 全局处理器）：面板开关、状态球外观与位置、酒馆主题与日夜。
 */
import { getSettings, saveSettings } from './st-host.js';
import { describeStConnection } from './st-backend.js';
import { prepareOrbImage } from './st-orb.js';
import {
    applyOrbVisibility, openInNewTab, openPanel, setFullscreen, isPanelOpen,
    refreshOrb, resetOrbPosition, refreshTheme,
} from './st-ui.js';

const DRAWER_ID = 'd3v_settings';

const DRAWER_HTML = `
    <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>创作工具箱</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <small class="d3v-hint" id="d3v_conn_hint"></small>

            <label class="checkbox_label" for="d3v_opt_fab">
                <input type="checkbox" id="d3v_opt_fab"><span>显示状态球（随时打开工具箱）</span>
            </label>
            <label class="checkbox_label" for="d3v_opt_open">
                <input type="checkbox" id="d3v_opt_open"><span>打开 SillyTavern 后自动打开工具箱</span>
            </label>
            <label class="checkbox_label" for="d3v_opt_full">
                <input type="checkbox" id="d3v_opt_full"><span>默认全屏显示</span>
            </label>
            <label class="checkbox_label" for="d3v_opt_remember">
                <input type="checkbox" id="d3v_opt_remember"><span>刷新页面后恢复上次的开关状态</span>
            </label>

            <div class="d3v-sub">状态球</div>
            <div class="d3v-row">
                <span class="d3v-label">图标</span>
                <input type="text" id="d3v_orb_icon" class="text_pole d3v-orb-input" maxlength="4" placeholder="留空=小箱子">
                <div class="menu_button" id="d3v_orb_icon_default">内置小箱子</div>
            </div>
            <div class="d3v-row">
                <span class="d3v-label">自定义图片</span>
                <label class="menu_button d3v-file-btn">上传 PNG / GIF
                    <input type="file" id="d3v_orb_image" accept="image/png,image/gif,image/webp,image/jpeg" hidden>
                </label>
                <div class="menu_button" id="d3v_orb_image_clear">清除图片</div>
            </div>
            <small class="d3v-hint" id="d3v_orb_image_note">透明底 PNG 会自动压到 ≤128px（保留透明），GIF 动图需 ≤220KB。</small>
            <div class="d3v-row">
                <span class="d3v-label">大小</span>
                <input type="range" id="d3v_orb_size" min="28" max="96" step="1">
                <span class="d3v-label" id="d3v_orb_size_val"></span>
            </div>
            <div class="d3v-row">
                <span class="d3v-label">不透明度</span>
                <input type="range" id="d3v_orb_opacity" min="0.3" max="1" step="0.05">
            </div>
            <div class="d3v-row">
                <div class="menu_button" id="d3v_orb_reset">状态球复位</div>
                <small class="d3v-hint d3v-inline-hint">可直接拖动状态球</small>
            </div>

            <div class="d3v-sub">外观与日夜</div>
            <label class="checkbox_label" for="d3v_opt_follow">
                <input type="checkbox" id="d3v_opt_follow"><span>跟随酒馆主题配色</span>
            </label>
            <div class="d3v-row">
                <span class="d3v-label">日夜</span>
                <select id="d3v_daynight" class="text_pole">
                    <option value="auto">跟随北京时间</option>
                    <option value="day">常亮</option>
                    <option value="night">常暗</option>
                    <option value="off">不干预</option>
                </select>
            </div>

            <div class="d3v-row">
                <div class="menu_button" id="d3v_btn_open">打开创作工具箱</div>
                <div class="menu_button" id="d3v_btn_page">在新标签页打开</div>
            </div>
            <small class="d3v-hint">
                工具箱原生挂在本页里（影子根隔离），生成后端可在工具箱「API 设置」里切换
                「SillyTavern 当前 API / 自定义 API」；原版单页（GitHub Pages）不受影响。
            </small>
        </div>
    </div>`;

function wireCheckbox(root, id, key, after) {
    const input = root.querySelector(`#${id}`);
    input.checked = !!getSettings()[key];
    input.addEventListener('change', () => {
        saveSettings({ [key]: input.checked });
        after?.(input.checked);
    });
    return input;
}

function wireSelect(root, id, key, after) {
    const select = root.querySelector(`#${id}`);
    select.value = getSettings()[key];
    select.addEventListener('change', () => {
        saveSettings({ [key]: select.value });
        after?.(select.value);
    });
    return select;
}

function wireRange(root, id, key, after) {
    const range = root.querySelector(`#${id}`);
    range.value = String(getSettings()[key] ?? 1);
    range.addEventListener('input', () => {
        saveSettings({ [key]: Number(range.value) });
        after?.(Number(range.value));
    });
    return range;
}

function wireOrbIcons(root) {
    const iconInput = root.querySelector('#d3v_orb_icon');
    iconInput.value = getSettings().orbIcon || '';
    iconInput.addEventListener('input', () => {
        saveSettings({ orbIcon: iconInput.value, orbImage: '' });
        refreshOrb();
    });

    root.querySelector('#d3v_orb_icon_default').addEventListener('click', () => {
        iconInput.value = '';
        saveSettings({ orbIcon: '', orbImage: '' });
        root.querySelector('#d3v_orb_image_note').textContent = '已恢复内置小箱子图标';
        refreshOrb();
    });
}

function wireOrbImage(root) {
    const input = root.querySelector('#d3v_orb_image');
    const note = root.querySelector('#d3v_orb_image_note');
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        note.textContent = '处理中…';
        try {
            const { dataUrl, note: info } = await prepareOrbImage(file);
            saveSettings({ orbImage: dataUrl, orbIcon: '' });
            root.querySelector('#d3v_orb_icon').value = '';
            note.textContent = `已应用：${info}`;
            refreshOrb();
        } catch (error) {
            note.textContent = `失败：${error?.message || error}`;
        }
    });
    root.querySelector('#d3v_orb_image_clear').addEventListener('click', () => {
        saveSettings({ orbImage: '' });
        note.textContent = '已清除自定义图片（回到内置小箱子图标）';
        refreshOrb();
    });
}

function wireOrbControls(root) {
    wireOrbIcons(root);
    wireOrbImage(root);

    const sizeInput = root.querySelector('#d3v_orb_size');
    const sizeLabel = root.querySelector('#d3v_orb_size_val');
    sizeInput.value = String(getSettings().orbSize ?? 46);
    sizeLabel.textContent = `${sizeInput.value}px`;
    sizeInput.addEventListener('input', () => {
        saveSettings({ orbSize: Number(sizeInput.value) });
        sizeLabel.textContent = `${sizeInput.value}px`;
        refreshOrb();
    });

    wireRange(root, 'd3v_orb_opacity', 'orbOpacity', refreshOrb);
    root.querySelector('#d3v_orb_reset').addEventListener('click', resetOrbPosition);
}

function wireThemeControls(root) {
    wireCheckbox(root, 'd3v_opt_follow', 'followTavernTheme', refreshTheme);
    wireSelect(root, 'd3v_daynight', 'dayNightMode', refreshTheme);
}

function fillConnectionHint(root) {
    const hint = root.querySelector('#d3v_conn_hint');
    const conn = describeStConnection();
    hint.textContent = conn
        ? `当前 SillyTavern 连接：${conn}`
        : '当前 SillyTavern 连接：未检测到（可在工具箱「API 设置」里改用自定义 API）';
}

export function buildSettingsDrawer() {
    if (document.getElementById(DRAWER_ID)) return true;
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) return false;

    const wrap = document.createElement('div');
    wrap.id = DRAWER_ID;
    wrap.innerHTML = DRAWER_HTML;
    host.appendChild(wrap);

    fillConnectionHint(wrap);
    wireCheckbox(wrap, 'd3v_opt_fab', 'showFab', applyOrbVisibility);
    wireCheckbox(wrap, 'd3v_opt_open', 'openOnStart');
    wireCheckbox(wrap, 'd3v_opt_full', 'defaultFullscreen', (checked) => {
        if (checked && isPanelOpen()) setFullscreen(true);
    });
    wireCheckbox(wrap, 'd3v_opt_remember', 'rememberLastOpened');
    wireOrbControls(wrap);
    wireThemeControls(wrap);

    wrap.querySelector('#d3v_btn_open').addEventListener('click', openPanel);
    wrap.querySelector('#d3v_btn_page').addEventListener('click', openInNewTab);
    return true;
}

/** ST 的扩展设置容器可能比扩展脚本晚出现，轮询挂载约 10 秒 */
export function mountSettingsDrawer(attempt = 0) {
    if (buildSettingsDrawer()) return;
    if (attempt >= 40) {
        console.debug('[创作工具箱] 未找到扩展设置容器，跳过设置面板挂载（状态球仍可用）');
        return;
    }
    setTimeout(() => mountSettingsDrawer(attempt + 1), 250);
}

export function disposeSettingsDrawer() {
    document.getElementById(DRAWER_ID)?.remove();
}
