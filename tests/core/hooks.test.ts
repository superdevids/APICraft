import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LifecycleManager, type LifecycleHooks } from '../../packages/core/src/hooks/index.js'
import type { RequestContext } from '../../packages/core/src/types/index.js'

describe('LifecycleManager', () => {
  let lifecycleManager: LifecycleManager

  beforeEach(() => {
    lifecycleManager = new LifecycleManager()
  })

  describe('register and getHooks', () => {
    it('registers hooks for an API', () => {
      const hooks: LifecycleHooks = {
        beforeRequest: vi.fn(),
        afterRequest: vi.fn(),
        onError: vi.fn(),
      }
      lifecycleManager.register('UsersAPI', hooks)
      const retrieved = lifecycleManager.getHooks('UsersAPI')
      expect(retrieved).toBe(hooks)
    })

    it('returns undefined for unregistered API', () => {
      expect(lifecycleManager.getHooks('NonExistent')).toBeUndefined()
    })
  })

  describe('unregister', () => {
    it('removes hooks for an API', () => {
      const hooks: LifecycleHooks = { beforeRequest: vi.fn() }
      lifecycleManager.register('TempAPI', hooks)
      lifecycleManager.unregister('TempAPI')
      expect(lifecycleManager.getHooks('TempAPI')).toBeUndefined()
    })
  })

  describe('executeBeforeRequest', () => {
    it('calls beforeRequest hook', async () => {
      const beforeRequest = vi.fn()
      lifecycleManager.register('TestAPI', { beforeRequest })
      const ctx = {} as RequestContext
      await lifecycleManager.executeBeforeRequest('TestAPI', ctx)
      expect(beforeRequest).toHaveBeenCalledWith(ctx)
    })

    it('does nothing if hook not registered', async () => {
      await expect(lifecycleManager.executeBeforeRequest('NoAPI', {} as RequestContext)).resolves.toBeUndefined()
    })

    it('does nothing if beforeRequest not defined', async () => {
      lifecycleManager.register('TestAPI', {})
      await expect(lifecycleManager.executeBeforeRequest('TestAPI', {} as RequestContext)).resolves.toBeUndefined()
    })
  })

  describe('executeAfterRequest', () => {
    it('calls afterRequest hook', async () => {
      const afterRequest = vi.fn()
      lifecycleManager.register('TestAPI', { afterRequest })
      const ctx = {} as RequestContext
      await lifecycleManager.executeAfterRequest('TestAPI', ctx)
      expect(afterRequest).toHaveBeenCalledWith(ctx)
    })

    it('does nothing if hook not registered', async () => {
      await expect(lifecycleManager.executeAfterRequest('NoAPI', {} as RequestContext)).resolves.toBeUndefined()
    })
  })

  describe('executeOnError', () => {
    it('calls onError hook', async () => {
      const onError = vi.fn()
      lifecycleManager.register('TestAPI', { onError })
      const ctx = {} as RequestContext
      const error = new Error('test error')
      await lifecycleManager.executeOnError('TestAPI', ctx, error)
      expect(onError).toHaveBeenCalledWith(ctx, error)
    })

    it('does nothing if hook not registered', async () => {
      await expect(lifecycleManager.executeOnError('NoAPI', {} as RequestContext, new Error())).resolves.toBeUndefined()
    })
  })

  describe('multiple hooks for same API', () => {
    it('only one set of hooks per API name', () => {
      const hooks1: LifecycleHooks = { beforeRequest: vi.fn() }
      const hooks2: LifecycleHooks = { beforeRequest: vi.fn() }
      lifecycleManager.register('SameAPI', hooks1)
      lifecycleManager.register('SameAPI', hooks2)
      const retrieved = lifecycleManager.getHooks('SameAPI')
      expect(retrieved).toBe(hooks2)
    })
  })
})
