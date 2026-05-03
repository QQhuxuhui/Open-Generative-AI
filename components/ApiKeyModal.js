'use client';

import { useState } from 'react';
import { addApiKey, refreshApiKeyModels, getBaseUrl } from 'studio';

const PLATFORM_NAME = 'Sparkcode多媒体平台';

export default function ApiKeyModal({ onSave }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const baseUrl = getBaseUrl();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = key.trim();
    if (!trimmed) { setError('请输入 API Key'); return; }
    setBusy(true);
    try {
      const entry = addApiKey({ name: 'Default', key: trimmed });
      const refreshed = await refreshApiKeyModels(entry.id);
      if (refreshed && refreshed.healthy === false) {
        setError(`Key 已保存，但连接失败：${refreshed.error}`);
        // Still call onSave so the user can enter the studio and fix in Settings.
      }
      onSave(trimmed);
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4 font-inter">
      <div className="w-full max-w-sm bg-[#0a0a0a]/40 backdrop-blur-xl border border-white/10 rounded-xl p-10 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-14 h-14 bg-[#d9ff00]/5 rounded-2xl flex items-center justify-center border border-[#d9ff00]/10 mb-6 group hover:border-[#d9ff00]/30 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" strokeWidth="1.5" className="group-hover:scale-110 transition-transform">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L12 17.25l-4.5-4.5L15.5 7.5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mb-2">
            {PLATFORM_NAME}
          </h1>
          <p className="text-white/40 text-[13px] leading-relaxed px-4">
            输入你在 {PLATFORM_NAME} 的 API Key 开始创作
          </p>
          <p className="text-white/25 text-[11px] mt-2 font-mono">{baseUrl}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-white/30 ml-1">
              API Key
            </label>
            <input
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              placeholder="sk-..."
              className="w-full bg-white/5 border border-white/[0.03] rounded-md px-5 py-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30 focus:bg-white/[0.07] transition-all font-mono"
              suppressHydrationWarning
            />
            {error && <p className="mt-2 text-red-500/80 text-[11px] font-medium ml-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[#d9ff00] text-black font-medium py-2.5 rounded-md hover:bg-[#e5ff33] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-[#d9ff00]/5 disabled:opacity-50"
            suppressHydrationWarning
          >
            {busy ? '验证中…' : '开始使用'}
          </button>

          <p className="text-center text-[11px] text-white/25 pt-2 leading-relaxed">
            进入后可在右上角设置中添加更多 Key，
            <br />支持不同分组的模型同时使用
          </p>
        </form>
      </div>
    </div>
  );
}
