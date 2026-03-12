'use client';

import { useState, useEffect } from 'react';
import { CheckIcon, PlusIcon, KeyIcon } from './icons.js';
import {
  getGitHubConfig,
  updateGitHubSecret,
  updateGitHubVariable,
  getApiKeySettings,
  updateApiKeySetting,
  regenerateWebhookSecret,
} from '../actions.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared row components
// ─────────────────────────────────────────────────────────────────────────────

function SecretRow({ name, label, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!value) return;
    setSaving(true);
    setError(null);
    const result = await onUpdate(name, value);
    setSaving(false);
    if (result?.success) {
      setEditing(false);
      setValue('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(result?.error || 'Failed to set secret');
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 py-3">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground font-mono">{name}</div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value..."
            autoFocus
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button onClick={handleSave} disabled={!value || saving}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => { setEditing(false); setValue(''); setError(null); }}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium border border-border text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground font-mono">{name}</div>
      </div>
      <button onClick={() => setEditing(true)}
        className={`rounded-md px-2.5 py-1.5 text-xs font-medium border shrink-0 self-start sm:self-auto ${
          saved ? 'border-green-500 text-green-600' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}>
        {saved ? <span className="inline-flex items-center gap-1"><CheckIcon size={12} /> Saved</span> : 'Set'}
      </button>
    </div>
  );
}

function VariableRow({ name, label, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await onUpdate(name, value);
    setSaving(false);
    if (result?.success) {
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(result?.error || 'Failed to set variable');
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 py-3">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground font-mono">{name}</div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <input type="text" value={value} onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value..." autoFocus
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-foreground"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
          <button onClick={handleSave} disabled={saving}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => { setEditing(false); setValue(''); setError(null); }}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium border border-border text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground font-mono">{name}</div>
      </div>
      <button onClick={() => setEditing(true)}
        className={`rounded-md px-2.5 py-1.5 text-xs font-medium border shrink-0 self-start sm:self-auto ${
          saved ? 'border-green-500 text-green-600' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}>
        {saved ? <span className="inline-flex items-center gap-1"><CheckIcon size={12} /> Saved</span> : 'Set'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add custom secret/variable form
// ─────────────────────────────────────────────────────────────────────────────

function AddItemForm({ type, onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isSecret = type === 'secret';

  const handleSave = async () => {
    const trimmedName = name.trim().toUpperCase();
    if (!trimmedName || (!value && isSecret)) return;
    setSaving(true);
    setError(null);
    const result = await onAdd(trimmedName, value);
    setSaving(false);
    if (result?.success) {
      setName('');
      setValue('');
      onCancel();
    } else {
      setError(result?.error || `Failed to add ${type}`);
    }
  };

  return (
    <div className="rounded-lg border border-dashed bg-card p-4 mb-4">
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-medium mb-1.5 block">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            placeholder={isSecret ? 'e.g. AGENT_MY_SECRET' : 'e.g. MY_VARIABLE'}
            autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1.5 block">Value</label>
          <input
            type={isSecret ? 'password' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value..."
            className={`w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground ${!isSecret ? 'font-mono' : ''}`}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!name.trim() || (!value && isSecret) || saving}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium border border-border text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared hook for loading GitHub config
// ─────────────────────────────────────────────────────────────────────────────

function useGitHubConfig() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await getGitHubConfig();
        setData(result);
      } catch {
        setData({ error: 'Failed to load GitHub configuration' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { data, loading };
}

function NotConfigured() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <h3 className="text-sm font-medium mb-2">GitHub not configured</h3>
      <p className="text-xs text-muted-foreground">
        Set a GitHub token on the Tokens tab to enable secret and variable management.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tokens sub-tab — GH_TOKEN + GH_WEBHOOK_SECRET (moved from API Keys)
// ─────────────────────────────────────────────────────────────────────────────

function TokenSecretRow({ label, isSet, onSave, onRegenerate, saving }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const handleSave = async () => {
    await onSave(value);
    setEditing(false);
    setValue('');
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 py-3">
        <div className="flex items-center gap-2">
          <KeyIcon size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value..."
            autoFocus
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button
            onClick={handleSave}
            disabled={!value || saving}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => { setEditing(false); setValue(''); }}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium border border-border text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3">
      <div className="flex items-center gap-2">
        <KeyIcon size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-xs ${isSet ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isSet ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
          {isSet ? 'Configured' : 'Not set'}
        </span>
        {onRegenerate && isSet && (
          <button
            onClick={onRegenerate}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Regenerate
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {isSet ? 'Update' : 'Set'}
        </button>
      </div>
    </div>
  );
}

export function GitHubTokensPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      const result = await getApiKeySettings();
      setSettings(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const getStatus = (key) => settings?.secrets?.find((s) => s.key === key)?.isSet || false;

  const handleSave = async (key, value) => {
    setSaving(true);
    await updateApiKeySetting(key, value);
    await loadSettings();
    setSaving(false);
  };

  const handleRegenerate = async (key) => {
    setSaving(true);
    await regenerateWebhookSecret(key);
    await loadSettings();
    setSaving(false);
  };

  if (loading) {
    return <div className="h-24 animate-pulse rounded-md bg-border/50" />;
  }

  return (
    <div className="space-y-6">
      {/* Personal Access Token */}
      <div>
        <div className="mb-4">
          <h2 className="text-base font-medium">Personal Access Token</h2>
          <p className="text-sm text-muted-foreground">GitHub PAT used by the event handler for repository operations (branches, PRs).</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <TokenSecretRow
            label="Personal Access Token"
            isSet={getStatus('GH_TOKEN')}
            saving={saving}
            onSave={(val) => handleSave('GH_TOKEN', val)}
          />
        </div>
      </div>

      {/* Webhook Secret */}
      <div>
        <div className="mb-4">
          <h2 className="text-base font-medium">Webhook Secret</h2>
          <p className="text-sm text-muted-foreground">Used to verify incoming GitHub webhook signatures.</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <TokenSecretRow
            label="Webhook Secret"
            isSet={getStatus('GH_WEBHOOK_SECRET')}
            saving={saving}
            onSave={(val) => handleSave('GH_WEBHOOK_SECRET', val)}
            onRegenerate={() => handleRegenerate('GH_WEBHOOK_SECRET')}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Secrets sub-tab
// ─────────────────────────────────────────────────────────────────────────────

export function GitHubSecretsPage() {
  const { data, loading } = useGitHubConfig();
  const [showAdd, setShowAdd] = useState(false);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-md bg-border/50" />;
  }

  if (data?.error) return <NotConfigured />;

  const handleUpdate = async (name, value) => {
    return await updateGitHubSecret(name, value);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-medium">Secrets</h2>
          <p className="text-sm text-muted-foreground">Encrypted values stored on GitHub for agent jobs. Values cannot be read back after setting.</p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 shrink-0"
          >
            <PlusIcon size={14} />
            Add secret
          </button>
        )}
      </div>
      {showAdd && (
        <AddItemForm
          type="secret"
          onAdd={handleUpdate}
          onCancel={() => setShowAdd(false)}
        />
      )}
      <div className="rounded-lg border bg-card p-4">
        <div className="divide-y divide-border">
          {data.secrets.map((s) => (
            <SecretRow key={s.name} name={s.name} label={s.label} onUpdate={handleUpdate} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Variables sub-tab
// ─────────────────────────────────────────────────────────────────────────────

export function GitHubVariablesPage() {
  const { data, loading } = useGitHubConfig();
  const [showAdd, setShowAdd] = useState(false);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-md bg-border/50" />;
  }

  if (data?.error) return <NotConfigured />;

  const handleUpdate = async (name, value) => {
    return await updateGitHubVariable(name, value);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-medium">Variables</h2>
          <p className="text-sm text-muted-foreground">Configuration values for agent jobs.</p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 shrink-0"
          >
            <PlusIcon size={14} />
            Add variable
          </button>
        )}
      </div>
      {showAdd && (
        <AddItemForm
          type="variable"
          onAdd={handleUpdate}
          onCancel={() => setShowAdd(false)}
        />
      )}
      <div className="rounded-lg border bg-card p-4">
        <div className="divide-y divide-border">
          {data.variables.map((v) => (
            <VariableRow key={v.name} name={v.name} label={v.label} onUpdate={handleUpdate} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Backwards compat
export function SettingsGitHubPage() {
  return <GitHubSecretsPage />;
}
