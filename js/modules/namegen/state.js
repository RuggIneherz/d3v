// ===================================================================
// 取名器 · 状态与持久化：存储键 / 词库扩展 / 黑名单 / 收藏 / 历史 / 最近记录
//   只读写 localStorage，不直接操作 DOM（视图刷新由调用方回调触发）
// ===================================================================
import { getLS, setLS, now } from '../../utils.js';
import { baseLex, banDefault } from './data.js';

// 存储键：键名与旧版完全一致，保证老用户数据可继续读取
export const LS = {
  fav:"ng_fav_v8", groups:"ng_groups_v8", his:"ng_his_v8",
  recent:"ng_recent_v8", opts:"ng_opts_v8", ban:"ng_black_v8", lex:"ng_lex_extra_v8"
};

// ===== 词库：基础词库 + 用户导入的扩展包 =====
function mergeList(a,b){ return [...new Set([...(a||[]),...(b||[])])]; }

function mergeSurnamePacks(L,packs){
  for(const k of Object.keys(packs)) L.surnamePacks[k]=mergeList(L.surnamePacks[k]||[],packs[k]||[]);
}

function mergeChars(L,chars){
  for(const g of Object.keys(chars)){
    L.chars[g]=L.chars[g]||{};
    for(const s of Object.keys(chars[g])) L.chars[g][s]=mergeList(L.chars[g][s]||[],chars[g][s]||[]);
  }
}

function mergeMap(target,src){
  for(const k of Object.keys(src)) target[k]=mergeList(target[k]||[],src[k]||[]);
}

function mergeLexicon(L,extra){
  if(extra.surnamePacks) mergeSurnamePacks(L,extra.surnamePacks);
  if(extra.doubleSurnames) L.doubleSurnames=mergeList(L.doubleSurnames,extra.doubleSurnames);
  if(extra.chars) mergeChars(L,extra.chars);
  if(extra.worldviewBoost) mergeMap(L.worldviewBoost,extra.worldviewBoost);
  if(extra.enFirst) mergeMap(L.enFirst,extra.enFirst);
  if(extra.enLast) mergeMap(L.enLast,extra.enLast);
  if(extra.nickCore) L.nickCore=mergeList(L.nickCore,extra.nickCore);
}

export function getLexicon(){
  const extra=getLS(LS.lex,null);
  if(!extra) return structuredClone(baseLex);
  const L=structuredClone(baseLex);
  try{ mergeLexicon(L,extra); }catch{}
  return L;
}

// ===== 黑名单 =====
export function getBan(){ return getLS(LS.ban, structuredClone(banDefault)); }
export function saveBan(b){ setLS(LS.ban,b); }
export function hitBanWord(s){ const b=getBan(), t=String(s||""); return b.words.some(w=>w && t.includes(w)); }
export function hitBanChar(s){ const b=getBan(), t=String(s||""); return b.chars.some(c=>c && t.includes(c)); }

// 导入黑名单：与现有内容取并集（保留对象上其它字段）
export function mergeBan(b,o){
  const chars=(o.chars||[]).filter(x=>/^[\u4e00-\u9fa5]$/.test(x));
  const words=(o.words||[]).map(x=>String(x).trim()).filter(Boolean);
  const surnames=(o.surnames||[]).filter(x=>/^[\u4e00-\u9fa5]{1,2}$/.test(x));
  return {
    ...b,
    chars:[...new Set([...(b.chars||[]),...chars])],
    words:[...new Set([...(b.words||[]),...words])],
    surnames:[...new Set([...(b.surnames||[]),...surnames])]
  };
}

// ===== 收藏 =====
export function getFav(){ return getLS(LS.fav,[]); }
export function saveFav(list){ setLS(LS.fav,list); }

export function addFav(name,group,tags,onChange){
  const fav=getFav();
  if(fav.some(x=>x.name===name)) return;
  fav.unshift({name,group:group||"默认",tags:tags||[],time:now()});
  setLS(LS.fav,fav.slice(0,600));
  if(onChange) onChange();
}

export function delFav(name,onChange){
  setLS(LS.fav,getFav().filter(x=>x.name!==name));
  if(onChange) onChange();
}

// ===== 历史 =====
export function getHis(){ return getLS(LS.his,[]); }

export function appendHistory(h){
  const his=getHis();
  his.unshift(h);
  setLS(LS.his,his.slice(0,240));
}

// ===== 分组与表单选项 =====
export function getGroups(){ return getLS(LS.groups,["默认"]); }
export function saveGroups(list){ setLS(LS.groups,list); }
export function getOpts(){ return getLS(LS.opts,{}); }
export function saveOpts(o){ setLS(LS.opts,o); }
export function getLexPack(){ return getLS(LS.lex,{}); }
export function saveLexPack(o){ setLS(LS.lex,o); }

// ===== 最近记录（去重窗口）=====
export function recentWindow(strength){ return strength==="weak"?60:(strength==="strong"?240:140); }

export function uniqRecent(names,strength){
  const win=recentWindow(strength), recent=getLS(LS.recent,[]);
  const set=new Set(recent.slice(-win));
  const out=[];
  for(const n of names){ if(!set.has(n)){ out.push(n); set.add(n);} }
  setLS(LS.recent,[...recent,...out].slice(-300));
  return out;
}

export function checkCollision(name){
  const fav=getLS(LS.fav,[]), his=getLS(LS.his,[]);
  return fav.some(f=>f.name===name) || his.some(h=>(h.names||[]).includes(name));
}
