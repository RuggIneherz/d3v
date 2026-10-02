// ===================================================================
// 人设面板 · 渲染与生成
//   把状态写进 DOM：模板库标签页 / 标签筛选 / 模板列表 / 世界书列表 /
//   历史列表，以及一次生成的完整流程（流式优先，失败降级）。
//   渲染函数写完 DOM 后立刻绑定行内小控件，与旧实现时机一致。
// ===================================================================
import { $, $all, getLS, now, uuid, UX, fetchChat, fetchChatStream, apiReadyFor } from '../../utils.js';
import { APIConfig } from '../../api-config.js';
import { dom, saveDraft, pushHistory, parseKeywords, collectGenerationInputs,
  getGroups, getPresets, getCurrentGroup, setCurrentGroup, activeTagCount,
  hasActiveTag, toggleActiveTag, clearActiveTags, historyGet, worldbooksGet, worldbooksSet,
  ensurePresetSeed, LS_DRAFT, LS_ROLECTX, LS_RESULT } from './state.js';
import { KEYWORDS, DEFAULT_TEMPLATE, buildPayload } from './prompt.js';
import { sanitizeOutput, normalizeWb } from './parse.js';

// ===== 顶部小提示 =====
export function setTip(m){
  dom.tip.textContent=m||"";
  if(m) setTimeout(()=>dom.tip.textContent===m&&(dom.tip.textContent=""),1700);
}

// ===== 模板库渲染 =====
export function renderGroupTabs(){
  const groups=getGroups()||[];
  const all=[{id:"all",name:"全部"}, ...groups];
  $("presetGroupTabs").innerHTML=all.map(presetTabHtml).join("");
  $all("#presetGroupTabs .glass-chip").forEach(el=>{
    el.onclick=()=>{
      setCurrentGroup(el.dataset.gid); clearActiveTags();
      renderGroupTabs(); renderTagFilter(); renderPresetList();
    };
  });
}

function presetTabHtml(g){
  return `<span class="glass-chip${g.id===getCurrentGroup()?" active":""}" data-gid="${g.id}">${g.name}</span>`;
}

export function renderTagFilter(){
  const cur=getCurrentGroup();
  const presets=getPresets().filter(p=>cur==="all"||p.group===cur);
  const tagSet=new Set();
  presets.forEach(p=>(p.tags||[]).forEach(t=>tagSet.add(t)));
  const tags=[...tagSet];
  if(!tags.length){ $("presetTagFilter").innerHTML=""; return; }
  $("presetTagFilter").innerHTML=tags.map(presetTagHtml).join("");
  $all("#presetTagFilter .glass-chip").forEach(el=>{
    el.onclick=()=>{
      toggleActiveTag(el.dataset.tag);
      renderTagFilter(); renderPresetList();
    };
  });
}

function presetTagHtml(t){
  return `<span class="glass-chip${hasActiveTag(t)?" active":""}" data-tag="${t}">#${t}</span>`;
}

export function renderPresetList(){
  const groups=getGroups()||[];
  let presets=getPresets();
  const cur=getCurrentGroup();
  if(cur!=="all") presets=presets.filter(p=>p.group===cur);
  if(activeTagCount()) presets=presets.filter(p=>(p.tags||[]).some(t=>hasActiveTag(t)));

  if(!presets.length){
    $("presetList").innerHTML=`<div class="small">这里还没有模板，点"新增模板"建一个吧。</div>`;
    return;
  }

  $("presetList").innerHTML=presets.map(p=>presetItemHtml(p,groups)).join("");
}

function presetItemHtml(p, groups){
  const tagsHtml=(p.tags||[]).map(t=>`<span class="glass-tag">${t}</span>`).join("");
  const groupOptions=groups.map(g=>`<option value="${g.id}"${g.id===p.group?" selected":""}>${g.name}</option>`).join("");
  const nameEsc=String(p.name).replace(/"/g,"&quot;");
  return `
      <div class="glass-item" data-id="${p.id}">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600">${p.name}</div>
            <div style="margin-top:4px">${tagsHtml}</div>
          </div>
          <div class="row" style="flex-wrap:nowrap">
            <button class="glass-btn" data-act="apply">套用</button>
            <button class="glass-btn" data-act="edit">编辑</button>
            <button class="glass-btn" data-act="delete">删除</button>
          </div>
        </div>
        <div class="preset-edit" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08)">
          <div class="grid2" style="margin-bottom:8px">
            <input class="edit-name glass-input" placeholder="模板名称" value="${nameEsc}">
            <select class="edit-group glass-select">${groupOptions}</select>
          </div>
          <input class="edit-tags glass-input" placeholder="标签，用逗号分隔" style="width:100%;margin-bottom:8px" value="${(p.tags||[]).join(', ')}">
          <div class="row">
            <button class="glass-btn" data-act="save-meta">保存</button>
            <button class="glass-btn" data-act="save-content">用下方编辑区内容覆盖此模板</button>
            <button class="glass-btn" data-act="cancel">收起</button>
          </div>
          <div class="small" style="margin-top:6px">"覆盖此模板"会把下面"人设模板（YAML）"编辑区里的当前内容存进这个模板。</div>
        </div>
      </div>`;
}

// ===== 历史渲染 =====
export function renderHistory(){
  const list=historyGet();
  const kw=(dom.historySearch.value||"").toLowerCase().trim();
  const mode=dom.historyModeFilter.value;
  const f=list.filter(it=>historyMatched(it,mode,kw));

  if(!f.length){ dom.historyList.innerHTML=`<div class="glass-item">（无匹配历史）</div>`; return; }

  dom.historyList.innerHTML=f.map(historyItemHtml).join("");
  dom.historyList.querySelectorAll(".glass-item").forEach(el=>{
    el.onclick=()=>applyHistoryItem(el.dataset.id);
  });
}

function historyMatched(it, mode, kw){
  if(mode!=="all" && it.mode!==mode) return false;
  if(!kw) return true;
  const corpus=`${it.time} ${it.mode} ${it.preview} ${it.keywords||""}`.toLowerCase();
  return corpus.includes(kw);
}

function historyItemHtml(it){
  return `
      <div class="glass-item" data-id="${it.id}">
        <div class="meta">${it.time} · ${it.mode==="random"?"随机":"按模板"} · ${it.model||""}</div>
        <div class="small">${(it.preview||"").replace(/\n/g," ").slice(0,140)}</div>
      </div>
    `;
}

function applyHistoryItem(id){
  const item=historyGet().find(x=>x.id===id);
  if(!item) return;
  dom.resultOutput.value=item.result||"";
  dom.templateInput.value=item.template||dom.templateInput.value;
  dom.keywordsInput.value=item.keywords||"";
  dom.roleContextInput.value=item.roleContext||dom.roleContextInput.value;
}

// ===== 世界书渲染 =====
export function renderWorldbooks(){
  const list=worldbooksGet().map(normalizeWb);
  worldbooksSet(list);
  if(!list.length){
    dom.worldbookList.innerHTML=`<div class="small">（暂无世界书）</div>`;
    return;
  }
  dom.worldbookList.innerHTML = list.map(worldbookItemHtml).join("");
  bindWorldbookRows();
}

function worldbookItemHtml(w, idx){
  return `
      <div class="glass-item">
        <div class="meta">${w.name} · ${w.type||"unknown"} · ${(w.entries||[]).length} 个条目 · ${(w.entries||[]).filter(e=>e.enabled).length} 启用</div>
        <div class="list-container" style="gap:6px;margin:6px 0;">
          ${(w.entries||[]).map((e,ei)=>wbEntryHtml(e,idx,ei)).join("")}
        </div>
        <div class="row" style="margin-top:6px">
          <button class="glass-btn" data-rm="${idx}">移除整份</button>
          <span class="small">权重</span>
          ${wbWeightSelectHtml(w,idx)}
        </div>
      </div>
    `;
}

function wbEntryHtml(e, idx, ei){
  return `
            <label style="display:flex;gap:8px;align-items:flex-start;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:7px 10px;cursor:pointer;">
              <input type="checkbox" data-wi="${idx}" data-ei="${ei}" ${e.enabled?"checked":""} style="margin-top:3px;">
              <span style="flex:1;min-width:0;"><span style="font-size:12px;color:#fff;">${String(e.key).slice(0,60)}</span><span class="small" style="display:block;">${(e.content||"").slice(0,100).replace(/\n/g," ")}</span></span>
            </label>`;
}

function wbWeightSelectHtml(w, idx){
  return `<select class="glass-select" data-weight="${idx}" style="height:32px;padding:0 8px;min-width:86px">
            <option value="low" ${w.weight==="low"?"selected":""}>弱</option>
            <option value="mid" ${(!w.weight||w.weight==="mid")?"selected":""}>中</option>
            <option value="high" ${w.weight==="high"?"selected":""}>强</option>
          </select>`;
}

function bindWorldbookRows(){
  dom.worldbookList.querySelectorAll("button[data-rm]").forEach(btn=>{
    btn.onclick=()=>{
      const arr=worldbooksGet();
      arr.splice(Number(btn.dataset.rm),1);
      worldbooksSet(arr); renderWorldbooks();
    };
  });
  dom.worldbookList.querySelectorAll("input[data-wi]").forEach(cb=>{
    cb.onchange=()=>{
      const arr=worldbooksGet(), wi=Number(cb.dataset.wi), ei=Number(cb.dataset.ei);
      if(arr[wi]&&arr[wi].entries[ei]){ arr[wi].entries[ei].enabled=cb.checked; worldbooksSet(arr); renderWorldbooks(); }
    };
  });
  dom.worldbookList.querySelectorAll("select[data-weight]").forEach(sel=>{
    sel.onchange=()=>{
      const i=Number(sel.dataset.weight);
      const arr=worldbooksGet();
      if(!arr[i]) return;
      arr[i].weight=sel.value; worldbooksSet(arr);
    };
  });
}

// ===== 生成流程 =====
export async function generate(mode){
  const cfg=APIConfig.getActive();
  if(!apiReadyFor(cfg)){ setTip("先在 API 设置填地址/密钥/模型，或改用 SillyTavern 当前 API"); return; }

  const payload=buildPayload(cfg, mode, collectGenerationInputs());
  const useStream = cfg.stream_enabled !== false; // 默认开启流式
  UX.loading(mode==="random"?"随机生成人设中…（流式）":"按模板生成人设中…（流式）");

  try{
    const raw=await requestRaw(cfg, payload, useStream);
    if(!raw) throw new Error("返回为空");
    finishGenerate(raw, mode, cfg, useStream);
  }catch(e){
    UX.done();
    dom.resultOutput.value="生成失败：\n"+(e.message||e);
    UX.toast("生成失败："+(e.message||e),"error");
    setTip("失败");
  }
}

/** 取回生成文本：流式逐字写入结果区，整体失败时降级为一次性请求 */
async function requestRaw(cfg, payload, useStream){
  if(!useStream) return fetchChat(cfg.base_url,cfg.api_key,payload);

  let raw="";
  dom.resultOutput.value="";
  try{
    await fetchChatStream(cfg.base_url,cfg.api_key,payload,(chunk)=>{
      raw+=chunk;
      dom.resultOutput.value=raw;                 // 逐字追加
      dom.resultOutput.scrollTop=dom.resultOutput.scrollHeight;
    },null);
  }catch(streamErr){
    // 流式整体失败（含 SSE/网络问题）时，自动降级为一次性请求
    return fetchChat(cfg.base_url,cfg.api_key,payload);
  }
  return raw;
}

/** 成功收尾：清洗结果、存草稿、写一条历史并刷新列表 */
function finishGenerate(text, mode, cfg, useStream){
  const cleaned=sanitizeOutput(text);
  dom.resultOutput.value=cleaned || "";
  saveDraft();
  pushHistory({
    id:uuid(),
    time:now(),
    mode,
    model:cfg.model,
    preview:(cleaned||"").slice(0,200),
    result:cleaned||"",
    template:dom.templateInput.value||"",
    keywords:parseKeywords().join(", "),
    roleContext:dom.roleContextInput.value||""
  });
  renderHistory();
  UX.done(); setTip(useStream?"完成（流式）":"完成");
}

// ===== 初始化装载 =====
export function initChips(){
  $("chips").innerHTML = KEYWORDS.map(k=>`<span class="glass-chip">${k}</span>`).join("");
  $all("#chips .glass-chip").forEach(el=>{
    el.onclick=()=>{
      const v=el.textContent;
      const arr=parseKeywords();
      if(!arr.includes(v)) arr.push(v);
      dom.keywordsInput.value=arr.join(", ");
    };
  });
}

/** 读存档回填编辑区，然后依次渲染各面板（顺序与原实现一致） */
export function loadPersonaPanel(){
  dom.templateInput.value=getLS(LS_DRAFT, DEFAULT_TEMPLATE)||DEFAULT_TEMPLATE;
  dom.roleContextInput.value=getLS(LS_ROLECTX, "");
  dom.resultOutput.value=getLS(LS_RESULT, "");
  ensurePresetSeed();
  renderGroupTabs();
  renderTagFilter();
  renderPresetList();
  renderWorldbooks();
  renderHistory();
}
