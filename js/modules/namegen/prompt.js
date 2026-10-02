// ===================================================================
// 取名器 · 提示词构建：黑名单描述 / 各语种规则 / 请求体
//   全部为纯函数，不碰 DOM 与存储
// ===================================================================
import { BILINGUAL_MODES, MODE_LABEL } from './data.js';
import { validSurnameInput } from './parse.js';

export function buildBanDesc(b){
  return `字黑名单:${b.chars.join("、")||"无"}；词黑名单:${b.words.join("、")||"无"}；姓氏黑名单:${b.surnames.join("、")||"无"}`;
}

function surnameRule(opt){
  return (opt.mode==="cn"&&opt.lockSurname&&validSurnameInput(opt.fixedSurname))?`姓氏固定为“${opt.fixedSurname}”。`:"";
}

function ziRule(opt){
  return (opt.mode==="cn"&&opt.withZi&&(opt.era==="ancient"||opt.era==="republic"))?"可输出格式：张三（字某某）。":"";
}

function enRule(opt){
  return (opt.mode==="en"&&opt.enWithSurname)?"英文名必须是 First Last。":"";
}

function bilingualRule(opt){
  return (BILINGUAL_MODES.has(opt.mode)||opt.mode==="mo")?"每个名字必须是“原文全名（中文译名）”格式，括号内为中文对照，一行一个。":"";
}

function regionalRule(opt){
  return opt.mode==="hk"?"使用香港繁体中文姓氏与粤语圈常用名字，括号内给粤语拼音，如 陳大文（Chan Tai Man）。"
    :opt.mode==="mo"?"贴合澳门生态：粤拼中文名（括号粤语拼音）或土生葡人名字（原文+中文译名）。"
    :opt.mode==="tw"?"使用台湾繁体中文名字，不加拼音。"
    :opt.mode==="kr"?"使用韩文原名，括号内为标准中文译名。"
    :opt.mode==="jp"?"使用日文原名（汉字/假名），括号内为中文译名。"
    :"";
}

export function buildPrompt(opt,banDesc){
  const modeText = MODE_LABEL[opt.mode]||"名字";
  const worldTxt = (opt.customWorldText||"").trim() || "无";
  return `输出${opt.batchCount}个${modeText}，每行一个，不编号不解释。
风格:${opt.style}；世界观预设:${opt.worldview}；自定义世界观:${worldTxt}；时代:${opt.era}；性别:${opt.gender}。
规则：真实可用、禁止机器感。${surnameRule(opt)}${ziRule(opt)}${enRule(opt)}${bilingualRule(opt)}${regionalRule(opt)}
必须遵守黑名单：${banDesc}`;
}

export function buildPayload(cfg,prompt){
  return {
    model:cfg.model,
    temperature:Number(cfg.temperature||0.75),
    max_tokens:900,
    messages:[
      {role:"system",content:"你是命名助手，只返回名字列表，不解释。"},
      {role:"user",content:prompt}
    ]
  };
}
