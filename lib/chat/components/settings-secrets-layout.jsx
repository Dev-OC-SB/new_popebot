'use client';

import { useState, useEffect } from 'react';

/**
 * Generic sub-tab navigation using pill buttons.
 * @param {{ tabs: { id: string, label: string, href: string }[], children: React.ReactNode }} props
 */
export function SubTabLayout({ tabs, children }) {
  const [activePath, setActivePath] = useState('');

  useEffect(() => {
    setActivePath(window.location.pathname);
  }, []);

  return (
    <div>
      {/* Sub-tab navigation (pills) */}
      <div className="flex gap-1.5 mb-6">
        {tabs.map((tab) => {
          const isActive = activePath === tab.href || activePath.startsWith(tab.href + '/');
          return (
            <a
              key={tab.id}
              href={tab.href}
              className={`rounded-full px-3 py-1.5 min-h-[36px] inline-flex items-center text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* Sub-tab content */}
      {children}
    </div>
  );
}

// Pre-configured layouts for each top-level tab

const API_KEYS_TABS = [
  { id: 'keys', label: 'Keys', href: '/settings/api-keys/keys' },
];

const CHAT_TABS = [
  { id: 'llm', label: 'LLM', href: '/settings/chat/llm' },
  { id: 'telegram', label: 'Telegram', href: '/settings/chat/telegram' },
];

const GITHUB_TABS = [
  { id: 'tokens', label: 'Tokens', href: '/settings/github/tokens' },
  { id: 'secrets', label: 'Secrets', href: '/settings/github/secrets' },
  { id: 'variables', label: 'Variables', href: '/settings/github/variables' },
];

export function ApiKeysLayout({ children }) {
  return <div>{children}</div>;
}

export function ChatSettingsLayout({ children }) {
  return <SubTabLayout tabs={CHAT_TABS}>{children}</SubTabLayout>;
}

export function GitHubSettingsLayout({ children }) {
  return <SubTabLayout tabs={GITHUB_TABS}>{children}</SubTabLayout>;
}

// Backwards compat — kept as alias
export function SecretsLayout({ children }) {
  return <ApiKeysLayout>{children}</ApiKeysLayout>;
}
