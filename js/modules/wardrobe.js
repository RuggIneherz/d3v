import { $, getLS, setLS, now, uuid, UX, fetchChat, fetchChatStream } from '/js/utils.js';
import { APIConfig } from '/js/api-config.js';

export function initWardrobe() {

  const LS_ITEMS = "wd_items_v1", LS_OUTFITS = "wd_outfits_v1", LS_DRAFT = "wd_draft_v1", LS_FIT = "wd_fitting_v1";
  const tipEl = $("wdTip");
  const setTip = (m) => { tipEl.textContent = m || ""; if (m) setTimeout(() => tipEl.textContent === m && (tipEl.textContent = ""), 3000); };
  const toast = (m, t) => UX.toast(m, t);
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  const getItems = () => getLS(LS_ITEMS, []);      const saveItems = l => setLS(LS_ITEMS, l);
  const getOutfits = () => getLS(LS_OUTFITS, []);  const saveOutfits = l => setLS(LS_OUTFITS, l);
  const getFit = () => getLS(LS_FIT, []);          const saveFit = l => setLS(LS_FIT, l);

  // ---------- 词典：颜色 / 材质 / 图案 / 款式 ----------
  const COLORS = ["黑色","白色","灰色","深灰","浅灰","红色","暗红","酒红","橙色","黄色","绿色","墨绿","青色","蓝色","深蓝","天蓝","藏蓝","藏青","紫色","粉色","棕色","褐色","驼色","咖啡色","米色","米白","奶白","卡其","银色","金色","炭灰","藕粉"];
  const MATERIALS = ["纯棉","棉麻","聚酯纤维","尼龙","牛仔","真皮","皮革","针织","羊毛","羊绒","丝绸","真丝","雪纺","灯芯绒","羽绒","帆布","蕾丝","网纱","麂皮","华达呢","哑光皮","牛津纺","华夫格"];
  const PATTERNS = ["条纹","格纹","格子","迷彩","印花","做旧","纯色","拼接","刺绣","波点","扎染"];
  const STYLES = ["立领","翻领","圆领","V领","高领","堆堆领","娃娃领","西装领","连帽","带帽","拉链","纽扣","单排扣","双排扣","直筒","宽松","修身","紧身","廓形","短款","长款","中长款","高腰","低腰","阔腿","束脚","收脚","收腰","A字","百褶","开叉","高帮","低帮","厚底","尖头","圆头","方头","短袖","长袖","无袖","泡泡袖","垫肩","oversize","工装","机能","复古","破洞","撞色","翻边","卷边","抽绳","褶皱","荷叶边"];
  const CAT_RULES = [
    { cat: "underwear", priv: true, re: /内衣|内裤|文胸|胸罩|丝袜|棉袜|短袜|长袜|中筒袜|连裤袜|袜子|袜(?!靴)|情趣|抹胸|安全裤|打底裤|吊带袜|睡衣/ },
    { cat: "shoes",     re: /马丁靴|短靴|长靴|靴子|运动鞋|跑鞋|板鞋|皮鞋|凉鞋|拖鞋|帆布鞋|高跟鞋|乐福鞋|鞋|靴/ },
    { cat: "bottom",    re: /牛仔裤|工装裤|短裤|半身裙|长裙|短裙|连衣裙|阔腿裤|西裤|运动裤|卫裤|裤|裙/ },
    { cat: "accessory", re: /手表|项链|手链|手镯|耳环|耳钉|耳坠|戒指|棒球帽|贝雷帽|针织帽|渔夫帽|礼帽|帽子|围巾|丝巾|背包|挎包|单肩包|双肩包|手提包|托特包|钱包|腰包|腰带|皮带|领带|领结|眼镜|墨镜|手套|发带|胸针|耳罩|口罩|耳环/ },
    { cat: "top",       re: /羽绒服|棉服|夹克|外套|大衣|风衣|西装|西服|卫衣|马甲|皮衣|开衫|披风|斗篷|针织衫|毛衣|衬衫|衬衣|T恤|t恤|背心|吊带|打底衫|内搭|上衣|Polo|polo|针织背心|衫/ }
  ];
  const GARMENT_RE = new RegExp(CAT_RULES.map(r => r.re.source).join("|"));
  const classify = seg => CAT_RULES.find(r => r.re.test(seg)) || null;

  function extractTags(seg) {
    const tags = [];
    const push = a => a.forEach(x => { if (seg.includes(x) && !tags.includes(x)) tags.push(x); });
    push(COLORS); push(STYLES); push(MATERIALS); push(PATTERNS);
    const m = seg.match(GARMENT_RE);
    if (m && !tags.includes(m[0])) tags.push(m[0]);
    return tags;
  }

  // ---------- 切分 ----------
  const STRIP_LEAD = /^(?:一件|一条|一双|一只|一副|一顶|一块|一根|一对|一串|内搭|外搭|外穿|脚上|脚穿|头戴|腰间|手腕戴|手腕|脖子|颈间|肩挎|斜挎)/;
  function splitSegments(text) {
    const t = String(text || "").replace(/```[\s\S]*?```/g, "").replace(/[*#>]/g, "").replace(/[ \t]+/g, " ");
    const raw = t.split(/[。！？!?；;、，,\n\r]/).map(s => s.trim()).filter(Boolean);
    const out = [];
    for (const p of raw) {
      p.split(/(?=(?:内搭|外搭|外穿|腰间|手腕上?|手腕戴|脖子上?|颈间|脚上|脚穿|头戴|肩挎|斜挎))/)
       .forEach(s => { s = s.trim(); if (s) out.push(s); });
    }
    return out;
  }
  function makeItem(seg) {
    const rule = classify(seg) || { cat: "top", priv: false };
    const clean = seg.replace(STRIP_LEAD, "").replace(/[。.，,；;：:]+$/, "").trim();
    return { id: uuid(), name: clean.slice(0, 14), description: seg.trim(), tags: extractTags(seg), category: rule.cat, is_private: !!rule.priv, created_at: now() };
  }
  // 拆解 → 试衣间；识别不出品类的杂句自动丢弃
  function splitToFitting(text) {
    const segs = splitSegments(text);
    const fit = getFit(), items = getItems();
    const existFit = new Set(fit.map(x => x.description)), existItem = new Set(items.map(x => x.description));
    let added = 0, dropped = 0, dup = 0;
    segs.forEach(s => {
      if (!GARMENT_RE.test(s) || s.length < 3) { dropped++; return; }
      if (existFit.has(s) || existItem.has(s)) { dup++; return; }
      fit.unshift(makeItem(s)); added++;
    });
    saveFit(fit);
    return { added, dropped, dup };
  }

  const stripFence = s => String(s || "").replace(/```(?:yaml|markdown|text)?/gi, "").trim();

  const OUTFIT_SYS = `你是一名客观、精准的服装描述员。
铁律（必须遵守）：
1. 只输出纯客观的服装单品罗列，格式为“一件/一条/一双 + 颜色 + 材质/图案 + 款式/版型 + 品类名”。
2. 绝对禁止出现任何主观评价词，包括但不限于：好看、帅气、优雅、时尚、休闲、大气、得体、漂亮、酷、性感、可爱、随性、个性、前卫。
3. 必须涵盖：外套（若有）、上装、下装、鞋袜。可选配饰（包、帽子、手表、项链等）视情况添加。
4. 使用中文，每件单品单独成句、以句号结尾，不写总结句，不描述人物长相、姿势、背景环境。`;

  async function generateOutfit() {
    const cfg = APIConfig.getActive();
    if (!cfg.base_url || !cfg.api_key || !cfg.model) { toast("先在 API 设置填好主 API 的地址/密钥/模型", "error"); return; }
    const role = ($("roleContextInput")?.value || "").trim() || "无";
    const user = `基于以下参考生成一套穿搭（只写衣服）：
- 角色背景：${role}
- 场景：${$("wdScene").value}
- 风格标签（选品参考，非强制）：${$("wdStyleTags").value.trim() || "无"}
- 额外约束：${$("wdExtra").value.trim() || "无"}`;
    const payload = {
      model: cfg.model, temperature: Number(cfg.temperature || 0.7), max_tokens: 1500,
      messages: [{ role: "system", content: OUTFIT_SYS }, { role: "user", content: user }]
    };
    const useStream = cfg.stream_enabled !== false; // 默认开启流式
    const editor = $("wdEditor");
    UX.loading(useStream ? "正在流式生成穿搭文本…" : "正在生成穿搭文本…");
    let acc = "";
    try {
      if (useStream) {
        editor.value = "";
        try {
          await fetchChatStream(cfg.base_url, cfg.api_key, payload, chunk => {
            acc += chunk;
            editor.value = acc;                          // 逐字追加
            editor.scrollTop = editor.scrollHeight;
          }, null);
        } catch (streamErr) {
          acc = await fetchChat(cfg.base_url, cfg.api_key, payload); // 流式失败自动降级
        }
      } else {
        acc = await fetchChat(cfg.base_url, cfg.api_key, payload);
      }
      editor.value = stripFence(acc); saveDraft();
      UX.done(); toast("穿搭文本已生成，可点「拆解到试衣间」", "success");
    } catch (e) { UX.done(); toast("生成失败：" + e.message, "error"); }
  }

  // ---------- 识图 ----------
  function modelSupportsVision(m) {
    return /(gpt-4o|gpt-5|claude-?[34]|gemini|vision|-vl|vl-|glm-?4\.?[05]?v|qwen[a-z0-9.\-]*vl|o3|o4|multimodal)/i.test(String(m || ""));
  }
  const VISION_PROMPT = `请只描述图片中人物（或单品）穿着的衣物，忽略人脸、身材、姿势、表情与背景。
要求：1) 只提取客观事实：颜色、材质（如能识别）、图案印花、领口红袖口样式、款式版型（宽松/修身/直筒）；
2) 每件衣物单独成句，必须以“一件/一条/一双/一只/一副/一顶”开头、以句号结尾；
3) 只保留真实可见的衣物单品，看不清或不确定的不要写；
4) 禁止任何评价、风格总结和修饰性形容词。`;
  async function callVision(cfg, dataUrl) {
    return fetchChat(cfg.base, cfg.key, {
      model: cfg.model, temperature: 0.2,
      messages: [{ role: "user", content: [
        { type: "text", text: VISION_PROMPT },
        { type: "image_url", image_url: { url: dataUrl } }
      ]}]
    });
  }
  const readFileAsDataURL = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(file); });

  async function visionExtract(file) {
    if (!/image\/(jpeg|png|webp|jpg)/.test(file.type)) { toast("仅支持 jpg/png/webp 图片", "error"); return; }
    UX.loading("正在识图提取衣物…");
    const dataUrl = await readFileAsDataURL(file);
    const cfg = APIConfig.getActive();
    let txt = "", route = "";
    if (cfg.base_url && cfg.api_key && cfg.model && modelSupportsVision(cfg.model)) {
      try { txt = stripFence(await callVision({ base: cfg.base_url, key: cfg.api_key, model: cfg.model }, dataUrl)); route = "主 API"; }
      catch { txt = ""; }
    }
    if (!txt) {
      const b = cfg.vision_backup_base_url, k = cfg.vision_backup_key, m = cfg.vision_backup_model;
      if (b && k && m) {
        try { txt = stripFence(await callVision({ base: b, key: k, model: m }, dataUrl)); route = "备用识图 API"; }
        catch (e) { UX.done(); toast("备用识图也失败了：" + e.message, "error"); return; }
      } else {
        UX.done();
        toast("主模型不支持视觉（或调用失败），且未在 API 设置中配置备用识图 API", "error"); return;
      }
    }
    $("wdEditor").value = txt; saveDraft();
    // 自动拆解到试衣间，杂句当场过滤
    const r = splitToFitting(txt); saveFittingRender();
    UX.done();
    toast(`识图完成（${route}）：${r.added} 件进入试衣间${r.dropped ? `，过滤 ${r.dropped} 段无效描述` : ""}`, "success");
    $("wdFitList").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ---------- 状态与渲染 ----------
  const state = { view: "items", scope: "normal", tagSel: new Set(), selected: new Set(), fitSel: new Set() };

  function renderViewChips() {
    $("view-items").classList.toggle("active", state.view === "items");
    $("view-outfits").classList.toggle("active", state.view === "outfits");
    $("scope-private").classList.toggle("active", state.scope === "private");
  }
  function renderTagChips(list) {
    const tagSet = new Set();
    list.forEach(it => (it.tags || []).forEach(t => tagSet.add(t)));
    const tags = [...tagSet].sort();
    const box = $("wdTagChips");
    if (!tags.length) { box.innerHTML = '<span class="small">（暂无标签，拆解后会自动生成颜色 / 款式标签）</span>'; return; }
    box.innerHTML = tags.map(t => `<span class="wd-tag-chip${state.tagSel.has(t) ? " active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`).join("");
    box.querySelectorAll("[data-tag]").forEach(el => el.onclick = () => {
      const t = el.dataset.tag;
      if (state.tagSel.has(t)) state.tagSel.delete(t); else state.tagSel.add(t);
      renderList();
    });
  }

  function itemCard(it) {
    const sel = state.selected.has(it.id);
    const tags = (it.tags || []).map(t => `<span class="glass-tag">${esc(t)}</span>`).join("");
    return `<div class="glass-item ${sel ? "selected" : ""}" data-id="${it.id}">
      <div class="row" style="justify-content:space-between;align-items:flex-start;margin:0;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" data-sel="${it.id}" ${sel ? "checked" : ""}></label>
            <span class="name" style="margin:0;">${esc(it.name)}</span>
            ${it.is_private ? '<span class="glass-tag private-tag">私密</span>' : ""}
          </div>
          <div class="meta" style="margin-top:4px;">${esc(it.created_at)}</div>
          <div style="margin:2px 0;">${tags}</div>
          <div class="small">${esc(it.description)}</div>
        </div>
        <div class="row" style="margin:0;flex-wrap:nowrap;">
          <button class="glass-btn" data-act="priv" data-id="${it.id}">${it.is_private ? "移出抽屉" : "收入抽屉"}</button>
          <button class="glass-btn" data-act="edit" data-id="${it.id}">编辑</button>
          <button class="glass-btn" data-act="del" data-id="${it.id}">删除</button>
        </div>
      </div></div>`;
  }
  function outfitCard(o) {
    const items = getItems();
    const cnt = (o.item_ids || []).filter(iid => items.some(x => x.id === iid)).length;
    const tags = (o.tags || []).map(t => `<span class="glass-tag">${esc(t)}</span>`).join("");
    return `<div class="glass-item" data-id="${o.id}">
      <div class="row" style="justify-content:space-between;align-items:flex-start;margin:0;">
        <div style="flex:1;min-width:0;">
          <span class="name" style="margin:0;">${esc(o.name)}</span>
          <div class="meta" style="margin-top:4px;">${esc(o.created_at)} · 关联单品 ${cnt} 件</div>
          <div style="margin:2px 0;">${tags}</div>
          <div class="small">${esc((o.full_description || "").slice(0, 160))}</div>
        </div>
        <div class="row" style="margin:0;flex-wrap:nowrap;">
          <button class="glass-btn" data-act="load" data-id="${o.id}">载入编辑区</button>
          <button class="glass-btn" data-act="osplit" data-id="${o.id}">拆到试衣间</button>
          <button class="glass-btn" data-act="odel" data-id="${o.id}">删除</button>
        </div>
      </div></div>`;
  }

  function renderList() {
    const box = $("wdList");
    if (state.view === "items") {
      const kw = $("wdTagFilter").value.trim().toLowerCase();
      let list = getItems().filter(it => {
        if (state.scope === "private") return !!it.is_private;
        if (it.is_private) return false;
        if (state.tagSel.size) { const has = (it.tags || []).some(t => state.tagSel.has(t)); if (!has) return false; }
        if (kw) { const hay = (it.name + " " + (it.tags || []).join(" ") + " " + it.description).toLowerCase(); if (!hay.includes(kw)) return false; }
        return true;
      }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      renderTagChips(state.scope === "private" ? getItems().filter(x => x.is_private) : getItems().filter(x => !x.is_private));
      $("wdCount").textContent = `共 ${list.length} 件${state.scope === "private" ? "（私密抽屉）" : ""}`;
      box.innerHTML = list.length ? list.map(itemCard).join("") : '<div class="small">这里还没有单品：生成/识图后在「试衣间」确认入库，或点「手动新增单品」。</div>';
    } else {
      const list = getOutfits().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      $("wdTagChips").innerHTML = "";
      $("wdCount").textContent = `共 ${list.length} 套穿搭`;
      box.innerHTML = list.length ? list.map(outfitCard).join("") : '<div class="small">还没有整套穿搭：在编辑区写好文本后点「保存为整套穿搭」，或勾选多件单品「组装为整套」。</div>';
    }
    $("wdBtnAssemble").style.visibility = state.view === "items" ? "visible" : "hidden";
  }

  // ---------- 试衣间 ----------
  function saveFittingRender() {
    const fit = getFit();
    const box = $("wdFitList");
    $("wdFitCount").textContent = fit.length ? `试衣间暂存 ${fit.length} 件` : "";
    if (!fit.length) { box.innerHTML = ""; return; }
    box.innerHTML = fit.map(it => `
      <div class="fit-item" data-fid="${it.id}">
        <input type="checkbox" data-fsel="${it.id}" checked>
        <div class="fit-main">
          <div style="font-weight:600;font-size:14px;">${esc(it.name)} ${it.is_private ? '<span class="glass-tag private-tag">私密</span>' : ""}</div>
          <div style="margin:2px 0;">${(it.tags || []).map(t => `<span class="glass-tag">${esc(t)}</span>`).join("")}</div>
          <div class="small">${esc(it.description)}</div>
        </div>
        <div class="row" style="margin:0;flex-wrap:nowrap;">
          <button class="glass-btn" data-fact="in" data-fid="${it.id}">入库</button>
          <button class="glass-btn" data-fact="drop" data-fid="${it.id}">丢弃</button>
        </div>
      </div>`).join("");
  }
  function fitToWardrobe(ids) {
    const fit = getFit(), items = getItems();
    const exist = new Set(items.map(x => x.description));
    let n = 0;
    const rest = [];
    fit.forEach(it => {
      if (ids.includes(it.id)) {
        if (!exist.has(it.description)) { items.unshift({ ...it, created_at: now() }); n++; }
      } else rest.push(it);
    });
    saveItems(items); saveFit(rest);
    ids.forEach(id => state.fitSel.delete(id));
    saveFittingRender(); renderList();
    toast(`已入库 ${n} 件单品`, "success");
  }

  // ---------- 列表事件 ----------
  function bindList() {
    $("wdList").addEventListener("click", e => {
      const cb = e.target.closest("[data-sel]");
      if (cb) {
        if (cb.checked) state.selected.add(cb.dataset.sel); else state.selected.delete(cb.dataset.sel);
        cb.closest(".glass-item").classList.toggle("selected", cb.checked);
        return;
      }
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = btn.dataset.id, act = btn.dataset.act;
      if (act === "del") {
        if (!confirm("删除该单品？")) return;
        saveItems(getItems().filter(x => x.id !== id)); state.selected.delete(id); renderList();
      } else if (act === "priv") {
        const list = getItems(), it = list.find(x => x.id === id); if (!it) return;
        it.is_private = !it.is_private; saveItems(list); renderList();
        toast(it.is_private ? "已收入私密抽屉" : "已移出私密抽屉");
      } else if (act === "edit") {
        const list = getItems(), it = list.find(x => x.id === id); if (!it) return;
        const name = prompt("单品名称：", it.name); if (name === null) return;
        const tags = prompt("标签（逗号分隔，可改颜色/款式）：", (it.tags || []).join(", ")); if (tags === null) return;
        const desc = prompt("客观描述：", it.description); if (desc === null) return;
        it.name = (name.trim() || it.name);
        it.tags = tags.split(/[，,]/).map(s => s.trim()).filter(Boolean);
        if (desc.trim()) it.description = desc.trim();
        saveItems(list); renderList(); toast("已保存修改", "success");
      } else if (act === "load") {
        const o = getOutfits().find(x => x.id === id); if (!o) return;
        $("wdEditor").value = o.full_description || ""; saveDraft();
        $("wdEditor").scrollIntoView({ behavior: "smooth", block: "center" });
        toast("已载入编辑区");
      } else if (act === "osplit") {
        const o = getOutfits().find(x => x.id === id); if (!o) return;
        const r = splitToFitting(o.full_description); saveFittingRender();
        state.view = "items"; renderViewChips(); renderList();
        $("wdFitList").scrollIntoView({ behavior: "smooth", block: "center" });
        toast(`已拆到试衣间：${r.added} 件${r.dropped ? `，过滤 ${r.dropped} 段` : ""}`);
      } else if (act === "odel") {
        if (!confirm("删除该整套穿搭？")) return;
        saveOutfits(getOutfits().filter(x => x.id !== id)); renderList();
      }
    });
    $("wdFitList").addEventListener("click", e => {
      const btn = e.target.closest("button[data-fact]");
      if (!btn) return;
      const id = btn.dataset.fid;
      if (btn.dataset.fact === "in") fitToWardrobe([id]);
      else { saveFit(getFit().filter(x => x.id !== id)); state.fitSel.delete(id); saveFittingRender(); }
    });
  }

  function saveOutfitFromEditor() {
    const text = $("wdEditor").value.trim();
    if (!text) { toast("编辑区没有内容", "error"); return; }
    const def = "穿搭 " + new Date().toLocaleString();
    const name = (prompt("给这套穿搭起个名字：", def) || def).trim() || def;
    const tags = $("wdStyleTags").value.split(/[，,]/).map(s => s.trim()).filter(Boolean);
    const list = getOutfits();
    list.unshift({ id: uuid(), name, item_ids: [], tags, full_description: text, created_at: now() });
    saveOutfits(list);
    state.view = "outfits"; renderViewChips(); renderList(); toast("已保存为整套穿搭", "success");
  }
  function assemble() {
    const ids = [...state.selected];
    if (ids.length < 2) { toast("先勾选至少两件单品再组装", "error"); return; }
    const picked = ids.map(i => getItems().find(x => x.id === i)).filter(Boolean);
    const def = picked.slice(0, 2).map(x => x.name).join("·");
    const name = (prompt("给这套穿搭起个名字：", def) || def).trim() || def;
    const tags = [...new Set(picked.flatMap(x => x.tags || []))].slice(0, 10);
    const text = picked.map(x => x.description).join("，") + "。";
    const list = getOutfits();
    list.unshift({ id: uuid(), name, item_ids: ids, tags, full_description: text, created_at: now() });
    saveOutfits(list);
    state.selected.clear(); state.view = "outfits"; renderViewChips(); renderList();
    toast(`已用 ${picked.length} 件单品组装成整套穿搭`, "success");
  }

  // ---------- 草稿 / 角色联动 ----------
  function saveDraft() {
    setLS(LS_DRAFT, { editor: $("wdEditor").value, scene: $("wdScene").value, style: $("wdStyleTags").value, extra: $("wdExtra").value });
  }
  function loadDraft() {
    const d = getLS(LS_DRAFT, null); if (!d) return;
    $("wdEditor").value = d.editor || "";
    if (d.scene) $("wdScene").value = d.scene;
    $("wdStyleTags").value = d.style || "";
    $("wdExtra").value = d.extra || "";
  }
  function refreshRolePreview() {
    const len = (document.getElementById("roleContextInput")?.value || "").trim().length;
    $("wdRolePreview").textContent = len
      ? `将自动引用【人设生成】面板的角色上下文（当前 ${len} 字）`
      : "人设面板暂无角色上下文，生成时将以「无」提交；可先去人设面板导入角色。";
  }

  function init() {
    renderViewChips();
    document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => {
      if (b.dataset.target === "panel-wardrobe") refreshRolePreview();
    }));
    const rc = document.getElementById("roleContextInput");
    if (rc) rc.addEventListener("input", refreshRolePreview);

    $("view-items").onclick = () => { state.view = "items"; renderViewChips(); renderList(); };
    $("view-outfits").onclick = () => { state.view = "outfits"; renderViewChips(); renderList(); };
    $("scope-private").onclick = () => {
      state.scope = state.scope === "private" ? "normal" : "private";
      state.tagSel.clear(); state.selected.clear(); renderViewChips(); renderList();
    };
    $("wdTagFilter").addEventListener("input", renderList);
    ["wdEditor","wdScene","wdStyleTags","wdExtra"].forEach(id => $(id).addEventListener("input", saveDraft));

    $("wdBtnGenerate").onclick = generateOutfit;
    $("wdBtnSplit").onclick = () => {
      const t = $("wdEditor").value.trim();
      if (!t) { toast("编辑区没有可拆解的文本", "error"); return; }
      const r = splitToFitting(t); saveFittingRender();
      state.view = "items"; renderViewChips(); renderList();
      toast(`识别 ${r.added} 件进入试衣间${r.dropped ? `，自动丢弃 ${r.dropped} 段无效文本` : ""}${r.dup ? `，${r.dup} 件已存在` : ""}`, r.dropped ? "error" : "success");
    };
    $("wdBtnSaveOutfit").onclick = saveOutfitFromEditor;
    $("wdBtnAssemble").onclick = assemble;
    $("wdBtnClear").onclick = () => { $("wdEditor").value = ""; saveDraft(); };
    $("wdBtnAddManual").onclick = () => {
      const t = prompt("输入一件单品的客观描述：");
      if (!t || !t.trim()) return;
      const r = splitToFitting(t); saveFittingRender();
      state.view = "items"; renderViewChips(); renderList();
      toast(r.added ? "已进入试衣间，确认后入库" : "没识别出衣物品类，请补充如「一件黑色…夹克」", r.added ? "success" : "error");
    };
    $("wdBtnFitAll").onclick = () => {
      const checked = [...$("wdFitList").querySelectorAll("[data-fsel]:checked")].map(c => c.dataset.fsel);
      if (!checked.length) { toast("先勾选要入库的单品", "error"); return; }
      fitToWardrobe(checked);
    };
    $("wdBtnFitClear").onclick = () => { saveFit([]); state.fitSel.clear(); saveFittingRender(); toast("试衣间已清空"); };
    $("wdVisionInput").addEventListener("change", e => {
      const f = e.target.files?.[0];
      if (f) visionExtract(f).catch(err => { UX.done(); toast("识图失败：" + (err.message || err), "error"); });
      e.target.value = "";
    });

    bindList(); loadDraft(); refreshRolePreview(); saveFittingRender(); renderList();
  }
  init();

}
