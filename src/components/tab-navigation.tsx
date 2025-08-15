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
    <div className='tab-navigation' style={{ marginTop: '1.5rem' }}>
      {/* Tab Headers */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #e0e0e0',
          marginBottom: '1rem',
        }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom:
                activeTab === tab.id
                  ? '2px solid #2196f3'
                  : '2px solid transparent',
              color: activeTab === tab.id ? '#2196f3' : '#666',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s ease',
            }}
            aria-selected={activeTab === tab.id}
            role='tab'
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content - Keep all tabs mounted but only show active one */}
      <div className='tab-content'>
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
      </div>
    </div>
  );
}
