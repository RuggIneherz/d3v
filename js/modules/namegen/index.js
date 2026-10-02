// ===================================================================
// 取名器面板 · 装配入口
//   只负责把视图层、生成流程与事件绑定串起来，业务细节在各自模块内
// ===================================================================
import { createUI, initPanel } from './render.js';
import { createFlow } from './flow.js';
import { bindEvents } from './events.js';

export function initNameGen() {
  const ui = createUI();
  const flow = createFlow(ui);
  bindEvents(ui, flow);
  initPanel(ui);
}
