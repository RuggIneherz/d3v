// ===================================================================
// 取名器 · 事件绑定：生成 / 复制 / 收藏 / 分组 / 黑名单 / 词库包 / 重置
//   绑定顺序与旧版一致（生成区 → 收藏区 → 黑名单 → 词库包 → 进阶与重置）
// ===================================================================
import { $, getLS, setLS } from '../../utils.js';
import { LS, getBan, saveBan, mergeBan, getLexPack, saveLexPack, getLexicon, addFav } from './state.js';
import { banDefault } from './data.js';
import { deriveEnNickFromResult } from './core.js';
import { downloadJSON, bindResultButtons } from './render.js';

function bindGenerateEvents(ui,flow){
  $("btnGenName").onclick=()=>flow.generateFlow();
  $("btnClearResultName").onclick=()=> ui.resultList.innerHTML=`<div class="glass-item small">（结果已清空）</div>`;

  $("btnCopyAll").onclick=async()=>{
    const names=[...ui.resultList.querySelectorAll(".name")].map(x=>x.textContent.trim()).filter(Boolean);
    if(!names.length) return ui.setTip("没有可复制内容");
    await navigator.clipboard.writeText(names.join("\n"));
    ui.setTip("已复制全部");
  };

  $("btnSaveAllFav").onclick=()=>{
    const names=[...ui.resultList.querySelectorAll(".name")].map(x=>x.textContent.trim()).filter(Boolean);
    if(!names.length) return ui.setTip("没有可收藏内容");
    const group=$("favGroupSelect").value||"默认";
    const tags=($("favTagsInput").value||"").split(/[，,]/).map(x=>x.trim()).filter(Boolean);
    names.forEach(n=>addFav(n,group,tags,ui.renderFav));
    ui.setTip("已全部收藏");
  };
}

function bindFavEvents(ui){
  $("btnClearFav").onclick=()=>{ if(confirm("清空收藏？")){ setLS(LS.fav,[]); ui.renderFav(); } };
  $("btnClearHis").onclick=()=>{ if(confirm("清空历史？")){ setLS(LS.his,[]); ui.renderHistory(); } };

  // 分组
  $("btnAddGroup").onclick=()=>{
    const n=($("newGroupInput").value||"").trim();
    if(!n) return;
    const g=getLS(LS.groups,["默认"]);
    if(!g.includes(n)) g.push(n);
    setLS(LS.groups,g); ui.renderGroupSelects(); $("newGroupInput").value="";
    ui.setTip("分组已新增");
  };

  $("btnDelGroup").onclick=()=>{
    const cur=$("favGroupSelect").value;
    if(cur==="默认") return ui.setTip("默认分组不可删除");
    const g=getLS(LS.groups,["默认"]).filter(x=>x!==cur);
    setLS(LS.groups,g);
    const fav=getLS(LS.fav,[]).map(f=>f.group===cur?({...f,group:"默认"}):f);
    setLS(LS.fav,fav);
    ui.renderGroupSelects(); ui.renderFav(); ui.setTip("分组已删除");
  };

  $("viewGroupFilter").onchange=()=>ui.renderFav();
  $("viewTagFilter").oninput=()=>ui.renderFav();
}

function importBanFile(ui){
  const f=$("importBanFile").files?.[0];
  if(!f) return ui.setTip("先选JSON文件");
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const o=JSON.parse(String(rd.result||"{}"));
      saveBan(mergeBan(getBan(),o)); ui.renderBan(); ui.setTip("黑名单导入成功");
    }catch{ ui.setTip("黑名单JSON格式错误"); }
  };
  rd.readAsText(f,"utf-8");
}

function addBanChar(ui){
  const v=($("banCharInput").value||"").trim();
  if(!/^[\u4e00-\u9fa5]$/.test(v)) return ui.setTip("字黑名单需1个中文字符");
  const b=getBan(); if(!b.chars.includes(v)) b.chars.push(v); saveBan(b);
  $("banCharInput").value=""; ui.renderBan(); ui.setTip("已拉黑字");
}

function addBanWord(ui){
  const v=($("banWordInput").value||"").trim();
  if(!v) return;
  const b=getBan(); if(!b.words.includes(v)) b.words.push(v); saveBan(b);
  $("banWordInput").value=""; ui.renderBan(); ui.setTip("已拉黑词");
}

function addBanSurname(ui){
  const v=($("banSurnameInput").value||"").trim();
  if(!/^[\u4e00-\u9fa5]{1,2}$/.test(v)) return ui.setTip("姓氏黑名单需1-2中文字符");
  const b=getBan(); if(!b.surnames.includes(v)) b.surnames.push(v); saveBan(b);
  $("banSurnameInput").value=""; ui.renderBan(); ui.setTip("已拉黑姓");
}

function clearBan(ui){
  if(!confirm("清空黑名单？")) return;
  saveBan(structuredClone(banDefault)); ui.renderBan(); ui.setTip("黑名单已清空");
}

function bindBanEvents(ui){
  $("btnAddBanChar").onclick=()=>addBanChar(ui);
  $("btnAddBanWord").onclick=()=>addBanWord(ui);
  $("btnAddBanSurname").onclick=()=>addBanSurname(ui);
  $("btnClearBan").onclick=()=>clearBan(ui);

  $("btnExportBan").onclick=()=>downloadJSON("blacklist.json",getBan());
  $("btnImportBan").onclick=()=>importBanFile(ui);
}

function importLexFile(ui){
  const f=$("importLexiconFile").files?.[0];
  if(!f) return ui.setTip("先选JSON文件");
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const obj=JSON.parse(String(rd.result||"{}"));
      saveLexPack(Object.assign({},getLexPack(),obj));
      ui.setTip("词库包导入成功（已追加）");
    }catch{ ui.setTip("词库包JSON格式错误"); }
  };
  rd.readAsText(f,"utf-8");
}

function bindLexEvents(ui){
  $("btnExportLexicon").onclick=()=>downloadJSON("lexicon_pack.json",getLexicon());
  $("btnImportLexicon").onclick=()=>importLexFile(ui);
}

// 英文派生昵称：从结果区的名字派生，并复用结果区按钮
function enDerive(ui){
  const names=[...ui.resultList.querySelectorAll(".name")].map(x=>x.textContent.trim()).filter(Boolean);
  if(!names.length) return ui.setTip("先生成名字");
  const nick=deriveEnNickFromResult(names);
  ui.resultList.innerHTML=nick.map(n=>`
      <div class="glass-item row" style="justify-content:space-between">
        <div class="name">${n}</div>
        <div class="row"><button class="glass-btn" data-c="${n}">复制</button><button class="glass-btn" data-f="${n}">收藏</button></div>
      </div>
    `).join("");
  bindResultButtons(ui);
  ui.setTip("已生成英文派生昵称");
}

function resetAll(ui){
  if(!confirm("恢复默认（不清空收藏/历史），继续？")) return;
  $("mode").value="cn"; $("engine").value="auto"; $("style").value="all"; $("worldview").value="all"; $("era").value="all"; $("gender").value="all";
  $("displayCount").value="5"; $("batchCount").value="30"; $("dedupeStrength").value="mid"; $("scoreThreshold").value="65";
  $("withZi").checked=false;
  $("surnamePack").value="common"; $("fixedSurname").value=""; $("lockSurname").checked=false;
  $("enWithSurname").checked=false; $("enLastPack").value="common"; $("familyMode").checked=false; $("generationChar").value="";
  $("tempExcludeChars").value=""; $("tempExcludeWords").value=""; $("customWorldText").value=""; $("cnRefForEn").value="";
  ui.setTip("已恢复默认");
}

function bindAdvancedEvents(ui){
  $("btnEnDerive").onclick=()=>enDerive(ui);
  $("btnResetAll").onclick=()=>resetAll(ui);
}

export function bindEvents(ui,flow){
  bindGenerateEvents(ui,flow);
  bindFavEvents(ui);
  bindBanEvents(ui);
  bindLexEvents(ui);
  bindAdvancedEvents(ui);
}
