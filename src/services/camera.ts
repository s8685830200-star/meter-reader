import { Filesystem, Directory } from '@capacitor/filesystem'
import { captureImageFromCamera, fileToBase64 } from './fileInput'
import { saveToGallery } from './gallery'
import { getStoragePrefs, type StorageTarget } from './storagePrefs'
import { PHOTO_DIRS } from '@/types'

function generatePhotoFileName(userName: string, userNo: string, meterNo: string): string {
  const suffix = meterNo.slice(-6).padStart(6, '0')
  const sn = userName.replace(/[\\/:*?"<>|]/g, '_')
  const su = userNo.replace(/[\\/:*?"<>|]/g, '_')
  return `${sn}_${su}_${suffix}.jpg`
}

export async function capturePhoto(): Promise<{ file: File; base64: string }> {
  const file = await captureImageFromCamera()
  const base64 = await fileToBase64(file)
  return { file, base64 }
}

/**
 * Save photo to internal storage plus the user's preferred secondary location.
 *
 * Internal storage always succeeds (for app-internal viewing/export).
 * The secondary save (gallery / file-manager) is best-effort and its
 * outcome is reported through displayPath so the user sees what happened.
 */
async function savePhotoWithPref(
  base64Data: string,
  dirName: string,
  fileName: string,
  galleryAlbum: string,
  prefKey: 'positionPhoto' | 'environmentPhoto',
): Promise<{ savedPath: string; displayPath: string }> {
  const prefs = getStoragePrefs()
  const target: StorageTarget = prefs[prefKey]

  // --- always save to internal app storage (reliable, for Records page) ---
  const savedPath = `${dirName}/${fileName}`
  await Filesystem.writeFile({
    path: savedPath,
    data: base64Data,
    directory: Directory.Data,
    recursive: true,
  })

  const galleryName = fileName.replace('.jpg', '') + '_' + Date.now() + '.jpg'

  // --- secondary save based on user preference ---
  if (target === 'gallery') {
    const ok = await saveToGallery(base64Data, galleryAlbum, galleryName)
    if (ok) {
      return { savedPath, displayPath: `系统相册 → ${galleryAlbum}` }
    }
    return { savedPath, displayPath: '应用内部（保存到系统相册失败，可在 Records 页面查看）' }
  }

  if (target === 'external') {
    try {
      await Filesystem.writeFile({
        path: `${galleryAlbum}/${galleryName}`,
        data: base64Data,
        directory: Directory.External,
        recursive: true,
      })
      const extPath = `Android/data/com.meterreader.app/files/${galleryAlbum}`
      return { savedPath, displayPath: `文件管理器 → ${extPath}` }
    } catch {
      return { savedPath, displayPath: '应用内部（保存到文件管理器失败，可在 Records 页面查看）' }
    }
  }

  // target === 'internal'
  return { savedPath, displayPath: '应用内部（Records 页面可查看）' }
}

export async function savePositionPhoto(
  userName: string,
  userNo: string,
  meterNo: string,
  base64Data: string,
): Promise<{ savedPath: string; displayPath: string }> {
  const fileName = generatePhotoFileName(userName, userNo, meterNo)
  return savePhotoWithPref(base64Data, PHOTO_DIRS.POSITION, fileName, '抄表电表照片', 'positionPhoto')
}

export async function saveEnvironmentPhoto(
  userName: string,
  userNo: string,
  meterNo: string,
  base64Data: string,
): Promise<{ savedPath: string; displayPath: string }> {
  const fileName = generatePhotoFileName(userName, userNo, meterNo)
  return savePhotoWithPref(base64Data, PHOTO_DIRS.ENVIRONMENT, fileName, '抄表现场照片', 'environmentPhoto')
}

export async function checkCameraPermission(): Promise<boolean> { return true }
export async function requestCameraPermission(): Promise<void> {}
