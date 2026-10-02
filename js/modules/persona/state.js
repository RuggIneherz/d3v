// ===================================================================
// 人设面板 · 状态与持久化
//   内存状态（当前分组 / 已选标签）、DOM 引用与 localStorage 读写。
//   DOM 引用在初始化时按当前 DOM 根取一次，其余模块统一从这里取用。
// ===================================================================
import { $, getLS, setLS, uuid } from '../../utils.js';
import { DEFAULT_TEMPLATE } from './prompt.js';

// Storage keys（键名与旧版完全一致，改动会影响老数据）
export const LS_DRAFT="pp_draft_v8", LS_HIS="pp_his_v8", LS_ROLECTX="pp_rolectx_v8", LS_WB="pp_wb_v8", LS_PRESET="pp_custom_preset_v8", LS_RESULT="pp_result_v8";
const LS_GROUPS = "pp_preset_groups_v9";
export const UNGROUPED = "ungrouped";

// ===== DOM 引用 =====
// 每次初始化重新取值：影子根重新挂载后旧引用会失效
export const dom = {};

export function bindPersonaDom(){
  dom.tip=$("tip");
  dom.templateInput=$("templateInput");
  dom.roleContextInput=$("roleContextInput");
  dom.keywordsInput=$("keywordsInput");
  dom.resultOutput=$("resultOutput");
  dom.historyList=$("historyList");
  dom.historySearch=$("historySearch");
  dom.historyModeFilter=$("historyModeFilter");
  dom.roleTip=$("roleTip");
  dom.worldbookList=$("worldbookList");
}

// ===== 内存状态 =====
let currentGroup="all";
const activeTags=new Set();

/** 回到初始状态：原实现每次初始化都是一份新闭包，这里显式复位 */
export function resetPersonaState(){
  currentGroup="all";
  activeTags.clear();
}

export const getCurrentGroup=()=>currentGroup;
export const setCurrentGroup=g=>{ currentGroup=g; };
export const getActiveTags=()=>activeTags;
export const activeTagCount=()=>activeTags.size;
export const hasActiveTag=t=>activeTags.has(t);
export const clearActiveTags=()=>activeTags.clear();

export function toggleActiveTag(t){
  if(activeTags.has(t)) activeTags.delete(t);
  else activeTags.add(t);
}

// ===== 当前输入 =====
export const parseKeywords=()=> (dom.keywordsInput.value||"").split(/[，,]/).map(s=>s.trim()).filter(Boolean);

export function saveDraft(){
  setLS(LS_DRAFT, dom.templateInput.value||"");
  setLS(LS_ROLECTX, dom.roleContextInput.value||"");
  setLS(LS_RESULT, dom.resultOutput.value||"");
}

/** 生成所需的当前输入：模板 / 角色上下文 / 关键词 / 世界书 */
export const collectGenerationInputs=()=>({
  template: dom.templateInput.value||"",
  role: dom.roleContextInput.value||"",
  keywords: parseKeywords(),
  worldbooks: worldbooksGet()
});

// ===== 模板库：分组 + 标签 =====
export function defaultGroups(){
  return [
    {id:UNGROUPED, name:"未分类"},
    {id:uuid(), name:"现代都市"},
    {id:uuid(), name:"古代/架空"},
    {id:uuid(), name:"科幻/异世界"}
  ];
}
export const getGroups=()=>getLS(LS_GROUPS, null);
export const saveGroups=list=>setLS(LS_GROUPS, list);
export const getPresets=()=>getLS(LS_PRESET, []);
export const savePresets=list=>setLS(LS_PRESET, list);

// 首次进入：建立默认分组 + 把旧版自定义模板迁移进来 + 放几个占位模板示例
export function ensurePresetSeed(){
  if(getGroups()) return;
  const groups=defaultGroups();
  const modern=groups[1].id, ancient=groups[2].id, scifi=groups[3].id;
  const migrated=migratedPresets();
  const seed=seedPresets(modern, ancient, scifi);
  saveGroups(groups);
  savePresets([...seed, ...migrated]);
}

function migratedPresets(){
  return getPresets().map(p=>({
    id:p.id||uuid(), name:p.name||"未命名模板", content:p.content||DEFAULT_TEMPLATE,
    group:p.group||UNGROUPED, tags:Array.isArray(p.tags)?p.tags:[]
  }));
}

function seedPresets(modern, ancient, scifi){
  const patch=(identity)=>DEFAULT_TEMPLATE.replace("identity:\n    -",`identity:\n    - ${identity}`);
  return [
    {id:uuid(), name:"都市冷感执行者", content:DEFAULT_TEMPLATE, group:modern, tags:["现代","职场","高冷"]},
    {id:uuid(), name:"校园元气社交型", content:patch("大学社团骨干"), group:modern, tags:["现代","校园","元气"]},
    {id:uuid(), name:"赛博侦查者", content:patch("数字取证分析师"), group:scifi, tags:["赛博","悬疑"]},
    {id:uuid(), name:"古风谋士", content:patch("幕僚参议"), group:ancient, tags:["古风","谋士"]}
  ];
}

// ===== 世界书 =====
export const worldbooksGet=()=>getLS(LS_WB, []);
export const worldbooksSet=list=>setLS(LS_WB, list);

// ===== 历史 =====
export const historyGet=()=>getLS(LS_HIS, []);
export const historySet=list=>setLS(LS_HIS, list);

/** 追加一条历史（最多保留 100 条）；历史列表刷新由调用方在同一步里完成 */
export function pushHistory(item){
  const list=historyGet();
  list.unshift(item);
  if(list.length>100) list.length=100;
  historySet(list);
}
