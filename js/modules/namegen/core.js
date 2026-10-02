// ===================================================================
// 取名器 · 命名核心：随机取词 / 中文名 / 英文名 / 昵称 / 多语种名 / 评分排序
//   依赖数据层、解析层与状态层，不直接操作 DOM
// ===================================================================
import {
  NAME_CULT, CULT_MODES, baseLex, ziMap, ziFallback,
  GEN_CHARS, NICK_TAILS, CN_EN_SEED, DERIVED_EN_POOL
} from './data.js';
import { validSurnameInput, hitTempExclude } from './parse.js';
import { getBan, hitBanWord, hitBanChar, getLexicon, uniqRecent, checkCollision } from './state.js';

// ===== 通用 =====
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function isBannedName(s){ return hitBanWord(s)||hitBanChar(s); }

function styleResolved(style,era){
  if(style!=="all") return style;
  if(era==="ancient") return "ancient";
  if(era==="republic") return "republic";
  if(era==="modern") return "modern";
  return pick(["ancient","modern","republic","fantasy"]);
}

// ===== 姓氏 =====
function lockedSurname(fixed,ban){ return ban.surnames.includes(fixed)?null:fixed; }

function surnamePool(lex,opt,ban){
  return (lex.surnamePacks[opt.surnamePack]||lex.surnamePacks.common||[]).filter(s=>!ban.surnames.includes(s));
}

function doubleSurnamePool(lex,ban){
  return (lex.doubleSurnames||[]).filter(s=>!ban.surnames.includes(s));
}

function shouldTryDouble(opt){
  if(opt.era!=="ancient" && opt.era!=="republic") return false;
  return Math.random()<0.1;
}

function pickSurname(lex,opt){
  const ban=getBan();
  if(opt.lockSurname && validSurnameInput(opt.fixedSurname)) return lockedSurname(opt.fixedSurname,ban);
  const pool=surnamePool(lex,opt,ban);
  if(!pool.length) return null;
  if(shouldTryDouble(opt)){
    const ds=doubleSurnamePool(lex,ban);
    if(ds.length) return pick(ds);
  }
  return pick(pool);
}

function weightedPool(lex,base,worldview){
  const boost=(lex.worldviewBoost[worldview]||[]);
  return [...base,...boost,...boost];
}

// ===== 中文名 =====
function pickZi(gender,given){
  for(const c of given){ if(ziMap[c]) return pick(ziMap[c]); }
  const g=gender==="all"?pick(["male","female","neutral"]):gender;
  return pick(ziFallback[g]);
}

function cnNameScore(full){
  const pure=String(full||"").replace(/（字[^）]+）/g,"");
  const m=pure.match(/^([\u4e00-\u9fa5]{1,2})([\u4e00-\u9fa5]{1,2})$/);
  if(!m) return 0;
  let s=74;
  const giv=m[2];
  if(giv.length===2) s+=10; else s+=3;
  if(/(.)\1/.test(giv)) s-=5;
  if(/[之也乎者]/.test(giv)) s-=6;
  if(/[机核栈阈模频矩熵铆铜轮]/.test(giv)) s-=22;
  if(hitBanWord(full)||hitBanChar(full)) s=0;
  return Math.max(0,Math.min(100,s));
}

function cnCharPool(lex,opt,g,ban){
  const st=styleResolved(opt.style,opt.era);
  const base=(lex.chars[g]&&lex.chars[g][st])?lex.chars[g][st]:(lex.chars[g].modern||[]);
  return weightedPool(lex,base,opt.worldview).filter(ch=>!ban.chars.includes(ch) && !ban.words.includes(ch));
}

// 辈分字：合法单字优先，其次从常用字池取，取不到就保留原字
function familyChar(ban,opt,fallback){
  if(/^[\u4e00-\u9fa5]$/.test(opt.generationChar||"")) return opt.generationChar;
  const pool=GEN_CHARS.filter(x=>!ban.chars.includes(x));
  return pool.length?pick(pool):fallback;
}

function buildCnGiven(g,pool,ban,opt){
  const len=Math.random()<0.2?1:2;
  let a=pick(pool), b=pick(pool), k=0;
  while(a===b && k<8){ b=pick(pool); k++; }
  if(opt.familyMode && len===2) b=familyChar(ban,opt,b);
  return len===1?a:(a+b);
}

function makeCnName(lex,opt){
  const g=opt.gender==="all"?pick(["male","female","neutral"]):opt.gender;
  const ban=getBan();
  const pool=cnCharPool(lex,opt,g,ban);
  if(!pool.length) return "";
  const sur=pickSurname(lex,opt);
  if(!sur) return "";
  const giv=buildCnGiven(g,pool,ban,opt);
  let full=sur+giv;
  if(opt.withZi && (opt.era==="ancient"||opt.era==="republic")) full+=`（字${pickZi(g,giv)}）`;
  if(isBannedName(full)) return "";
  return full;
}

// ===== 英文名 =====
function enFirstPool(lex,g){
  return (lex.enFirst[g]||[]).length?lex.enFirst[g]:baseLex.enFirst[g];
}

function enLastPool(lex,opt){
  let pack=opt.enLastPack||"common";
  if(opt.worldview==="western") pack="western";
  if(opt.worldview==="steam") pack="steam";
  if(opt.worldview==="cyberpunk") pack="cyberpunk";
  return lex.enLast[pack]||lex.enLast.common||[];
}

function makeEnName(lex,opt){
  const g=opt.gender==="all"?pick(["male","female","neutral"]):opt.gender;
  const first=pick(enFirstPool(lex,g));
  const out=opt.enWithSurname?`${first} ${pick(enLastPool(lex,opt))}`:first;
  return hitBanWord(out)?"":out;
}

// ===== 中文昵称 =====
function makeNick(lex){
  const core=pick(lex.nickCore||baseLex.nickCore);
  const r=Math.random();
  const n=r<0.45?core+core:(r<0.7?"小"+core:(r<0.9?"阿"+core:core+pick(NICK_TAILS)));
  return isBannedName(n)?"":n;
}

// ===== 多语种名字 =====
function makeKjName(mode,g0){
  const C=NAME_CULT[mode], s=pick(C.surnames), gv=pick(g0==="male"?C.gm:C.gf);
  const out=`${s[0]}${gv[0]}（${s[1]}${gv[1]}）`;
  return isBannedName(out)?"":out;
}

function makeTwCultName(g0){
  const C=NAME_CULT.tw, out=pick(C.surnames)+pick(g0==="male"?C.gm:C.gf);
  return isBannedName(out)?"":out;
}

// 澳门：部分生成土生葡人名字（原文+中文），其余为粤拼生态中文名
function makeMacaneseName(g0){
  const C=NAME_CULT.pt, gv=pick(g0==="male"?C.gm:C.gf), sur=pick(C.surnames);
  const out=`${gv[0]} ${sur[0]}（${gv[1]}·${sur[1]}）`;
  return isBannedName(out)?"":out;
}

function pickCultChars(pool,n){
  const used=new Set(), chars=[];
  while(chars.length<n){
    const c=pick(pool);
    if(used.has(c[0])) continue;
    used.add(c[0]); chars.push(c);
  }
  return chars;
}

function makeHkMoName(mode,g0){
  if(mode==="mo" && Math.random()<0.4) return makeMacaneseName(g0);
  const C=NAME_CULT.hk, s=pick(mode==="mo"?NAME_CULT.mo.surnames:C.surnames);
  const pool=g0==="male"?C.gm:C.gf;
  const n=Math.random()<0.25?1:2;
  const chars=pickCultChars(pool,n);
  const out=`${s[0]+chars.map(c=>c[0]).join("")}（${s[1]} ${chars.map(c=>c[1]).join(" ")}）`;
  return isBannedName(out)?"":out;
}

// 西方小语种：原文 + 中文对照（俄语姓氏随性别变形）
function makeLatinCultName(mode,g0){
  const C=NAME_CULT[mode], gv=pick(g0==="male"?C.gm:C.gf);
  let sur;
  if(mode==="ru"){ const x=pick(C.surnames); sur=g0==="male"?[x[0],x[2]]:[x[1],x[3]]; }
  else sur=pick(C.surnames);
  const out=`${gv[0]} ${sur[0]}（${gv[1]}·${sur[1]}）`;
  return isBannedName(out)?"":out;
}

function makeCultName(mode,opt){
  const g0=opt.gender==="all"||opt.gender==="neutral"?pick(["male","female"]):opt.gender;
  if(mode==="kr"||mode==="jp") return makeKjName(mode,g0);
  if(mode==="tw") return makeTwCultName(g0);
  if(mode==="hk"||mode==="mo") return makeHkMoName(mode,g0);
  return makeLatinCultName(mode,g0);
}

// ===== 英文派生昵称 =====
function cnToEnSeed(cn){
  const out=[];
  for(const c of (cn||"")) if(CN_EN_SEED[c]) out.push(CN_EN_SEED[c]);
  return out.join(" ");
}

function enNickOf(n){
  const pure=n.replace(/（字[^）]+）/g,"");
  const seed=cnToEnSeed(pure);
  if(!seed) return pick(DERIVED_EN_POOL);
  const p=seed.split(/\s+/).filter(Boolean);
  const h=p[0]||"Kai";
  return Math.random()<0.5?h:(h+"y");
}

export function deriveEnNickFromResult(list){ return [...new Set(list.map(enNickOf))]; }

// ===== 评分 =====
function bilingualScore(n){ return /（[^（）]*[\u4e00-\u9fa5][^（）]*）\s*$/.test(n)?84:46; }

function hkMoScore(n){
  if(/^[\u4e00-\u9fa5]{2,6}（[A-Za-z .'-]+）$/.test(n)) return 84;
  return bilingualScore(n);
}

const MODE_SCORERS={
  cn:n=>cnNameScore(n),
  en:n=>/^[A-Za-z][A-Za-z'\-]+(\s+[A-Za-z][A-Za-z'\-]+)?$/.test(n)?84:48,
  nick:n=>n.length<=4?82:64,
  hk:hkMoScore,
  mo:hkMoScore,
  kr:bilingualScore,
  jp:bilingualScore,
  de:bilingualScore,
  ru:bilingualScore,
  la:bilingualScore,
  celtic:bilingualScore,
  tw:n=>/^[\u4e00-\u9fa5]{2,5}$/.test(n)?84:50
};

function modeBaseScore(n,opt){
  const scorer=MODE_SCORERS[opt.mode];
  return scorer?scorer(n):80;
}

function toRow(n,opt){
  let s=modeBaseScore(n,opt);
  if(checkCollision(n)) s-=6;
  if(hitBanWord(n)||hitBanChar(n)) s=0;
  return {name:n,score:s,collision:checkCollision(n)};
}

// 高分不足时逐级降阈值（每次降 3，最低 50）
function pickByThreshold(rows,opt,onThresholdDrop){
  let thr=opt.scoreThreshold;
  let selected=[];
  while(thr>=50){
    selected=rows.filter(r=>r.score>=thr);
    if(selected.length>=opt.displayCount) break;
    thr-=3;
  }
  if(thr<opt.scoreThreshold && onThresholdDrop) onThresholdDrop(thr);
  return selected;
}

export function rankAndSelect(opt,batch,onThresholdDrop){
  const rows=batch.map(n=>toRow(n,opt));
  const selected=pickByThreshold(rows,opt,onThresholdDrop);
  selected.sort((a,b)=>b.score-a.score);
  const deduped=uniqRecent(selected.map(x=>x.name),opt.dedupeStrength);
  return deduped.slice(0,opt.displayCount).map(n=>selected.find(x=>x.name===n)).filter(Boolean);
}

// ===== 本地批量生成 =====
export function validateOpt(o){
  if(o.lockSurname && !validSurnameInput(o.fixedSurname)) return "固定姓氏需1-2中文字符";
  if(o.generationChar && !/^[\u4e00-\u9fa5]$/.test(o.generationChar)) return "辈分字必须1个中文字符";
  return "";
}

function cnLocalName(lex,opt){
  const n=makeCnName(lex,opt);
  if(!n) return "";
  if(hitTempExclude(n,opt.tempExcludeChars,opt.tempExcludeWords)) return "";
  return n;
}

function enLocalName(lex,opt){
  let n="";
  if(opt.cnRefForEn && Math.random()<0.2){
    const seed=cnToEnSeed(opt.cnRefForEn);
    if(seed) n=opt.enWithSurname?`${seed} ${pick((lex.enLast[opt.enLastPack]||lex.enLast.common))}`:seed.split(" ")[0];
  }
  if(!n) n=makeEnName(lex,opt);
  return n;
}

function localNameByMode(lex,opt){
  if(opt.mode==="cn") return cnLocalName(lex,opt);
  if(opt.mode==="nick") return makeNick(lex);
  if(opt.mode==="en") return enLocalName(lex,opt);
  if(CULT_MODES.has(opt.mode)) return makeCultName(opt.mode,opt);
  return "";
}

export function makeBatchLocal(opt){
  const lex=getLexicon();
  const out=[];
  let guard=0;
  while(out.length<opt.batchCount && guard<2500){
    guard++;
    const n=localNameByMode(lex,opt);
    if(!n) continue;
    if(hitBanWord(n)||hitBanChar(n)||out.includes(n)) continue;
    out.push(n);
  }
  return out;
}
