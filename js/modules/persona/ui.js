// ===================================================================
// 人设面板 · 交互层
//   面板级控件事件：模板库增删改 / 导入导出、世界书导入与清空、
//   角色卡素材解析、结果区按钮与输入监听。
// ===================================================================
import { $, uuid } from '../../utils.js';
import { dom, saveDraft, getPresets, savePresets, getGroups, saveGroups,
  defaultGroups, getCurrentGroup, setCurrentGroup, clearActiveTags, UNGROUPED,
  worldbooksGet, worldbooksSet, historySet } from './state.js';
import { DEFAULT_TEMPLATE } from './prompt.js';
import { normalizeWb, extractWorldbookEntries, parsePngTextChunks, toRoleContext,
  roleFromPngChunks, worldbookFromPngChunks } from './parse.js';
import { setTip, renderGroupTabs, renderTagFilter, renderPresetList, renderWorldbooks,
  renderHistory, generate } from './render.js';

const asArray = v => (Array.isArray(v)?v:[]);

/** 浏览器下载：统一的 Blob + a.click + revoke 流程 */
function downloadBlob(text, type, filename){
  const blob=new Blob([text],{type});
  const u=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=u; a.download=filename; a.click(); URL.revokeObjectURL(u);
}

// ===== 模板库：列表动作 =====
const PRESET_ACTIONS={
  apply:actPresetApply,
  edit:actPresetEdit,
  delete:actPresetDelete,
  "save-meta":actPresetSaveMeta,
  "save-content":actPresetSaveContent,
  cancel:actPresetCancel
};

function onPresetListClick(e){
  const btn=e.target.closest("button[data-act]");
  if(!btn) return;
  const item=btn.closest(".glass-item");
  const act=btn.dataset.act;
  const list=getPresets();
  const idx=list.findIndex(x=>x.id===item.dataset.id);
  if(idx<0) return;
  const run=PRESET_ACTIONS[act];
  if(run) run(item, list, idx);
}

function actPresetApply(item, list, idx){
  if(!confirm("套用将覆盖当前模板，继续？")) return;
  dom.templateInput.value=list[idx].content;
  saveDraft(); setTip("已套用模板");
}

function actPresetEdit(item){
  const edit=item.querySelector(".preset-edit");
  edit.style.display = edit.style.display==="none" ? "block" : "none";
}

function actPresetDelete(item, list, idx){
  if(!confirm("确定删除该模板？")) return;
  const id=list[idx].id;
  savePresets(list.filter(x=>x.id!==id));
  renderTagFilter(); renderPresetList(); setTip("已删除");
}

function actPresetSaveMeta(item, list, idx){
  const name=item.querySelector(".edit-name").value.trim();
  const group=item.querySelector(".edit-group").value;
  const tags=item.querySelector(".edit-tags").value.split(/[，,]/).map(s=>s.trim()).filter(Boolean);
  if(!name) return setTip("名称不能为空");
  list[idx]={...list[idx], name, group, tags};
  savePresets(list);
  renderGroupTabs(); renderTagFilter(); renderPresetList(); setTip("已保存");
}

function actPresetSaveContent(item, list, idx){
  list[idx]={...list[idx], content:dom.templateInput.value};
  savePresets(list);
  setTip("已用当前内容覆盖模板");
}

function actPresetCancel(item){
  item.querySelector(".preset-edit").style.display="none";
}

// ===== 模板库：按钮 =====
export function bindPresetPanel(){
  $("presetList").addEventListener("click", onPresetListClick);
  $("btnAddPreset").onclick=addPreset;
  $("btnPresetAddGroup").onclick=addPresetGroup;
  $("btnPresetRenameGroup").onclick=renamePresetGroup;
  $("btnPresetDeleteGroup").onclick=deletePresetGroup;
  $("btnExportPreset").onclick=exportPresets;
  $("btnImportPreset").onclick=importPresets;
}

function addPreset(){
  const name=prompt("新模板名称：");
  if(!name||!name.trim()) return;
  const list=getPresets();
  const group=getCurrentGroup()==="all" ? UNGROUPED : getCurrentGroup();
  list.push({id:uuid(), name:name.trim(), content:dom.templateInput.value||DEFAULT_TEMPLATE, group, tags:[]});
  savePresets(list);
  renderTagFilter(); renderPresetList(); setTip("已新增模板");
}

function addPresetGroup(){
  const name=prompt("新分组名称：");
  if(!name||!name.trim()) return;
  const groups=getGroups()||defaultGroups();
  const g={id:uuid(), name:name.trim()};
  groups.push(g); saveGroups(groups);
  setCurrentGroup(g.id); clearActiveTags();
  renderGroupTabs(); renderTagFilter(); renderPresetList(); setTip("已新建分组");
}

function renamePresetGroup(){
  const cur=getCurrentGroup();
  if(cur==="all"||cur===UNGROUPED) return setTip("该分组不可重命名");
  const groups=getGroups()||[], g=groups.find(x=>x.id===cur);
  if(!g) return;
  const name=prompt("新分组名称：", g.name);
  if(!name||!name.trim()) return;
  g.name=name.trim(); saveGroups(groups);
  renderGroupTabs(); renderPresetList(); setTip("已重命名");
}

function deletePresetGroup(){
  const cur=getCurrentGroup();
  if(cur==="all"||cur===UNGROUPED) return setTip("该分组不可删除");
  if(!confirm("删除分组后，组内模板会移至「未分类」，继续？")) return;
  const groups=(getGroups()||[]).filter(x=>x.id!==cur);
  const list=getPresets().map(p=>(p.group===cur?{...p,group:UNGROUPED}:p));
  saveGroups(groups); savePresets(list);
  setCurrentGroup("all"); clearActiveTags();
  renderGroupTabs(); renderTagFilter(); renderPresetList(); setTip("已删除分组");
}

function exportPresets(){
  const data={groups:getGroups()||[], presets:getPresets()};
  downloadBlob(JSON.stringify(data,null,2), "application/json;charset=utf-8", "persona_template_library.json");
  setTip("模板库已导出");
}

function importPresets(){
  const f=$("presetImportFile").files?.[0];
  if(!f) return setTip("先选择JSON文件");
  const rd=new FileReader();
  rd.onload=()=>{
    try{ applyImportedPresets(JSON.parse(String(rd.result||"{}"))); }
    catch{ setTip("导入失败：JSON格式错误"); }
  };
  rd.readAsText(f,"utf-8");
}

function applyImportedPresets(obj){
  const groups=getGroups()||defaultGroups();
  asArray(obj.groups).forEach(g=>pushImportedGroup(groups, g));
  const presets=Array.isArray(obj.presets)?obj.presets:asArray(obj.custom);
  const cleaned=presets.filter(isImportablePreset).map(x=>cleanImportedPreset(x, groups));
  if(!cleaned.length) return setTip("未找到可导入模板");
  saveGroups(groups);
  savePresets([...getPresets(), ...cleaned]);
  renderGroupTabs(); renderTagFilter(); renderPresetList(); setTip("模板导入成功");
}

function pushImportedGroup(groups, g){
  if(!g||!g.id||!g.name) return;
  if(groups.find(x=>x.id===g.id)) return;
  groups.push({id:g.id,name:String(g.name)});
}

const isImportablePreset = x => !!(x&&x.name&&x.content);

function cleanImportedPreset(x, groups){
  return {
    id:uuid(), name:String(x.name), content:String(x.content),
    group:(x.group&&groups.find(g=>g.id===x.group)) ? x.group : UNGROUPED,
    tags:Array.isArray(x.tags)?x.tags.map(String):[]
  };
}

// ===== 世界书面板 =====
export function bindWorldbookPanel(){
  $("worldbookFileInput").onchange=(e)=>{
    const files=[...(e.target.files||[])];
    if(files.length) importWorldbookFiles(files);
    e.target.value="";
  };
  $("btnClearWorldbooks").onclick=()=>{
    if(confirm("确定清空所有世界书？")){
      worldbooksSet([]);
      renderWorldbooks();
    }
  };
}

async function importWorldbookFiles(files){
  const arr=worldbooksGet().map(normalizeWb);
  for(const f of files){
    const one=await worldbookFromFile(f);
    if(one) arr.push(one);
  }
  worldbooksSet(arr);
  renderWorldbooks();
}

async function worldbookFromFile(f){
  const n=f.name.toLowerCase();
  try{
    if(n.endsWith(".txt")||n.endsWith(".md")) return await textWorldbook(f);
    if(n.endsWith(".json")) return await jsonWorldbook(f);
    if(n.endsWith(".png")) return await pngWorldbook(f);
  }catch(e){
    return {name:f.name,type:"error",weight:"mid",entries:[{key:"导入失败",content:"导入失败："+(e.message||e),enabled:false}]};
  }
  return null;
}

async function textWorldbook(f){
  return {name:f.name,type:"text",weight:"mid",entries:[{key:f.name,content:(await f.text()).slice(0,20000),enabled:true}]};
}

async function jsonWorldbook(f){
  const obj=JSON.parse(await f.text());
  return {name:f.name,type:"json",weight:"mid",entries:cappedEntries(extractWorldbookEntries(obj))};
}

async function pngWorldbook(f){
  const wb=worldbookFromPngChunks(parsePngTextChunks(await f.arrayBuffer()));
  if(!wb) return {name:f.name,type:"png",weight:"mid",entries:[{key:f.name,content:"（未识别标准世界书结构）",enabled:false}]};
  return {name:f.name,type:"png",weight:"mid",entries:cappedEntries(extractWorldbookEntries(wb))};
}

const cappedEntries = entries => entries.map(e=>({...e,content:e.content.slice(0,20000)}));

// ===== 角色卡素材 =====
export function bindRolePanel(){
  $("roleFileInput").onchange=(e)=>{
    const f=e.target.files?.[0];
    if(f) parseRoleFile(f).catch(err=>dom.roleTip.textContent="解析失败："+(err.message||err));
    e.target.value="";
  };
  $("btnParseRoleText").onclick=parseRoleText;
}

async function parseRoleFile(file){
  const name=file.name.toLowerCase();
  if(name.endsWith(".json")) return parseRoleJsonFile(file);
  if(name.endsWith(".png")) return parseRolePngFile(file);
  dom.roleTip.textContent="仅支持JSON/PNG";
}

async function parseRoleJsonFile(file){
  const obj=JSON.parse(await file.text());
  dom.roleContextInput.value=toRoleContext(obj); // 仅关键字段
  dom.roleTip.textContent="角色JSON解析成功（仅关键字段）";
  saveDraft();
}

async function parseRolePngFile(file){
  const parsed=roleFromPngChunks(parsePngTextChunks(await file.arrayBuffer()));
  if(parsed){
    dom.roleContextInput.value=toRoleContext(parsed);
    dom.roleTip.textContent="角色PNG解析成功（仅关键字段）";
  }else{
    dom.roleTip.textContent="PNG读取成功，但未识别标准角色字段";
  }
  saveDraft();
}

function parseRoleText(){
  const t=(dom.roleContextInput.value||"").trim();
  if(!t) return dom.roleTip.textContent="角色文本为空";
  if(t.startsWith("{")){
    try{
      dom.roleContextInput.value=toRoleContext(JSON.parse(t));
      dom.roleTip.textContent="手动JSON解析成功（仅关键字段）";
      saveDraft();
      return;
    }catch{ /* 不是合法 JSON，按纯文本继续 */ }
  }
  dom.roleTip.textContent="已按纯文本使用";
  saveDraft();
}

// ===== 生成与结果区 =====
export function bindGeneratorPanel(){
  $("btnRandom").onclick=()=>generate("random");
  $("btnGenerate").onclick=()=>generate("custom");
  $("btnCopy").onclick=copyResult;
  $("btnExport").onclick=exportResultTxt;
  $("btnClearResult").onclick=clearResult;
  dom.templateInput.addEventListener("input", saveDraft);
  dom.roleContextInput.addEventListener("input", saveDraft);
  dom.resultOutput.addEventListener("input", saveDraft);
  window.addEventListener("beforeunload", saveDraft);
  dom.historySearch.oninput=renderHistory;
  dom.historyModeFilter.onchange=renderHistory;
  $("btnClearHistory").onclick=clearHistory;
}

async function copyResult(){
  const txt=dom.resultOutput.value||"";
  if(!txt) return setTip("没有可复制内容");
  try{ await navigator.clipboard.writeText(txt); setTip("已复制"); }
  catch{ setTip("复制失败"); }
}

function exportResultTxt(){
  const txt=dom.resultOutput.value||"";
  if(!txt) return setTip("没有可导出内容");
  const d=new Date(), p=n=>String(n).padStart(2,"0");
  const name=`persona_${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.txt`;
  downloadBlob(txt,"text/plain;charset=utf-8", name);
  setTip("已导出TXT");
}

function clearResult(){
  dom.resultOutput.value="";
  saveDraft();
  setTip("结果已清空");
}

function clearHistory(){
  if(confirm("确定清空历史？")){ historySet([]); renderHistory(); }
}
