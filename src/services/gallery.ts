import { registerPlugin } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

export interface GalleryPlugin {
  saveImage(options: {
    base64: string
    album: string
    fileName: string
  }): Promise<{ uri: string; path: string }>
}

const Gallery = registerPlugin<GalleryPlugin>('Gallery')

/**
 * Save photo to system gallery album (e.g. Pictures/抄表电表照片/).
 * Falls back to app external storage if MediaStore insert fails.
 */
export async function saveToGallery(base64: string, album: string, fileName: string): Promise<void> {
  try {
    await Gallery.saveImage({ base64, album, fileName })
  } catch {
    // Fallback: save to accessible location
    try {
      await Filesystem.writeFile({
        path: `${album}/${fileName}`,
        data: base64,
        directory: Directory.External,
        recursive: true,
      })
    } catch {
      // Absolute last resort
      console.warn('Gallery save failed completely')
    }
  }
}
