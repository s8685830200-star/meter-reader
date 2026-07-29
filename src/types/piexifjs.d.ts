declare module 'piexifjs' {
  export const GPSIFD: {
    GPSVersionID: number
    GPSLatitudeRef: number
    GPSLatitude: number
    GPSLongitudeRef: number
    GPSLongitude: number
  }

  interface ExifData {
    GPS?: Record<number, any>
    [key: string]: any
  }

  export function load(jpegBinary: string): ExifData
  export function dump(exifData: ExifData): string
  export function insert(exifBytes: string, jpegBinary: string): string
}