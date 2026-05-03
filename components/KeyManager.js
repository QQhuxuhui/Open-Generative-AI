'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getApiKeys,
  addApiKey,
  updateApiKey,
  removeApiKey,
  reorderApiKeys,
  refreshApiKeyModels,
  getBaseUrl,
} from 'studio';

const PLATFORM_NAME = 'Sparkcode多媒体平台';

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 12) return key.slice(0, 4) + '••••';
  return key.slice(0, 8) + '••••••••' + key.slice(-4);
}

function formatLastChecked(ts) {
  if (!ts) return '从未';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function KeyManager({ onClose, onChange }) {
  const [keys, setKeys] = useState([]);
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState('');
  const [addKey, setAddKey] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editKey, setEditKey] = useState('');

  const baseUrl = getBaseUrl();

  const reload = useCallback(() => {
    setKeys(getApiKeys());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const notifyParent = useCallback(() => {
    onChange?.();
    reload();
  }, [onChange, reload]);

  const handleAdd = async () => {
    setAddError('');
    const trimmedKey = addKey.trim();
    if (!trimmedKey) { setAddError('API Key 不能为空'); return; }
    setAddBusy(true);
    try {
      const entry = addApiKey({ name: addName, key: trimmedKey });
      const refreshed = await refreshApiKeyModels(entry.id);
      if (refreshed && refreshed.healthy === false) {
        setAddError(`已添加，但连接失败：${refreshed.error}`);
      }
      setAddName('');
      setAddKey('');
      setAdding(false);
      notifyParent();
    } catch (err) {
      setAddError(err.message || '添加失败');
    } finally {
      setAddBusy(false);
    }
  };

  const handleRefresh = async (id) => {
    setBusyId(id);
    try {
      await refreshApiKeyModels(id);
      notifyParent();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (id) => {
    if (!confirm('删除这把 API Key？')) return;
    removeApiKey(id);
    notifyParent();
  };

  const handleEditStart = (entry) => {
    setEditingId(entry.id);
    setEditName(entry.name);
    setEditKey(entry.key);
  };

  const handleEditSave = async () => {
    const id = editingId;
    if (!id) return;
    const trimmedKey = editKey.trim();
    if (!trimmedKey) return;
    updateApiKey(id, { name: editName.trim() || 'Key', key: trimmedKey });
    setEditingId(null);
    await refreshApiKeyModels(id);
    notifyParent();
  };

  const move = (id, delta) => {
    const ids = keys.map(k => k.id);
    const idx = ids.indexOf(id);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= ids.length) return;
    [ids[idx], ids[next]] = [ids[next], ids[idx]];
    reorderApiKeys(ids);
    notifyParent();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up p-4">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-7 w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-white font-bold text-lg mb-1">{PLATFORM_NAME}</h2>
        <div className="text-white/40 text-[12px] mb-5">
          网关地址：<span className="font-mono text-white/60">{baseUrl}</span>
          <span className="ml-2 text-white/30">（部署固定）</span>
        </div>

        {/* Key list */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-white/30 uppercase tracking-wider">
              API Keys ({keys.length})
            </label>
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="text-[12px] text-[#d9ff00] hover:text-[#e5ff33] font-semibold"
              >
                + 添加 Key
              </button>
            )}
          </div>

          {keys.length === 0 && !adding && (
            <div className="bg-white/5 border border-white/[0.03] rounded-md p-4 text-center text-white/40 text-[13px]">
              还没有 API Key。点击「添加 Key」开始。
            </div>
          )}

          <div className="space-y-2">
            {keys.map((k, idx) => {
              const isEditing = editingId === k.id;
              return (
                <div
                  key={k.id}
                  className="bg-white/5 border border-white/[0.03] rounded-md p-3"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="名称（如：大香蕉）"
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[13px] text-white"
                      />
                      <input
                        type="password"
                        value={editKey}
                        onChange={(e) => setEditKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[13px] text-white font-mono"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleEditSave}
                          className="flex-1 h-8 rounded bg-[#d9ff00] text-black text-[12px] font-bold hover:bg-[#e5ff33]"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex-1 h-8 rounded bg-white/5 text-white/80 text-[12px] hover:bg-white/10"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[13px] font-semibold text-white truncate">{k.name}</span>
                            {k.healthy === true && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                                {k.models?.length || 0} 模型
                              </span>
                            )}
                            {k.healthy === false && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400" title={k.error || ''}>
                                失效
                              </span>
                            )}
                            {k.healthy === null && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                                未检测
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-white/40 truncate">{maskKey(k.key)}</div>
                          <div className="text-[10px] text-white/25 mt-0.5">
                            上次检测：{formatLastChecked(k.lastCheckedAt)}
                          </div>
                          {k.healthy === false && k.error && (
                            <div className="text-[11px] text-red-400/80 mt-1 truncate" title={k.error}>
                              {k.error}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 ml-2">
                          <button
                            onClick={() => move(k.id, -1)}
                            disabled={idx === 0}
                            className="w-7 h-7 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed text-[14px]"
                            title="上移（同名模型时优先使用）"
                          >↑</button>
                          <button
                            onClick={() => move(k.id, 1)}
                            disabled={idx === keys.length - 1}
                            className="w-7 h-7 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed text-[14px]"
                            title="下移"
                          >↓</button>
                          <button
                            onClick={() => handleRefresh(k.id)}
                            disabled={busyId === k.id}
                            className="w-7 h-7 rounded text-white/40 hover:text-white hover:bg-white/5 text-[14px]"
                            title="重新检测"
                          >{busyId === k.id ? '…' : '↻'}</button>
                          <button
                            onClick={() => handleEditStart(k)}
                            className="w-7 h-7 rounded text-white/40 hover:text-white hover:bg-white/5 text-[12px]"
                            title="编辑"
                          >✎</button>
                          <button
                            onClick={() => handleDelete(k.id)}
                            className="w-7 h-7 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 text-[14px]"
                            title="删除"
                          >×</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add form */}
          {adding && (
            <div className="bg-white/5 border border-[#d9ff00]/30 rounded-md p-3 mt-2 space-y-2">
              <div className="text-[11px] font-bold text-[#d9ff00] mb-1">添加新的 API Key</div>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="名称（可选，例如：大香蕉、GPT图像）"
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[13px] text-white placeholder:text-white/20"
              />
              <input
                type="password"
                value={addKey}
                onChange={(e) => setAddKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[13px] text-white font-mono placeholder:text-white/20"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              />
              {addError && <div className="text-[11px] text-red-400">{addError}</div>}
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={addBusy || !addKey.trim()}
                  className="flex-1 h-8 rounded bg-[#d9ff00] text-black text-[12px] font-bold hover:bg-[#e5ff33] disabled:opacity-40"
                >
                  {addBusy ? '检测中…' : '添加并检测'}
                </button>
                <button
                  onClick={() => { setAdding(false); setAddName(''); setAddKey(''); setAddError(''); }}
                  className="flex-1 h-8 rounded bg-white/5 text-white/80 text-[12px] hover:bg-white/10"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-white/30 mb-4 leading-relaxed">
          多把 Key 的模型会合并显示。如果两把 Key 都返回同名模型，按顺序优先使用列表上方的那把（用 ↑↓ 调整）。
        </p>

        <button
          onClick={onClose}
          className="w-full h-10 rounded-md bg-white/5 text-white/80 hover:bg-white/10 text-xs font-semibold transition-all border border-white/5"
        >
          关闭
        </button>
      </div>
    </div>
  );
}
