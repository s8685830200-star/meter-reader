import { Geolocation } from '@capacitor/geolocation'

export interface GpsResult {
  latitude: number
  longitude: number
  accuracy: number | null
}

/**
 * Try Capacitor Geolocation first (needs Google Play Services).
 * Falls back to HTML5 Geolocation API which works on all devices.
 */
export async function getCurrentPosition(timeoutMs = 15000): Promise<GpsResult> {
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 30000,
    })
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
    }
  } catch {
    return getCurrentPositionHtml5(true, timeoutMs)
  }
}

export async function getCurrentPositionCoarse(timeoutMs = 10000): Promise<GpsResult> {
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: timeoutMs,
      maximumAge: 60000,
    })
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
    }
  } catch {
    return getCurrentPositionHtml5(false, timeoutMs)
  }
}

function getCurrentPositionHtml5(highAccuracy: boolean, timeoutMs: number): Promise<GpsResult> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 30000 },
    )
  })
}

/**
 * Check location permission.
 * Uses Capacitor which calls Android's native permission check (no Google Play Services needed).
 */
export async function checkLocationPermission(): Promise<boolean> {
  try {
    const p = await Geolocation.checkPermissions()
    return p.location === 'granted' || p.coarseLocation === 'granted'
  } catch {
    // Fallback: navigator.permissions API
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' } as any)
      return result.state === 'granted'
    } catch {
      return false
    }
  }
}

/**
 * Request location permission.
 * Uses Capacitor to trigger the Android runtime permission dialog.
 */
export async function requestLocationPermission(): Promise<void> {
  try {
    await Geolocation.requestPermissions()
  } catch {
    // If Capacitor fails, try to trigger the browser permission prompt
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              reject(new Error('定位权限被拒绝'))
            } else {
              resolve()
            }
          },
          { timeout: 1, maximumAge: 0 },
        )
      })
    } catch { /* silent */ }
  }
}