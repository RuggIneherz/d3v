// ===================================================================
// 公共工具：DOM / 存储 / 全局提示 / 聊天请求（流式 + 非流式，含兜底）
// ===================================================================

export const $ = id => document.getElementById(id);

// 读取 localStorage：对象走 JSON；历史上有以裸字符串存储的键（草稿等），解析失败时原样返回
export const getLS = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    if (v == null) return d;
    try { return JSON.parse(v); } catch { return v; }
  } catch { return d; }
};
export const setLS = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
export const now = () => new Date().toLocaleString();
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export const normalizeUrl = u => (u || '').trim().replace(/\/+$/, '');

// OpenAI 风格 chat/completions 候选地址（自动兼容带 /v1 与不带 /v1）
export const chatUrls = base => {
  const b = normalizeUrl(base);
  if (!b) return [];
  if (b.endsWith('/v1')) return [`${b}/chat/completions`, `${b.slice(0, -3)}/v1/chat/completions`, `${b.slice(0, -3)}/chat/completions`];
  return [`${b}/v1/chat/completions`, `${b}/chat/completions`];
};
export const headers = key => {
  const h = { 'Content-Type': 'application/json' };
  if ((key || '').trim()) h.Authorization = `Bearer ${key.trim()}`;
  return h;
};

// ---------- 全局顶部提示（生成中 / 成功 / 失败） ----------
let toastEl = null;
const ensureToast = () => {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'uxToast';
    document.body.appendChild(toastEl);
  }
  return toastEl;
};
const escapeHtml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const UX = {
  toast(msg, type = '') {
    const el = ensureToast();
    el.className = 'show' + (type ? ' ' + type : '');
    el.innerHTML = escapeHtml(msg);
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.className = ''; }, type === 'error' ? 4200 : 2400);
  },
  loading(msg) {
    const el = ensureToast();
    el.className = 'show';
    el.innerHTML = `<span class="ux-spinner"></span><span>${escapeHtml(msg || '处理中…')}</span>`;
  },
  done() {
    const el = ensureToast();
    clearTimeout(el._timer);
    el.className = '';
  }
};

// ---------- 流式请求（SSE）；后端不支持流式 / 返回普通 JSON 时自动降级，绝不卡死 ----------
export async function fetchChatStream(baseUrl, apiKey, payload, onChunk, onDone, signal = null) {
  const urls = chatUrls(baseUrl);
  if (!urls.length) throw new Error('未配置 API 地址');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 分钟超时
  const finalSignal = signal || controller.signal;
  let lastErr = '';

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({ ...payload, stream: true }),
        signal: finalSignal
      });
      if (!resp.ok) { lastErr = `HTTP ${resp.status}`; continue; }

      const contentType = resp.headers.get('content-type') || '';
      // 兜底 1：服务端无视 stream 标志、直接返回普通 JSON
      if (contentType.includes('application/json')) {
        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content || data?.text || '';
        if (content) { onChunk && onChunk(content); onDone && onDone(); clearTimeout(timeoutId); return true; }
        lastErr = '返回为空';
        continue;
      }

      // 正常 SSE 流
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let readerDone = false;
      let gotAny = false;
      while (!readerDone) {
        const step = await reader.read();
        readerDone = step.done;
        if (step.value) {
          buffer += decoder.decode(step.value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data:')) {
              try {
                const json = JSON.parse(trimmed.slice(trimmed.startsWith('data: ') ? 6 : 5));
                const chunk = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content;
                if (chunk !== undefined && chunk !== null) { gotAny = true; onChunk && onChunk(chunk); }
              } catch { /* 忽略 SSE 噪声行 */ }
            }
          }
        }
      }
      clearTimeout(timeoutId);
      if (gotAny) { onDone && onDone(); return true; }
      lastErr = '流式返回为空';
    } catch (e) {
      lastErr = e?.name === 'AbortError' ? '请求超时' : (e.message || String(e));
    }
  }
  clearTimeout(timeoutId);
  throw new Error(lastErr || '所有流式请求均失败');
}

// ---------- 非流式请求（保留兼容；取名器 / 识图等一次性返回场景使用） ----------
export async function fetchChat(baseUrl, apiKey, payload) {
  const urls = chatUrls(baseUrl);
  if (!urls.length) throw new Error('未配置 API 地址');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  let lastErr = '';
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({ ...payload, stream: false }),
        signal: controller.signal
      });
      if (!resp.ok) { lastErr = `HTTP ${resp.status}`; continue; }
      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content || data?.text || '';
      if (content) { clearTimeout(timeoutId); return content; }
      lastErr = '返回为空';
    } catch (e) {
      lastErr = e?.name === 'AbortError' ? '请求超时' : (e.message || String(e));
    }
  }
  clearTimeout(timeoutId);
  throw new Error(lastErr || '请求失败');
}
