// OpenAI-compatible image client (new-api / one-api / OpenAI direct).
// Base URL is locked to the platform deployment (Sparkcode multimedia
// platform by default). Override via env at build time:
//   NEXT_PUBLIC_NEWAPI_BASE_URL=https://your-relay.example/v1
//
// All entry points take an explicit `apiKey` so the caller (provider.js)
// can dispatch per-model to the right user key from the multi-key store.

const PLATFORM_DEFAULT_BASE_URL = 'https://api.sparkcode.top/v1';

export function getBaseUrl() {
    // process.env.NEXT_PUBLIC_* is inlined at build time by Next.js, so this
    // works in both server and browser bundles.
    const fromEnv = (typeof process !== 'undefined'
        && process.env
        && process.env.NEXT_PUBLIC_NEWAPI_BASE_URL) || '';
    const url = fromEnv || PLATFORM_DEFAULT_BASE_URL;
    return url.replace(/\/+$/, '');
}

// Map a UI aspect ratio to a `size` string accepted by OpenAI's Images API.
// - gpt-image-1+ accepts 'auto' as a sentinel meaning "model picks".
// - dall-e-2 / dall-e-3 do NOT accept 'auto'; they require an explicit size,
//   so we fall back to 1024x1024 / supported landscape / portrait pairs.
function aspectToSize(aspect, model) {
    const isDalle = /^dall-e/i.test(model || '');
    const a = aspect || 'auto';
    switch (a) {
        case '1:1':  return '1024x1024';
        case '16:9':
        case '4:3':  return isDalle ? '1792x1024' : '1536x1024';
        case '9:16':
        case '3:4':  return isDalle ? '1024x1792' : '1024x1536';
        case 'auto':
        default:     return isDalle ? '1024x1024' : 'auto';
    }
}

async function parseError(response) {
    const text = await response.text();
    try {
        const obj = JSON.parse(text);
        const msg = obj?.error?.message || obj?.message || text;
        return new Error(`new-api ${response.status}: ${msg}`);
    } catch (_e) {
        return new Error(`new-api ${response.status}: ${text.slice(0, 200)}`);
    }
}

function dataUrlToBlob(dataUrl) {
    const [meta, b64] = dataUrl.split(',');
    const mimeMatch = meta.match(/data:([^;]+);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

async function urlOrDataToBlob(value) {
    if (typeof value !== 'string') return value; // assume already a Blob/File
    if (value.startsWith('data:')) return dataUrlToBlob(value);
    // Remote URL — fetch then convert to Blob. Cross-origin URLs without CORS
    // headers will throw a TypeError ("Failed to fetch"); surface a clearer
    // message so the user knows to re-upload the file instead of clicking
    // "use as reference" on a remote-hosted image.
    let res;
    try {
        res = await fetch(value);
    } catch (err) {
        throw new Error(
            'Cannot reuse this image as a reference (CORS blocked). ' +
            'Download the image and re-upload it instead.'
        );
    }
    if (!res.ok) throw new Error(`Failed to fetch reference image: ${res.status}`);
    return await res.blob();
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

// Pass model-family-specific knobs through new-api's `extra_fields` passthrough.
// We deliberately do NOT include aspect_ratio here — it is already encoded in
// the standard `size` field via aspectToSize(). Whether the upstream model
// honors `extra_fields` depends on the channel config (PassThroughBodyEnabled
// or the upstream's own parsing); see provider.js docs.
function buildExtraFields(params) {
    const extra = {};
    if (params.resolution) extra.resolution = params.resolution;
    if (params.quality && !['auto', 'standard', 'hd', 'high', 'medium', 'low'].includes(params.quality)) {
        extra.quality = params.quality;
    }
    if (params.seed !== undefined && params.seed !== -1 && params.seed !== null) {
        extra.seed = params.seed;
    }
    return Object.keys(extra).length > 0 ? extra : undefined;
}

function normalizeImageResponse(json) {
    // OpenAI-shaped: { data: [{url, b64_json, revised_prompt}], created }
    const first = json?.data?.[0];
    if (!first) {
        throw new Error('new-api response missing data[0]');
    }
    let url = first.url;
    if (!url && first.b64_json) {
        url = `data:image/png;base64,${first.b64_json}`;
    }
    if (!url) {
        throw new Error('new-api response missing url and b64_json');
    }
    return {
        url,
        id: json.id || `${json.created || Date.now()}`,
        revised_prompt: first.revised_prompt,
        raw: json,
    };
}

// Models whose image output is delivered through /v1/chat/completions instead
// of /v1/images/generations. new-api's gemini adapter explicitly rejects any
// non-`imagen-*` model on the images endpoint, so gemini-*-image / nano-banana
// MUST go through chat-completions and embed the image as a markdown / inline
// data URL inside the assistant message content.
function isChatImageModel(model) {
    if (!model) return false;
    const m = model.toLowerCase();
    if (m.includes('nano-banana')) return true;
    // gemini-*-image, gemini-*-image-preview, gemini-2.5-flash-image, etc.
    if (/gemini[-.\d]*.*image/.test(m)) return true;
    return false;
}

// Pull the first base64 image data URL out of an OpenAI-shaped chat response.
// new-api's responseGeminiChat2OpenAI wraps inline image parts as either
// `![image](data:<mime>;base64,<...>)` markdown or `[media](data:<mime>;base64,<...>)`.
// We tolerate either, plus a bare data URL embedded anywhere in the text.
function extractImageFromChat(json) {
    const choices = json?.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
        throw new Error('new-api chat response: no choices returned (upstream may be out of credits or rate-limited)');
    }
    const msg = choices[0]?.message;
    let content = msg?.content;
    if (Array.isArray(content)) {
        // Some upstream variants return a parts array. Find an image_url part.
        for (const part of content) {
            if (part?.type === 'image_url' && part?.image_url?.url) {
                return part.image_url.url;
            }
            if (typeof part?.text === 'string') {
                const m = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/.exec(part.text);
                if (m) return m[0];
            }
        }
    }
    if (typeof content === 'string') {
        const m = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/.exec(content);
        if (m) return m[0];
        // Plain text reply with no image — likely a safety refusal or text-only fallthrough.
        const snippet = content.trim().slice(0, 160) || '(empty)';
        throw new Error(`Model returned no image. Response: ${snippet}`);
    }
    throw new Error('Chat response has no extractable image content');
}

async function generateImageViaChat(apiKey, params, referenceImages) {
    const baseUrl = getBaseUrl();
    const userParts = [];
    if (params.prompt) {
        userParts.push({ type: 'text', text: params.prompt });
    }
    if (Array.isArray(referenceImages) && referenceImages.length > 0) {
        for (const ref of referenceImages) {
            // ref is a string: either data:URL (preferred) or remote URL.
            // The chat API accepts both shapes inside image_url.url.
            userParts.push({ type: 'image_url', image_url: { url: ref } });
        }
    }
    const body = {
        model: params.model,
        messages: [
            { role: 'user', content: userParts.length > 1 ? userParts : (params.prompt || '') },
        ],
        modalities: ['image', 'text'],
        stream: false,
    };
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw await parseError(response);
    const json = await response.json();
    const url = extractImageFromChat(json);
    return {
        url,
        id: json.id || `${json.created || Date.now()}`,
        revised_prompt: undefined,
        raw: json,
    };
}

export async function generateImage(apiKey, params) {
    if (isChatImageModel(params.model)) {
        return generateImageViaChat(apiKey, params, null);
    }
    const baseUrl = getBaseUrl();
    const body = {
        model: params.model,
        prompt: params.prompt,
        n: 1,
        size: aspectToSize(params.aspect_ratio, params.model),
    };
    // gpt-image-1+ accepts these directly; dall-e-3 also accepts quality
    if (['standard', 'hd', 'high', 'medium', 'low', 'auto'].includes(params.quality)) {
        body.quality = params.quality;
    }
    const extra = buildExtraFields(params);
    if (extra) body.extra_fields = extra;

    const response = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw await parseError(response);
    return normalizeImageResponse(await response.json());
}

export async function generateI2I(apiKey, params) {
    const images = params.images_list?.length > 0
        ? params.images_list
        : (params.image_url ? [params.image_url] : []);
    if (images.length === 0) {
        throw new Error('No reference image provided for image-to-image');
    }

    if (isChatImageModel(params.model)) {
        // chat/completions accepts the data URL directly in image_url; no
        // multipart conversion needed.
        return generateImageViaChat(apiKey, params, images);
    }

    const baseUrl = getBaseUrl();
    const form = new FormData();
    form.append('model', params.model);
    if (params.prompt) form.append('prompt', params.prompt);
    form.append('n', '1');
    form.append('size', aspectToSize(params.aspect_ratio, params.model));

    if (['standard', 'hd', 'high', 'medium', 'low', 'auto'].includes(params.quality)) {
        form.append('quality', params.quality);
    }
    const extra = buildExtraFields(params);
    if (extra) form.append('extra_fields', JSON.stringify(extra));

    // gpt-image-1+ accepts multiple `image[]` entries; dall-e-2 only one.
    for (let i = 0; i < images.length; i++) {
        const blob = await urlOrDataToBlob(images[i]);
        // OpenAI canonical: field name "image" repeated; some servers want image[].
        // new-api accepts both; using bare "image" is safest for a single image and
        // appending multiple with the same name works for gpt-image-1+.
        const filename = `ref_${i}.${(blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
        form.append('image', blob, filename);
    }

    const response = await fetch(`${baseUrl}/images/edits`, {
        method: 'POST',
        headers: {
            // Do NOT set Content-Type — let fetch add the multipart boundary
            'Authorization': `Bearer ${apiKey}`,
        },
        body: form,
    });
    if (!response.ok) throw await parseError(response);
    return normalizeImageResponse(await response.json());
}

// new-api / OpenAI have no separate file-host endpoint. We keep the file in-browser
// as a data URL and let generateI2I convert it back to a Blob at submit time. This
// matches muapi.uploadFile's contract (returns a string the rest of the app stores
// in localStorage and references later) without requiring extra infra.
export async function uploadFile(apiKey, file, onProgress) {
    if (onProgress) {
        // Synthesize a single 100% tick so any progress UI completes.
        try { onProgress(100); } catch (_) {}
    }
    return await fileToDataUrl(file);
}

// OpenAI compat has no balance endpoint. Returning null lets the UI render
// without crashing while clearly indicating "not applicable".
export async function getUserBalance(_apiKey) {
    return { balance: null };
}

// Pull the model whitelist from /v1/models so the UI shows exactly what
// the configured channels in new-api expose.
export async function getModels(apiKey) {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) throw await parseError(response);
    const json = await response.json();
    const list = Array.isArray(json?.data) ? json.data : [];
    return list.map(m => m.id).filter(Boolean);
}
