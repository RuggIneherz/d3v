// ===================================================================
// 取名器 · 解析层：输入列表 / 临时排除匹配 / 姓氏校验 / 模型响应解析
//   全部为纯函数，不碰 DOM 与存储
// ===================================================================

// 有中英文逗号则按逗号拆，否则按单个字符拆（与旧版一致）
export function parseCommaList(raw){
  const s=(raw||"").trim();
  if(!s) return [];
  if(/[，,]/.test(s)) return s.split(/[，,]/).map(x=>x.trim()).filter(Boolean);
  return [...s].filter(Boolean);
}

// 本次生成临时排除：命中排除字或排除词即视为不可用
export function hitTempExclude(name,tempCharsRaw,tempWordsRaw){
  const chars=parseCommaList(tempCharsRaw);
  const words=parseCommaList(tempWordsRaw);
  for(const c of chars){ if(name.includes(c)) return true; }
  for(const w of words){ if(name.includes(w)) return true; }
  return false;
}

// 固定姓氏：1-2 个汉字
export function validSurnameInput(s){ return /^[\u4e00-\u9fa5]{1,2}$/.test(s); }

// 模型返回的文本 → 名字列表：按行拆，去掉行首序号
export function parseModelNames(txt){
  return txt.split(/\n+/).map(s=>s.replace(/^\d+[\.\、\s]*/,"").trim()).filter(Boolean);
}
