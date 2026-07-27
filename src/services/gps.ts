import { Geolocation } from '@capacitor/geolocation'

export interface GpsResult {
  latitude: number
  longitude: number
  accuracy: number | null
}

export async function getCurrentPosition(timeoutMs = 15000): Promise<GpsResult> {
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 })
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null }
}

export async function getCurrentPositionCoarse(): Promise<GpsResult> {
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 })
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null }
}

export async function checkLocationPermission(): Promise<boolean> {
  try {
    const p = await Geolocation.checkPermissions()
    return p.location === 'granted' || p.coarseLocation === 'granted'
  } catch { return false }
}

export async function requestLocationPermission(): Promise<void> {
  await Geolocation.requestPermissions()
}
