// ===================================================================
// 共享 API 配置：多份配置档案 + 流式开关（stream_enabled，默认开启）
// ===================================================================
import { getLS, setLS, uuid } from './utils.js';

const LS_PROFILES = 'shared_api_profiles_v1';
const LS_ACTIVE = 'shared_api_active_v1';

function blankProfile(name) {
  return {
    id: uuid(),
    name: name || '默认配置',
    base_url: '',
    api_key: '',
    model: '',
    temperature: 0.75,
    vision_backup_base_url: '',
    vision_backup_key: '',
    vision_backup_model: '',
    stream_enabled: true // 流式输出默认开启，可在 API 设置弹窗中关闭
  };
}

export const APIConfig = {
  getProfiles() {
    let list = getLS(LS_PROFILES, null);
    if (!Array.isArray(list) || !list.length) {
      list = [blankProfile('默认配置')];
      setLS(LS_PROFILES, list);
    } else {
      // 兼容旧档案：补齐缺失字段（含流式开关）
      list = list.map(p => ({ ...blankProfile(), ...p }));
    }
    return list;
  },
  saveProfiles(list) { setLS(LS_PROFILES, list); },
  getActiveId() {
    const list = this.getProfiles();
    let id = getLS(LS_ACTIVE, null);
    if (!id || !list.find(p => p.id === id)) {
      id = list[0].id;
      setLS(LS_ACTIVE, id);
    }
    return id;
  },
  setActiveId(id) { setLS(LS_ACTIVE, id); },
  getActive() {
    const list = this.getProfiles(), id = this.getActiveId();
    return list.find(p => p.id === id) || list[0];
  },
  updateActive(fields) {
    const list = this.getProfiles(), id = this.getActiveId();
    const idx = list.findIndex(p => p.id === id);
    if (idx >= 0) { list[idx] = { ...list[idx], ...fields }; this.saveProfiles(list); }
  },
  addProfile(name) {
    const list = this.getProfiles();
    const p = blankProfile(name || `配置${list.length + 1}`);
    list.push(p);
    this.saveProfiles(list);
    this.setActiveId(p.id);
    return p;
  },
  renameActive(name) {
    const list = this.getProfiles(), id = this.getActiveId();
    const idx = list.findIndex(p => p.id === id);
    if (idx >= 0 && name) list[idx].name = name;
    this.saveProfiles(list);
  },
  deleteActive() {
    let list = this.getProfiles();
    if (list.length <= 1) return false;
    const id = this.getActiveId();
    list = list.filter(p => p.id !== id);
    this.saveProfiles(list);
    this.setActiveId(list[0].id);
    return true;
  }
};
