"use client";

// Sparkcode multimedia platform — Studio package public surface.
// Image generation flows only; the legacy Muapi-only studios (Video, LipSync,
// Cinema, Marketing, Workflow, Agent, Apps) are not exported because the
// shell hides them in single-platform mode.

export { default as ImageStudio } from './components/ImageStudio';

// Provider helpers — multi-key OpenAI-compatible client for the configured platform relay.
export {
    getApiKeys,
    addApiKey,
    updateApiKey,
    removeApiKey,
    reorderApiKeys,
    refreshApiKeyModels,
    refreshAllApiKeys,
    getKeyForModel,
    getAllAvailableModels,
    hasAnyKey,
    generateImage,
    generateI2I,
    uploadFile,
} from './provider';

export { getBaseUrl } from './newapi';
