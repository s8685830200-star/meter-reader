/**
 * Embed GPS coordinates into a JPEG base64 string as EXIF data.
 * Uses piexifjs to modify the JPEG metadata.
 */
import piexif from 'piexifjs'

/**
 * Convert a decimal degree to EXIF DMS (Degrees, Minutes, Seconds) format.
 * EXIF stores each component as a rational (numerator, denominator).
 */
function toExifDms(degree: number): [number, number][] {
  const d = Math.abs(degree)
  const deg = Math.floor(d)
  const min = Math.floor((d - deg) * 60)
  const sec = Math.round(((d - deg) * 60 - min) * 10000)
  return [
    [deg, 1],
    [min, 1],
    [sec, 10000],
  ]
}

/**
 * Embed GPS EXIF data into a JPEG base64 string.
 * @param base64Data - Raw base64-encoded JPEG (without data-uri prefix)
 * @param latitude - Decimal latitude
 * @param longitude - Decimal longitude
 * @returns New base64 string with GPS EXIF embedded
 */
export function embedGpsExif(
  base64Data: string,
  latitude: number,
  longitude: number,
): string {
  try {
    const binary = atob(base64Data)
    const exifData = piexif.load(binary)

    exifData.GPS = {
      [piexif.GPSIFD.GPSVersionID]: [2, 3, 0, 0],
      [piexif.GPSIFD.GPSLatitudeRef]: latitude >= 0 ? 'N' : 'S',
      [piexif.GPSIFD.GPSLatitude]: toExifDms(latitude),
      [piexif.GPSIFD.GPSLongitudeRef]: longitude >= 0 ? 'E' : 'W',
      [piexif.GPSIFD.GPSLongitude]: toExifDms(longitude),
    }

    const exifBytes = piexif.dump(exifData)
    const newBinary = piexif.insert(exifBytes, binary)
    return btoa(newBinary)
  } catch {
    // If EXIF embedding fails, return original data unchanged
    return base64Data
  }
}