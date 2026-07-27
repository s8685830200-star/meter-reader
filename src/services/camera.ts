import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { PHOTO_DIRS } from '@/types'

function generatePhotoFileName(userName: string, userNo: string, meterNo: string): string {
  const suffix = meterNo.slice(-6).padStart(6, '0')
  const sn = userName.replace(/[\\/:*?"<>|]/g, '_')
  const su = userNo.replace(/[\\/:*?"<>|]/g, '_')
  return `${sn}_${su}_${suffix}.jpg`
}

async function takePhotoAndSave(dirName: string, userName: string, userNo: string, meterNo: string): Promise<string> {
  const image = await Camera.getPhoto({ resultType: CameraResultType.Uri, source: CameraSource.Camera, quality: 80, allowEditing: false, saveToGallery: true })
  if (!image.path) throw new Error('拍照失败')
  const fileName = generatePhotoFileName(userName, userNo, meterNo)
  const savedPath = `${dirName}/${fileName}`
  // 保存到应用 Documents 目录
  const photoData = await Filesystem.readFile({ path: image.path, directory: Directory.Data })
  await Filesystem.writeFile({ path: savedPath, data: photoData.data, directory: Directory.Documents, recursive: true })
  return savedPath
}

export async function takePositionPhoto(userName: string, userNo: string, meterNo: string): Promise<string> {
  return takePhotoAndSave(PHOTO_DIRS.POSITION, userName, userNo, meterNo)
}

export async function takeEnvironmentPhoto(userName: string, userNo: string, meterNo: string): Promise<string> {
  return takePhotoAndSave(PHOTO_DIRS.ENVIRONMENT, userName, userNo, meterNo)
}

export async function shareFile(filePath: string): Promise<void> {
  await Share.share({ title: '抄表记录', text: '抄表记录导出文件', files: [filePath] })
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
