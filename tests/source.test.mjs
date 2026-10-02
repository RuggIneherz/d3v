/**
 * 创作工具箱 · 「从酒馆读取」纯逻辑单测（不需要浏览器）
 * 用法：node tests/source.test.mjs
 *
 * st-source.js 的格式化 / 合并 / 落点函数不碰 DOM，可以直接在 Node 里跑；
 * 需要酒馆上下文的地方（角色卡列表、世界书）用替身 SillyTavern 顶上去，
 * 需要影子根的地方用一个假 host（带 shadowRoot.getElementById）。
 */
import {
    listStCharacters, readCharacterBlock, listStLorebooks, readLorebookBlock,
    currentStPersona, formatPersonaBlock, formatCharacterBlock, characterBookText,
    isShallowCharacter, ensureCharacterDetail, headerOf, splitBlocks, mergeContext,
    applyBlockToToolbox, loadPersonaToToolbox, readToolboxField,
    CONTEXT_FIELD, TEMPLATE_FIELD, RESULT_FIELD,
} from '../st-source.js';

let passed = 0;
const failures = [];

function ok(name, condition, extra = '') {
    if (condition) {
        passed++;
        console.log(`  ✓ ${name}${extra ? ` | ${extra}` : ''}`);
    } else {
        failures.push(name);
        console.log(`  ✗ ${name}${extra ? ` | ${extra}` : ''}`);
    }
}

/** 假影子根宿主：三个输入框，记录 input 事件次数 */
function fakeHost() {
    const fields = { [CONTEXT_FIELD]: { value: '', events: 0 }, [TEMPLATE_FIELD]: { value: '', events: 0 }, [RESULT_FIELD]: { value: '', events: 0 } };
    for (const field of Object.values(fields)) {
        field.dispatchEvent = (event) => { if (event?.type === 'input') field.events++; };
    }
    return { fields, host: { shadowRoot: { getElementById: (id) => fields[id] || null } } };
}

const FULL_CARDS = [
    {
        name: '爱丽丝',
        avatar: 'alice.png',
        description: '一座会说话的钟表店的店主。',
        personality: '耐心、话少',
        scenario: '深夜的钟表店',
        mes_example: '{{char}}: 时间还没到。',
        data: {
            system_prompt: '保持神秘感',
            character_book: {
                entries: {
                    0: { key: ['时间'], content: '这条街的时间是倒着走的。', enabled: true },
                    1: { key: ['秘密'], content: '这条不该被读到', disable: true },
                },
            },
        },
    },
    { name: '鲍勃', avatar: 'bob.png', description: '', personality: '爽快', data: {} },
    {
        name: 'V2 卡',
        avatar: 'v2.png',
        data: { description: '正文只写在 data 里的 V2 卡片。', personality: '冷淡' },
    },
];

/** 酒馆开了懒加载时的浅数据：只有名字 / 头像 */
function shallowCard(card) {
    return { shallow: true, name: card.name, avatar: card.avatar, chat: '', fav: false };
}

const WORLDS = {
    酒馆世界书: {
        entries: {
            0: { uid: 0, key: ['黑市'], content: '黑市只在雨夜开张。' },
            1: { uid: 1, key: ['禁忌'], content: '这条不该被读到', disable: true },
        },
    },
};

let shallowCalls = 0;
const state = {
    characters: FULL_CARDS.map(shallowCard),   // 一开始都是浅数据（模拟真实酒馆）
    characterId: 0,
};

globalThis.SillyTavern = {
    getContext: () => ({
        characters: state.characters,
        characterId: state.characterId,
        // 酒馆自己的展开接口：就地替换 characters[index]
        unshallowCharacter: async (index) => { shallowCalls++; state.characters[index] = FULL_CARDS[index]; },
        getCharacters: async () => state.characters,
        getWorldInfoNames: () => Object.keys(WORLDS),
        loadWorldInfo: async (name) => WORLDS[name] || null,
        powerUserSettings: {
            personas: { 'user-old.png': '老人设', 'user-new.png': '新人设' },
            persona_descriptions: { 'user-old.png': { description: '我是一名古董修复师，三十七岁。', position: 0 } },
            default_persona: 'user-old.png',
        },
    }),
};

// --- 懒加载（浅）角色卡 ---------------------------------------------------
console.log('\n[1/7] 懒加载角色卡');
const list = listStCharacters();
ok('列出全部角色卡并标记当前角色', list.length === 3 && list[0].current && !list[1].current,
    JSON.stringify(list.map((c) => `${c.name}${c.current ? '(当前)' : ''}`)));
ok('浅数据卡被标成「浅」（面板显示「点开读取」而不是「无描述」）', list.every((c) => c.shallow));
ok('浅数据卡不再冒充「有描述」', list.every((c) => !c.hasDescription));
ok('浅数据判定：只有名字/头像 → 浅', isShallowCharacter(shallowCard(FULL_CARDS[0])) && !isShallowCharacter(FULL_CARDS[0]));

// --- 角色卡：展开后读到正文 ------------------------------------------------
console.log('\n[2/7] 角色卡（展开 → 正文）');
const alice = await readCharacterBlock(0);
ok('读角色卡会先展开浅数据（调用酒馆 unshallowCharacter）', shallowCalls === 1, 'unshallow ×' + shallowCalls);
ok('展开后读到描述 / 性格 / 场景', alice.includes('【角色卡：爱丽丝】') && alice.includes('钟表店') && alice.includes('耐心、话少'));
ok('展开后读到卡内世界书的启用条目', alice.includes('这条街的时间是倒着走的'));
ok('不含被禁用的世界书条目', !alice.includes('这条不该被读到'));
ok('相同的完整卡不会重复展开', await (async () => { const before = shallowCalls; await ensureCharacterDetail(0); return shallowCalls === before; })());
ok('V2 卡片的正文从 data 里回退取到', (await readCharacterBlock(2)).includes('正文只写在 data 里的 V2 卡片'));
ok('没有描述的角色也能读出骨架', (await readCharacterBlock(1)).includes('【角色卡：鲍勃】'));

// --- 世界书 ---------------------------------------------------------------
console.log('\n[3/7] 世界书');
ok('列出世界书名字', listStLorebooks().join(',') === '酒馆世界书');
const book = await readLorebookBlock('酒馆世界书');
ok('世界书块只含启用条目', book.ok && book.text.includes('黑市') && !book.text.includes('这条不该被读到'), book.message);
ok('世界书块带书名标题', headerOf(book.text) === '世界书：酒馆世界书');
const missing = await readLorebookBlock('不存在');
ok('读不到的世界书给出失败提示', !missing.ok && missing.message.length > 0, missing.message);

// --- 人设：有描述=优化，空=新写 -------------------------------------------
console.log('\n[4/7] 人设（优化 / 新写）');
const current = currentStPersona();
ok('读到酒馆当前人设', current.avatar === 'user-old.png' && current.description.includes('古董修复师'), current.name);
const personaBlock = formatPersonaBlock(current);
ok('有描述的人设走「优化」', headerOf(personaBlock) === '现有用户人设 · 待优化' && personaBlock.includes('不要推翻重写'));
ok('优化块把原有描述一起带上', personaBlock.includes('我是一名古董修复师'));

const { fields, host } = fakeHost();
const loaded = loadPersonaToToolbox(host, current);
ok('读人设：正文进「人设模板」', loaded.ok && fields[TEMPLATE_FIELD].value.includes('我是一名古董修复师'), loaded.message);
ok('读人设：原描述进「结果」（覆盖式，方便直接改 / 复制）', fields[RESULT_FIELD].value === current.description);
ok('读人设：不再占用「角色上下文」', fields[CONTEXT_FIELD].value === '');
ok('落点会派发 input（让工具箱保存自己的草稿）',
    fields[TEMPLATE_FIELD].events === 1 && fields[RESULT_FIELD].events === 1);
ok('重复读同一人设不会在模板里堆叠', (() => {
    loadPersonaToToolbox(host, current);
    return fields[TEMPLATE_FIELD].value.split('【现有用户人设 · 待优化】').length === 2;
})());
const emptyPersona = loadPersonaToToolbox(host, { name: '新人设', description: '' });
ok('没有人设的描述时只给提示（走新写）', !emptyPersona.ok && emptyPersona.message.includes('新写'), emptyPersona.message);

// --- 角色卡 / 世界书 → 角色上下文 ------------------------------------------
console.log('\n[5/7] 素材落点');
const target = fakeHost();
const contextLoaded = await (async () => {
    const text = await readCharacterBlock(0);
    return applyBlockToToolbox(target.host, text);
})();
ok('角色卡进「角色上下文」', contextLoaded.ok && target.fields[CONTEXT_FIELD].value.includes('【角色卡：爱丽丝】'));
ok('角色卡不会污染「人设模板」', target.fields[TEMPLATE_FIELD].value === '');
const bookApplied = applyBlockToToolbox(target.host, book.text);
ok('世界书也能叠加进「角色上下文」', bookApplied.ok && target.fields[CONTEXT_FIELD].value.includes('【世界书：酒馆世界书】'));
ok('工具箱没挂载好时给出提示', !applyBlockToToolbox({ shadowRoot: null }, '【x】\ny').ok);

// --- 合并：同标题覆盖、异标题共存 -----------------------------------------
console.log('\n[6/7] 上下文合并');
const b1 = '【角色卡：爱丽丝】\n第一版';
const b2 = '【角色卡：爱丽丝】\n第二版';
const b3 = '【世界书：酒馆世界书】\n黑市';
ok('没有标题的手写内容也保留成一块', splitBlocks('我自己写的设定').length === 1);
const merged = mergeContext(mergeContext('我自己写的设定', b1), b2);
ok('同一标题只留一份（后者覆盖）', merged.split('【角色卡：爱丽丝】').length === 2 && merged.includes('第二版') && !merged.includes('第一版'));
ok('手写内容不会被吃掉', merged.startsWith('我自己写的设定'));
const both = mergeContext(merged, b3);
ok('不同标题的素材可以叠加', both.includes('【角色卡：爱丽丝】') && both.includes('【世界书：酒馆世界书】'));
ok('为空时不改动原内容', mergeContext('原文', '   ') === '原文');
ok('readToolboxField 能读回落点内容', readToolboxField(target.host, CONTEXT_FIELD).includes('黑市'));

// --- 边界 ----------------------------------------------------------------
console.log('\n[7/7] 边界与降级');
ok('没有角色卡时返回空串', formatCharacterBlock(null) === '');
ok('角色卡没有卡内世界书时不留空段', !(await readCharacterBlock(1)).includes('卡内世界书：'));
ok('超长字段会截断并标注', /已截断/.test(characterBookText({ entries: { 0: { key: ['x'], content: 'a'.repeat(4000) } } })),
    `${characterBookText({ entries: { 0: { key: ['x'], content: 'a'.repeat(4000) } } }).length} 字`);
globalThis.SillyTavern = { getContext: () => ({}) };
ok('酒馆接口缺失时安全降级（不吃异常）', listStCharacters().length === 0 && listStLorebooks().length === 0
    && currentStPersona().name === '（未设置）');
ok('没有 unshallowCharacter 时退回浅数据', await (async () => {
    globalThis.SillyTavern = { getContext: () => ({ characters: [{ shallow: true, name: 'X', avatar: 'x.png' }] }) };
    const text = await readCharacterBlock(0);
    globalThis.SillyTavern = { getContext: () => ({}) };
    return text.includes('【角色卡：X】');
})());

console.log('\n----------------------------------------');
if (failures.length) {
    console.log(`单测未通过：${passed} 通过 / ${failures.length} 失败`);
    for (const name of failures) console.log(`  · ${name}`);
    process.exitCode = 1;
} else {
    console.log(`单测通过：${passed}/${passed}`);
}
