// 人设生成面板 · 装配入口：复位状态 → 取 DOM → 绑事件 → 初始化灵感词 → 装载存档并渲染
// 细分模块：state（状态与持久化）/ prompt（提示词与请求体）/ parse（解析与清洗）/ render（渲染与生成）/ ui（事件绑定）
import { resetPersonaState, bindPersonaDom } from './state.js';
import { initChips, loadPersonaPanel } from './render.js';
import { bindPresetPanel, bindWorldbookPanel, bindRolePanel, bindGeneratorPanel } from './ui.js';

export function initPersona(){
  resetPersonaState();
  bindPersonaDom();
  bindPresetPanel();
  bindWorldbookPanel();
  bindRolePanel();
  bindGeneratorPanel();
  initChips();
  loadPersonaPanel();
}
