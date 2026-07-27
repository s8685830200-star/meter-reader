import { Filesystem, Directory } from '@capacitor/filesystem'
import { captureImageFromCamera, fileToBase64 } from './fileInput'
import { PHOTO_DIRS } from '@/types'

function generatePhotoFileName(userName: string, userNo: string, meterNo: string): string {
  const suffix = meterNo.slice(-6).padStart(6, '0')
  const sn = userName.replace(/[\\/:*?"<>|]/g, '_')
  const su = userNo.replace(/[\\/:*?"<>|]/g, '_')
  return `${sn}_${su}_${suffix}.jpg`
}

/**
 * Generate a temporary file name for photos taken before meter is identified
 */
function generateTempFileName(): string {
  return `temp_${Date.now()}.jpg`
}

/**
 * Capture a photo via <input capture> and return File + base64 data.
 * Used when we need the raw file for barcode scanning AND the base64 for saving.
 */
export async function capturePhoto(): Promise<{ file: File; base64: string }> {
  const file = await captureImageFromCamera()
  const base64 = await fileToBase64(file)
  return { file, base64 }
}

/**
 * Save photo data to app private storage (Directory.Data — no permissions needed)
 */
export async function savePhoto(
  base64Data: string,
  dirName: string,
  fileName: string,
): Promise<string> {
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
 * Save a position photo with meter info in the filename
 */
export async function savePositionPhoto(
  userName: string,
  userNo: string,
  meterNo: string,
  base64Data: string,
): Promise<string> {
  const fileName = generatePhotoFileName(userName, userNo, meterNo)
  return savePhoto(base64Data, PHOTO_DIRS.POSITION, fileName)
}

/**
 * Save an environment photo with meter info in the filename
 */
export async function saveEnvironmentPhoto(
  userName: string,
  userNo: string,
  meterNo: string,
  base64Data: string,
): Promise<string> {
  const fileName = generatePhotoFileName(userName, userNo, meterNo)
  return savePhoto(base64Data, PHOTO_DIRS.ENVIRONMENT, fileName)
}

// Permission stubs — <input capture> delegates to system camera app
export async function checkCameraPermission(): Promise<boolean> {
  return true
}

export async function requestCameraPermission(): Promise<void> {
  // no-op
}
