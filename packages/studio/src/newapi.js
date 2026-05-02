// OpenAI-compatible image client (new-api / one-api / OpenAI direct).
// Mirrors the muapi.js export surface so the rest of the app can switch providers
// by importing from a unified provider module.

const NEWAPI_BASE_KEY = 'newapi_base_url';
const NEWAPI_KEY_FALLBACK_DEFAULT = 'https://api.openai.com/v1';

function getBaseUrl() {
    if (typeof window === 'undefined') return NEWAPI_KEY_FALLBACK_DEFAULT;
    const raw = window.localStorage.getItem(NEWAPI_BASE_KEY);
    if (!raw) return NEWAPI_KEY_FALLBACK_DEFAULT;
    return raw.replace(/\/+$/, '');
}

// gpt-image-2 / dall-e-3 / nano-banana sizes accepted by OpenAI Images API
function aspectToSize(aspect) {
    switch (aspect) {
        case '1:1':  return '1024x1024';
        case '16:9':
        case '4:3':  return '1536x1024';
        case '9:16':
        case '3:4':  return '1024x1536';
        case 'auto':
        default:     return 'auto';
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
    // Remote URL — fetch it (CORS depending). Useful when "use as reference" was clicked
    // on a previously generated image whose URL is under our control.
    const res = await fetch(value);
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

function buildExtraFields(params) {
    const extra = {};
    // Pass model-family-specific knobs through new-api's extra_fields passthrough.
    if (params.resolution) extra.resolution = params.resolution;
    if (params.quality && !['auto', 'standard', 'hd', 'high', 'medium', 'low'].includes(params.quality)) {
        extra.quality = params.quality;
    }
    if (params.seed !== undefined && params.seed !== -1 && params.seed !== null) {
        extra.seed = params.seed;
    }
    if (params.aspect_ratio) extra.aspect_ratio = params.aspect_ratio;
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

export async function generateImage(apiKey, params) {
    const baseUrl = getBaseUrl();
    const body = {
        model: params.model,
        prompt: params.prompt,
        n: 1,
        size: aspectToSize(params.aspect_ratio),
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
    const baseUrl = getBaseUrl();
    const images = params.images_list?.length > 0
        ? params.images_list
        : (params.image_url ? [params.image_url] : []);
    if (images.length === 0) {
        throw new Error('No reference image provided for image-to-image');
    }

    const form = new FormData();
    form.append('model', params.model);
    if (params.prompt) form.append('prompt', params.prompt);
    form.append('n', '1');
    form.append('size', aspectToSize(params.aspect_ratio));

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
