import { Html5Qrcode } from 'html5-qrcode'
import { captureImageFromCamera } from './fileInput'

/**
 * Scan a barcode by first capturing a photo (via system camera app through
 * <input capture>), then decoding it with html5-qrcode's scanFile.
 *
 * This avoids WebView's broken getUserMedia on many Android devices
 * (especially Chinese OEM ROMs like MagicOS, MIUI, ColorOS, etc.)
 */

// Hidden DOM element used by html5-qrcode for scanFile (required by the API)
const SCANNER_ELEMENT_ID = 'qr-scanner-hidden-decoder'
let scanElementCreated = false

function ensureScannerElement(): void {
  if (scanElementCreated) return
  let el = document.getElementById(SCANNER_ELEMENT_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = SCANNER_ELEMENT_ID
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;'
    document.body.appendChild(el)
  }
  scanElementCreated = true
}

export async function startScanner(
  onResult: (code: string) => void,
  onError?: (err: string) => void,
): Promise<void> {
  try {
    ensureScannerElement()

    // 1. Capture image from camera via native camera app
    const file = await captureImageFromCamera()

    // 2. Decode barcode from captured image
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false })
    try {
      const decodedText = await scanner.scanFile(file, false)
      if (decodedText) {
        onResult(decodedText)
      } else {
        if (onError) onError('未识别到条码，请重新拍照')
      }
    } finally {
      try { scanner.clear() } catch {}
    }
  } catch (err: any) {
    const msg = err?.message || '扫码失败'
    if (onError) onError(msg)
    else throw new Error(msg)
  }
}

export async function stopScanner(): Promise<void> {
  // No cleanup needed; file input approach has no persistent camera stream
}

export function isScanning(): boolean {
  // File input approach is instantaneous; no persistent scan state
  return false
}
