// ===================================================================
// 衣柜与穿搭 · 入口：只做装配，把状态、渲染与事件串起来
// ===================================================================
import { resetState } from './state.js';
import { initRenderDom, loadDraft, refreshRolePreview, renderList, renderViewChips, saveFittingRender } from './render.js';
import { bindEvents } from './ui.js';

export function initWardrobe() {
  initRenderDom();
  resetState();
  renderViewChips();
  bindEvents();
  loadDraft();
  refreshRolePreview();
  saveFittingRender();
  renderList();
}
