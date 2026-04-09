import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Check if the browser supports push notifications.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/**
 * Convert a URL-safe base64 string to a Uint8Array (for VAPID key).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Subscribe to push notifications and save the subscription to Supabase.
 */
export async function subscribeToPush(
  supabase: SupabaseClient,
  groupId: string
): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn('Push notifications are not supported in this browser.')
    return null
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    console.warn('Notification permission denied.')
    return null
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidPublicKey) {
    console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.')
    return null
  }

  const registration = await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  })

  const subscriptionJSON = subscription.toJSON()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('User not authenticated.')
    return null
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      group_id: groupId,
      endpoint: subscriptionJSON.endpoint,
      p256dh: subscriptionJSON.keys?.p256dh,
      auth: subscriptionJSON.keys?.auth,
    },
    { onConflict: 'user_id,group_id' }
  )

  if (error) {
    console.error('Failed to save push subscription:', error.message)
    return null
  }

  return subscription
}

/**
 * Unsubscribe from push notifications and remove the subscription from Supabase.
 */
export async function unsubscribeFromPush(
  supabase: SupabaseClient,
  groupId: string
): Promise<boolean> {
  if (!isPushSupported()) {
    return false
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    await subscription.unsubscribe()
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return false
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('group_id', groupId)

  if (error) {
    console.error('Failed to remove push subscription:', error.message)
    return false
  }

  return true
}
