'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface QueryOptions {
  /** Cache key - used to deduplicate and cache results */
  key: string
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number
  /** Whether to fetch immediately on mount */
  enabled?: boolean
  /** Stale time in milliseconds - won't refetch if data is younger than this */
  staleTime?: number
}

interface QueryResult<T> {
  data: T | null
  error: Error | null
  loading: boolean
  refetch: () => Promise<void>
  isStale: boolean
}

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number; subscribers: Set<() => void> }>()

export function useSupabaseQuery<T>(
  queryFn: (supabase: ReturnType<typeof createClient>) => Promise<{ data: T | null; error: any }>,
  options: QueryOptions
): QueryResult<T> {
  const { key, refreshInterval = 0, enabled = true, staleTime = 30000 } = options
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [isStale, setIsStale] = useState(false)
  const mountedRef = useRef(true)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!enabled) return

    // Check cache first
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < staleTime) {
      if (mountedRef.current) {
        setData(cached.data)
        setLoading(false)
        setIsStale(false)
      }
      return
    }

    // Mark as stale if we have cached data but it's old
    if (cached) {
      setIsStale(true)
    }

    try {
      const { data: result, error: queryError } = await queryFn(supabase)

      if (queryError) {
        if (mountedRef.current) {
          setError(new Error(queryError.message))
          setLoading(false)
        }
        return
      }

      // Update cache
      const entry = cache.get(key) || { data: null, timestamp: 0, subscribers: new Set() }
      entry.data = result
      entry.timestamp = Date.now()
      cache.set(key, entry)

      // Notify all subscribers
      entry.subscribers.forEach((cb) => cb())

      if (mountedRef.current) {
        setData(result)
        setError(null)
        setLoading(false)
        setIsStale(false)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setLoading(false)
      }
    }
  }, [key, enabled, staleTime, queryFn, supabase])

  // Subscribe to cache updates
  useEffect(() => {
    const entry = cache.get(key) || { data: null, timestamp: 0, subscribers: new Set() }

    const onUpdate = () => {
      const cached = cache.get(key)
      if (cached && mountedRef.current) {
        setData(cached.data)
        setIsStale(false)
      }
    }

    entry.subscribers.add(onUpdate)
    if (!cache.has(key)) cache.set(key, entry)

    return () => {
      entry.subscribers.delete(onUpdate)
    }
  }, [key])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval <= 0) return
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval])

  // Cleanup
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refetch = useCallback(async () => {
    // Invalidate cache
    cache.delete(key)
    setLoading(true)
    await fetchData()
  }, [key, fetchData])

  return { data, error, loading, refetch, isStale }
}

// Utility to invalidate cache entries by prefix
export function invalidateQueries(keyPrefix: string) {
  for (const [key] of cache) {
    if (key.startsWith(keyPrefix)) {
      const entry = cache.get(key)
      if (entry) {
        entry.timestamp = 0 // Mark as stale
        entry.subscribers.forEach((cb) => cb())
      }
    }
  }
}

// Utility to clear all cache
export function clearQueryCache() {
  cache.clear()
}
