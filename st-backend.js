/**
 * 创作工具箱 · SillyTavern 生成后端
 * ---------------------------------------------------------------------------
 * 把工具箱的生成请求接到「SillyTavern 此刻连接的模型」上，两条路径：
 *   1. 连接管理器（ST 1.12+ 内置）：用当前选中的连接配置发请求，支持流式；
 *   2. 兜底：ST 自带的 generateRaw（用主 API 设置，非流式）。
 * 工具箱里的「自定义 API」档案不受影响，两种后端随时可切换。
 */
import { insertToStInput } from './st-host.js';

const LOG_PREFIX = '[创作工具箱]';

function getCtx() {
    return globalThis.SillyTavern?.getContext?.() ?? null;
}

/** 给用户看的当前连接描述，例如「OpenAI · gpt-4o」 */
export function describeStConnection() {
    const ctx = getCtx();
    if (!ctx) return '';
    const cm = ctx.extensionSettings?.connectionManager;
    const profile = cm?.profiles?.find((p) => p.id === cm.selectedProfile);
    if (profile) return [profile.name || profile.api, profile.model].filter(Boolean).join(' · ');
    const oai = ctx.chatCompletionSettings;
    if (oai?.chat_completion_source) {
        const model = oai[`${oai.chat_completion_source}_model`] || oai.custom_model || '';
        return [oai.chat_completion_source, model].filter(Boolean).join(' · ');
    }
    return 'SillyTavern 当前 API';
}

function messagesOf(payload) {
    if (Array.isArray(payload?.messages) && payload.messages.length) return payload.messages;
    if (typeof payload?.prompt === 'string' && payload.prompt.trim()) return [{ role: 'user', content: payload.prompt }];
    return [];
}

function textOfContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.filter((p) => p?.type === 'text').map((p) => p.text).join('\n');
    return '';
}

/** 连接管理器路径 */
async function viaConnectionManager(ctx, payload, streaming) {
    const service = ctx.ConnectionManagerRequestService;
    const cm = ctx.extensionSettings?.connectionManager;
    const profileId = cm?.selectedProfile;
    if (!service || !profileId) return null;
    if (ctx.extensionSettings?.disabledExtensions?.includes('connection-manager')) return null;

    const messages = messagesOf(payload);
    const maxTokens = Number(payload?.max_tokens) || 1024;
    const override = {};
    if (typeof payload?.temperature === 'number') override.temperature = payload.temperature;

    if (!streaming) {
        const data = await service.sendRequest(profileId, messages, maxTokens, { stream: false }, override);
        return data?.content ?? '';
    }

    const generator = await service.sendRequest(
        profileId, messages, maxTokens,
        { stream: true, signal: streaming.signal ?? null },
        override,
    );

    // 流式：返回的是「调用后得到异步生成器」的函数
    if (typeof generator === 'function') {
        let got = false;
        for await (const chunk of generator()) {
            const text = chunk?.text ?? '';
            if (text) { got = true; streaming.onChunk?.(text); }
        }
        if (!got) throw new Error('SillyTavern 流式返回为空');
        streaming.onDone?.();
        return true;
    }

    // 服务端忽略了 stream，直接返回完整结果
    const text = generator?.content ?? '';
    if (!text) throw new Error('SillyTavern 返回为空');
    streaming.onChunk?.(text);
    streaming.onDone?.();
    return true;
}

/** 兜底路径：ST 主 API 设置 + generateRaw（非流式） */
async function viaGenerateRaw(ctx, payload, streaming) {
    if (typeof ctx.generateRaw !== 'function') return null;
    const messages = messagesOf(payload);
    const systemPrompt = messages.filter((m) => m.role === 'system').map((m) => textOfContent(m.content)).join('\n\n');
    const dialogue = messages
        .filter((m) => m.role !== 'system')
        .map((m) => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${textOfContent(m.content)}`)
        .join('\n\n');
    const text = await ctx.generateRaw({
        systemPrompt,
        prompt: dialogue,
        responseLength: Number(payload?.max_tokens) || 1024,
        trimNames: false,
    });
    if (!text) throw new Error('SillyTavern 返回为空');
    if (streaming) {
        streaming.onChunk?.(text);
        streaming.onDone?.();
        return true;
    }
    return text;
}

async function generate(payload, streaming) {
    const ctx = getCtx();
    if (!ctx) throw new Error('未检测到 SillyTavern 上下文');

    let result = null;
    try {
        result = await viaConnectionManager(ctx, payload, streaming);
    } catch (error) {
        console.debug(LOG_PREFIX, '连接管理器路径失败，尝试 generateRaw', error);
    }
    if (result !== null) return result;

    result = await viaGenerateRaw(ctx, payload, streaming);
    if (result !== null) return result;

    throw new Error('SillyTavern 没有可用的生成接口（连接管理器未选择配置，且 generateRaw 不可用）');
}

/** 生成给工具箱注入的后端实现 */
export function createStBackend() {
    return {
        label: describeStConnection() || 'SillyTavern 当前 API',
        chat: (payload) => generate(payload, null),
        chatStream: (payload, onChunk, onDone, signal) => generate(payload, { onChunk, onDone, signal }),
        insertToInput: insertToStInput,
    };
}
