import { describe, it, expect } from 'vitest'

describe('テスト基盤', () => {
  it('vitestが正常に動作する', () => {
    expect(1 + 1).toBe(2)
  })

  it('TypeScriptの型チェックが動作する', () => {
    const greet = (name: string): string => `こんにちは、${name}`
    expect(greet('テスト')).toBe('こんにちは、テスト')
  })
})
