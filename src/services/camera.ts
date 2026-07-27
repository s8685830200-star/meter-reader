import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { PHOTO_DIRS } from '@/types'

function generatePhotoFileName(userName: string, userNo: string, meterNo: string): string {
  const suffix = meterNo.slice(-6).padStart(6, '0')
  const sn = userName.replace(/[\\/:*?"<>|]/g, '_')
  const su = userNo.replace(/[\\/:*?"<>|]/g, '_')
  return `${sn}_${su}_${suffix}.jpg`
}

async function takePhotoAndSave(dirName: string, userName: string, userNo: string, meterNo: string): Promise<string> {
  // 使用 Base64 模式获取照片，避免 Uri 路径读取兼容性问题
  const image = await Camera.getPhoto({ resultType: CameraResultType.Base64, source: CameraSource.Camera, quality: 80, allowEditing: false, saveToGallery: true })
  if (!image.base64String) throw new Error('拍照失败')
  const fileName = generatePhotoFileName(userName, userNo, meterNo)
  const savedPath = `${dirName}/${fileName}`
  // 直接写入 base64 数据到应用 Documents 目录
  await Filesystem.writeFile({ path: savedPath, data: image.base64String, directory: Directory.Documents, recursive: true })
  return savedPath
}

export async function takePositionPhoto(userName: string, userNo: string, meterNo: string): Promise<string> {
  return takePhotoAndSave(PHOTO_DIRS.POSITION, userName, userNo, meterNo)
}

export async function takeEnvironmentPhoto(userName: string, userNo: string, meterNo: string): Promise<string> {
  return takePhotoAndSave(PHOTO_DIRS.ENVIRONMENT, userName, userNo, meterNo)
}

export async function checkCameraPermission(): Promise<boolean> {
  try {
    const p = await Camera.checkPermissions()
    return p.camera === 'granted' || p.camera === 'limited'
  } catch { return false }
}

export async function requestCameraPermission(): Promise<void> {
  await Camera.requestPermissions()
}
