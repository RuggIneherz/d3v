/**
 * 创作工具箱 · 「从酒馆读取」纯逻辑单测（不需要浏览器）
 * 用法：node tests/source.test.mjs
 *
 * st-source.js 的格式化 / 合并函数不碰 DOM，可以直接在 Node 里跑；
 * 需要酒馆上下文的地方（角色卡列表、世界书）用替身 SillyTavern 顶上去。
 */
import {
    listStCharacters, readCharacterBlock, listStLorebooks, readLorebookBlock,
    currentStPersona, formatPersonaBlock, formatCharacterBlock, characterBookText,
    headerOf, splitBlocks, mergeContext,
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

const CHARACTERS = [
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
];

const WORLDS = {
    酒馆世界书: {
        entries: {
            0: { uid: 0, key: ['黑市'], content: '黑市只在雨夜开张。' },
            1: { uid: 1, key: ['禁忌'], content: '这条不该被读到', disable: true },
        },
    },
};

globalThis.SillyTavern = {
    getContext: () => ({
        characters: CHARACTERS,
        characterId: 0,
        getWorldInfoNames: () => Object.keys(WORLDS),
        loadWorldInfo: async (name) => WORLDS[name] || null,
        powerUserSettings: {
            personas: { 'user-old.png': '老人设', 'user-new.png': '新人设' },
            persona_descriptions: { 'user-old.png': { description: '我是一名古董修复师，三十七岁。', position: 0 } },
            default_persona: 'user-old.png',
        },
    }),
};

// --- 角色卡 ---------------------------------------------------------------
console.log('\n[1/5] 角色卡');
const list = listStCharacters();
ok('列出全部角色卡并标记当前角色', list.length === 2 && list[0].current && !list[1].current,
    JSON.stringify(list.map((c) => `${c.name}${c.current ? '(当前)' : ''}`)));
ok('标注角色卡有没有描述', list[0].hasDescription && !list[1].hasDescription);

const alice = readCharacterBlock(0);
ok('角色块带标题', alice.includes('【角色卡：爱丽丝】'), headerOf(alice));
ok('角色块含描述 / 性格 / 场景', alice.includes('钟表店') && alice.includes('耐心、话少') && alice.includes('深夜'));
ok('角色块含卡内世界书的启用条目', alice.includes('这条街的时间是倒着走的'));
ok('角色块不含被禁用的条目', !alice.includes('这条不该被读到'));
ok('没有描述的角色也能读出骨架', readCharacterBlock(1).includes('【角色卡：鲍勃】'));

// --- 世界书 ---------------------------------------------------------------
console.log('\n[2/5] 世界书');
ok('列出世界书名字', listStLorebooks().join(',') === '酒馆世界书');
const book = await readLorebookBlock('酒馆世界书');
ok('世界书块只含启用条目', book.ok && book.text.includes('黑市') && !book.text.includes('这条不该被读到'), book.message);
ok('世界书块带书名标题', headerOf(book.text) === '世界书：酒馆世界书');
const missing = await readLorebookBlock('不存在');
ok('读不到的世界书给出失败提示', !missing.ok && missing.message.length > 0, missing.message);

// --- 人设：有描述=优化，空=新写 -------------------------------------------
console.log('\n[3/5] 人设（优化 / 新写）');
const current = currentStPersona();
ok('读到酒馆当前人设', current.avatar === 'user-old.png' && current.description.includes('古董修复师'), current.name);
const optimize = formatPersonaBlock(current);
ok('有描述的人设走「优化模式」', headerOf(optimize) === '现有用户人设 · 优化模式' && optimize.includes('不要推翻重写'));
ok('优化模式把原有描述一起带上', optimize.includes('我是一名古董修复师'));
const fresh = formatPersonaBlock({ name: '新人设', description: '' });
ok('没有描述的人设走「新写」', headerOf(fresh) === '新建用户人设' && fresh.includes('新人设'));

// --- 合并：同标题覆盖、异标题共存 -----------------------------------------
console.log('\n[4/5] 上下文合并');
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

// --- 边界 ----------------------------------------------------------------
console.log('\n[5/5] 边界与降级');
ok('没有角色卡时返回空串', formatCharacterBlock(null) === '');
ok('角色卡没有卡内世界书时不留空段', !readCharacterBlock(1).includes('卡内世界书：'));
ok('超长字段会截断并标注', /已截断/.test(characterBookText({ entries: { 0: { key: ['x'], content: 'a'.repeat(4000) } } })),
    `${characterBookText({ entries: { 0: { key: ['x'], content: 'a'.repeat(4000) } } }).length} 字`);
globalThis.SillyTavern = { getContext: () => ({}) };
ok('酒馆接口缺失时安全降级（不吃异常）', listStCharacters().length === 0 && listStLorebooks().length === 0
    && currentStPersona().name === '（未设置）');

console.log('\n----------------------------------------');
if (failures.length) {
    console.log(`单测未通过：${passed} 通过 / ${failures.length} 失败`);
    for (const name of failures) console.log(`  · ${name}`);
    process.exitCode = 1;
} else {
    console.log(`单测通过：${passed}/${passed}`);
}
