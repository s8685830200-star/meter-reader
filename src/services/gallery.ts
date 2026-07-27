import { registerPlugin } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

export interface GalleryPlugin {
  saveImage(options: {
    base64: string
    album: string
    fileName: string
  }): Promise<{ uri: string }>
}

const Gallery = registerPlugin<GalleryPlugin>('Gallery')

export async function saveToGallery(base64: string, album: string, fileName: string): Promise<boolean> {
  try {
    await Gallery.saveImage({ base64, album, fileName })
    return true
  } catch {
    // Fallback: write to app external storage
    try {
      await Filesystem.writeFile({
        path: `${album}/${fileName}`,
        data: base64,
        directory: Directory.External,
        recursive: true,
      })
    } catch {
      // silently fail — photo is still in app storage
    }
    return false
  }
}
