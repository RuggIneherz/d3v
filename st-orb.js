/**
 * 创作工具箱 · 状态球
 * ---------------------------------------------------------------------------
 * 右下角那颗球：可拖动、贴边吸附、位置与外观可自定义，
 * 生成中会亮起一圈进度光环。点击开关面板，拖动移动，双击回到默认位置。
 * 位置按视口比例存储，换分辨率 / 全屏后不会跑丢。
 */
import { LOG_PREFIX } from './st-host.js';

const ORB_ID = 'd3v_orb';
const DRAG_THRESHOLD = 4;      // 超过这个位移算拖动，否则算点击
const EDGE_MARGIN = 8;
const ORB_SIZE = { small: 40, medium: 52, large: 64 };

const DEFAULT_POS = { x: 0.965, y: 0.92 };

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function sizeOf(name) {
    return ORB_SIZE[name] || ORB_SIZE.medium;
}

/** 把比例坐标换成像素坐标，保证球完整落在视口内 */
export function positionToPixels(pos) {
    const size = sizeOf(pos?.size);
    const maxX = Math.max(EDGE_MARGIN, window.innerWidth - size - EDGE_MARGIN);
    const maxY = Math.max(EDGE_MARGIN, window.innerHeight - size - EDGE_MARGIN);
    const x = (pos?.x ?? DEFAULT_POS.x) * window.innerWidth;
    const y = (pos?.y ?? DEFAULT_POS.y) * window.innerHeight;
    return {
        left: clamp(x - size / 2, EDGE_MARGIN, maxX),
        top: clamp(y - size / 2, EDGE_MARGIN, maxY),
    };
}

/** 像素坐标反算比例坐标（存这个，换窗口大小也不会跑丢） */
function pixelsToFraction(left, top, size) {
    return {
        x: (left + size / 2) / Math.max(1, window.innerWidth),
        y: (top + size / 2) / Math.max(1, window.innerHeight),
    };
}

function createOrbElement() {
    const orb = document.createElement('div');
    orb.id = ORB_ID;
    orb.className = 'd3v-orb';
    orb.setAttribute('role', 'button');
    orb.setAttribute('tabindex', '0');
    orb.setAttribute('aria-label', '创作工具箱');
    orb.innerHTML = '<span class="d3v-orb-ring" aria-hidden="true"></span>'
        + '<span class="d3v-orb-icon" aria-hidden="true"></span>'
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
 * @param {() => object} options.getSettings 读取外观与位置设置（{ orbIcon, orbSize, orbOpacity, orbPos }）
 * @param {(pos: {x:number,y:number}) => void} options.onMove 拖动结束后回存位置
 * @param {() => void} options.onClick 单击
 * @param {() => boolean} [options.shouldIgnoreDrag] 返回 true 时本次按下不拖动（例如正在全屏面板里）
 */
export function createOrb({ getSettings, onMove, onClick, shouldIgnoreDrag }) {
    const orb = createOrbElement();
    document.body.appendChild(orb);

    let dragging = false;
    let moved = false;
    let suppressClickUntil = 0;
    let start = null;

    const settings = () => getSettings() || {};

    function applyAppearance() {
        const conf = settings();
        const size = sizeOf(conf.orbSize);
        orb.dataset.size = conf.orbSize || 'medium';
        orb.style.width = `${size}px`;
        orb.style.height = `${size}px`;
        orb.style.opacity = String(conf.orbOpacity ?? 1);
        orb.querySelector('.d3v-orb-icon').textContent = conf.orbIcon || '🎁';
        orb.title = '创作工具箱（可拖动）';
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
        if (shouldIgnoreDrag?.()) return;
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
        const size = sizeOf(settings().orbSize);
        const left = clamp(start.left + dx, EDGE_MARGIN, window.innerWidth - size - EDGE_MARGIN);
        const top = clamp(start.top + dy, EDGE_MARGIN, window.innerHeight - size - EDGE_MARGIN);
        orb.style.left = `${left}px`;
        orb.style.top = `${top}px`;
    }

    function snapToEdge(left, top, size) {
        const centre = left + size / 2;
        const snapLeft = centre < window.innerWidth / 2 ? EDGE_MARGIN : window.innerWidth - size - EDGE_MARGIN;
        return { left: snapLeft, top };
    }

    function finishDrag(event) {
        if (!dragging) return;
        dragging = false;
        orb.classList.remove('d3v-orb-dragging');
        capturePointer(orb, event, false);
        start = null;
        if (!moved) return;
        // 拖完浏览器还会补一个 click，短时间内吞掉它，避免"拖一下就把面板打开了"
        suppressClickUntil = Date.now() + 300;
        const size = sizeOf(settings().orbSize);
        const snapped = snapToEdge(parseFloat(orb.style.left) || 0, parseFloat(orb.style.top) || 0, size);
        orb.classList.add('d3v-orb-snapping');
        orb.style.left = `${snapped.left}px`;
        orb.style.top = `${snapped.top}px`;
        setTimeout(() => orb.classList.remove('d3v-orb-snapping'), 240);
        onMove?.(pixelsToFraction(snapped.left, snapped.top, size));
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

    function onKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick?.(); }
    }

    orb.addEventListener('pointerdown', onPointerDown);
    orb.addEventListener('pointermove', onPointerMove);
    orb.addEventListener('pointerup', finishDrag);
    orb.addEventListener('pointercancel', finishDrag);
    orb.addEventListener('click', onClickEvent);
    orb.addEventListener('keydown', onKeyDown);

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
        destroy() {
            window.removeEventListener('resize', onResize);
            orb.remove();
        },
    };
}
