import { $, getLS, setLS, now, uuid, UX, fetchChat, fetchChatStream } from '/js/utils.js';
import { APIConfig } from '/js/api-config.js';

export function initPersona() {


  // Storage keys
  const LS_DRAFT="pp_draft_v8", LS_HIS="pp_his_v8", LS_ROLECTX="pp_rolectx_v8", LS_WB="pp_wb_v8", LS_PRESET="pp_custom_preset_v8", LS_RESULT="pp_result_v8";

  // ===== 强化 Prompt（已去字数限制，要求更丰富）=====
  const SYSTEM_PROMPT = `你是一位精确、高效的角色设定助手。用户会提供一份基于模板的粗略角色设定。
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

  const DEFAULT_TEMPLATE = `user_name:
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

  // 模板库分组（id固定，名称可改）
  const LS_GROUPS = "pp_preset_groups_v9";
  const UNGROUPED = "ungrouped";

  // 灵感词：40个，偏白描口语，少用"导向/优先/主义"类术语
  const KEYWORDS = [
    "冷静","慢热","克制","不轻易交底","说到就做","疏离感","生活简单","不爱寒暄","只看结果","讲究",
    "外向","内向","敏感","乐观","悲观","爱冒险","谨慎","自律","拖延","较真",
    "心软","眼里有活","自来熟","爱清静","扛得住","情绪稳","话少","有话直说","反差萌","爱开玩笑",
    "爱管事","随和","认理","重感情","看得长远","说干就干","看不上凑合","怕麻烦","顾着身边人","认准了就往前冲"
  ];

  // DOM
  const tip=$("tip");
  const templateInput=$("templateInput"), roleContextInput=$("roleContextInput"), keywordsInput=$("keywordsInput"), resultOutput=$("resultOutput");
  const historyList=$("historyList"), historySearch=$("historySearch"), historyModeFilter=$("historyModeFilter");
  const roleTip=$("roleTip"), worldbookList=$("worldbookList");

  const setTip=(m)=>{tip.textContent=m||""; if(m) setTimeout(()=>tip.textContent===m&&(tip.textContent=""),1700);}
  const parseKeywords=()=> (keywordsInput.value||"").split(/[，,]/).map(s=>s.trim()).filter(Boolean);

  function saveDraft(){
    setLS(LS_DRAFT, templateInput.value||"");
    setLS(LS_ROLECTX, roleContextInput.value||"");
    setLS(LS_RESULT, resultOutput.value||"");
  }

  // ===== 模板库：分组 + 标签 =====
  let currentGroup="all";
  const activeTags=new Set();

  function defaultGroups(){
    return [
      {id:UNGROUPED, name:"未分类"},
      {id:uuid(), name:"现代都市"},
      {id:uuid(), name:"古代/架空"},
      {id:uuid(), name:"科幻/异世界"}
    ];
  }
  function getGroups(){ return getLS(LS_GROUPS, null); }
  function saveGroups(list){ setLS(LS_GROUPS, list); }
  function getPresets(){ return getLS(LS_PRESET, []); }
  function savePresets(list){ setLS(LS_PRESET, list); }

  // 首次进入：建立默认分组 + 把旧版自定义模板迁移进来 + 放几个占位模板示例
  function ensurePresetSeed(){
    if(getGroups()) return;
    const groups=defaultGroups();
    const modern=groups[1].id, ancient=groups[2].id, scifi=groups[3].id;

    const old=getPresets();
    const migrated=old.map(p=>({
      id:p.id||uuid(), name:p.name||"未命名模板", content:p.content||DEFAULT_TEMPLATE,
      group:p.group||UNGROUPED, tags:Array.isArray(p.tags)?p.tags:[]
    }));

    const seed=[
      {id:uuid(), name:"都市冷感执行者", content:DEFAULT_TEMPLATE, group:modern, tags:["现代","职场","高冷"]},
      {id:uuid(), name:"校园元气社交型", content:DEFAULT_TEMPLATE.replace("identity:\n    -","identity:\n    - 大学社团骨干"), group:modern, tags:["现代","校园","元气"]},
      {id:uuid(), name:"赛博侦查者", content:DEFAULT_TEMPLATE.replace("identity:\n    -","identity:\n    - 数字取证分析师"), group:scifi, tags:["赛博","悬疑"]},
      {id:uuid(), name:"古风谋士", content:DEFAULT_TEMPLATE.replace("identity:\n    -","identity:\n    - 幕僚参议"), group:ancient, tags:["古风","谋士"]}
    ];

    saveGroups(groups);
    savePresets([...seed, ...migrated]);
  }

  function renderGroupTabs(){
    const groups=getGroups()||[];
    const all=[{id:"all",name:"全部"}, ...groups];
    $("presetGroupTabs").innerHTML=all.map(g=>
      `<span class="glass-chip${g.id===currentGroup?" active":""}" data-gid="${g.id}">${g.name}</span>`
    ).join("");
    [...document.querySelectorAll("#presetGroupTabs .glass-chip")].forEach(el=>{
      el.onclick=()=>{
        currentGroup=el.dataset.gid; activeTags.clear();
        renderGroupTabs(); renderTagFilter(); renderPresetList();
      };
    });
  }

  function renderTagFilter(){
    const presets=getPresets().filter(p=>currentGroup==="all"||p.group===currentGroup);
    const tagSet=new Set();
    presets.forEach(p=>(p.tags||[]).forEach(t=>tagSet.add(t)));
    const tags=[...tagSet];
    if(!tags.length){ $("presetTagFilter").innerHTML=""; return; }
    $("presetTagFilter").innerHTML=tags.map(t=>
      `<span class="glass-chip${activeTags.has(t)?" active":""}" data-tag="${t}">#${t}</span>`
    ).join("");
    [...document.querySelectorAll("#presetTagFilter .glass-chip")].forEach(el=>{
      el.onclick=()=>{
        const t=el.dataset.tag;
        if(activeTags.has(t)) activeTags.delete(t); else activeTags.add(t);
        renderTagFilter(); renderPresetList();
      };
    });
  }

  function renderPresetList(){
    const groups=getGroups()||[];
    let presets=getPresets();
    if(currentGroup!=="all") presets=presets.filter(p=>p.group===currentGroup);
    if(activeTags.size) presets=presets.filter(p=>(p.tags||[]).some(t=>activeTags.has(t)));

    if(!presets.length){
      $("presetList").innerHTML=`<div class="small">这里还没有模板，点"新增模板"建一个吧。</div>`;
      return;
    }

    $("presetList").innerHTML=presets.map(p=>{
      const tagsHtml=(p.tags||[]).map(t=>`<span class="glass-tag">${t}</span>`).join("");
      const groupOptions=groups.map(g=>`<option value="${g.id}"${g.id===p.group?" selected":""}>${g.name}</option>`).join("");
      const nameEsc=String(p.name).replace(/"/g,"&quot;");
      return `
      <div class="glass-item" data-id="${p.id}">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600">${p.name}</div>
            <div style="margin-top:4px">${tagsHtml}</div>
          </div>
          <div class="row" style="flex-wrap:nowrap">
            <button class="glass-btn" data-act="apply">套用</button>
            <button class="glass-btn" data-act="edit">编辑</button>
            <button class="glass-btn" data-act="delete">删除</button>
          </div>
        </div>
        <div class="preset-edit" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08)">
          <div class="grid2" style="margin-bottom:8px">
            <input class="edit-name glass-input" placeholder="模板名称" value="${nameEsc}">
            <select class="edit-group glass-select">${groupOptions}</select>
          </div>
          <input class="edit-tags glass-input" placeholder="标签，用逗号分隔" style="width:100%;margin-bottom:8px" value="${(p.tags||[]).join(', ')}">
          <div class="row">
            <button class="glass-btn" data-act="save-meta">保存</button>
            <button class="glass-btn" data-act="save-content">用下方编辑区内容覆盖此模板</button>
            <button class="glass-btn" data-act="cancel">收起</button>
          </div>
          <div class="small" style="margin-top:6px">"覆盖此模板"会把下面"人设模板（YAML）"编辑区里的当前内容存进这个模板。</div>
        </div>
      </div>`;
    }).join("");
  }

  $("presetList").addEventListener("click",(e)=>{
    const btn=e.target.closest("button[data-act]");
    if(!btn) return;
    const item=btn.closest(".glass-item");
    const id=item.dataset.id, act=btn.dataset.act;
    const list=getPresets();
    const idx=list.findIndex(x=>x.id===id);
    if(idx<0) return;

    if(act==="apply"){
      if(!confirm("套用将覆盖当前模板，继续？")) return;
      templateInput.value=list[idx].content;
      saveDraft(); setTip("已套用模板");
    }else if(act==="edit"){
      const edit=item.querySelector(".preset-edit");
      edit.style.display = edit.style.display==="none" ? "block" : "none";
    }else if(act==="delete"){
      if(!confirm("确定删除该模板？")) return;
      savePresets(list.filter(x=>x.id!==id));
      renderTagFilter(); renderPresetList(); setTip("已删除");
    }else if(act==="save-meta"){
      const name=item.querySelector(".edit-name").value.trim();
      const group=item.querySelector(".edit-group").value;
      const tags=item.querySelector(".edit-tags").value.split(/[，,]/).map(s=>s.trim()).filter(Boolean);
      if(!name) return setTip("名称不能为空");
      list[idx]={...list[idx], name, group, tags};
      savePresets(list);
      renderGroupTabs(); renderTagFilter(); renderPresetList(); setTip("已保存");
    }else if(act==="save-content"){
      list[idx]={...list[idx], content:templateInput.value};
      savePresets(list);
      setTip("已用当前内容覆盖模板");
    }else if(act==="cancel"){
      item.querySelector(".preset-edit").style.display="none";
    }
  });

  $("btnAddPreset").onclick=()=>{
    const name=prompt("新模板名称：");
    if(!name||!name.trim()) return;
    const list=getPresets();
    const group=currentGroup==="all" ? UNGROUPED : currentGroup;
    list.push({id:uuid(), name:name.trim(), content:templateInput.value||DEFAULT_TEMPLATE, group, tags:[]});
    savePresets(list);
    renderTagFilter(); renderPresetList(); setTip("已新增模板");
  };

  $("btnPresetAddGroup").onclick=()=>{
    const name=prompt("新分组名称：");
    if(!name||!name.trim()) return;
    const groups=getGroups()||defaultGroups();
    const g={id:uuid(), name:name.trim()};
    groups.push(g); saveGroups(groups);
    currentGroup=g.id; activeTags.clear();
    renderGroupTabs(); renderTagFilter(); renderPresetList(); setTip("已新建分组");
  };

  $("btnPresetRenameGroup").onclick=()=>{
    if(currentGroup==="all"||currentGroup===UNGROUPED) return setTip("该分组不可重命名");
    const groups=getGroups()||[], g=groups.find(x=>x.id===currentGroup);
    if(!g) return;
    const name=prompt("新分组名称：", g.name);
    if(!name||!name.trim()) return;
    g.name=name.trim(); saveGroups(groups);
    renderGroupTabs(); renderPresetList(); setTip("已重命名");
  };

  $("btnPresetDeleteGroup").onclick=()=>{
    if(currentGroup==="all"||currentGroup===UNGROUPED) return setTip("该分组不可删除");
    if(!confirm("删除分组后，组内模板会移至「未分类」，继续？")) return;
    const groups=(getGroups()||[]).filter(x=>x.id!==currentGroup);
    const list=getPresets().map(p=>p.group===currentGroup?{...p,group:UNGROUPED}:p);
    saveGroups(groups); savePresets(list);
    currentGroup="all"; activeTags.clear();
    renderGroupTabs(); renderTagFilter(); renderPresetList(); setTip("已删除分组");
  };

  $("btnExportPreset").onclick=()=>{
    const data={groups:getGroups()||[], presets:getPresets()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
    const u=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=u; a.download="persona_template_library.json"; a.click(); URL.revokeObjectURL(u);
    setTip("模板库已导出");
  };

  $("btnImportPreset").onclick=()=>{
    const f=$("presetImportFile").files?.[0];
    if(!f) return setTip("先选择JSON文件");
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const obj=JSON.parse(String(rd.result||"{}"));
        const importedGroups=Array.isArray(obj.groups)?obj.groups:[];
        const importedPresets=Array.isArray(obj.presets)?obj.presets:(Array.isArray(obj.custom)?obj.custom:[]);
        const groups=getGroups()||defaultGroups();
        importedGroups.forEach(g=>{
          if(g&&g.id&&g.name&&!groups.find(x=>x.id===g.id)) groups.push({id:g.id,name:String(g.name)});
        });
        const list=getPresets();
        const cleaned=importedPresets.filter(x=>x&&x.name&&x.content).map(x=>({
          id:uuid(), name:String(x.name), content:String(x.content),
          group:(x.group&&groups.find(g=>g.id===x.group)) ? x.group : UNGROUPED,
          tags:Array.isArray(x.tags)?x.tags.map(String):[]
        }));
        if(!cleaned.length) return setTip("未找到可导入模板");
        saveGroups(groups);
        savePresets([...list, ...cleaned]);
        renderGroupTabs(); renderTagFilter(); renderPresetList(); setTip("模板导入成功");
      }catch{ setTip("导入失败：JSON格式错误"); }
    };
    rd.readAsText(f,"utf-8");
  };

  // worldbooks
  function worldbooksGet(){ return getLS(LS_WB, []); }
  function worldbooksSet(list){ setLS(LS_WB, list); }
  function normalizeWb(w){
    if(Array.isArray(w.entries)&&w.entries.length) return w;
    return {...w, entries:[{key:w.name||"条目", content:w.text||"", enabled:true}]};
  }
  function extractWorldbookEntries(obj){
    const x=obj?.data||obj||{};
    let entries=x.entries || x.worldbook?.entries || x.lorebook?.entries || [];
    if(!Array.isArray(entries)&&typeof entries==="object") entries=Object.values(entries);
    if(Array.isArray(entries)&&entries.length){
      return entries.map((e,i)=>{
        let keys=e.keys||e.key||e.primary_keys||e.comment||`条目${i+1}`;
        if(Array.isArray(keys)) keys=keys.join(", ");
        const content=e.content||e.entry||e.text||"";
        const enabled=e.enabled!==false && (e.disable===undefined?true:!e.disable) && (e.disabled===undefined?true:!e.disabled);
        return {key:String(keys||`条目${i+1}`), content:String(content), enabled:!!enabled};
      }).filter(e=>e.content);
    }
    return [{key:"全文", content:JSON.stringify(obj).slice(0,15000), enabled:true}];
  }

  function renderWorldbooks(){
    const list=worldbooksGet().map(normalizeWb);
    worldbooksSet(list);
    if(!list.length){
      worldbookList.innerHTML=`<div class="small">（暂无世界书）</div>`;
      return;
    }
    worldbookList.innerHTML = list.map((w,idx)=>`
      <div class="glass-item">
        <div class="meta">${w.name} · ${w.type||"unknown"} · ${(w.entries||[]).length} 个条目 · ${(w.entries||[]).filter(e=>e.enabled).length} 启用</div>
        <div class="list-container" style="gap:6px;margin:6px 0;">
          ${(w.entries||[]).map((e,ei)=>`
            <label style="display:flex;gap:8px;align-items:flex-start;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:7px 10px;cursor:pointer;">
              <input type="checkbox" data-wi="${idx}" data-ei="${ei}" ${e.enabled?"checked":""} style="margin-top:3px;">
              <span style="flex:1;min-width:0;"><span style="font-size:12px;color:#fff;">${String(e.key).slice(0,60)}</span><span class="small" style="display:block;">${(e.content||"").slice(0,100).replace(/\n/g," ")}</span></span>
            </label>`).join("")}
        </div>
        <div class="row" style="margin-top:6px">
          <button class="glass-btn" data-rm="${idx}">移除整份</button>
          <span class="small">权重</span>
          <select class="glass-select" data-weight="${idx}" style="height:32px;padding:0 8px;min-width:86px">
            <option value="low" ${w.weight==="low"?"selected":""}>弱</option>
            <option value="mid" ${(!w.weight||w.weight==="mid")?"selected":""}>中</option>
            <option value="high" ${w.weight==="high"?"selected":""}>强</option>
          </select>
        </div>
      </div>
    `).join("");

    [...worldbookList.querySelectorAll("button[data-rm]")].forEach(btn=>{
      btn.onclick=()=>{
        const arr=worldbooksGet();
        arr.splice(Number(btn.dataset.rm),1);
        worldbooksSet(arr); renderWorldbooks();
      };
    });
    [...worldbookList.querySelectorAll("input[data-wi]")].forEach(cb=>{
      cb.onchange=()=>{
        const arr=worldbooksGet(), wi=Number(cb.dataset.wi), ei=Number(cb.dataset.ei);
        if(arr[wi]&&arr[wi].entries[ei]){ arr[wi].entries[ei].enabled=cb.checked; worldbooksSet(arr); renderWorldbooks(); }
      };
    });
    [...worldbookList.querySelectorAll("select[data-weight]")].forEach(sel=>{
      sel.onchange=()=>{
        const i=Number(sel.dataset.weight);
        const arr=worldbooksGet();
        if(!arr[i]) return;
        arr[i].weight=sel.value; worldbooksSet(arr);
      };
    });
  }

  function wbTextByWeight(text, weight){
    const t = String(text||"");
    if(weight==="low") return t.slice(0,700);
    if(weight==="high") return t.slice(0,3500);
    return t.slice(0,1800); // mid
  }

  // history
  function historyGet(){ return getLS(LS_HIS, []); }
  function historySet(list){ setLS(LS_HIS, list); }

  function pushHistory(item){
    const list=historyGet();
    list.unshift(item);
    if(list.length>100) list.length=100;
    historySet(list);
    renderHistory();
  }

  function renderHistory(){
    const list=historyGet();
    const kw=(historySearch.value||"").toLowerCase().trim();
    const mode=historyModeFilter.value;

    const f=list.filter(it=>{
      const modeOK=(mode==="all" || it.mode===mode);
      const corpus=`${it.time} ${it.mode} ${it.preview} ${it.keywords||""}`.toLowerCase();
      return modeOK && (!kw || corpus.includes(kw));
    });

    if(!f.length){ historyList.innerHTML=`<div class="glass-item">（无匹配历史）</div>`; return; }

    historyList.innerHTML=f.map(it=>`
      <div class="glass-item" data-id="${it.id}">
        <div class="meta">${it.time} · ${it.mode==="random"?"随机":"按模板"} · ${it.model||""}</div>
        <div class="small">${(it.preview||"").replace(/\n/g," ").slice(0,140)}</div>
      </div>
    `).join("");

    [...historyList.querySelectorAll(".glass-item")].forEach(el=>{
      el.onclick=()=>{
        const id=el.dataset.id;
        const item=historyGet().find(x=>x.id===id);
        if(!item) return;
        resultOutput.value=item.result||"";
        templateInput.value=item.template||templateInput.value;
        keywordsInput.value=item.keywords||"";
        roleContextInput.value=item.roleContext||roleContextInput.value;
      };
    });
  }

  function buildMessages(mode){
    const template = templateInput.value || DEFAULT_TEMPLATE;
    const role = (roleContextInput.value||"").trim() || "无";
    const kws = parseKeywords();
    const wbs = worldbooksGet();

    const wbMerged = wbs.map(normalizeWb).map((w,i)=>{
      const wt = w.weight || "mid";
      const parts=(w.entries||[]).filter(e=>e.enabled).map(e=>`[条目|${e.key}]\n${wbTextByWeight(e.content,wt)}`);
      return parts.length?`[世界书${i+1}|${w.name}|权重:${wt}]\n${parts.join("\n")}`:"";
    }).filter(Boolean).join("\n\n") || "无";

    const user = `模式: ${mode==="random"?"随机":"按模板"}
严格只输出模板YAML，禁止输出角色卡/世界书原文。

角色上下文(仅用于约束，不可原样复述):
${role}

世界书(仅用于约束，不可原样复述):
${wbMerged}

关键词:
${kws.length?kws.join(", "):"无"}

模板输入:
${template}`;

    return [
      {role:"system",content:SYSTEM_PROMPT},
      {role:"user",content:user}
    ];
  }

  function sanitizeOutput(raw){
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

  async function generate(mode){
    const cfg=APIConfig.getActive();
    if(!cfg.base_url || !cfg.api_key || !cfg.model){ setTip("先在API设置填地址/密钥/模型"); return; }

    const payload={
      model:cfg.model,
      temperature:Number(cfg.temperature||0.75),
      max_tokens: 6000,
      messages:buildMessages(mode)
    };

    const useStream = cfg.stream_enabled !== false; // 默认开启流式
    UX.loading(mode==="random"?"随机生成人设中…（流式）":"按模板生成人设中…（流式）");
    let raw="";

    const finish=(text)=>{
      const cleaned=sanitizeOutput(text);
      resultOutput.value=cleaned || "";
      saveDraft();
      pushHistory({
        id:uuid(),
        time:now(),
        mode,
        model:cfg.model,
        preview:(cleaned||"").slice(0,200),
        result:cleaned||"",
        template:templateInput.value||"",
        keywords:parseKeywords().join(", "),
        roleContext:roleContextInput.value||""
      });
      UX.done(); setTip(useStream?"完成（流式）":"完成");
    };

    try{
      if(useStream){
        resultOutput.value="";
        try{
          await fetchChatStream(cfg.base_url,cfg.api_key,payload,(chunk)=>{
            raw+=chunk;
            resultOutput.value=raw;                 // 逐字追加
            resultOutput.scrollTop=resultOutput.scrollHeight;
          },null);
        }catch(streamErr){
          // 流式整体失败（含 SSE/网络问题）时，自动降级为一次性请求
          raw=await fetchChat(cfg.base_url,cfg.api_key,payload);
        }
      }else{
        raw=await fetchChat(cfg.base_url,cfg.api_key,payload);
      }
      if(!raw) throw new Error("返回为空");
      finish(raw);
    }catch(e){
      UX.done();
      resultOutput.value="生成失败：\n"+(e.message||e);
      UX.toast("生成失败："+(e.message||e),"error");
      setTip("失败");
    }
  }

  // file parse
  function decodeUTF8(bytes){ try{return new TextDecoder("utf-8").decode(bytes)}catch{return ""} }

  function parsePngTextChunks(buf){
    const u8=new Uint8Array(buf), sig=[137,80,78,71,13,10,26,10];
    for(let i=0;i<8;i++) if(u8[i]!==sig[i]) throw new Error("非PNG");
    let p=8, out=[];
    while(p<u8.length){
      const len=(u8[p]<<24)|(u8[p+1]<<16)|(u8[p+2]<<8)|u8[p+3]; p+=4;
      const type=String.fromCharCode(u8[p],u8[p+1],u8[p+2],u8[p+3]); p+=4;
      const data=u8.slice(p,p+len); p+=len; p+=4;
      if(type==="tEXt"){
        const z=data.indexOf(0);
        if(z>0) out.push({key:decodeUTF8(data.slice(0,z)), val:decodeUTF8(data.slice(z+1))});
      }else if(type==="iTXt"){
        let i=0; while(i<data.length&&data[i]!==0)i++; const key=decodeUTF8(data.slice(0,i)); i++;
        i++; i++; while(i<data.length&&data[i]!==0)i++; i++; while(i<data.length&&data[i]!==0)i++; i++;
        out.push({key, val:decodeUTF8(data.slice(i))});
      }
    }
    return out;
  }

  function toRoleContext(obj){
    const o=obj?.data||obj||{};
    const pick=(...keys)=>{for(const k of keys){if(o?.[k]) return o[k]} return ""};
    return [
      `name: ${pick("name","char_name","character_name")}`,
      `description: ${pick("description","desc")}`,
      `personality: ${pick("personality")}`,
      `scenario: ${pick("scenario")}`,
      `first_message: ${pick("first_mes","first_message")}`,
      `tags: ${Array.isArray(o.tags)?o.tags.join(", "):(o.tags||"")}`
    ].join("\n").trim();
  }

  function worldbookToText(obj){
    const x=obj?.data||obj||{};
    let entries=x.entries || x.worldbook?.entries || x.lorebook?.entries || [];
    if(!Array.isArray(entries) && typeof entries==="object") entries=Object.values(entries);
    if(Array.isArray(entries) && entries.length){
      return entries.map((e,i)=>{
        const keys=e.keys || e.key || e.primary_keys || [];
        const sec=e.secondary_keys || [];
        const content=e.content || e.entry || e.text || "";
        return `[Entry ${i+1}] keys:${Array.isArray(keys)?keys.join(", "):keys} sec:${Array.isArray(sec)?sec.join(", "):sec}\n${content}`;
      }).join("\n\n");
    }
    return JSON.stringify(obj).slice(0,15000);
  }

  async function parseRoleFile(file){
    const name=file.name.toLowerCase();
    if(name.endsWith(".json")){
      const txt=await file.text();
      const obj=JSON.parse(txt);
      roleContextInput.value=toRoleContext(obj); // 仅关键字段
      roleTip.textContent="角色JSON解析成功（仅关键字段）";
      saveDraft();
      return;
    }
    if(name.endsWith(".png")){
      const chunks=parsePngTextChunks(await file.arrayBuffer());
      let parsed=null;
      for(const c of chunks){
        const key=(c.key||"").toLowerCase(), val=(c.val||"").trim();
        if(!val) continue;
        if(key.includes("chara") || key.includes("char") || val.startsWith("{")){
          try{ parsed=JSON.parse(val); break; }catch{}
          try{
            const b=atob(val);
            const t=new TextDecoder("utf-8").decode(Uint8Array.from(b, ch=>ch.charCodeAt(0)));
            parsed=JSON.parse(t); break;
          }catch{}
        }
      }
      if(parsed){
        roleContextInput.value=toRoleContext(parsed);
        roleTip.textContent="角色PNG解析成功（仅关键字段）";
      }else{
        roleTip.textContent="PNG读取成功，但未识别标准角色字段";
      }
      saveDraft();
      return;
    }
    roleTip.textContent="仅支持JSON/PNG";
  }

  async function importWorldbookFiles(files){
    const arr=worldbooksGet().map(normalizeWb);
    for(const f of files){
      const n=f.name.toLowerCase();
      try{
        if(n.endsWith(".txt")||n.endsWith(".md")){
          arr.push({name:f.name,type:"text",weight:"mid",entries:[{key:f.name,content:(await f.text()).slice(0,20000),enabled:true}]});
        }else if(n.endsWith(".json")){
          const obj=JSON.parse(await f.text());
          arr.push({name:f.name,type:"json",weight:"mid",entries:extractWorldbookEntries(obj).map(e=>({...e,content:e.content.slice(0,20000)}))});
        }else if(n.endsWith(".png")){
          const chunks=parsePngTextChunks(await f.arrayBuffer());
          let wb=null;
          for(const c of chunks){
            const key=(c.key||"").toLowerCase(), val=(c.val||"").trim();
            if(!val) continue;
            if(key.includes("world")||key.includes("lore")||val.startsWith("{")){
              try{ wb=JSON.parse(val); break; }catch{}
              try{
                const b=atob(val);
                const t=new TextDecoder("utf-8").decode(Uint8Array.from(b, ch=>ch.charCodeAt(0)));
                wb=JSON.parse(t); break;
              }catch{}
            }
          }
          arr.push(wb
            ? {name:f.name,type:"png",weight:"mid",entries:extractWorldbookEntries(wb).map(e=>({...e,content:e.content.slice(0,20000)}))}
            : {name:f.name,type:"png",weight:"mid",entries:[{key:f.name,content:"（未识别标准世界书结构）",enabled:false}]});
        }
      }catch(e){
        arr.push({name:f.name,type:"error",weight:"mid",entries:[{key:"导入失败",content:"导入失败："+(e.message||e),enabled:false}]});
      }
    }
    worldbooksSet(arr);
    renderWorldbooks();
  }

  // init
  function initChips(){
    $("chips").innerHTML = KEYWORDS.map(k=>`<span class="glass-chip">${k}</span>`).join("");
    [...document.querySelectorAll("#chips .glass-chip")].forEach(el=>{
      el.onclick=()=>{
        const v=el.textContent;
        const arr=parseKeywords();
        if(!arr.includes(v)) arr.push(v);
        keywordsInput.value=arr.join(", ");
      };
    });
  }

  function initLoad(){
    templateInput.value=getLS(LS_DRAFT, DEFAULT_TEMPLATE)||DEFAULT_TEMPLATE;
    roleContextInput.value=getLS(LS_ROLECTX, "");
    resultOutput.value=getLS(LS_RESULT, "");
    ensurePresetSeed();
    renderGroupTabs();
    renderTagFilter();
    renderPresetList();
    renderWorldbooks();
    renderHistory();
  }

  // events
  $("btnRandom").onclick=()=>generate("random");
  $("btnGenerate").onclick=()=>generate("custom");

  $("btnCopy").onclick=async()=>{
    const txt=resultOutput.value||"";
    if(!txt) return setTip("没有可复制内容");
    try{ await navigator.clipboard.writeText(txt); setTip("已复制"); }catch{ setTip("复制失败"); }
  };

  $("btnExport").onclick=()=>{
    const txt=resultOutput.value||"";
    if(!txt) return setTip("没有可导出内容");
    const d=new Date(), p=n=>String(n).padStart(2,"0");
    const name=`persona_${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.txt`;
    const blob=new Blob([txt],{type:"text/plain;charset=utf-8"});
    const u=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u);
    setTip("已导出TXT");
  };

  $("btnClearResult").onclick=()=>{
    resultOutput.value="";
    saveDraft();
    setTip("结果已清空");
  };

  templateInput.addEventListener("input", saveDraft);
  roleContextInput.addEventListener("input", saveDraft);
  resultOutput.addEventListener("input", saveDraft);
  window.addEventListener("beforeunload", saveDraft);

  historySearch.oninput=renderHistory;
  historyModeFilter.onchange=renderHistory;
  $("btnClearHistory").onclick=()=>{ if(confirm("确定清空历史？")){ historySet([]); renderHistory(); } };

  $("roleFileInput").onchange=(e)=>{
    const f=e.target.files?.[0];
    if(f) parseRoleFile(f).catch(err=>roleTip.textContent="解析失败："+(err.message||err));
    e.target.value="";
  };

  $("btnParseRoleText").onclick=()=>{
    const t=(roleContextInput.value||"").trim();
    if(!t) return roleTip.textContent="角色文本为空";
    if(t.startsWith("{")){
      try{
        roleContextInput.value=toRoleContext(JSON.parse(t));
        roleTip.textContent="手动JSON解析成功（仅关键字段）";
        saveDraft();
        return;
      }catch{}
    }
    roleTip.textContent="已按纯文本使用";
    saveDraft();
  };

  $("worldbookFileInput").onchange=(e)=>{
    const files=[...(e.target.files||[])];
    if(files.length) importWorldbookFiles(files);
    e.target.value="";
  };

  $("btnClearWorldbooks").onclick=()=>{
    if(confirm("确定清空所有世界书？")){
      worldbooksSet([]);
      renderWorldbooks();
    }
  };

  initChips();
  initLoad();

  
}
