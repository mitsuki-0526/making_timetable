import { type ReactNode, useState } from 'react'

type Tab = {
  id: string
  label: string
  content: ReactNode
}

type Props = {
  tabs: Tab[]
  defaultTab?: string
}

export function TabContainer({ tabs, defaultTab }: Props) {
  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.id ?? '')

  const activeContent = tabs.find((t) => t.id === activeTab)?.content

  return (
    <div>
      <div style={{
        display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb',
        marginBottom: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer',
              backgroundColor: 'transparent', fontSize: 13, fontWeight: 500,
              borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
              marginBottom: -2,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{activeContent}</div>
    </div>
  )
}
