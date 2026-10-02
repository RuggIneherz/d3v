// ===================================================================
// 人设面板 · 提示词与请求体
//   纯函数：只做字符串 / 对象拼装，不读写 DOM，也不依赖面板状态。
// ===================================================================
import { normalizeWb } from './parse.js';

// ===== 强化 Prompt（已去字数限制，要求更丰富）=====
export const SYSTEM_PROMPT = `你是一位精确、高效的角色设定助手。用户会提供一份基于模板的粗略角色设定。
你的任务：
1) 严格保持原有模板结构和键名（key）不变。
2) 在用户信息基础上进行扩展和补全，补足逻辑链条、行为动机、时间线和细节。
3) 语言风格清晰、简洁、客观，避免空洞形容和堆砌辞藻。
4) 内容必须前后一致、可落地、可用于创作，不要互相矛盾。
5) 需要结合角色卡与世界书信息，生成对应的用户人设。

质量要求（重点）：
- 不限制总字数，优先保证完整度和细节密度。
- 允许在列表字段中增加条目数量（如 goals/weakness/likes/dislikes/skills 等），但键名不变。
- background_story 的每个阶段都要有实质信息，避免空话。
- appearance、attire、personality、behaviors 必须具体，避免“普通/一般/不错”等低信息词。
- 角色卡与世界书只可吸收信息，禁止原文照抄，禁止重复粘贴原始文本。

输出规则（强制）：
- 仅输出最终 YAML。
- 不要解释、不要前言后记、不要 Markdown 代码块。`;

export const DEFAULT_TEMPLATE = `user_name:
  Chinese name:
  Nickname:
  age:
  gender:
  height:
  identity:
    -
  background_story:
    童年(0-12岁):
    少年(13-18岁):
    青年(19-35岁):
    中年(35-至今):
    现状:

  social_status:
    -

  appearance:
    hair:
    eyes:
    skin:
    face_style:
    build:
      -
  attire:
    business_formal:
    business_casual:
    casual_wear:
    home_wear:

  archetype:

  personality:
    core_traits:
      - : ""
    romantic_traits:
      - : ""

  lifestyle_behaviors:
    -
    -

  work_behaviors:
    -

  emotional_behaviors:
    angry:
    happy:

  goals:
    -

  weakness:
    -

  likes:
    -

  dislikes:
    -

  skills:
    - 工作: ["",""]
    - 生活: ["",""]
    - 爱好: ["",""]

  NSFW_information:
    Sex_related traits:
      experiences:
      sexual_orientation:
      sexual_role:
      sexual_habits:
        -
    Kinks:
    Limits:`;

// 灵感词：40个，偏白描口语，少用"导向/优先/主义"类术语
export const KEYWORDS = [
  "冷静","慢热","克制","不轻易交底","说到就做","疏离感","生活简单","不爱寒暄","只看结果","讲究",
  "外向","内向","敏感","乐观","悲观","爱冒险","谨慎","自律","拖延","较真",
  "心软","眼里有活","自来熟","爱清静","扛得住","情绪稳","话少","有话直说","反差萌","爱开玩笑",
  "爱管事","随和","认理","重感情","看得长远","说干就干","看不上凑合","怕麻烦","顾着身边人","认准了就往前冲"
];

// ===== 消息与请求体 =====

/** 世界书正文按权重截断（弱 / 中 / 强） */
export function wbTextByWeight(text, weight){
  const t = String(text||"");
  if(weight==="low") return t.slice(0,700);
  if(weight==="high") return t.slice(0,3500);
  return t.slice(0,1800); // mid
}

/** 世界书条目合并成一段约束文本；没有可用内容时给「无」 */
export function mergeWorldbooks(wbs){
  return wbs.map(normalizeWb).map(worldbookBlock).filter(Boolean).join("\n\n") || "无";
}

function worldbookBlock(w, i){
  const wt = w.weight || "mid";
  const parts=(w.entries||[]).filter(e=>e.enabled).map(e=>`[条目|${e.key}]\n${wbTextByWeight(e.content,wt)}`);
  return parts.length?`[世界书${i+1}|${w.name}|权重:${wt}]\n${parts.join("\n")}`:"";
}

/** 组装 OpenAI 风格请求体 */
export function buildPayload(cfg, mode, input){
  return {
    model:cfg.model,
    temperature:Number(cfg.temperature||0.75),
    max_tokens: 6000,
    messages:buildMessages(mode, input)
  };
}

/** 系统提示 + 用户提示（模式 / 角色上下文 / 世界书 / 关键词 / 模板） */
export function buildMessages(mode, input){
  const template = input.template || DEFAULT_TEMPLATE;
  const role = String(input.role||"").trim() || "无";
  const kws = input.keywords || [];
  const wbMerged = mergeWorldbooks(input.worldbooks||[]);
  return [
    {role:"system",content:SYSTEM_PROMPT},
    {role:"user",content:userPrompt(mode, role, wbMerged, kws, template)}
  ];
}

function userPrompt(mode, role, wbMerged, kws, template){
  return `模式: ${mode==="random"?"随机":"按模板"}
严格只输出模板YAML，禁止输出角色卡/世界书原文。

角色上下文(仅用于约束，不可原样复述):
${role}

世界书(仅用于约束，不可原样复述):
${wbMerged}

关键词:
${kws.length?kws.join(", "):"无"}

模板输入:
${template}`;
}
