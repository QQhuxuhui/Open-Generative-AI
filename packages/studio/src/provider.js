// Unified image-generation client facade. Dispatches between Muapi.ai and
// any OpenAI-compatible relay (new-api / one-api / OpenAI direct) based on
// localStorage settings, so the rest of the UI imports a single module.

import * as muapi from './muapi.js';
import * as newapi from './newapi.js';

export const PROVIDER_MUAPI = 'muapi';
export const PROVIDER_NEWAPI = 'newapi';

const STORAGE = {
    provider: 'provider',
    muapiKey: 'muapi_key',
    newapiBaseUrl: 'newapi_base_url',
    newapiKey: 'newapi_key',
};

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

export function getProvider() {
    const stored = readLS(STORAGE.provider);
    return stored === PROVIDER_NEWAPI ? PROVIDER_NEWAPI : PROVIDER_MUAPI;
}

export function setProvider(p) {
    writeLS(STORAGE.provider, p === PROVIDER_NEWAPI ? PROVIDER_NEWAPI : PROVIDER_MUAPI);
}

export function getProviderConfig() {
    return {
        provider: getProvider(),
        muapiKey: readLS(STORAGE.muapiKey) || '',
        newapiBaseUrl: readLS(STORAGE.newapiBaseUrl) || '',
        newapiKey: readLS(STORAGE.newapiKey) || '',
    };
}

export function setNewapiConfig({ baseUrl, apiKey }) {
    writeLS(STORAGE.newapiBaseUrl, baseUrl);
    writeLS(STORAGE.newapiKey, apiKey);
}

// The "active key" the rest of the app passes around. Components were written
// against a single `apiKey` prop sourced from localStorage('muapi_key'); we keep
// that contract by returning whichever key matches the active provider.
export function getActiveApiKey() {
    if (getProvider() === PROVIDER_NEWAPI) {
        return readLS(STORAGE.newapiKey) || '';
    }
    return readLS(STORAGE.muapiKey) || '';
}

function client() {
    return getProvider() === PROVIDER_NEWAPI ? newapi : muapi;
}

// ── Image generation surface (the only flows we route through providers) ──

export async function generateImage(apiKey, params) {
    return client().generateImage(apiKey, params);
}

export async function generateI2I(apiKey, params) {
    return client().generateI2I(apiKey, params);
}

export async function uploadFile(apiKey, file, onProgress) {
    return client().uploadFile(apiKey, file, onProgress);
}

export async function getUserBalance(apiKey) {
    return client().getUserBalance(apiKey);
}

// Only newapi exposes a model whitelist; muapi UI relies on the static models.js list.
export async function getModels(apiKey) {
    if (getProvider() !== PROVIDER_NEWAPI) return null;
    return newapi.getModels(apiKey);
}
