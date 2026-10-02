// ===================================================================
// 衣柜与穿搭 · 提示词层：系统提示 / 消息与请求体构建（纯函数，不碰 DOM）
// ===================================================================

export const OUTFIT_SYS = `你是一名客观、精准的服装描述员。
铁律（必须遵守）：
1. 只输出纯客观的服装单品罗列，格式为“一件/一条/一双 + 颜色 + 材质/图案 + 款式/版型 + 品类名”。
2. 绝对禁止出现任何主观评价词，包括但不限于：好看、帅气、优雅、时尚、休闲、大气、得体、漂亮、酷、性感、可爱、随性、个性、前卫。
3. 必须涵盖：外套（若有）、上装、下装、鞋袜。可选配饰（包、帽子、手表、项链等）视情况添加。
4. 使用中文，每件单品单独成句、以句号结尾，不写总结句，不描述人物长相、姿势、背景环境。`;

export const VISION_PROMPT = `请只描述图片中人物（或单品）穿着的衣物，忽略人脸、身材、姿势、表情与背景。
要求：1) 只提取客观事实：颜色、材质（如能识别）、图案印花、领口红袖口样式、款式版型（宽松/修身/直筒）；
2) 每件衣物单独成句，必须以“一件/一条/一双/一只/一副/一顶”开头、以句号结尾；
3) 只保留真实可见的衣物单品，看不清或不确定的不要写；
4) 禁止任何评价、风格总结和修饰性形容词。`;

// 依据模型名判断是否具备视觉能力
export function modelSupportsVision(m) {
  return /(gpt-4o|gpt-5|claude-?[34]|gemini|vision|-vl|vl-|glm-?4\.?[05]?v|qwen[a-z0-9.\-]*vl|o3|o4|multimodal)/i.test(String(m || ""));
}

// 生成穿搭：用户消息（角色背景 / 场景 / 风格标签 / 额外约束）
export function buildOutfitUser(role, scene, style, extra) {
  return `基于以下参考生成一套穿搭（只写衣服）：
- 角色背景：${role}
- 场景：${scene}
- 风格标签（选品参考，非强制）：${style}
- 额外约束：${extra}`;
}

// 生成穿搭：请求体
export function buildOutfitPayload(cfg, user) {
  return {
    model: cfg.model, temperature: Number(cfg.temperature || 0.7), max_tokens: 1500,
    messages: [{ role: "system", content: OUTFIT_SYS }, { role: "user", content: user }]
  };
}

// 识图：请求体（文本要求 + 单张图片）
export function buildVisionPayload(model, dataUrl) {
  return {
    model: model, temperature: 0.2,
    messages: [{ role: "user", content: [
      { type: "text", text: VISION_PROMPT },
      { type: "image_url", image_url: { url: dataUrl } }
    ]}]
  };
}
