// ===================================================================
// 人设面板 · 解析与清洗
//   纯函数：生成结果清洗、PNG 文本块读取、角色卡 / 世界书结构提取，
//   不读写 DOM，也不依赖面板状态。
// ===================================================================

/** 去掉代码块围栏与前言后记，只留 YAML 正文 */
export function sanitizeOutput(raw){
  if(!raw) return "";
  let t = String(raw).replace(/```yaml|```/gi,"").trim();
  const idx = t.indexOf("user_name:");
  if(idx>=0) t = t.slice(idx).trim();
  const cutMarks = ["\n---\n", "\n附注", "\n说明", "\n备注", "\n（以上"];
  for(const m of cutMarks){
    const p=t.indexOf(m);
    if(p>0){ t=t.slice(0,p).trim(); break; }
  }
  return t;
}

// ===== 世界书结构 =====

/** 补全世界书：没有条目时用 name / text 兜一条 */
export function normalizeWb(w){
  if(Array.isArray(w.entries)&&w.entries.length) return w;
  return {...w, entries:[{key:w.name||"条目", content:w.text||"", enabled:true}]};
}

/** 取条目数组：兼容 entries / worldbook.entries / lorebook.entries 与对象字典 */
export function worldbookEntryArray(x){
  let entries=x.entries || x.worldbook?.entries || x.lorebook?.entries || [];
  if(!Array.isArray(entries) && typeof entries==="object") entries=Object.values(entries);
  return entries;
}

/** 条目启用判定：兼容 enabled / disable / disabled 三种写法 */
export function wbEnabled(e){
  if(e.enabled===false) return false;
  if(e.disable!==undefined) return !e.disable;
  if(e.disabled!==undefined) return !e.disabled;
  return true;
}

/** 单条世界书条目 → {key, content, enabled} */
export function toWbEntry(e, i){
  let keys=e.keys || e.key || e.primary_keys || e.comment || `条目${i+1}`;
  if(Array.isArray(keys)) keys=keys.join(", ");
  const content=e.content || e.entry || e.text || "";
  return {key:String(keys||`条目${i+1}`), content:String(content), enabled:!!wbEnabled(e)};
}

/** 从世界书 JSON 提取条目；识别不到结构时退回整段文本 */
export function extractWorldbookEntries(obj){
  const entries=worldbookEntryArray(obj?.data || obj || {});
  if(!Array.isArray(entries) || !entries.length){
    return [{key:"全文", content:JSON.stringify(obj).slice(0,15000), enabled:true}];
  }
  return entries.map(toWbEntry).filter(e=>e.content);
}

const joinKeys = v => (Array.isArray(v)?v.join(", "):v);

/** 单条条目 → 纯文本（键与副键） */
export function wbEntryText(e, i){
  const keys=e.keys || e.key || e.primary_keys || [];
  const sec=e.secondary_keys || [];
  const content=e.content || e.entry || e.text || "";
  return `[Entry ${i+1}] keys:${joinKeys(keys)} sec:${joinKeys(sec)}\n${content}`;
}

/** 世界书 JSON → 纯文本；识别不到条目时给原文 */
export function worldbookToText(obj){
  const x=obj?.data || obj || {};
  const entries=worldbookEntryArray(x);
  if(Array.isArray(entries) && entries.length) return entries.map(wbEntryText).join("\n\n");
  return JSON.stringify(obj).slice(0,15000);
}

// ===== PNG 文本块 =====
const PNG_SIG=[137,80,78,71,13,10,26,10];

export function decodeUTF8(bytes){ try{return new TextDecoder("utf-8").decode(bytes)}catch{return ""} }

function assertPng(u8){
  for(let i=0;i<8;i++) if(u8[i]!==PNG_SIG[i]) throw new Error("非PNG");
}

const readU32=(u8,p)=>(u8[p]<<24)|(u8[p+1]<<16)|(u8[p+2]<<8)|u8[p+3];
const readType=(u8,p)=>String.fromCharCode(u8[p],u8[p+1],u8[p+2],u8[p+3]);

/** 收集 PNG 里的文本块（tEXt / iTXt），非 PNG 直接抛错 */
export function parsePngTextChunks(buf){
  const u8=new Uint8Array(buf);
  assertPng(u8);
  let p=8, out=[];
  while(p<u8.length){
    const len=readU32(u8,p); p+=4;
    const type=readType(u8,p); p+=4;
    const data=u8.slice(p,p+len); p+=len; p+=4;
    const one=readTextChunk(type,data);
    if(one) out.push(one);
  }
  return out;
}

function readTextChunk(type, data){
  if(type==="tEXt") return readTEXtChunk(data);
  if(type==="iTXt") return readITXtChunk(data);
  return null;
}

function readTEXtChunk(data){
  const z=data.indexOf(0);
  if(z<=0) return null;
  return {key:decodeUTF8(data.slice(0,z)), val:decodeUTF8(data.slice(z+1))};
}

// iTXt 结构：关键字\0 压缩标志\0 压缩方法\0 语言\0 译文\0 正文
function readITXtChunk(data){
  let i=skipToZero(data,0);
  const key=decodeUTF8(data.slice(0,i));
  i+=3;
  i=skipToZero(data,i)+1;
  i=skipToZero(data,i)+1;
  return {key, val:decodeUTF8(data.slice(i))};
}

function skipToZero(data, from){
  let i=from;
  while(i<data.length&&data[i]!==0)i++;
  return i;
}

// ===== 角色卡字段 =====

/** 角色卡关键字段 → 纯文本上下文 */
export function toRoleContext(obj){
  const o=obj?.data || obj || {};
  return [
    `name: ${pickField(o,"name","char_name","character_name")}`,
    `description: ${pickField(o,"description","desc")}`,
    `personality: ${pickField(o,"personality")}`,
    `scenario: ${pickField(o,"scenario")}`,
    `first_message: ${pickField(o,"first_mes","first_message")}`,
    `tags: ${Array.isArray(o.tags)?o.tags.join(", "):(o.tags||"")}`
  ].join("\n").trim();
}

function pickField(o, ...keys){
  for(const k of keys){ if(o?.[k]) return o[k]; }
  return "";
}

const isRoleChunk=(key,val)=> key.includes("chara") || key.includes("char") || val.startsWith("{");
const isWorldbookChunk=(key,val)=> key.includes("world") || key.includes("lore") || val.startsWith("{");

/** 从 PNG 文本块找角色卡 JSON：明文优先，其次 base64 */
export const roleFromPngChunks = chunks => findJsonInChunks(chunks, isRoleChunk);

/** 从 PNG 文本块找世界书 JSON：明文优先，其次 base64 */
export const worldbookFromPngChunks = chunks => findJsonInChunks(chunks, isWorldbookChunk);

function findJsonInChunks(chunks, match){
  for(const c of chunks){
    const key=String(c.key||"").toLowerCase(), val=String(c.val||"").trim();
    if(!val || !match(key,val)) continue;
    const one=readChunkJson(val);
    if(one.hit) return one.value;
  }
  return null;
}

function readChunkJson(val){
  try{ return {hit:true, value:JSON.parse(val)}; }catch{ /* 明文不是 JSON，改试 base64 */ }
  try{ return {hit:true, value:jsonFromBase64(val)}; }catch{ return {hit:false}; }
}

function jsonFromBase64(val){
  const b=atob(val);
  const t=new TextDecoder("utf-8").decode(Uint8Array.from(b, ch=>ch.charCodeAt(0)));
  return JSON.parse(t);
}
