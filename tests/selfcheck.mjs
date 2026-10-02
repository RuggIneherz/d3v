/**
 * 创作工具箱 SillyTavern 扩展 · 静态自检
 * 用法：node tests/selfcheck.mjs        （在扩展根目录执行）
 *
 * 检查内容：
 *   1. manifest.json 是否合法、必填字段是否齐全、js/css 指向的文件是否存在；
 *   2. index.html / index.js / st-style.css 里引用的本地资源是否都存在；
 *   3. 模拟 SillyTavern 的 URL 规则，打印各资源的最终访问地址；
 *   4. index.js 中 `../../../extensions.js` 是否能解析到 /scripts/extensions.js。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

/** 递归列出目录下的文件（相对 root 的 posix 路径） */
function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) out.push(...walk(rel));
        else out.push(rel);
    }
    return out;
}

function check(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`);
    } else {
        problems.push(message);
        console.log(`  ✗ ${message}`);
    }
}

// --- 1. manifest -----------------------------------------------------------
console.log('\n[1/4] manifest.json');
let manifest = null;
try {
    manifest = JSON.parse(read('manifest.json'));
    check(true, 'manifest.json 是合法 JSON');
} catch (error) {
    check(false, `manifest.json 解析失败：${error.message}`);
}
if (manifest) {
    for (const field of ['display_name', 'js', 'css', 'author', 'version']) {
        check(typeof manifest[field] === 'string' && manifest[field].length > 0, `必填字段 ${field} = ${JSON.stringify(manifest[field])}`);
    }
    check(!Array.isArray(manifest.requires) || manifest.requires.length === 0, "requires 为空（不依赖 Extras 模块）");
    if (manifest.js) check(exists(manifest.js), `入口脚本存在：${manifest.js}`);
    if (manifest.css) check(exists(manifest.css), `样式文件存在：${manifest.css}`);
    if (manifest.minimum_client_version) notes.push(`minimum_client_version = ${manifest.minimum_client_version}`);
    if (manifest.auto_update) notes.push('auto_update = true（ST 扩展面板可一键 git pull 更新）');

    // 版本号两处必须一致：manifest.json（ST 扩展列表显示）与 st-host.js（面板徽标）
    const hostSource = read('st-host.js');
    const versionMatch = /EXT_VERSION\s*=\s*'([^']+)'/.exec(hostSource);
    check(!!versionMatch, 'st-host.js 里能找到 EXT_VERSION');
    check(versionMatch?.[1] === manifest.version, `EXT_VERSION (${versionMatch?.[1]}) 与 manifest.version (${manifest.version}) 一致`);
}

// --- 2. 资源引用 -----------------------------------------------------------
console.log('\n[2/4] 本地资源引用');
const html = read('index.html');
const refs = new Set();
for (const match of html.matchAll(/(?:src|href)="(?!https?:|data:|#|\/\/)([^"]+)"/g)) refs.add(match[1]);
for (const ref of refs) check(exists(ref), `index.html → ${ref}`);

const css = read('st-style.css');
check(!/url\(\s*['"]?(?!data:)/.test(css), 'st-style.css 没有引用外部图片（纯 CSS）');

const jsFiles = fs.readdirSync(root).filter((f) => f.endsWith('.js'));
for (const file of walk('js')) {
    if (file.endsWith('.js')) jsFiles.push(file);
}
for (const file of jsFiles) {
    const code = read(file);
    for (const match of code.matchAll(/from\s+'(\.{1,2}\/[^']+)'/g)) {
        const target = path.normalize(path.join(path.dirname(file), match[1]));
        check(exists(target), `${file} → import ${match[1]}`);
    }
}
check(exists('index.html'), 'index.js 通过 new URL(\'./index.html\') 指向的页面存在：index.html');

// --- 3. URL 模拟 -----------------------------------------------------------
console.log('\n[3/4] SillyTavern 访问地址（假设扩展目录名为 d3v）');
const extBase = '/scripts/extensions/third-party/d3v/';
console.log(`  扩展根：${extBase}`);
console.log(`  入口脚本：${extBase}${manifest?.js ?? 'index.js'}`);
console.log(`  样式文件：${extBase}${manifest?.css ?? 'st-style.css'}`);
console.log(`  工具箱页面：${extBase}index.html`);
console.log(`  页面内模块：${extBase}js/main.js → js/utils.js / js/modules/*.js`);
check(exists('index.html'), 'index.html 位于扩展根目录（ST 静态路由可直接访问）');

// --- 4. ST 模块解析 --------------------------------------------------------
console.log('\n[4/4] SillyTavern 内部模块解析');
const moduleUrl = `http://127.0.0.1:8000${extBase}index.js`;
const resolved = new URL('../../../extensions.js', moduleUrl).pathname;
check(resolved === '/scripts/extensions.js', `../../../extensions.js → ${resolved}（期望 /scripts/extensions.js）`);

// --- 汇总 -----------------------------------------------------------------
console.log('\n----------------------------------------');
if (notes.length) {
    console.log('提示：');
    for (const note of notes) console.log(`  · ${note}`);
}
if (problems.length) {
    console.log(`\n自检未通过：${problems.length} 项问题`);
    process.exitCode = 1;
} else {
    console.log('\n自检通过：manifest、资源引用与 ST 路径解析均正常。');
}
