// ===================================================================
// 入口：Tab 切换 / 背景图库 / 悬浮球 / API 设置弹窗（含流式开关）
//      最后初始化三大功能模块
// ===================================================================
import { $, getLS, setLS, UX, headers } from './utils.js';
import { APIConfig } from './api-config.js';
import { initPersona } from './modules/persona.js';
import { initNameGen } from './modules/namegen.js';
import { initWardrobe } from './modules/wardrobe.js';

// ---------- Tab 切换 ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.glass-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
  });
});

// ---------- 背景：备选图库 / 自定义图库 / 一键清空 / 北京时间自动昼夜 ----------
(() => {
  const LS_CUR = 'user_toolkit_custom_bg';      // 兼容旧版：当前自定义图
  const LS_GAL = 'user_bg_gallery_v1';          // 自定义图库 dataURL 数组
  const LS_PREF = 'user_bg_pref_v2';            // {mode:'auto'|'preset'|'custom'|'none', value}
  const bgLayer = document.getElementById('bg-layer');
  const modal = document.getElementById('bgModal');
  const getPref = () => getLS(LS_PREF, { mode: 'none', value: '' });
  const savePref = p => setLS(LS_PREF, p);
  const getGallery = () => { const g = getLS(LS_GAL, []); return Array.isArray(g) ? g : []; };
  const saveGallery = g => setLS(LS_GAL, g);

  // 备选背景（纯 CSS 渐变，离线可用）
  const PRESETS = [
    { id: 'day',     name: '白昼',       css: 'linear-gradient(160deg,#6f8fc8,#9db9e6 45%,#c6d3f2)' },
    { id: 'dusk',    name: '薄暮',       css: 'linear-gradient(160deg,#2a2350,#5b4a8a 50%,#c98f7a)' },
    { id: 'night',   name: '深夜',       css: 'linear-gradient(160deg,#05060f,#0d1230 55%,#1b2350)' },
    { id: 'aurora',  name: '极光',       css: 'linear-gradient(150deg,#04101e,#0b2a3a 45%,#123c34)' },
    { id: 'ink',     name: '墨色',       css: 'linear-gradient(160deg,#14141c,#20202c)' },
    { id: 'rose',    name: '蔷薇黎明',   css: 'linear-gradient(160deg,#3a2a3d,#7a5a78 55%,#b07f86)' },
    { id: 'forest',  name: '雾林',       css: 'linear-gradient(160deg,#0e1a16,#20382c 55%,#3d5a4a)' },
    { id: 'slate',   name: '灰蓝',       css: 'linear-gradient(160deg,#1b2030,#2c3447 55%,#45506b)' }
  ];

  function applyPreset(css) {
    bgLayer.style.backgroundImage = 'none';
    bgLayer.style.background = css;
  }
  function applyImage(url) {
    bgLayer.style.background = '';
    bgLayer.style.backgroundImage = `url(${url})`;
    bgLayer.style.backgroundSize = 'cover';
    bgLayer.style.backgroundPosition = 'center';
  }
  function clearBg() {
    bgLayer.style.background = '';
    bgLayer.style.backgroundImage = 'none';
  }

  // 北京时间小时（UTC+8，不依赖本机时区）
  function beijingHour() {
    const now = new Date();
    return (now.getUTCHours() + 8) % 24;
  }
  function autoDayNight() {
    const h = beijingHour();
    const id = (h >= 7 && h < 18) ? 'day' : 'night';
    const p = PRESETS.find(x => x.id === id);
    applyPreset(p.css);
    return p.name;
  }

  function applyCurrent() {
    const pref = getPref();
    if (pref.mode === 'auto') return autoDayNight();
    if (pref.mode === 'preset') { const p = PRESETS.find(x => x.id === pref.value); if (p) { applyPreset(p.css); return p.name; } }
    if (pref.mode === 'custom') { const url = pref.value || localStorage.getItem(LS_CUR); if (url) { applyImage(url); return '自定义'; } }
    clearBg();
    // 兼容旧版：v2 之前存过自定义图则继续显示
    const legacy = localStorage.getItem(LS_CUR);
    if (legacy) applyImage(legacy);
    return '';
  }

  // 图片压缩后入库（避免 localStorage 超限）
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onload = e => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1600;
          let { width: w, height: hh } = img;
          if (Math.max(w, hh) > MAX) { const k = MAX / Math.max(w, hh); w = Math.round(w * k); hh = Math.round(hh * k); }
          const c = document.createElement('canvas');
          c.width = w; c.height = hh;
          c.getContext('2d').drawImage(img, 0, 0, w, hh);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      rd.onerror = reject;
      rd.readAsDataURL(file);
    });
  }

  function renderModal() {
    const pref = getPref();
    const presetBox = document.getElementById('bgPresets');
    presetBox.innerHTML = PRESETS.map(p =>
      `<div class="bg-swatch${pref.mode === 'preset' && pref.value === p.id ? ' active' : ''}" data-pid="${p.id}" style="background:${p.css}"><span class="sw-label">${p.name}</span></div>`
    ).join('');
    presetBox.querySelectorAll('.bg-swatch').forEach(el => el.onclick = () => {
      savePref({ mode: 'preset', value: el.dataset.pid });
      applyCurrent(); renderModal();
    });

    const gal = getGallery();
    const galBox = document.getElementById('bgGallery');
    galBox.innerHTML = gal.length ? gal.map((u, i) =>
      `<div class="bg-thumb${pref.mode === 'custom' && pref.value === u ? ' active' : ''}" data-i="${i}" style="background-image:url('${u}')"><button class="bg-del" data-del="${i}">×</button></div>`
    ).join('') : '<span class="small">还没有自定义背景，点下方按钮上传。</span>';
    galBox.querySelectorAll('.bg-thumb').forEach(el => el.onclick = e => {
      if (e.target.dataset.del !== undefined) return;
      const u = gal[Number(el.dataset.i)];
      savePref({ mode: 'custom', value: u });
      try { localStorage.setItem(LS_CUR, u); } catch {}
      applyCurrent(); renderModal();
    });
    galBox.querySelectorAll('.bg-del').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const g = getGallery(); g.splice(Number(b.dataset.del), 1); saveGallery(g); renderModal();
    });

    document.getElementById('bgAuto').checked = pref.mode === 'auto';
  }

  function openModal() { renderModal(); modal.classList.add('show'); }
  function closeModal() { modal.classList.remove('show'); }

  document.getElementById('btnOpenBg').onclick = openModal;
  document.getElementById('bgClose').onclick = closeModal;
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.getElementById('bgUploader').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    UX.loading('压缩并保存背景中…');
    try {
      const url = await compressImage(file);
      const g = getGallery();
      if (!g.includes(url)) {
        g.unshift(url);
        try { saveGallery(g.slice(0, 6)); }
        catch (err) { UX.done(); UX.toast('存储空间不足，已无法保存更多背景', 'error'); return; }
      }
      savePref({ mode: 'custom', value: url });
      try { localStorage.setItem(LS_CUR, url); } catch {}
      applyCurrent(); renderModal();
      UX.done(); UX.toast('自定义背景已保存并应用', 'success');
    } catch (err) {
      UX.done(); UX.toast('背景读取失败：' + (err.message || err), 'error');
    }
  });

  document.getElementById('bgAuto').addEventListener('change', e => {
    if (e.target.checked) { savePref({ mode: 'auto', value: '' }); autoDayNight(); renderModal(); UX.toast('已开启按北京时间自动昼夜'); }
  });
  document.getElementById('bgClear').onclick = () => {
    localStorage.removeItem(LS_CUR); saveGallery([]); savePref({ mode: 'none', value: '' });
    clearBg(); renderModal(); UX.toast('背景已一键清空');
  };

  // 初始化 + 每分钟校正自动昼夜
  renderModal();
  applyCurrent();
  setInterval(() => { if (getPref().mode === 'auto') autoDayNight(); }, 60000);
})();

// ---------- 悬浮球 ----------
(() => {
  const ball = document.getElementById('fabBall');
  const menu = document.getElementById('fabMenu');
  ball.onclick = () => menu.classList.toggle('show');
  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && e.target !== ball && !ball.contains(e.target)) menu.classList.remove('show');
  });
  document.getElementById('fabTop').onclick = () => {
    document.querySelector('.app-container').scrollTo({ top: 0, behavior: 'smooth' });
    menu.classList.remove('show');
  };
  document.getElementById('fabRegen').onclick = () => {
    const active = document.querySelector('.tab-btn.active')?.dataset.target;
    const map = { 'panel-persona': 'btnGenerate', 'panel-name': 'btnGenName', 'panel-wardrobe': 'wdBtnGenerate' };
    const id = map[active]; if (id) document.getElementById(id)?.click();
    menu.classList.remove('show');
  };
  document.getElementById('fabCopy').onclick = async () => {
    const active = document.querySelector('.tab-btn.active')?.dataset.target;
    let txt = '';
    if (active === 'panel-persona') txt = document.getElementById('resultOutput')?.value || '';
    else if (active === 'panel-name') txt = [...document.querySelectorAll('#resultList .name')].map(x => x.textContent.trim()).join('\n');
    else if (active === 'panel-wardrobe') txt = document.getElementById('wdEditor')?.value || '';
    menu.classList.remove('show');
    if (!txt) { UX.toast('当前没有可复制的结果'); return; }
    try { await navigator.clipboard.writeText(txt); UX.toast('已复制当前结果', 'success'); }
    catch { UX.toast('复制失败', 'error'); }
  };
})();

// ---------- API 设置弹窗（含流式复选框同步） ----------
(() => {
  const modal = $('apiModal');
  const profileSelect = $('apiProfileSelect');
  const baseUrlInput = $('apiBaseUrl');
  const keyInput = $('apiKeyInput');
  const modelSelect = $('apiModelSelect');
  const modelManual = $('apiModelManual');
  const tempRange = $('apiTempRange');
  const tempVal = $('apiTempVal');
  const apiTip = $('apiTip');
  const streamCheck = $('apiStreamCheck');

  const setTip = m => { apiTip.textContent = m || ''; if (m) setTimeout(() => apiTip.textContent === m && (apiTip.textContent = ''), 1700); };
  const normalize = u => (u || '').trim().replace(/\/+$/, '');

  function modelUrls(base) {
    const b = normalize(base);
    if (b.endsWith('/v1')) return [`${b}/models`, `${b.slice(0, -3)}/v1/models`, `${b.slice(0, -3)}/models`];
    return [`${b}/v1/models`, `${b}/models`];
  }

  function refreshProfileSelect() {
    const list = APIConfig.getProfiles();
    const activeId = APIConfig.getActiveId();
    profileSelect.innerHTML = list.map(p => `<option value="${p.id}"${p.id === activeId ? ' selected' : ''}>${p.name}</option>`).join('');
  }

  function loadFormFromActive() {
    const cfg = APIConfig.getActive();
    baseUrlInput.value = cfg.base_url || '';
    keyInput.value = cfg.api_key || '';
    modelManual.value = cfg.model || '';
    const wdVB = $('wdVisionBase'), wdVK = $('wdVisionKey'), wdVM = $('wdVisionModel');
    if (wdVB) { wdVB.value = cfg.vision_backup_base_url || ''; wdVK.value = cfg.vision_backup_key || ''; wdVM.value = cfg.vision_backup_model || ''; }
    modelSelect.innerHTML = `<option value="${cfg.model || ''}">${cfg.model || '请拉取模型或手填'}</option>`;
    tempRange.value = cfg.temperature ?? 0.75;
    tempVal.textContent = Number(tempRange.value).toFixed(2);
    if (streamCheck) streamCheck.checked = cfg.stream_enabled !== false; // 默认开启
  }

  function openModal() {
    refreshProfileSelect();
    loadFormFromActive();
    modal.classList.add('show');
  }

  $('btnOpenApi').onclick = openModal;
  $('btnCloseApi').onclick = () => modal.classList.remove('show');
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });

  profileSelect.onchange = () => {
    APIConfig.setActiveId(profileSelect.value);
    loadFormFromActive();
  };

  $('btnNewProfile').onclick = () => {
    const name = prompt('新配置档案名称：', `配置${APIConfig.getProfiles().length + 1}`);
    if (name === null) return;
    APIConfig.addProfile(name.trim() || undefined);
    refreshProfileSelect();
    loadFormFromActive();
    setTip('已新增');
  };
  $('btnRenameProfile').onclick = () => {
    const cur = APIConfig.getActive();
    const name = prompt('重命名为：', cur.name);
    if (name === null) return;
    APIConfig.renameActive(name.trim() || cur.name);
    refreshProfileSelect();
    setTip('已重命名');
  };
  $('btnDeleteProfile').onclick = () => {
    if (APIConfig.getProfiles().length <= 1) { setTip('至少保留一份配置'); return; }
    if (!confirm('确定删除当前配置档案？')) return;
    APIConfig.deleteActive();
    refreshProfileSelect();
    loadFormFromActive();
    setTip('已删除');
  };

  tempRange.oninput = () => tempVal.textContent = Number(tempRange.value).toFixed(2);
  modelSelect.onchange = () => modelManual.value = modelSelect.value || '';

  $('btnSaveApi').onclick = () => {
    APIConfig.updateActive({
      base_url: normalize(baseUrlInput.value),
      api_key: keyInput.value.trim(),
      model: (modelManual.value || modelSelect.value || '').trim(),
      temperature: Number(tempRange.value || 0.75),
      vision_backup_base_url: ($('wdVisionBase') || { value: '' }).value.trim(),
      vision_backup_key: ($('wdVisionKey') || { value: '' }).value.trim(),
      vision_backup_model: ($('wdVisionModel') || { value: '' }).value.trim(),
      stream_enabled: streamCheck ? streamCheck.checked : true
    });
    refreshProfileSelect();
    setTip('已保存');
  };

  $('btnPullModels').onclick = async () => {
    const base = baseUrlInput.value.trim(), key = keyInput.value.trim();
    if (!base) { setTip('请先填写API地址'); return; }
    setTip('拉取中...');
    let lastErr = '';
    for (const u of modelUrls(base)) {
      try {
        const r = await fetch(u, { method: 'GET', headers: headers(key) });
        if (!r.ok) { lastErr = `${r.status}`; continue; }
        const d = await r.json();
        let models = [];
        if (Array.isArray(d?.data)) models = d.data.map(x => x?.id).filter(Boolean);
        if (!models.length && Array.isArray(d?.models)) models = d.models.map(x => typeof x === 'string' ? x : x?.id).filter(Boolean);
        if (!models.length && Array.isArray(d)) models = d.map(x => typeof x === 'string' ? x : x?.id).filter(Boolean);
        modelSelect.innerHTML = '';
        if (!models.length) {
          modelSelect.innerHTML = `<option value="">未拉到模型（可手填）</option>`;
          setTip('未拉到模型');
        } else {
          models.forEach(m => { const o = document.createElement('option'); o.value = m; o.textContent = m; modelSelect.appendChild(o); });
          modelManual.value = models[0];
          setTip('拉取成功');
        }
        return;
      } catch (e) { lastErr = e.message || String(e); }
    }
    setTip('拉取失败，可手填模型');
    console.warn(lastErr);
  };
})();

// ---------- 初始化三大模块（module 脚本默认 defer，此时 DOM 已就绪） ----------
initPersona();
initNameGen();
initWardrobe();
