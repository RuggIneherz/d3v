/**
 * 创作工具箱 · 标题栏的两个小面板
 * ---------------------------------------------------------------------------
 *   ⤓ 写入酒馆人设：把工具箱当前结果写进某个人设的描述（只改 description）
 *   ⤒ 从酒馆读取：把角色卡 / 世界书 / 我的人设读进工具箱「角色上下文」
 *
 * 两个面板互斥（开一个关另一个），点选项外的空白、按 Esc、关面板都会收起。
 */
import { listStPersonas, writeStPersona, readToolboxResult } from './st-persona.js';
import {
    listStCharacters, listStLorebooks, readCharacterBlock, readLorebookBlock,
    applyBlockToToolbox, loadPersonaToToolbox, ensureStCharacters,
} from './st-source.js';

const MENU_DEFS = [
    { key: 'write', menuId: 'd3v_write_menu', buttonId: 'd3v_btn_write' },
    { key: 'read', menuId: 'd3v_read_menu', buttonId: 'd3v_btn_read' },
];

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function itemHtml(act, value, title, meta) {
    return `<button type="button" class="d3v-menu-item" data-act="${act}" data-value="${escapeHtml(value)}">`
        + `<span class="d3v-menu-name">${escapeHtml(title)}</span>`
        + `<span class="d3v-menu-meta">${escapeHtml(meta)}</span></button>`;
}

const sectionHtml = (title, items, empty) => `<div class="d3v-menu-head">${title}</div>`
    + (items || `<div class="d3v-menu-empty">${empty}</div>`);

// ------------------------------------------------------------------ 写入人设

function renderWriteMenu(menu, getHost) {
    const personas = listStPersonas();
    const text = readToolboxResult(getHost());
    menu.innerHTML = `<div class="d3v-menu-title">写入酒馆人设${text ? '' : '（工具箱当前没有结果）'}</div>`
        + (personas.length
            ? personas.map((p) => itemHtml('write', p.avatar, `${p.current ? '当前 · ' : ''}${p.name}`,
                p.description ? `${p.description.length} 字` : '空')).join('')
            : '<div class="d3v-menu-empty">酒馆里还没有人设：先在酒馆侧边栏添加一个人设头像</div>')
        + '<div class="d3v-menu-note"></div>';
    menu.dataset.text = text;
}

async function pickWrite(menu, button) {
    const result = writeStPersona(button.dataset.value, menu.dataset.text || '');
    if (result.ok) setTimeout(() => menu.classList.remove('d3v-menu-open'), 1200);
    return result;
}

// ------------------------------------------------------------------ 读取素材

function charMeta(char) {
    if (char.shallow) return '点开读取';
    return char.hasDescription ? '有描述' : '无描述';
}

function renderReadMenu(menu) {
    const personas = listStPersonas();
    const characters = listStCharacters();
    const books = listStLorebooks();
    menu.innerHTML = '<div class="d3v-menu-title">从酒馆读取素材</div>'
        + sectionHtml('我的人设 → 人设模板 + 结果（有描述=优化，空=新写）', personas.map((p) => itemHtml('persona', p.avatar,
            `${p.current ? '当前 · ' : ''}${p.name}`, p.description ? `优化 · ${p.description.length} 字` : '新写 · 空')).join(''),
            '酒馆里还没有人设')
        + sectionHtml('角色卡 → 角色上下文（含卡内世界书）', characters.map((c) => itemHtml('char', c.index,
            `${c.current ? '当前 · ' : ''}${c.name}`, charMeta(c))).join(''),
            '酒馆里还没有角色卡')
        + sectionHtml('世界书 → 角色上下文（只读启用条目）', books.map((name) => itemHtml('book', name, name, '读启用条目')).join(''),
            '酒馆里还没有世界书')
        + '<div class="d3v-menu-note"></div>';
}

async function pickRead(menu, button, toolboxHost) {
    const act = button.dataset.act;
    const value = button.dataset.value;
    if (act === 'persona') {
        const persona = listStPersonas().find((p) => p.avatar === value);
        if (!persona) return { ok: false, message: '这个酒馆人设已经不在了，重开面板试试' };
        return loadPersonaToToolbox(toolboxHost(), persona);
    }
    if (act === 'char') return applyBlockToToolbox(toolboxHost(), await readCharacterBlock(Number(value)));
    const book = await readLorebookBlock(value);
    if (!book.ok) return book;
    return applyBlockToToolbox(toolboxHost(), book.text);
}

// ------------------------------------------------------------------ 组装

/**
 * 把两个小面板接到标题栏按钮上
 * @param {object} options
 * @param {HTMLElement} options.host 面板外壳（#d3v_overlay）
 * @param {() => HTMLElement} options.getToolboxHost 影子宿主
 */
export function createTitlebarMenus({ host, getToolboxHost }) {
    const menus = {};
    for (const def of MENU_DEFS) {
        const element = host.querySelector(`#${def.menuId}`);
        const button = host.querySelector(`#${def.buttonId}`);
        if (!element) continue;
        menus[def.key] = element;
        element.addEventListener('click', (event) => onMenuClick(def.key, element, event));
        button?.addEventListener('click', () => open(def.key));
    }

    function isOpen(key) {
        return !!menus[key]?.classList.contains('d3v-menu-open');
    }

    function close() {
        for (const key of Object.keys(menus)) menus[key].classList.remove('d3v-menu-open');
    }

    function open(key) {
        const menu = menus[key];
        if (!menu) return;
        const wasOpen = isOpen(key);
        close();
        if (wasOpen) return;
        if (key === 'write') {
            renderWriteMenu(menu, getToolboxHost);
        } else {
            renderReadMenu(menu);
            // 新会话里 characters 还是空的：拉完角色卡列表再重绘一次这块
            void ensureStCharacters().then((loaded) => {
                if (loaded && isOpen(key)) renderReadMenu(menu);
            });
        }
        menu.classList.add('d3v-menu-open');
    }

    function note(key, message) {
        const element = menus[key]?.querySelector('.d3v-menu-note');
        if (element) element.textContent = message || '';
    }

    function onMenuClick(key, menu, event) {
        const button = event.target?.closest?.('[data-act]');
        if (!button) return;
        const task = key === 'write' ? pickWrite(menu, button) : pickRead(menu, button, getToolboxHost);
        Promise.resolve(task)
            .then((result) => { if (result?.message) note(key, result.message); })
            .catch((error) => note(key, `出错了：${error?.message || error}`));
    }

    return {
        close,
        toggle: (key) => open(key),
        isOpen,
        /** 只给测试用：直接渲染某个面板 */
        render: (key) => (key === 'write' ? renderWriteMenu(menus[key], getToolboxHost) : renderReadMenu(menus[key])),
    };
}
