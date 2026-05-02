'use client';

import { useState, useEffect } from 'react';
import { getProviderConfig, PROVIDER_MUAPI, PROVIDER_NEWAPI } from 'studio';

export default function ProviderSettings({
  activeApiKey,
  currentProvider,
  onClose,
  onChangeKey,
  onSaveProvider,
}) {
  const [provider, setProvider] = useState(currentProvider || PROVIDER_MUAPI);
  const [baseUrl, setBaseUrl] = useState('');
  const [newapiKey, setNewapiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // {ok, message}
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const cfg = getProviderConfig();
    setProvider(cfg.provider);
    setBaseUrl(cfg.newapiBaseUrl || '');
    setNewapiKey(cfg.newapiKey || '');
  }, []);

  const trimmedBase = baseUrl.trim().replace(/\/+$/, '');
  const canTest = provider === PROVIDER_NEWAPI && trimmedBase && newapiKey.trim();

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const url = `${trimmedBase}/models`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${newapiKey.trim()}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
      }
      const json = await res.json();
      const count = Array.isArray(json?.data) ? json.data.length : 0;
      setTestResult({ ok: true, message: `OK — ${count} models` });
    } catch (err) {
      setTestResult({ ok: false, message: err.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (provider === PROVIDER_NEWAPI && (!trimmedBase || !newapiKey.trim())) {
      setTestResult({ ok: false, message: 'Base URL and API Key are required' });
      return;
    }
    onSaveProvider({
      provider,
      newapiBaseUrl: trimmedBase,
      newapiKey: newapiKey.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up p-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-white font-bold text-lg mb-2">Settings</h2>
        <p className="text-white/40 text-[13px] mb-6">
          Pick a provider and configure credentials.
        </p>

        {/* Provider selector */}
        <div className="mb-6">
          <label className="block text-[11px] font-bold text-white/30 mb-2 uppercase tracking-wider">Provider</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setProvider(PROVIDER_MUAPI)}
              className={`px-3 py-2.5 rounded-md border text-[13px] font-semibold transition-all ${
                provider === PROVIDER_MUAPI
                  ? 'border-[#d9ff00]/40 bg-[#d9ff00]/5 text-[#d9ff00]'
                  : 'border-white/5 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              Muapi.ai
            </button>
            <button
              type="button"
              onClick={() => setProvider(PROVIDER_NEWAPI)}
              className={`px-3 py-2.5 rounded-md border text-[13px] font-semibold transition-all ${
                provider === PROVIDER_NEWAPI
                  ? 'border-[#d9ff00]/40 bg-[#d9ff00]/5 text-[#d9ff00]'
                  : 'border-white/5 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              new-api / OpenAI
            </button>
          </div>
        </div>

        {/* Per-provider config */}
        {provider === PROVIDER_MUAPI ? (
          <div className="bg-white/5 border border-white/[0.03] rounded-md p-4 mb-6">
            <label className="block text-[11px] font-bold text-white/30 mb-2 uppercase tracking-wider">Active Muapi key</label>
            <div className="text-[13px] font-mono text-white/80">
              {activeApiKey ? `${activeApiKey.slice(0, 8)}••••••••••••••••` : '(not set)'}
            </div>
            <p className="text-[11px] text-white/30 mt-3">
              Use the &quot;Change Key&quot; button below to re-enter your Muapi.ai key.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[11px] font-bold text-white/30 mb-2 uppercase tracking-wider">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => { setBaseUrl(e.target.value); setTestResult(null); }}
                placeholder="https://api.sparkcode.top/v1"
                className="w-full bg-white/5 border border-white/[0.03] rounded-md px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                spellCheck={false}
              />
              <p className="text-[11px] text-white/30 mt-1.5">
                Must include <code className="font-mono">/v1</code>. Examples: new-api / one-api / OpenAI.
              </p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-white/30 mb-2 uppercase tracking-wider">API Key</label>
              <input
                type="password"
                value={newapiKey}
                onChange={(e) => { setNewapiKey(e.target.value); setTestResult(null); }}
                placeholder="sk-..."
                className="w-full bg-white/5 border border-white/[0.03] rounded-md px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
                spellCheck={false}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!canTest || testing}
                onClick={handleTest}
                className="px-3 py-2 rounded-md bg-white/5 text-white/80 hover:bg-white/10 text-[12px] font-semibold transition-all border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              {testResult && (
                <span className={`text-[12px] ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {testResult.message}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/30">
              Only image flows route through the relay. Video/lipsync/agent tabs are hidden in this mode.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onChangeKey}
            className="flex-1 h-10 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-all"
            title="Clear all keys and re-enter Muapi key"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className="flex-1 h-10 rounded-md bg-[#d9ff00] text-black hover:bg-[#e5ff33] text-xs font-bold transition-all"
          >
            {saved ? 'Saved ✓' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-md bg-white/5 text-white/80 hover:bg-white/10 text-xs font-semibold transition-all border border-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
