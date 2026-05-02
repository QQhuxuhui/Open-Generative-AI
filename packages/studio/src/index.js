"use client";

export { default as ImageStudio } from './components/ImageStudio';
export { default as VideoStudio } from './components/VideoStudio';
export { default as LipSyncStudio } from './components/LipSyncStudio';
export { default as CinemaStudio } from './components/CinemaStudio';
export { default as MarketingStudio } from './components/MarketingStudio';
export { default as WorkflowStudio } from './components/WorkflowStudio';
export { default as AgentStudio } from './components/AgentStudio';
export { default as AppsStudio } from './components/AppsStudio';
// Re-export muapi.* directly for backward compatibility (workflow / agent / video flows still use it).
// Note: image-flow consumers (ImageStudio) import generateImage/generateI2I/uploadFile from
// './provider' directly to get provider routing. The shell uses getUserBalance below which
// dispatches via the provider facade so that newapi mode returns {balance: null} instead of
// 401-ing against api.muapi.ai.
export {
    generateVideo,
    generateI2V,
    generateMarketingStudioAd,
    processLipSync,
    getTemplateWorkflows,
    getUserWorkflows,
    getPublishedWorkflows,
    getTemplateAgents,
    getUserAgents,
    getPublishedAgents,
    getUserConversations,
    createWorkflow,
    updateWorkflowName,
    deleteWorkflow,
    getWorkflowInputs,
    executeWorkflow,
    getAllNodeSchemas,
    getWorkflowData,
    getNodeSchemas,
    runSingleNode,
    deleteNodeRun,
    getNodeStatus,
    handleProxyRequest,
    handleServerSideProxy,
    calculateDynamicCost,
    registerAppInterest,
    getAppInterests,
} from './muapi';
// Provider facade for image flows that should switch between Muapi and OpenAI-compatible relays.
export {
    PROVIDER_MUAPI,
    PROVIDER_NEWAPI,
    getProvider,
    setProvider,
    getProviderConfig,
    setNewapiConfig,
    getActiveApiKey,
    getModels as getProviderModels,
    generateImage,
    generateI2I,
    uploadFile,
    getUserBalance,
} from './provider';

