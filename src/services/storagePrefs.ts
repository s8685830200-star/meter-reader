const STORAGE_KEY = 'meter-reader-storage-prefs'

export type StorageTarget = 'gallery' | 'external' | 'internal'

export interface StoragePrefs {
  /** 电表照片（定位照）保存位置 */
  positionPhoto: StorageTarget
  /** 现场照片（环境照）保存位置 */
  environmentPhoto: StorageTarget
}

const DEFAULTS: StoragePrefs = {
  positionPhoto: 'external',
  environmentPhoto: 'external',
}

const LABELS: Record<StorageTarget, string> = {
  gallery: '系统相册 (Pictures)',
  external: '文件管理器 (Android/data)',
  internal: '应用内 (仅App查看)',
}

const PATHS: Record<StorageTarget, string> = {
  gallery: '图库 → Pictures/',
  external: '文件管理器 → Android/data/com.meterreader.app/files/',
  internal: '仅App内查看 (Records页面)',
}

export function getStoragePrefs(): StoragePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULTS }
}

export function setStoragePrefs(prefs: Partial<StoragePrefs>): void {
  const current = getStoragePrefs()
  const updated = { ...current, ...prefs }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

export function getStorageLabel(target: StorageTarget): string {
  return LABELS[target] || target
}

export function getStoragePath(target: StorageTarget): string {
  return PATHS[target] || target
}

export const STORAGE_OPTIONS: { value: StorageTarget; label: string }[] = [
  { value: 'external', label: '文件管理器可访问' },
  { value: 'gallery', label: '系统相册可见' },
  { value: 'internal', label: '仅App内部' },
]
