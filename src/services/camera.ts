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

function galleryTimestamp(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
}

export async function capturePhoto(): Promise<{ file: File; base64: string }> {
  const file = await captureImageFromCamera()
  const base64 = await fileToBase64(file)
  return { file, base64 }
}

/**
 * Save photo to the appropriate location based on user preference.
 * Returns the saved path (for records) and a display path (for user info).
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

  // Always save to app internal storage as primary (for records/export)
  const savedPath = `${dirName}/${fileName}`
  await Filesystem.writeFile({
    path: savedPath,
    data: base64Data,
    directory: Directory.Data,
    recursive: true,
  })

  const galleryName = `${fileName.replace('.jpg', '')}_${galleryTimestamp()}.jpg`
  let displayPath = '应用内部 (Records页面可查看)'

  try {
    if (target === 'gallery') {
      // Save to system gallery album
      await saveToGallery(base64Data, galleryAlbum, galleryName)
      displayPath = `系统图库 → ${galleryAlbum}`
    } else if (target === 'external') {
      // Save to app external storage (visible in file manager)
      await Filesystem.writeFile({
        path: `${galleryAlbum}/${galleryName}`,
        data: base64Data,
        directory: Directory.External,
        recursive: true,
      })
      displayPath = `文件管理器 → Android/data/com.meterreader.app/files/${galleryAlbum}`
    } else {
      displayPath = '应用内部 (Records页面可查看)'
    }
  } catch {
    // Fallback: internal storage always works
  }

  return { savedPath, displayPath }
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
