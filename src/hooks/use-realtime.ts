'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { invalidateQueries } from './use-supabase-query'

type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface RealtimeOptions {
  /** Table to subscribe to */
  table: string
  /** Schema (default: public) */
  schema?: string
  /** Filter string (e.g. "group_id=eq.xxx") */
  filter?: string
  /** Events to listen for (default: all) */
  event?: PostgresEvent
  /** Cache key prefix to invalidate on changes */
  invalidateKey?: string
  /** Custom callback on any change */
  onData?: (payload: RealtimePostgresChangesPayload<any>) => void
  /** Whether subscription is active (default: true) */
  enabled?: boolean
}

/**
 * Subscribe to Supabase Realtime changes on a table.
 * Automatically invalidates the useSupabaseQuery cache so all
 * consumers of the same cache key re-render with fresh data.
 */
export function useRealtime(options: RealtimeOptions) {
  const {
    table,
    schema = 'public',
    filter,
    event = '*',
    invalidateKey,
    onData,
    enabled = true,
  } = options

  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const channelName = `realtime:${schema}:${table}${filter ? ':' + filter : ''}`

    const channelConfig: any = {
      event,
      schema,
      table,
    }
    if (filter) channelConfig.filter = filter

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', channelConfig, (payload: RealtimePostgresChangesPayload<any>) => {
        // Invalidate cache so useSupabaseQuery subscribers auto-update
        if (invalidateKey) {
          invalidateQueries(invalidateKey)
        }
        // Custom callback
        onData?.(payload)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [table, schema, filter, event, invalidateKey, enabled])
}

/**
 * Subscribe to multiple tables at once.
 * Useful for pages that load from several related tables.
 */
export function useRealtimeGroup(groupId: string, tables: string[], options?: { enabled?: boolean }) {
  const enabled = options?.enabled !== false

  useEffect(() => {
    if (!enabled || !groupId) return

    const supabase = createClient()
    const channels: RealtimeChannel[] = []

    for (const table of tables) {
      const channel = supabase
        .channel(`realtime:${table}:group:${groupId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          filter: `group_id=eq.${groupId}`,
        }, () => {
          invalidateQueries(table)
          invalidateQueries(groupId)
        })
        .subscribe()

      channels.push(channel)
    }

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch))
    }
  }, [groupId, tables.join(','), enabled])
}
