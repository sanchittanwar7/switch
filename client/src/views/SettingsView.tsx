import { useState, useEffect } from "react";
import { Save, Key, Globe, Cpu, CheckCircle, AlertCircle, Loader2, HardDrive, Cloud } from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import type { SettingsData } from "../stores/settingsStore";

const PROVIDERS = ["openai", "gemini", "claude", "deepseek", "qwen"] as const;

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  openai:    { baseUrl: "https://api.openai.com/v1", model: "gpt-5.2" },
  gemini:    { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-3.1-pro" },
  claude:    { baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-5" },
  deepseek:  { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-v4-flash" },
  qwen:      { baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", model: "qwen3.6-plus" },
};

export default function SettingsView() {
  const { settings, loading, error: storeError, loadSettings, saveSettings, clearError } = useSettingsStore();

  const [form, setForm] = useState({
    provider: "openai",
    apiKey: "",
    baseUrl: "",
    model: "",
    storageMode: "local" as "local" | "cloud",
  });
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setForm({
        provider: settings.provider || "openai",
        apiKey: settings.apiKey || "",
        baseUrl: settings.baseUrl || PROVIDER_DEFAULTS.openai.baseUrl,
        model: settings.model || PROVIDER_DEFAULTS.openai.model,
        storageMode: settings.storageMode || "local",
      });
    }
  }, [settings]);

  useEffect(() => {
    if (storeError) setError(storeError);
  }, [storeError]);

  function handleProviderChange(provider: string) {
    const defaults = PROVIDER_DEFAULTS[provider];
    setForm((prev) => {
      const prevDefaults = PROVIDER_DEFAULTS[prev.provider];
      const baseUrl =
        prev.baseUrl === prevDefaults?.baseUrl || !prev.baseUrl
          ? defaults.baseUrl
          : prev.baseUrl;
      const model =
        prev.model === prevDefaults?.model || !prev.model
          ? defaults.model
          : prev.model;
      return { ...prev, provider, baseUrl, model };
    });
  }

  async function handleSave() {
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const payload: Partial<SettingsData> = {
        provider: form.provider,
        apiKey: apiKeyDirty ? form.apiKey : undefined,
        baseUrl: form.baseUrl,
        model: form.model,
        storageMode: form.storageMode,
      };
      const saved = await saveSettings(payload);
      setForm({
        provider: saved.provider,
        apiKey: saved.apiKey || "",
        baseUrl: saved.baseUrl || PROVIDER_DEFAULTS[saved.provider]?.baseUrl || "",
        model: saved.model || PROVIDER_DEFAULTS[saved.provider]?.model || "",
        storageMode: saved.storageMode || "local",
      });
      setApiKeyDirty(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#fafafa]">
        <Loader2 size={24} className="animate-spin text-[#888888]" />
      </div>
    );
  }

  return (
    <div className="h-full bg-[#fafafa] overflow-auto">
      <div className="max-w-[480px] mx-auto py-16 px-6">
        <h2
          className="mb-10 text-[24px] font-semibold leading-[32px] tracking-[-0.96px] text-[#171717]"
        >
          Settings.
        </h2>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-[6px] bg-[#f7d4d6] px-3 py-2 text-[14px] leading-[20px] text-[#c50000]">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-[6px] bg-[#d3e5ff] px-3 py-2 text-[14px] leading-[20px] text-[#0070f3]">
            <CheckCircle size={16} />
            Settings saved.
          </div>
        )}

        <div className="space-y-5">
          <div className="pb-4 border-b border-[#ebebeb]">
            <h3 className="text-[13px] font-medium text-[#888888] uppercase tracking-wider mb-4">
              Storage
            </h3>
            <div className="flex rounded-[8px] bg-[#f0f0f0] p-1 gap-1">
              <button
                onClick={() => setForm({ ...form, storageMode: "local" })}
                className={`flex-1 flex items-center justify-center gap-2 rounded-[6px] px-3 py-2 text-[14px] leading-[20px] font-medium transition-colors ${
                  form.storageMode === "local"
                    ? "bg-white text-[#171717] shadow-sm"
                    : "text-[#888888] hover:text-[#171717]"
                }`}
              >
                <HardDrive size={14} />
                Local
              </button>
              <button
                onClick={() => setForm({ ...form, storageMode: "cloud" })}
                className={`flex-1 flex items-center justify-center gap-2 rounded-[6px] px-3 py-2 text-[14px] leading-[20px] font-medium transition-colors ${
                  form.storageMode === "cloud"
                    ? "bg-white text-[#171717] shadow-sm"
                    : "text-[#888888] hover:text-[#171717]"
                }`}
              >
                <Cloud size={14} />
                Cloud
              </button>
            </div>
            <p className="mt-2 text-[12px] leading-[16px] text-[#888888]">
              {form.storageMode === "local"
                ? "Resume files stored on your device."
                : "Resume files synced to Supabase cloud storage."}
            </p>
          </div>

          <div className="pt-1">
            <h3 className="text-[13px] font-medium text-[#888888] uppercase tracking-wider mb-4">
              LLM
            </h3>
          </div>

          <label className="block">
            <span className="flex items-center gap-2 text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-[#171717] mb-1.5">
              <Cpu size={14} />
              Provider
            </span>
            <select
              value={form.provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full rounded-[6px] border border-[#ebebeb] bg-white px-3 h-10 text-[14px] leading-[20px] text-[#171717] focus:outline-none focus:ring-2 focus:ring-[#0070f3]/20 focus:border-[#0070f3] appearance-none"
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="flex items-center gap-2 text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-[#171717] mb-1.5">
              <Key size={14} />
              API Key
            </span>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => {
                setForm({ ...form, apiKey: e.target.value });
                setApiKeyDirty(true);
              }}
              placeholder="sk-..."
              className="w-full rounded-[6px] border border-[#ebebeb] bg-white px-3 h-10 text-[14px] leading-[20px] text-[#171717] placeholder:text-[#888888] focus:outline-none focus:ring-2 focus:ring-[#0070f3]/20 focus:border-[#0070f3]"
            />
            {settings?.apiKey && (
              <p className="mt-1.5 text-[12px] leading-[16px] text-[#888888] font-mono">
                {settings.apiKey}
              </p>
            )}
          </label>

          <label className="block">
            <span className="flex items-center gap-2 text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-[#171717] mb-1.5">
              <Globe size={14} />
              Base URL
            </span>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full rounded-[6px] border border-[#ebebeb] bg-white px-3 h-10 text-[14px] leading-[20px] text-[#171717] placeholder:text-[#888888] focus:outline-none focus:ring-2 focus:ring-[#0070f3]/20 focus:border-[#0070f3]"
            />
          </label>

          <label className="block">
            <span className="flex items-center gap-2 text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-[#171717] mb-1.5">
              <Cpu size={14} />
              Model
            </span>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="gpt-5.2"
              className="w-full rounded-[6px] border border-[#ebebeb] bg-white px-3 h-10 text-[14px] leading-[20px] text-[#171717] placeholder:text-[#888888] focus:outline-none focus:ring-2 focus:ring-[#0070f3]/20 focus:border-[#0070f3]"
            />
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-[100px] bg-[#171717] text-white px-5 h-10 text-[14px] leading-[20px] font-medium hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
