import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getApiKey, setApiKey, getModel, setModel } from '@/lib/gemini'

describe('gemini ユーティリティ', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('APIキーのget/setができる', () => {
    expect(getApiKey()).toBeNull()
    setApiKey('test-key-123')
    expect(getApiKey()).toBe('test-key-123')
  })

  it('モデルのget/setができる', () => {
    expect(getModel()).toBe('gemini-2.0-flash-lite') // デフォルト
    setModel('gemini-2.0-flash')
    expect(getModel()).toBe('gemini-2.0-flash')
  })

  it('APIキーが未設定の場合nullを返す', () => {
    expect(getApiKey()).toBeNull()
  })
})
