import { type ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

type Props = {
  title: string
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  width?: string
  height?: string
}

export function ModalShell({ title, isOpen, onClose, children, width = '900px', height = '80vh' }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        backgroundColor: '#fff', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        width, maxWidth: '95vw', height, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid #e5e7eb',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, borderRadius: 4, display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
