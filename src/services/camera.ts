import { Filesystem, Directory } from '@capacitor/filesystem'
import { captureImageFromCamera, fileToBase64 } from './fileInput'
import { saveToGallery } from './gallery'
import { PHOTO_DIRS } from '@/types'

function generatePhotoFileName(userName: string, userNo: string, meterNo: string): string {
  const suffix = meterNo.slice(-6).padStart(6, '0')
  const sn = userName.replace(/[\\/:*?"<>|]/g, '_')
  const su = userNo.replace(/[\\/:*?"<>|]/g, '_')
  return `${sn}_${su}_${suffix}.jpg`
}

/**
 * Capture a photo via <input capture> and return File + base64 data.
 */
export async function capturePhoto(): Promise<{ file: File; base64: string }> {
  const file = await captureImageFromCamera()
  const base64 = await fileToBase64(file)
  return { file, base64 }
}

/**
 * Save photo to app private storage (for export/backup)
 */
async function saveToAppStorage(base64Data: string, dirName: string, fileName: string): Promise<string> {
  const savedPath = `${dirName}/${fileName}`
  await Filesystem.writeFile({
    path: savedPath,
    data: base64Data,
    directory: Directory.Data,
    recursive: true,
  })
  return savedPath
}

/**
 * Save position photo: app storage + system gallery album "抄表电表照片"
 */
export async function savePositionPhoto(
  userName: string,
  userNo: string,
  meterNo: string,
  base64Data: string,
): Promise<string> {
  const fileName = generatePhotoFileName(userName, userNo, meterNo)
  // Save to system gallery (Pictures/抄表电表照片/)
  const now = new Date()
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const galleryName = `${userName}_${ts}.jpg`
  saveToGallery(base64Data, '抄表电表照片', galleryName)
  // Save to app storage
  return saveToAppStorage(base64Data, PHOTO_DIRS.POSITION, fileName)
}

/**
 * Save environment photo: app storage + system gallery album "抄表现场照片"
 */
export async function saveEnvironmentPhoto(
  userName: string,
  userNo: string,
  meterNo: string,
  base64Data: string,
): Promise<string> {
  const fileName = generatePhotoFileName(userName, userNo, meterNo)
  // Save to system gallery (Pictures/抄表现场照片/)
  const now = new Date()
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const galleryName = `${userName}_${ts}.jpg`
  saveToGallery(base64Data, '抄表现场照片', galleryName)
  // Save to app storage
  return saveToAppStorage(base64Data, PHOTO_DIRS.ENVIRONMENT, fileName)
}

// Permission stubs
export async function checkCameraPermission(): Promise<boolean> { return true }
export async function requestCameraPermission(): Promise<void> {}
