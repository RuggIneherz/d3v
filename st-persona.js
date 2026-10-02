/**
 * 创作工具箱 · 与酒馆人设（Persona）互通
 * ---------------------------------------------------------------------------
 * 读：列出酒馆里的人设（power_user.personas / persona_descriptions），并读回描述。
 * 写：把工具箱当前结果写进指定人设的描述，然后保存酒馆设置（saveSettingsDebounced）。
 * 只动 power_user.persona_descriptions[avatar].description，其余字段原样保留。
 */

function getCtx() {
    return globalThis.SillyTavern?.getContext?.() ?? null;
}

/** 列出酒馆现有的人设：{ avatar, name, description }[] */
export function listStPersonas() {
    const ctx = getCtx();
    const powerUser = ctx?.powerUserSettings;
    const personas = powerUser?.personas || {};
    const descriptions = powerUser?.persona_descriptions || {};
    const current = powerUser?.default_persona || '';
    return Object.entries(personas).map(([avatar, name]) => ({
        avatar,
        name: name || avatar,
        description: String(descriptions?.[avatar]?.description || ''),
        current: avatar === current,
    }));
}

/** 读取某个人设的描述 */
export function readStPersona(avatar) {
    const found = listStPersonas().find((p) => p.avatar === avatar);
    return found ? found.description : '';
}

/**
 * 把文本写进指定人设的描述。
 * @returns {{ok: boolean, message: string}}
 */
export function writeStPersona(avatar, text) {
    const ctx = getCtx();
    const powerUser = ctx?.powerUserSettings;
    if (!ctx || !powerUser) return { ok: false, message: '当前不在酒馆里，无法写入人设' };
    if (!avatar) return { ok: false, message: '没有选择要写入的人设' };
    if (!powerUser.personas?.[avatar]) return { ok: false, message: `找不到人设「${avatar}」` };
    const content = String(text || '').trim();
    if (!content) return { ok: false, message: '结果为空，没有可写入的内容' };

    const previous = powerUser.persona_descriptions?.[avatar] || {};
    powerUser.persona_descriptions = powerUser.persona_descriptions || {};
    powerUser.persona_descriptions[avatar] = { ...previous, description: content };
    try {
        ctx.saveSettingsDebounced?.();
    } catch (error) {
        return { ok: false, message: `保存失败：${error?.message || error}` };
    }
    return { ok: true, message: `已写入人设「${powerUser.personas[avatar]}」的描述` };
}

/** 从工具箱影子根里取当前标签页的结果文本（面板外壳调用） */
export function readToolboxResult(host) {
    const shadow = host?.shadowRoot;
    if (!shadow) return '';
    const active = shadow.querySelector('.tab-btn.active')?.dataset?.target;
    if (active === 'panel-persona') return shadow.getElementById('resultOutput')?.value || '';
    if (active === 'panel-name') return Array.from(shadow.querySelectorAll('#resultList .name')).map((x) => x.textContent.trim()).join('\n');
    if (active === 'panel-wardrobe') return shadow.getElementById('wdEditor')?.value || '';
    return '';
}
