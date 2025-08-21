import { useState } from 'react';
import type { ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabNavigationProps {
  tabs: Tab[];
  defaultActiveTab?: string;
  onTabChange?: (tabId: string) => void;
}

export default function TabNavigation({
  tabs,
  defaultActiveTab,
  onTabChange,
}: TabNavigationProps) {
  const [activeTab, setActiveTab] = useState<string>(
    defaultActiveTab || tabs[0]?.id || ''
  );

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  return (
    <>
      {/* Tab Headers */}
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab.id)}
          aria-selected={activeTab === tab.id}
          role='tab'
        >
          {tab.label}
        </button>
      ))}

      {/* Tab Content - Keep all tabs mounted but only show active one */}
      {tabs.map(tab => (
        <div
          key={tab.id}
          role='tabpanel'
          style={{
            display: activeTab === tab.id ? 'block' : 'none',
          }}
        >
          {tab.content}
        </div>
      ))}
    </>
  );
}
