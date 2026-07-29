import { registerPlugin } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

export interface GalleryPluginDef {
  saveImage(options: {
    base64: string
    album: string
    fileName: string
  }): Promise<{ uri: string }>
}

const Gallery = registerPlugin<GalleryPluginDef>('Gallery')

/**
 * Save image to system gallery via native plugin.
 * Returns true if saved successfully, false otherwise.
 */
export async function saveToGallery(base64: string, album: string, fileName: string): Promise<boolean> {
  try {
    const result = await Gallery.saveImage({ base64, album, fileName })
    return result?.uri != null
  } catch {
    // Gallery plugin unavailable or failed — return false
    return false
  }
}
