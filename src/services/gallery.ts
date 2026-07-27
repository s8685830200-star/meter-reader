import { registerPlugin } from '@capacitor/core'

export interface GalleryPlugin {
  saveImage(options: {
    base64: string
    album: string
    fileName: string
  }): Promise<{ uri: string; path: string }>
}

const Gallery = registerPlugin<GalleryPlugin>('Gallery')

export async function saveToGallery(base64: string, album: string, fileName: string): Promise<void> {
  try {
    await Gallery.saveImage({ base64, album, fileName })
  } catch (e) {
    console.warn('Gallery save failed:', e)
    // Silently fail — the photo is still in app storage
  }
}
