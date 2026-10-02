// ===================================================================
// 取名器 · 生成流程：模型请求 / 本地批量 / 模型与本地混合 / 排序 / 历史入库
// ===================================================================
import { fetchChat, UX, now, apiReadyFor } from '../../utils.js';
import { APIConfig } from '../../api-config.js';
import { CULT_MODES } from './data.js';
import { getBan, hitBanWord, hitBanChar, appendHistory, saveOpts } from './state.js';
import { buildBanDesc, buildPrompt, buildPayload } from './prompt.js';
import { parseModelNames } from './parse.js';
import { validateOpt, makeBatchLocal, rankAndSelect } from './core.js';

// 取名器结果为短列表：统一收集完整响应后一次性解析（非流式）
async function aiGenerate(opt){
  const cfg=APIConfig.getActive();
  if(!apiReadyFor(cfg)) return null;

  const payload=buildPayload(cfg,buildPrompt(opt,buildBanDesc(getBan())));

  try{
    const txt=await fetchChat(cfg.base_url,cfg.api_key,payload);
    if(txt){
      const arr=parseModelNames(txt).filter(x=>!hitBanWord(x)&&!hitBanChar(x));
      if(arr.length) return arr;
    }
  }catch{}
  return null;
}

function shouldUseAI(opt,apiReady){
  if(opt.engine==="ai") return true;
  return opt.engine==="auto" && apiReady && (opt.worldview!=="all" || opt.customWorldText || CULT_MODES.has(opt.mode));
}

function mixAiBatch(ai,local,batchCount){
  const aiTake=Math.max(1,Math.floor(batchCount*0.35));
  return [...ai.slice(0,aiTake), ...local].slice(0,batchCount);
}

// 候选池：走模型时取 35% 模型结果，其余由本地补齐
async function buildBatch(opt){
  const apiReady=apiReadyFor(APIConfig.getActive());
  let batch=[], usedAI=false;
  if(shouldUseAI(opt,apiReady)){
    const ai=await aiGenerate(opt);
    if(ai && ai.length){
      const local=makeBatchLocal(opt);
      batch=mixAiBatch(ai,local,opt.batchCount);
      usedAI=true;
    }
  }
  if(!batch.length) batch=makeBatchLocal(opt);
  return {names:batch,usedAI};
}

export function createFlow(ui){
  const onThresholdDrop=thr=>ui.setTip(`高分不足，阈值自动降至 ${thr}`);

  async function generateFlow(){
    const opt=ui.collectOpt();
    const err=validateOpt(opt);
    if(err) return ui.setTip(err);

    saveOpts({
      surnamePack:opt.surnamePack,fixedSurname:opt.fixedSurname,lockSurname:opt.lockSurname,
      enWithSurname:opt.enWithSurname,enLastPack:opt.enLastPack
    });

    UX.loading("取名生成中…");
    const batch=await buildBatch(opt);
    const finalRows=rankAndSelect(opt,batch.names,onThresholdDrop);
    ui.renderResults(finalRows);

    appendHistory({
      time:now(), mode:opt.mode, style:opt.style, worldview:opt.worldview, era:opt.era, gender:opt.gender,
      ai:batch.usedAI, names:finalRows.map(x=>x.name)
    });
    ui.renderHistory();

    UX.done(); ui.setTip(batch.usedAI?"完成（AI+本地）":"完成（本地）");
  }

  return {generateFlow};
}
