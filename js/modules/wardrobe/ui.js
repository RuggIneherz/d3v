// ===================================================================
// 衣柜与穿搭 · 交互层：生成 / 识图 / 试衣间入库 / 事件绑定
// ===================================================================
import { $, $all, UX, now, uuid, apiReadyFor, fetchChat, fetchChatStream } from '../../utils.js';
import { APIConfig } from '../../api-config.js';
import { state, getItems, saveItems, getOutfits, saveOutfits, getFit, saveFit, splitToFitting } from './state.js';
import { stripFence } from './parse.js';
import { buildOutfitPayload, buildOutfitUser, buildVisionPayload, modelSupportsVision } from './prompt.js';
import { renderList, renderViewChips, refreshRolePreview, saveDraft, saveFittingRender, toast } from './render.js';

// ---------- 生成穿搭 ----------
function roleContextText() { return ($("roleContextInput")?.value || "").trim() || "无"; }
const styleTagsText = () => $("wdStyleTags").value.trim() || "无";
const extraText = () => $("wdExtra").value.trim() || "无";

async function generateOutfit() {
  const cfg = APIConfig.getActive();
  if (!apiReadyFor(cfg)) { toast("先在 API 设置填好地址/密钥/模型，或改用 SillyTavern 当前 API", "error"); return; }
  const user = buildOutfitUser(roleContextText(), $("wdScene").value, styleTagsText(), extraText());
  const payload = buildOutfitPayload(cfg, user);
  const useStream = cfg.stream_enabled !== false; // 默认开启流式
  const editor = $("wdEditor");
  UX.loading(useStream ? "正在流式生成穿搭文本…" : "正在生成穿搭文本…");
  let acc = "";
  try {
    if (useStream) {
      editor.value = "";
      try {
        await fetchChatStream(cfg.base_url, cfg.api_key, payload, chunk => {
          acc += chunk;
          editor.value = acc;                          // 逐字追加
          editor.scrollTop = editor.scrollHeight;
        }, null);
      } catch (streamErr) {
        acc = await fetchChat(cfg.base_url, cfg.api_key, payload); // 流式失败自动降级
      }
    } else {
      acc = await fetchChat(cfg.base_url, cfg.api_key, payload);
    }
    editor.value = stripFence(acc); saveDraft();
    UX.done(); toast("穿搭文本已生成，可点「拆解到试衣间」", "success");
  } catch (e) { UX.done(); toast("生成失败：" + e.message, "error"); }
}

// ---------- 识图 ----------
const readFileAsDataURL = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(file); });

async function callVision(cfg, dataUrl) {
  return fetchChat(cfg.base, cfg.key, buildVisionPayload(cfg.model, dataUrl));
}

// 主 API 识图：地址/密钥/模型齐备且模型支持视觉时才有结果，否则返回空
async function visionPrimary(cfg, dataUrl) {
  if (!(cfg.base_url && cfg.api_key && cfg.model && modelSupportsVision(cfg.model))) return "";
  try { return stripFence(await callVision({ base: cfg.base_url, key: cfg.api_key, model: cfg.model }, dataUrl)); }
  catch { return ""; }
}

// 主模型不可用时走备用识图 API；两条路都不可用则提示并返回 null
async function visionFallback(cfg, dataUrl) {
  const b = cfg.vision_backup_base_url, k = cfg.vision_backup_key, m = cfg.vision_backup_model;
  if (!(b && k && m)) {
    UX.done();
    toast("主模型不支持视觉（或调用失败），且未在 API 设置中配置备用识图 API", "error"); return null;
  }
  try { return { txt: stripFence(await callVision({ base: b, key: k, model: m }, dataUrl)), route: "备用识图 API" }; }
  catch (e) { UX.done(); toast("备用识图也失败了：" + e.message, "error"); return null; }
}

async function visionExtract(file) {
  if (!/image\/(jpeg|png|webp|jpg)/.test(file.type)) { toast("仅支持 jpg/png/webp 图片", "error"); return; }
  UX.loading("正在识图提取衣物…");
  const dataUrl = await readFileAsDataURL(file);
  const cfg = APIConfig.getActive();
  let txt = await visionPrimary(cfg, dataUrl);
  let route = txt ? "主 API" : "";
  if (!txt) {
    const fb = await visionFallback(cfg, dataUrl);
    if (!fb) return;
    txt = fb.txt; route = fb.route;
  }
  $("wdEditor").value = txt; saveDraft();
  // 自动拆解到试衣间，杂句当场过滤
  const r = splitToFitting(txt); saveFittingRender();
  UX.done();
  toast(`识图完成（${route}）：${r.added} 件进入试衣间${r.dropped ? `，过滤 ${r.dropped} 段无效描述` : ""}`, "success");
  $("wdFitList").scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------- 试衣间入库 ----------
function fitToWardrobe(ids) {
  const fit = getFit(), items = getItems();
  const exist = new Set(items.map(x => x.description));
  let n = 0;
  const rest = [];
  fit.forEach(it => {
    if (ids.includes(it.id)) {
      if (!exist.has(it.description)) { items.unshift({ ...it, created_at: now() }); n++; }
    } else rest.push(it);
  });
  saveItems(items); saveFit(rest);
  ids.forEach(id => state.fitSel.delete(id));
  saveFittingRender(); renderList();
  toast(`已入库 ${n} 件单品`, "success");
}

// ---------- 列表事件 ----------
function onSelectBox(cb) {
  if (cb.checked) state.selected.add(cb.dataset.sel); else state.selected.delete(cb.dataset.sel);
  cb.closest(".glass-item").classList.toggle("selected", cb.checked);
}

function delItem(id) {
  if (!confirm("删除该单品？")) return;
  saveItems(getItems().filter(x => x.id !== id));
  state.selected.delete(id);
  renderList();
}

function togglePrivate(id) {
  const list = getItems(), it = list.find(x => x.id === id); if (!it) return;
  it.is_private = !it.is_private; saveItems(list); renderList();
  toast(it.is_private ? "已收入私密抽屉" : "已移出私密抽屉");
}

function editItem(id) {
  const list = getItems(), it = list.find(x => x.id === id); if (!it) return;
  const name = prompt("单品名称：", it.name); if (name === null) return;
  const tags = prompt("标签（逗号分隔，可改颜色/款式）：", (it.tags || []).join(", ")); if (tags === null) return;
  const desc = prompt("客观描述：", it.description); if (desc === null) return;
  it.name = (name.trim() || it.name);
  it.tags = tags.split(/[，,]/).map(s => s.trim()).filter(Boolean);
  if (desc.trim()) it.description = desc.trim();
  saveItems(list); renderList(); toast("已保存修改", "success");
}

function loadOutfit(id) {
  const o = getOutfits().find(x => x.id === id); if (!o) return;
  $("wdEditor").value = o.full_description || ""; saveDraft();
  $("wdEditor").scrollIntoView({ behavior: "smooth", block: "center" });
  toast("已载入编辑区");
}

function splitOutfit(id) {
  const o = getOutfits().find(x => x.id === id); if (!o) return;
  const r = splitToFitting(o.full_description); saveFittingRender();
  state.view = "items"; renderViewChips(); renderList();
  $("wdFitList").scrollIntoView({ behavior: "smooth", block: "center" });
  toast(`已拆到试衣间：${r.added} 件${r.dropped ? `，过滤 ${r.dropped} 段` : ""}`);
}

function delOutfit(id) {
  if (!confirm("删除该整套穿搭？")) return;
  saveOutfits(getOutfits().filter(x => x.id !== id)); renderList();
}

const LIST_ACTS = { del: delItem, priv: togglePrivate, edit: editItem, load: loadOutfit, osplit: splitOutfit, odel: delOutfit };

function onListClick(e) {
  const cb = e.target.closest("[data-sel]");
  if (cb) { onSelectBox(cb); return; }
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const run = LIST_ACTS[btn.dataset.act];
  if (run) run(btn.dataset.id);
}

function onFitClick(e) {
  const btn = e.target.closest("button[data-fact]");
  if (!btn) return;
  const id = btn.dataset.fid;
  if (btn.dataset.fact === "in") fitToWardrobe([id]);
  else { saveFit(getFit().filter(x => x.id !== id)); state.fitSel.delete(id); saveFittingRender(); }
}

function bindListEvents() {
  $("wdList").addEventListener("click", onListClick);
  $("wdFitList").addEventListener("click", onFitClick);
}

// ---------- 保存整套 / 组装整套 ----------
function saveOutfitFromEditor() {
  const text = $("wdEditor").value.trim();
  if (!text) { toast("编辑区没有内容", "error"); return; }
  const def = "穿搭 " + new Date().toLocaleString();
  const name = (prompt("给这套穿搭起个名字：", def) || def).trim() || def;
  const tags = $("wdStyleTags").value.split(/[，,]/).map(s => s.trim()).filter(Boolean);
  const list = getOutfits();
  list.unshift({ id: uuid(), name, item_ids: [], tags, full_description: text, created_at: now() });
  saveOutfits(list);
  state.view = "outfits"; renderViewChips(); renderList(); toast("已保存为整套穿搭", "success");
}

function assemble() {
  const ids = [...state.selected];
  if (ids.length < 2) { toast("先勾选至少两件单品再组装", "error"); return; }
  const picked = ids.map(i => getItems().find(x => x.id === i)).filter(Boolean);
  const def = picked.slice(0, 2).map(x => x.name).join("·");
  const name = (prompt("给这套穿搭起个名字：", def) || def).trim() || def;
  const tags = [...new Set(picked.flatMap(x => x.tags || []))].slice(0, 10);
  const text = picked.map(x => x.description).join("，") + "。";
  const list = getOutfits();
  list.unshift({ id: uuid(), name, item_ids: ids, tags, full_description: text, created_at: now() });
  saveOutfits(list);
  state.selected.clear(); state.view = "outfits"; renderViewChips(); renderList();
  toast(`已用 ${picked.length} 件单品组装成整套穿搭`, "success");
}

// ---------- 事件绑定 ----------
function bindTabHooks() {
  $all(".tab-btn").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.target === "panel-wardrobe") refreshRolePreview();
  }));
  const rc = $("roleContextInput");
  if (rc) rc.addEventListener("input", refreshRolePreview);
}

function bindViewControls() {
  $("view-items").onclick = () => { state.view = "items"; renderViewChips(); renderList(); };
  $("view-outfits").onclick = () => { state.view = "outfits"; renderViewChips(); renderList(); };
  $("scope-private").onclick = () => {
    state.scope = state.scope === "private" ? "normal" : "private";
    state.tagSel.clear(); state.selected.clear(); renderViewChips(); renderList();
  };
  $("wdTagFilter").addEventListener("input", renderList);
}

function bindEditorInputs() {
  ["wdEditor","wdScene","wdStyleTags","wdExtra"].forEach(id => $(id).addEventListener("input", saveDraft));
}

function bindSplitButton() {
  $("wdBtnSplit").onclick = () => {
    const t = $("wdEditor").value.trim();
    if (!t) { toast("编辑区没有可拆解的文本", "error"); return; }
    const r = splitToFitting(t); saveFittingRender();
    state.view = "items"; renderViewChips(); renderList();
    toast(`识别 ${r.added} 件进入试衣间${r.dropped ? `，自动丢弃 ${r.dropped} 段无效文本` : ""}${r.dup ? `，${r.dup} 件已存在` : ""}`, r.dropped ? "error" : "success");
  };
}

function bindManualButton() {
  $("wdBtnAddManual").onclick = () => {
    const t = prompt("输入一件单品的客观描述：");
    if (!t || !t.trim()) return;
    const r = splitToFitting(t); saveFittingRender();
    state.view = "items"; renderViewChips(); renderList();
    toast(r.added ? "已进入试衣间，确认后入库" : "没识别出衣物品类，请补充如「一件黑色…夹克」", r.added ? "success" : "error");
  };
}

function bindFitButtons() {
  $("wdBtnFitAll").onclick = () => {
    const checked = [...$("wdFitList").querySelectorAll("[data-fsel]:checked")].map(c => c.dataset.fsel);
    if (!checked.length) { toast("先勾选要入库的单品", "error"); return; }
    fitToWardrobe(checked);
  };
  $("wdBtnFitClear").onclick = () => { saveFit([]); state.fitSel.clear(); saveFittingRender(); toast("试衣间已清空"); };
}

function bindButtonHooks() {
  $("wdBtnGenerate").onclick = generateOutfit;
  bindSplitButton();
  $("wdBtnSaveOutfit").onclick = saveOutfitFromEditor;
  $("wdBtnAssemble").onclick = assemble;
  $("wdBtnClear").onclick = () => { $("wdEditor").value = ""; saveDraft(); };
  bindManualButton();
  bindFitButtons();
}

function bindVisionInput() {
  $("wdVisionInput").addEventListener("change", e => {
    const f = e.target.files?.[0];
    if (f) visionExtract(f).catch(err => { UX.done(); toast("识图失败：" + (err.message || err), "error"); });
    e.target.value = "";
  });
}

export function bindEvents() {
  bindTabHooks();
  bindViewControls();
  bindEditorInputs();
  bindButtonHooks();
  bindVisionInput();
  bindListEvents();
}
