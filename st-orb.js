/**
 * 创作工具箱 · 状态球
 * ---------------------------------------------------------------------------
 * 右下角那颗球：可拖动、贴边吸附、位置与外观可自定义，
 * 生成中会亮起一圈进度光环。点击开关面板，拖动移动。
 * 外观三选一（优先级从高到低）：自定义图片（透明底 PNG / GIF）→ 自定义文字/emoji → 内置 SVG 小箱子。
 * 尺寸用像素（28 - 96），位置按视口比例存储，换分辨率 / 全屏后不会跑丢。
 */
import { LOG_PREFIX } from './st-host.js';

const ORB_ID = 'd3v_orb';
const DRAG_THRESHOLD = 4;      // 超过这个位移算拖动，否则算点击
const EDGE_MARGIN = 8;
const MIN_SIZE = 28;
const MAX_SIZE = 96;
const DEFAULT_SIZE = 46;
const DEFAULT_POS = { x: 0.965, y: 0.92 };
const LEGACY_SIZE = { small: 38, medium: 46, large: 60 };

/** 内置图标：一个极简的等距小箱子（纯色描边，跟随 currentColor） */
const BOX_SVG = `
    <svg class="d3v-orb-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.2 8.4 12 3.8l8.8 4.6v7.2L12 20.2 3.2 15.6z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M3.2 8.4 12 13l8.8-4.6M12 13v7.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/** 尺寸：兼容旧存档里的 small/medium/large */
export function orbSizePx(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return clamp(Math.round(value), MIN_SIZE, MAX_SIZE);
    if (typeof value === 'string' && LEGACY_SIZE[value]) return LEGACY_SIZE[value];
    return DEFAULT_SIZE;
}

/** 把比例坐标换成像素坐标，保证球完整落在视口内 */
export function positionToPixels(pos) {
    const size = orbSizePx(pos?.size);
    const maxX = Math.max(EDGE_MARGIN, window.innerWidth - size - EDGE_MARGIN);
    const maxY = Math.max(EDGE_MARGIN, window.innerHeight - size - EDGE_MARGIN);
    const x = (pos?.x ?? DEFAULT_POS.x) * window.innerWidth;
    const y = (pos?.y ?? DEFAULT_POS.y) * window.innerHeight;
    return { left: clamp(x - size / 2, EDGE_MARGIN, maxX), top: clamp(y - size / 2, EDGE_MARGIN, maxY) };
}

/** 像素坐标反算比例坐标（存这个，换窗口大小也不会跑丢） */
function pixelsToFraction(left, top, size) {
    return { x: (left + size / 2) / Math.max(1, window.innerWidth), y: (top + size / 2) / Math.max(1, window.innerHeight) };
}

function createOrbElement() {
    const orb = document.createElement('div');
    orb.id = ORB_ID;
    orb.className = 'd3v-orb';
    orb.setAttribute('role', 'button');
    orb.setAttribute('tabindex', '0');
    orb.setAttribute('aria-label', '创作工具箱');
    orb.innerHTML = '<span class="d3v-orb-ring" aria-hidden="true"></span>'
        + '<span class="d3v-orb-face" aria-hidden="true"></span>'
        + '<span class="d3v-orb-tip" role="tooltip">创作工具箱</span>';
    return orb;
}

/** 指针捕获在合成事件 / 已释放指针时可能抛错，统一吞掉 */
function capturePointer(orb, event, capture) {
    try {
        if (capture) orb.setPointerCapture?.(event.pointerId);
        else orb.releasePointerCapture?.(event.pointerId);
    } catch { /* 忽略 */ }
}

/**
 * 创建状态球
 * @param {object} options
 * @param {() => object} options.getSettings 读取外观与位置设置
 * @param {(pos: {x:number,y:number}) => void} options.onMove 拖动结束后回存位置
 * @param {() => void} options.onClick 单击
 */
export function createOrb({ getSettings, onMove, onClick }) {
    const orb = createOrbElement();
    document.body.appendChild(orb);

    let dragging = false;
    let moved = false;
    let suppressClickUntil = 0;
    let start = null;
    const settings = () => getSettings() || {};

    function applyAppearance() {
        const conf = settings();
        const size = orbSizePx(conf.orbSize);
        orb.style.width = `${size}px`;
        orb.style.height = `${size}px`;
        orb.style.setProperty('--d3v-orb-size', `${size}px`);
        orb.style.opacity = String(conf.orbOpacity ?? 1);
        orb.title = '创作工具箱（可拖动）';

        const face = orb.querySelector('.d3v-orb-face');
        const image = String(conf.orbImage || '').trim();
        const icon = String(conf.orbIcon || '').trim();
        orb.classList.toggle('d3v-orb-has-image', !!image);
        if (image) {
            face.style.backgroundImage = `url("${image}")`;
            face.textContent = '';
        } else if (icon) {
            face.style.backgroundImage = '';
            face.textContent = icon;
            face.classList.add('d3v-orb-text');
        } else {
            face.style.backgroundImage = '';
            face.classList.remove('d3v-orb-text');
            face.innerHTML = BOX_SVG;
        }
    }

    function place() {
        const conf = settings();
        const pos = positionToPixels({ ...(conf.orbPos || DEFAULT_POS), size: conf.orbSize });
        orb.style.left = `${pos.left}px`;
        orb.style.top = `${pos.top}px`;
        return pos;
    }

    function onPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        dragging = true;
        moved = false;
        start = { x: event.clientX, y: event.clientY, left: parseFloat(orb.style.left) || 0, top: parseFloat(orb.style.top) || 0 };
        orb.classList.add('d3v-orb-dragging');
        capturePointer(orb, event, true);
    }

    function onPointerMove(event) {
        if (!dragging || !start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        moved = true;
        event.preventDefault();
        const size = orbSizePx(settings().orbSize);
        orb.style.left = `${clamp(start.left + dx, EDGE_MARGIN, window.innerWidth - size - EDGE_MARGIN)}px`;
        orb.style.top = `${clamp(start.top + dy, EDGE_MARGIN, window.innerHeight - size - EDGE_MARGIN)}px`;
    }

    function finishDrag(event) {
        if (!dragging) return;
        dragging = false;
        orb.classList.remove('d3v-orb-dragging');
        capturePointer(orb, event, false);
        start = null;
        if (!moved) return;
        suppressClickUntil = Date.now() + 300;

        const size = orbSizePx(settings().orbSize);
        const left = parseFloat(orb.style.left) || 0;
        const top = parseFloat(orb.style.top) || 0;
        const centre = left + size / 2;
        const snappedLeft = centre < window.innerWidth / 2 ? EDGE_MARGIN : window.innerWidth - size - EDGE_MARGIN;
        orb.classList.add('d3v-orb-snapping');
        orb.style.left = `${snappedLeft}px`;
        setTimeout(() => orb.classList.remove('d3v-orb-snapping'), 240);
        onMove?.(pixelsToFraction(snappedLeft, top, size));
    }

    /** 点击开关面板；刚拖过就吞掉这一次点击（时间窗，不会永久吞） */
    function onClickEvent() {
        if (Date.now() < suppressClickUntil) { suppressClickUntil = 0; return; }
        onClick?.();
    }

    function resetPosition() {
        orb.classList.add('d3v-orb-snapping');
        const pos = positionToPixels({ ...DEFAULT_POS, size: settings().orbSize });
        orb.style.left = `${pos.left}px`;
        orb.style.top = `${pos.top}px`;
        setTimeout(() => orb.classList.remove('d3v-orb-snapping'), 240);
        onMove?.(DEFAULT_POS);
    }

    orb.addEventListener('pointerdown', onPointerDown);
    orb.addEventListener('pointermove', onPointerMove);
    orb.addEventListener('pointerup', finishDrag);
    orb.addEventListener('pointercancel', finishDrag);
    orb.addEventListener('click', onClickEvent);
    orb.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick?.(); }
    });

    const onResize = () => place();
    window.addEventListener('resize', onResize);

    applyAppearance();
    place();
    console.debug(LOG_PREFIX, '状态球已就绪');

    return {
        element: orb,
        refresh() { applyAppearance(); place(); },
        place,
        resetPosition,
        setBusy(busy) { orb.classList.toggle('d3v-orb-busy', !!busy); },
        setVisible(visible) { orb.style.display = visible ? '' : 'none'; },
        destroy() { window.removeEventListener('resize', onResize); orb.remove(); },
    };
}

/* ═══════════════ 自定义图标：读取 + 压缩 ═══════════════ */

const GifMaxBytes = 220 * 1024;   // 动图没法在浏览器里压，超了就拒绝

function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = () => reject(new Error('读取文件失败'));
        reader.readAsDataURL(file);
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('图片解码失败'));
        img.src = src;
    });
}

function toPngDataUrl(img, max) {
    const scale = Math.min(1, max / Math.max(img.width || max, img.height || max));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(8, Math.round((img.width || max) * scale));
    canvas.height = Math.max(8, Math.round((img.height || max) * scale));
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);   // 保留透明底
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/png'), size: canvas.width };
}

/**
 * 处理用户选的图标文件：透明底 PNG 会被逐级缩到够小（保留 alpha），
 * GIF 动图无法在浏览器里压缩，超过上限直接给出提示。
 * @returns {Promise<{dataUrl: string, note: string}>}
 */
export async function prepareOrbImage(file) {
    if (!file) throw new Error('没有选择文件');
    if (file.type === 'image/gif') {
        if (file.size > GifMaxBytes) {
            throw new Error(`GIF 动图有 ${Math.round(file.size / 1024)}KB，浏览器里没法压缩动图，请先自己压到 ${Math.round(GifMaxBytes / 1024)}KB 以内`);
        }
        return { dataUrl: await readAsDataUrl(file), note: `GIF 原图 ${Math.round(file.size / 1024)}KB（动图保持原样）` };
    }
    if (!/^image\/(png|webp|jpeg|jpg)$/.test(file.type)) throw new Error('只支持 PNG / GIF / WebP / JPG');

    const img = await loadImage(await readAsDataUrl(file));
    let last = null;
    for (const max of [128, 96, 72, 56]) {
        last = toPngDataUrl(img, max);
        if (last.dataUrl.length <= 160 * 1024) break;
    }
    return { dataUrl: last.dataUrl, note: `${img.width}x${img.height} → ${last.size}px，${Math.round(last.dataUrl.length / 1024)}KB（PNG 透明底）` };
}
