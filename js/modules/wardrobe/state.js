// ===================================================================
// 衣柜与穿搭 · 状态与持久化：内存状态 + localStorage 读写 / 拆解入库
// ===================================================================
import { getLS, setLS, now, uuid } from '../../utils.js';
import { GARMENT_RE, STRIP_LEAD, classify, extractTags, splitSegments } from './parse.js';

const LS_ITEMS = "wd_items_v1", LS_OUTFITS = "wd_outfits_v1", LS_DRAFT = "wd_draft_v1", LS_FIT = "wd_fitting_v1";

export const getItems = () => getLS(LS_ITEMS, []);
export const saveItems = l => setLS(LS_ITEMS, l);
export const getOutfits = () => getLS(LS_OUTFITS, []);
export const saveOutfits = l => setLS(LS_OUTFITS, l);
export const getFit = () => getLS(LS_FIT, []);
export const saveFit = l => setLS(LS_FIT, l);

// ---------- 界面状态：当前分区 / 私密抽屉 / 标签筛选 / 勾选集合 ----------
export const state = { view: "items", scope: "normal", tagSel: new Set(), selected: new Set(), fitSel: new Set() };

export function resetState() {
  state.view = "items";
  state.scope = "normal";
  state.tagSel.clear();
  state.selected.clear();
  state.fitSel.clear();
}

// ---------- 草稿（编辑区 / 场景 / 风格标签 / 额外约束） ----------
export const saveDraftLS = d => setLS(LS_DRAFT, d);
export const readDraftLS = () => getLS(LS_DRAFT, null);

function makeItem(seg) {
  const rule = classify(seg) || { cat: "top", priv: false };
  const clean = seg.replace(STRIP_LEAD, "").replace(/[。.，,；;：:]+$/, "").trim();
  return { id: uuid(), name: clean.slice(0, 14), description: seg.trim(), tags: extractTags(seg), category: rule.cat, is_private: !!rule.priv, created_at: now() };
}

// 拆解 → 试衣间；识别不出品类的杂句自动丢弃
export function splitToFitting(text) {
  const segs = splitSegments(text);
  const fit = getFit(), items = getItems();
  const existFit = new Set(fit.map(x => x.description)), existItem = new Set(items.map(x => x.description));
  let added = 0, dropped = 0, dup = 0;
  segs.forEach(s => {
    if (!GARMENT_RE.test(s) || s.length < 3) { dropped++; return; }
    if (existFit.has(s) || existItem.has(s)) { dup++; return; }
    fit.unshift(makeItem(s)); added++;
  });
  saveFit(fit);
  return { added, dropped, dup };
}
