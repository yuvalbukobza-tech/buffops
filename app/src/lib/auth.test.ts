import { describe, expect, it } from 'vitest'
import { accessOf, login } from './auth'
import type { AppUser } from './types'

const u = (over: Partial<AppUser>): AppUser => ({ id: 1, firstName: 'Test', lastName: 'User', email: 't@example.com', role: '', username: 'tester', password: 'pw-local-test', ...over })

describe('access levels', () => {
  it('defaults to Editor, built-in admin stays Admin', () => {
    expect(accessOf(u({}))).toBe('Editor')
    expect(accessOf(u({ username: 'yuvalbukobza', access: 'Viewer' }))).toBe('Admin')
    expect(accessOf(u({ access: 'Viewer' }))).toBe('Viewer')
  })
  it('login checks username case-insensitively and the exact password', () => {
    expect(login('TESTER', 'pw-local-test', [u({})])?.access).toBe('Editor')
    expect(login('tester', 'wrong', [u({})])).toBeNull()
    expect(login('tester', '', [u({ password: '' })])).toBeNull()
  })
})
