// API key registry for the Sparkcode multimedia platform.
// One platform, one base URL (configured via env), many user keys
// (each key may belong to a different new-api group with different model access).

import * as newapi from './newapi.js';

const STORAGE_KEYS_LIST = 'newapi_keys';
const LEGACY_SINGLE_KEY = 'newapi_key'; // pre-multi-key storage; migrated on read

function readLS(key) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
}

function writeLS(key, value) {
    if (typeof window === 'undefined') return;
    if (value === null || value === undefined || value === '') {
        window.localStorage.removeItem(key);
    } else {
        window.localStorage.setItem(key, value);
    }
}

function newId() {
    return `k_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function migrateLegacy() {
    const legacy = readLS(LEGACY_SINGLE_KEY);
    if (!legacy) return null;
    const entry = {
        id: newId(),
        name: 'Default',
        key: legacy,
        models: [],
        lastCheckedAt: 0,
        healthy: null,
        error: null,
    };
    writeLS(STORAGE_KEYS_LIST, JSON.stringify([entry]));
    writeLS(LEGACY_SINGLE_KEY, null);
    return [entry];
}

export function getApiKeys() {
    const raw = readLS(STORAGE_KEYS_LIST);
    if (!raw) {
        const migrated = migrateLegacy();
        if (migrated) return migrated;
        return [];
    }
    try {
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
}

function saveApiKeys(list) {
    writeLS(STORAGE_KEYS_LIST, JSON.stringify(list));
}

export function addApiKey({ name, key }) {
    const list = getApiKeys();
    const entry = {
        id: newId(),
        name: (name || '').trim() || `Key ${list.length + 1}`,
        key: (key || '').trim(),
        models: [],
        lastCheckedAt: 0,
        healthy: null,
        error: null,
    };
    list.push(entry);
    saveApiKeys(list);
    return entry;
}

export function updateApiKey(id, patch) {
    const list = getApiKeys();
    const idx = list.findIndex(k => k.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch };
    saveApiKeys(list);
    return list[idx];
}

export function removeApiKey(id) {
    const list = getApiKeys().filter(k => k.id !== id);
    saveApiKeys(list);
}

export function reorderApiKeys(orderedIds) {
    const list = getApiKeys();
    const byId = new Map(list.map(k => [k.id, k]));
    const reordered = orderedIds.map(id => byId.get(id)).filter(Boolean);
    // Append any keys not in the ordering at the end (shouldn't happen but safe).
    for (const k of list) if (!orderedIds.includes(k.id)) reordered.push(k);
    saveApiKeys(reordered);
    return reordered;
}

// Probe /v1/models for a single key and persist the result.
export async function refreshApiKeyModels(id) {
    const list = getApiKeys();
    const entry = list.find(k => k.id === id);
    if (!entry) return null;
    try {
        const models = await newapi.getModels(entry.key);
        return updateApiKey(id, {
            models,
            lastCheckedAt: Date.now(),
            healthy: true,
            error: null,
        });
    } catch (err) {
        return updateApiKey(id, {
            models: [],
            lastCheckedAt: Date.now(),
            healthy: false,
            error: err.message || 'Unknown error',
        });
    }
}

// Refresh every key in parallel. Returns the updated list.
export async function refreshAllApiKeys() {
    const list = getApiKeys();
    await Promise.all(list.map(k => refreshApiKeyModels(k.id)));
    return getApiKeys();
}

// First key (in user-defined order) whose /v1/models response includes the
// given model id. Returns the full key entry, not just the secret.
export function getKeyForModel(modelId) {
    const list = getApiKeys();
    return list.find(k => k.healthy !== false && (k.models || []).includes(modelId)) || null;
}

// All distinct model ids across all healthy keys, with source key id attached.
// Returns: [{ id, sourceKeyId, sourceKeyName }]
export function getAllAvailableModels() {
    const list = getApiKeys();
    const seen = new Map();
    for (const k of list) {
        if (k.healthy === false) continue;
        for (const modelId of (k.models || [])) {
            if (!seen.has(modelId)) {
                seen.set(modelId, { id: modelId, sourceKeyId: k.id, sourceKeyName: k.name });
            }
        }
    }
    return Array.from(seen.values());
}

export function hasAnyKey() {
    return getApiKeys().length > 0;
}

// ── Image generation surface (forwards to newapi.js with explicit key) ──

export async function generateImage(apiKey, params) {
    return newapi.generateImage(apiKey, params);
}

export async function generateI2I(apiKey, params) {
    return newapi.generateI2I(apiKey, params);
}

export async function uploadFile(apiKey, file, onProgress) {
    return newapi.uploadFile(apiKey, file, onProgress);
}
