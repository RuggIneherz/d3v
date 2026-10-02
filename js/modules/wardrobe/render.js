// ===================================================================
// 衣柜与穿搭 · 渲染层：列表 / 卡片 / 试衣间 / 草稿与角色提示
// ===================================================================
import { $, UX } from '../../utils.js';
import { state, getItems, getOutfits, getFit, saveDraftLS, readDraftLS } from './state.js';

// 提示条：进入模块时取一次元素，与界面同生命周期
let tipEl = null;
export function initRenderDom() { tipEl = $("wdTip"); }
export const setTip = (m) => { tipEl.textContent = m || ""; if (m) setTimeout(() => tipEl.textContent === m && (tipEl.textContent = ""), 3000); };
export const toast = (m, t) => UX.toast(m, t);
export const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

export function renderViewChips() {
  $("view-items").classList.toggle("active", state.view === "items");
  $("view-outfits").classList.toggle("active", state.view === "outfits");
  $("scope-private").classList.toggle("active", state.scope === "private");
}

export function renderTagChips(list) {
  const tagSet = new Set();
  list.forEach(it => (it.tags || []).forEach(t => tagSet.add(t)));
  const tags = [...tagSet].sort();
  const box = $("wdTagChips");
  if (!tags.length) { box.innerHTML = '<span class="small">（暂无标签，拆解后会自动生成颜色 / 款式标签）</span>'; return; }
  box.innerHTML = tags.map(t => `<span class="wd-tag-chip${state.tagSel.has(t) ? " active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`).join("");
  box.querySelectorAll("[data-tag]").forEach(el => el.onclick = () => {
    const t = el.dataset.tag;
    if (state.tagSel.has(t)) state.tagSel.delete(t); else state.tagSel.add(t);
    renderList();
  });
}

function itemCard(it) {
  const sel = state.selected.has(it.id);
  const tags = (it.tags || []).map(t => `<span class="glass-tag">${esc(t)}</span>`).join("");
  return `<div class="glass-item ${sel ? "selected" : ""}" data-id="${it.id}">
      <div class="row" style="justify-content:space-between;align-items:flex-start;margin:0;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" data-sel="${it.id}" ${sel ? "checked" : ""}></label>
            <span class="name" style="margin:0;">${esc(it.name)}</span>
            ${it.is_private ? '<span class="glass-tag private-tag">私密</span>' : ""}
          </div>
          <div class="meta" style="margin-top:4px;">${esc(it.created_at)}</div>
          <div style="margin:2px 0;">${tags}</div>
          <div class="small">${esc(it.description)}</div>
        </div>
        <div class="row" style="margin:0;flex-wrap:nowrap;">
          <button class="glass-btn" data-act="priv" data-id="${it.id}">${it.is_private ? "移出抽屉" : "收入抽屉"}</button>
          <button class="glass-btn" data-act="edit" data-id="${it.id}">编辑</button>
          <button class="glass-btn" data-act="del" data-id="${it.id}">删除</button>
        </div>
      </div></div>`;
}

function outfitCard(o) {
  const items = getItems();
  const cnt = (o.item_ids || []).filter(iid => items.some(x => x.id === iid)).length;
  const tags = (o.tags || []).map(t => `<span class="glass-tag">${esc(t)}</span>`).join("");
  return `<div class="glass-item" data-id="${o.id}">
      <div class="row" style="justify-content:space-between;align-items:flex-start;margin:0;">
        <div style="flex:1;min-width:0;">
          <span class="name" style="margin:0;">${esc(o.name)}</span>
          <div class="meta" style="margin-top:4px;">${esc(o.created_at)} · 关联单品 ${cnt} 件</div>
          <div style="margin:2px 0;">${tags}</div>
          <div class="small">${esc((o.full_description || "").slice(0, 160))}</div>
        </div>
        <div class="row" style="margin:0;flex-wrap:nowrap;">
          <button class="glass-btn" data-act="load" data-id="${o.id}">载入编辑区</button>
          <button class="glass-btn" data-act="osplit" data-id="${o.id}">拆到试衣间</button>
          <button class="glass-btn" data-act="odel" data-id="${o.id}">删除</button>
        </div>
      </div></div>`;
}

function filterItems(kw) {
  return getItems().filter(it => {
    if (state.scope === "private") return !!it.is_private;
    if (it.is_private) return false;
    if (state.tagSel.size) { const has = (it.tags || []).some(t => state.tagSel.has(t)); if (!has) return false; }
    if (kw) { const hay = (it.name + " " + (it.tags || []).join(" ") + " " + it.description).toLowerCase(); if (!hay.includes(kw)) return false; }
    return true;
  }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function renderItems(box) {
  const kw = $("wdTagFilter").value.trim().toLowerCase();
  const list = filterItems(kw);
  renderTagChips(state.scope === "private" ? getItems().filter(x => x.is_private) : getItems().filter(x => !x.is_private));
  $("wdCount").textContent = `共 ${list.length} 件${state.scope === "private" ? "（私密抽屉）" : ""}`;
  box.innerHTML = list.length ? list.map(itemCard).join("") : '<div class="small">这里还没有单品：生成/识图后在「试衣间」确认入库，或点「手动新增单品」。</div>';
}

function renderOutfits(box) {
  const list = getOutfits().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  $("wdTagChips").innerHTML = "";
  $("wdCount").textContent = `共 ${list.length} 套穿搭`;
  box.innerHTML = list.length ? list.map(outfitCard).join("") : '<div class="small">还没有整套穿搭：在编辑区写好文本后点「保存为整套穿搭」，或勾选多件单品「组装为整套」。</div>';
}

export function renderList() {
  const box = $("wdList");
  if (state.view === "items") renderItems(box); else renderOutfits(box);
  $("wdBtnAssemble").style.visibility = state.view === "items" ? "visible" : "hidden";
}

// ---------- 试衣间 ----------
export function saveFittingRender() {
  const fit = getFit();
  const box = $("wdFitList");
  $("wdFitCount").textContent = fit.length ? `试衣间暂存 ${fit.length} 件` : "";
  if (!fit.length) { box.innerHTML = ""; return; }
  box.innerHTML = fit.map(it => `
      <div class="fit-item" data-fid="${it.id}">
        <input type="checkbox" data-fsel="${it.id}" checked>
        <div class="fit-main">
          <div style="font-weight:600;font-size:14px;">${esc(it.name)} ${it.is_private ? '<span class="glass-tag private-tag">私密</span>' : ""}</div>
          <div style="margin:2px 0;">${(it.tags || []).map(t => `<span class="glass-tag">${esc(t)}</span>`).join("")}</div>
          <div class="small">${esc(it.description)}</div>
        </div>
        <div class="row" style="margin:0;flex-wrap:nowrap;">
          <button class="glass-btn" data-fact="in" data-fid="${it.id}">入库</button>
          <button class="glass-btn" data-fact="drop" data-fid="${it.id}">丢弃</button>
        </div>
      </div>`).join("");
}

// ---------- 草稿 / 角色联动 ----------
export function saveDraft() {
  saveDraftLS({ editor: $("wdEditor").value, scene: $("wdScene").value, style: $("wdStyleTags").value, extra: $("wdExtra").value });
}

export function loadDraft() {
  const d = readDraftLS(); if (!d) return;
  $("wdEditor").value = d.editor || "";
  if (d.scene) $("wdScene").value = d.scene;
  $("wdStyleTags").value = d.style || "";
  $("wdExtra").value = d.extra || "";
}

export function refreshRolePreview() {
  const len = ($("roleContextInput")?.value || "").trim().length;
  $("wdRolePreview").textContent = len
    ? `将自动引用【人设生成】面板的角色上下文（当前 ${len} 字）`
    : "人设面板暂无角色上下文，生成时将以「无」提交；可先去人设面板导入角色。";
}
