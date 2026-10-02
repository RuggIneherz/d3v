// ===================================================================
// 取名器 · 视图层：结果 / 收藏 / 历史 / 黑名单 / 分组渲染 + 表单取值
//   元素一律按 id 通过 utils 的 $ 取，页面文案与结构保持与旧版一致
// ===================================================================
import { $, getLS, setLS } from '../../utils.js';
import { LS, getBan, saveBan, getFav, getHis, delFav, addFav, getOpts } from './state.js';

// 顶部小提示：显示后 1.6 秒自动清空（期间内容被改写则不清理）
function makeSetTip(tip){
  return t=>{tip.textContent=t||""; if(t) setTimeout(()=>tip.textContent===t&&(tip.textContent=""),1600);}
}

// 黑名单三列表（字 / 词 / 姓氏）
function drawBanList(ui,id,type,list){
  const box=$(id);
  if(!list.length){ box.innerHTML=`<span class="small">（空）</span>`; return; }
  box.innerHTML=list.map(v=>`<span class="glass-chip">${v}<button class="glass-btn" data-t="${type}" data-v="${v}">释放</button></span>`).join("");
  box.querySelectorAll("button[data-t]").forEach(btn=>{
    btn.onclick=()=>{
      const bb=getBan();
      bb[btn.dataset.t]=bb[btn.dataset.t].filter(x=>x!==btn.dataset.v);
      saveBan(bb); renderBan(ui); ui.setTip(`已释放：${btn.dataset.v}`);
    };
  });
}

function renderBan(ui){
  const b=getBan();
  drawBanList(ui,"banCharList","chars",b.chars);
  drawBanList(ui,"banWordList","words",b.words);
  drawBanList(ui,"banSurnameList","surnames",b.surnames);
}

function renderGroupSelects(){
  const groups=getLS(LS.groups,["默认"]);
  if(!groups.length) setLS(LS.groups,["默认"]);
  const gs=getLS(LS.groups,["默认"]);
  const opts=gs.map(g=>`<option value="${g}">${g}</option>`).join("");
  $("favGroupSelect").innerHTML=opts;
  $("viewGroupFilter").innerHTML=`<option value="all">全部</option>${opts}`;
}

// 结果区的复制 / 收藏按钮（渲染结果与英文派生昵称共用）
export function bindResultButtons(ui){
  ui.resultList.querySelectorAll("button[data-c]").forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(b.dataset.c); ui.setTip("已复制");});
  ui.resultList.querySelectorAll("button[data-f]").forEach(b=>b.onclick=()=>{
    const group=$("favGroupSelect").value||"默认";
    const tags=($("favTagsInput").value||"").split(/[，,]/).map(x=>x.trim()).filter(Boolean);
    addFav(b.dataset.f,group,tags,ui.renderFav); ui.setTip("已收藏");
  });
}

function renderResults(ui,rows){
  if(!rows.length){ ui.resultList.innerHTML=`<div class="glass-item small">（无可展示结果，请放宽条件）</div>`; return; }
  ui.resultList.innerHTML=rows.map(r=>`
      <div class="glass-item row" style="justify-content:space-between">
        <div>
          <div class="name">${r.name}</div>
          <div class="small">质量：${r.score}${r.collision?` <span class="warn">可能重名</span>`:""}</div>
        </div>
        <div class="row">
          <button class="glass-btn" data-c="${r.name}">复制</button>
          <button class="glass-btn" data-f="${r.name}">收藏</button>
        </div>
      </div>
    `).join("");
  bindResultButtons(ui);
}

function renderFav(ui){
  const fav=getFav();
  const gf=$("viewGroupFilter").value||"all";
  const tf=($("viewTagFilter").value||"").trim();
  const list=fav.filter(f=>(gf==="all"||f.group===gf)&&(!tf||(f.tags||[]).includes(tf)));
  if(!list.length){ ui.favList.innerHTML=`<div class="glass-item small">（暂无收藏）</div>`; return; }

  ui.favList.innerHTML=list.map(f=>`
      <div class="glass-item row" style="justify-content:space-between">
        <div>
          <div class="name" style="font-size:18px">${f.name}</div>
          <div class="small">分组：${f.group} ${(f.tags||[]).map(t=>`<span class="glass-tag">${t}</span>`).join("")}</div>
        </div>
        <div class="row">
          <button class="glass-btn" data-c="${f.name}">复制</button>
          <button class="glass-btn" data-d="${f.name}">移除</button>
        </div>
      </div>
    `).join("");

  ui.favList.querySelectorAll("button[data-c]").forEach(b=>b.onclick=async()=>{await navigator.clipboard.writeText(b.dataset.c); ui.setTip("已复制");});
  ui.favList.querySelectorAll("button[data-d]").forEach(b=>b.onclick=()=>delFav(b.dataset.d,ui.renderFav));
}

function renderHistory(ui){
  const his=getHis();
  if(!his.length){ ui.hisList.innerHTML=`<div class="glass-item small">（暂无历史）</div>`; return; }
  ui.hisList.innerHTML=his.map(h=>`
      <div class="glass-item">
        <div class="small">${h.time} · ${h.mode} · ${h.style} · ${h.worldview} · ${h.era} · ${h.gender} ${h.ai?"·AI":""}</div>
        <div>${h.names.join(" / ")}</div>
      </div>
    `).join("");
}

// 表单 → 选项对象（字段与旧版一致）
function collectOpt(){
  return {
    mode:$("mode").value,
    engine:$("engine").value,
    style:$("style").value,
    worldview:$("worldview").value,
    era:$("era").value,
    gender:$("gender").value,
    displayCount:Number($("displayCount").value),
    batchCount:Number($("batchCount").value),
    dedupeStrength:$("dedupeStrength").value,
    scoreThreshold:Number($("scoreThreshold").value),
    withZi:$("withZi").checked,
    surnamePack:$("surnamePack").value,
    fixedSurname:$("fixedSurname").value.trim(),
    lockSurname:$("lockSurname").checked,
    enWithSurname:$("enWithSurname").checked,
    enLastPack:$("enLastPack").value,
    familyMode:$("familyMode").checked,
    generationChar:$("generationChar").value.trim(),
    tempExcludeChars:$("tempExcludeChars").value.trim(),
    tempExcludeWords:$("tempExcludeWords").value.trim(),
    customWorldText:$("customWorldText").value.trim(),
    cnRefForEn:$("cnRefForEn").value.trim()
  };
}

export function downloadJSON(name,obj){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json;charset=utf-8"});
  const u=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u);
}

export function createUI(){
  const tip=$("tipName"), resultList=$("resultList"), favList=$("favList"), hisList=$("hisList");
  const ui={ tip, resultList, favList, hisList, setTip:makeSetTip(tip) };
  ui.renderResults=rows=>renderResults(ui,rows);
  ui.renderFav=()=>renderFav(ui);
  ui.renderHistory=()=>renderHistory(ui);
  ui.renderBan=()=>renderBan(ui);
  ui.renderGroupSelects=()=>renderGroupSelects();
  ui.collectOpt=()=>collectOpt();
  return ui;
}

// 初始化：恢复上次的表单偏好 + 首屏渲染
export function initPanel(ui){
  if(!getLS(LS.groups,null)) setLS(LS.groups,["默认"]);
  const o=getOpts();
  if(o.surnamePack) $("surnamePack").value=o.surnamePack;
  $("fixedSurname").value=o.fixedSurname||"";
  $("lockSurname").checked=!!o.lockSurname;
  $("enWithSurname").checked=!!o.enWithSurname;
  if(o.enLastPack) $("enLastPack").value=o.enLastPack;

  ui.renderGroupSelects();
  ui.renderBan();
  ui.renderFav();
  ui.renderHistory();
}
