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
 * Use <input type="file" capture="environment"> to take a photo.
 * This bypasses the Capacitor Camera plugin's EXTRA_OUTPUT approach which
 * fails on many Chinese OEM ROMs (MagicOS, MIUI, ColorOS, etc.) where the
 * system camera app ignores the EXTRA_OUTPUT file URI.
 */
async function takePhotoAndSave(
  dirName: string,
  userName: string,
  userNo: string,
  meterNo: string,
): Promise<string> {
  // 1. Capture image using native camera via file input (most reliable approach)
  const file = await captureImageFromCamera()

  // 2. Convert to base64
  const base64Data = await fileToBase64(file)

  // 3. Save to app Documents directory
  const fileName = generatePhotoFileName(userName, userNo, meterNo)
  const savedPath = `${dirName}/${fileName}`
  await Filesystem.writeFile({
    path: savedPath,
    data: base64Data,
    directory: Directory.Documents,
    recursive: true,
  })

  return savedPath
}

export async function takePositionPhoto(
  userName: string,
  userNo: string,
  meterNo: string,
): Promise<string> {
  return takePhotoAndSave(PHOTO_DIRS.POSITION, userName, userNo, meterNo)
}

export async function takeEnvironmentPhoto(
  userName: string,
  userNo: string,
  meterNo: string,
): Promise<string> {
  return takePhotoAndSave(PHOTO_DIRS.ENVIRONMENT, userName, userNo, meterNo)
}

// Permission helpers — kept for the Home.vue guard logic
// Since we now use <input capture> (which delegates camera permission to the
// system camera app), these are only advisory.
export async function checkCameraPermission(): Promise<boolean> {
  // With the file input approach, the system camera app handles its own
  // permissions. Our app doesn't need CAMERA permission for <input capture>.
  // Return true to skip the Capacitor permission flow.
  return true
}

export async function requestCameraPermission(): Promise<void> {
  // No-op: <input capture> doesn't require our app to hold CAMERA permission
}
