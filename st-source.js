/**
 * 创作工具箱 · 从 SillyTavern 读取素材
 * ---------------------------------------------------------------------------
 * 把酒馆里的**角色卡**（含卡内世界书）、**世界书**、**我的人设**整理成一段
 * 「角色上下文」文本，填进工具箱的 `#roleContextInput` —— 生成时按工具箱
 * 原有提示词作为约束参与（系统提示里已写明"仅用于约束，不可原样复述"）。
 *
 * 只读：不会改动酒馆的任何数据。格式化与合并都是纯函数，便于单独测试。
 * 取不到的接口一律安全降级（返回空 / 给出提示），不会让扩展抛错。
 */

const MAX_FIELD = 2400;      // 单个字段上限
const MAX_BLOCK = 9000;      // 单个素材块上限
const MAX_ENTRY = 600;       // 世界书单条目上限
const MAX_BOOK = 3000;       // 卡内世界书整体上限

/** 酒馆上下文（非酒馆环境返回 null） */
export function getStContext() {
    try {
        return globalThis.SillyTavern?.getContext?.() ?? null;
    } catch {
        return null;
    }
}

function clip(text, max = MAX_FIELD) {
    const value = String(text ?? '').trim();
    if (!value) return '';
    return value.length > max ? `${value.slice(0, max)}…（已截断）` : value;
}

/** 一段素材：`【标题】` + 正文 */
export function block(header, body) {
    const content = clip(body, MAX_BLOCK);
    return content ? `【${header}】\n${content}` : '';
}

function fieldLine(label, value, max = MAX_FIELD) {
    const text = clip(value, max);
    return text ? `${label}：\n${text}` : '';
}

/** 卡内世界书（V2 角色卡的 character_book）→ 文本 */
export function characterBookText(book) {
    const entries = Object.values(book?.entries || {});
    const parts = entries.filter(isEntryEnabled).map((entry) => {
        const key = entryKey(entry);
        return `- [${key}]\n${clip(entry?.content, MAX_ENTRY)}`;
    }).filter(Boolean);
    return clip(parts.join('\n'), MAX_BOOK);
}

function isEntryEnabled(entry) {
    if (!entry) return false;
    if (entry.enabled === false) return false;
    return entry.disable !== true;
}

function entryKey(entry) {
    const keys = Array.isArray(entry?.key) ? entry.key : [entry?.key];
    const text = keys.filter(Boolean).join(' / ');
    return text || entry?.comment || '无关键词';
}

/**
 * 角色卡 → 一段上下文文本（只取关键字段，不整卡粘贴）
 * @param {object} char SillyTavern 的 characters[i]
 */
export function formatCharacterBlock(char) {
    if (!char) return '';
    const data = char.data || {};
    const body = [
        fieldLine('名称', char.name, 200),
        fieldLine('描述', char.description),
        fieldLine('性格', char.personality),
        fieldLine('场景', char.scenario),
        fieldLine('对话示例', char.mes_example, 900),
        fieldLine('系统提示', data.system_prompt, 900),
        fieldLine('历史后指令', data.post_history_instructions, 600),
        fieldLine('卡内世界书', characterBookText(char.character_book || data.character_book), MAX_BOOK),
    ].filter(Boolean).join('\n\n');
    return block(`角色卡：${char.name || '未命名'}`, body);
}

/** 列出酒馆角色卡：{ index, name, current, hasDescription }[] */
export function listStCharacters() {
    const ctx = getStContext();
    const list = Array.isArray(ctx?.characters) ? ctx.characters : [];
    return list.map((char, index) => ({
        index,
        name: char?.name || `角色${index + 1}`,
        current: String(index) === String(ctx?.characterId),
        hasDescription: !!String(char?.description || '').trim(),
    }));
}

/**
 * 刚打开的酒馆会话（还没选角色卡）里 `characters` 是空的，
 * 需要主动调一次酒馆自己的 `getCharacters()` 把列表拉起来（它就地填充同一个数组）。
 * @returns {Promise<boolean>} 是否真的拉到了角色卡
 */
export async function ensureStCharacters() {
    const ctx = getStContext();
    if (Array.isArray(ctx?.characters) && ctx.characters.length) return true;
    if (typeof ctx?.getCharacters !== 'function') return false;
    try {
        await ctx.getCharacters();
    } catch {
        return false;
    }
    return (getStContext()?.characters || []).length > 0;
}

/** 读某张角色卡（按下标），返回可直接填入上下文的文本 */
export function readCharacterBlock(index) {
    const char = getStContext()?.characters?.[index];
    return formatCharacterBlock(char);
}

/** 列出酒馆世界书的名字 */
export function listStLorebooks() {
    const ctx = getStContext();
    try {
        const names = ctx?.getWorldInfoNames?.();
        if (Array.isArray(names)) return names.filter((name) => !!String(name || '').trim());
    } catch { /* 降级到空列表 */ }
    return [];
}

/**
 * 读一本世界书（`loadWorldInfo` 在酒馆里是异步的）→ 只取启用中的条目
 * @returns {Promise<{ok: boolean, text: string, message: string}>}
 */
export async function readLorebookBlock(name) {
    const ctx = getStContext();
    if (!ctx?.loadWorldInfo) return { ok: false, text: '', message: '当前酒馆版本没有开放世界书接口' };
    let data = null;
    try {
        data = await ctx.loadWorldInfo(name);
    } catch (error) {
        return { ok: false, text: '', message: `读取失败：${error?.message || error}` };
    }
    const entries = Object.values(data?.entries || {});
    const parts = entries.filter(isEntryEnabled).map((entry) => `- [${entryKey(entry)}]\n${clip(entry?.content, MAX_ENTRY)}`);
    if (!parts.length) return { ok: false, text: '', message: `世界书「${name}」里没有启用中的条目` };
    return { ok: true, text: block(`世界书：${name}`, parts.join('\n')), message: '' };
}

/** 酒馆当前人设（侧边栏里选中的那个） */
export function currentStPersona() {
    const powerUser = getStContext()?.powerUserSettings;
    const avatar = powerUser?.default_persona || '';
    return {
        avatar,
        name: powerUser?.personas?.[avatar] || avatar || '（未设置）',
        description: String(powerUser?.persona_descriptions?.[avatar]?.description || ''),
    };
}

/**
 * 人设 → 上下文文本：**已有描述走"优化"，没有描述走"新写"**
 * @param {{name?: string, description?: string}} persona
 */
export function formatPersonaBlock(persona) {
    const name = persona?.name || '（未命名）';
    const description = String(persona?.description || '').trim();
    if (!description) {
        return block('新建用户人设', `酒馆人设「${name}」还没有描述，请按模板从零写一份用户人设（可结合上文已读入的角色卡 / 世界书）。`);
    }
    return block('现有用户人设 · 优化模式',
        '请在下面这份已有设定的基础上优化：保留既有设定与信息，补全缺失字段、细化模糊描述、消除矛盾，不要推翻重写。\n'
        + `酒馆人设名称：${name}\n\n${clip(description, 6000)}`);
}

/* ═══════════════ 填进工具箱：按块「有则替换、无则追加」 ═══════════════ */

/** 取一段素材的标题（`【标题】`），没有则为空串 */
export function headerOf(text) {
    const match = /^【([^】]{1,40})】/m.exec(String(text || '').trim());
    return match ? match[1] : '';
}

/** 把上下文文本切成素材块（没有标题的手写内容也会原样保留成一块） */
export function splitBlocks(text) {
    return String(text || '').split(/\n{2,}(?=【)/).map((part) => part.trim()).filter(Boolean);
}

/** 同一标题的素材只保留一份（后读到的覆盖先前的），其余原样保留 */
export function mergeContext(current, incoming) {
    const addition = String(incoming || '').trim();
    if (!addition) return String(current || '');
    const key = headerOf(addition);
    const kept = splitBlocks(current).filter((part) => !key || headerOf(part) !== key);
    kept.push(addition);
    return kept.join('\n\n');
}

/**
 * 把素材写进工具箱的「角色上下文」。
 * 派发 input 事件是为了让工具箱自己保存草稿（它监听的就是 input）。
 * @param {HTMLElement} host 工具箱影子宿主
 * @param {string} text 素材块
 */
export function applyBlockToToolbox(host, text) {
    const field = host?.shadowRoot?.getElementById('roleContextInput');
    if (!field) return { ok: false, message: '工具箱还没挂载好，稍等一下再点一次' };
    const incoming = String(text || '').trim();
    if (!incoming) return { ok: false, message: '没有读到可用的内容' };
    field.value = mergeContext(field.value, incoming);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const title = headerOf(incoming) || '素材';
    return { ok: true, message: `已填入「角色上下文」：${title} —— 接着点「按模板生成」` };
}

/** 读回工具箱当前的角色上下文（仅用于测试与调试） */
export function readToolboxContext(host) {
    return host?.shadowRoot?.getElementById('roleContextInput')?.value || '';
}
