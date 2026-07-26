import { useState, useEffect } from "react";
import { Plus, Key, Trash2, Cpu, AlertCircle, CheckCircle, Loader2, Star } from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";

const PROVIDERS = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "Qwen" },
];

export default function SettingsView() {
  const {
    providers,
    loading,
    error: storeError,
    loadProviders,
    addProvider,
    deleteProvider,
    setDefaultModel,
    clearError,
  } = useSettingsStore();

  const [newProvider, setNewProvider] = useState("openai");
  const [newApiKey, setNewApiKey] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    if (storeError) setError(storeError);
  }, [storeError]);

  async function handleAdd() {
    if (!newApiKey.trim()) {
      setError("API key is required");
      return;
    }

    setError(null);
    setSuccess(false);
    setAdding(true);

    try {
      await addProvider(newProvider, newApiKey.trim());
      setNewApiKey("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add provider");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);

    try {
      await deleteProvider(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove provider");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-brand-canvas-soft">
        <Loader2 size={24} className="animate-spin text-brand-mute" />
      </div>
    );
  }

  const configuredProviders = PROVIDERS.filter((p) =>
    providers.some((cp) => cp.provider === p.value),
  );
  const unconfiguredProviders = PROVIDERS.filter(
    (p) => !providers.some((cp) => cp.provider === p.value),
  );

  return (
    <div className="h-full bg-brand-canvas-soft overflow-auto">
      <div className="max-w-[640px] mx-auto py-16 px-6">
        <h2 className="mb-10 text-[24px] font-semibold leading-[32px] tracking-[-0.96px] text-brand-ink">
          Settings.
        </h2>

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-md bg-brand-error-soft px-3 py-2 text-[14px] leading-[20px] text-brand-error">
            <AlertCircle size={16} />
            {error}
            <button
              onClick={() => { setError(null); clearError(); }}
              className="ml-auto text-brand-mute hover:text-brand-ink"
            >
              x
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-md bg-brand-link/10 px-3 py-2 text-sm text-brand-link">
            <CheckCircle size={16} />
            Provider added.
          </div>
        )}

        <div className="space-y-8">
          <section>
            <h3 className="text-[13px] font-medium text-brand-mute mb-4">
              Providers
            </h3>

            {configuredProviders.length === 0 && (
              <div className="p-12 rounded-xl bg-brand-canvas border border-brand-hairline flex flex-col items-center text-center">
                <Key size={32} className="text-brand-mute mb-4" />
                <p className="text-[14px] text-brand-body mb-1">No providers configured.</p>
                <p className="text-[13px] text-brand-mute">
                  Add a provider below to use it for resume tailoring.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {configuredProviders.map((p) => {
                const config = providers.find((cp) => cp.provider === p.value);
                if (!config) return null;

                return (
                  <div
                    key={config.id}
                    className="rounded-xl bg-brand-canvas border border-brand-hairline p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-canvas-soft-2 border border-brand-hairline flex items-center justify-center">
                          <Cpu size={16} className="text-brand-body" />
                        </div>
                        <div>
                          <div className="text-[14px] font-medium text-brand-ink">
                            {p.label}
                          </div>
                          {config.apiKey && (
                            <div className="text-[12px] text-brand-mute font-mono mt-0.5">
                              {config.apiKey}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(config.id)}
                        disabled={deletingId === config.id}
                        className="shrink-0 p-1.5 rounded-md text-brand-mute hover:text-brand-error hover:bg-brand-error-soft transition-colors disabled:opacity-50"
                      >
                        {deletingId === config.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>

                    <div>
                      <div className="text-xs text-brand-mute font-medium mb-2">
                        Models — click to set default
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {config.models.map((model) => {
                          const isDefault = config.defaultModel === model;
                          return (
                            <button
                              key={model}
                              onClick={async () => {
                                try {
                                  await setDefaultModel(config.id, model);
                                } catch { /* handled by store */ }
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs leading-[18px] font-mono border transition-colors ${
                                isDefault
                                  ? "bg-brand-link/15 text-brand-link border-brand-link/30"
                                  : "bg-brand-canvas-soft-2 text-brand-body border-brand-hairline hover:border-brand-hairline-strong"
                              }`}
                            >
                              {isDefault && <Star size={10} />}
                              {model}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {unconfiguredProviders.length > 0 && (
            <section>
<h3 className="text-sm font-medium text-brand-mute mb-4">
                Add provider
              </h3>

              <div className="rounded-xl bg-brand-canvas border border-brand-hairline p-6">
                <div className="space-y-4">
                  <label className="block">
                    <span className="flex items-center gap-2 text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5">
                      <Cpu size={14} className="text-brand-body" />
                      Provider
                    </span>
                    <select
                      value={newProvider}
                      onChange={(e) => setNewProvider(e.target.value)}
                      className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link appearance-none"
                    >
                      {unconfiguredProviders.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="flex items-center gap-2 text-[14px] leading-[20px] tracking-[-0.28px] font-medium text-brand-ink mb-1.5">
                      <Key size={14} className="text-brand-body" />
                      API Key
                    </span>
                    <input
                      type="password"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full rounded-md border border-brand-hairline bg-brand-canvas px-3 h-10 text-[14px] leading-[20px] text-brand-ink placeholder:text-brand-mute focus:outline-none focus:ring-2 focus:ring-brand-link/20 focus:border-brand-link"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAdd();
                      }}
                    />
                  </label>

                  <button
                    onClick={handleAdd}
                    disabled={adding || !newApiKey.trim()}
                    className="inline-flex items-center gap-2 rounded-[100px] bg-brand-ink text-brand-canvas px-5 h-10 text-[14px] leading-[20px] font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {adding ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    {adding ? "Adding..." : "Add Provider"}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
