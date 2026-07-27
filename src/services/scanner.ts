import { Html5Qrcode } from 'html5-qrcode'
import { captureImageFromCamera } from './fileInput'

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

/**
 * Scan a File (image) for barcode content.
 * Returns the decoded text, or null if no barcode found.
 */
export async function scanBarcodeFromFile(file: File): Promise<string | null> {
  ensureScannerElement()
  const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false })
  try {
    return await scanner.scanFile(file, false)
  } catch {
    return null
  } finally {
    try { scanner.clear() } catch {}
  }
}

/**
 * Open camera, take a photo, and scan it for a barcode.
 * Returns { barcode, file, base64 }.
 * barcode is null if no barcode was detected.
 */
export async function captureAndScan(): Promise<{
  barcode: string | null
  file: File
  base64: string
}> {
  ensureScannerElement()

  // 1. Capture photo via system camera
  const file = await captureImageFromCamera()

  // 2. Convert to base64 (for saving later)
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      if (!result) { reject(new Error('文件读取失败')); return }
      resolve(result.includes('base64,') ? result.split('base64,')[1] : result)
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })

  // 3. Scan for barcode
  let barcode: string | null = null
  const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false })
  try {
    barcode = await scanner.scanFile(file, false)
  } catch {
    // No barcode found — that's OK
  } finally {
    try { scanner.clear() } catch {}
  }

  return { barcode, file, base64 }
}

// Legacy API compatibility — kept for any existing callers
export async function startScanner(
  onResult: (code: string) => void,
  onError?: (err: string) => void,
): Promise<void> {
  try {
    const { barcode } = await captureAndScan()
    if (barcode) {
      onResult(barcode)
    } else {
      if (onError) onError('未识别到条码，请手动输入电表编号')
    }
  } catch (err: any) {
    const msg = err?.message || '扫码失败'
    if (onError && msg !== '用户取消拍照') onError(msg)
    else if (!onError) throw new Error(msg)
  }
}

export async function stopScanner(): Promise<void> {}

export function isScanning(): boolean {
  return false
}
