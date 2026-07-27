import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'

/**
 * Start real-time barcode scanning (native camera view).
 * When a barcode is detected, auto-stops and returns the result.
 */
export async function startLiveScan(): Promise<string> {
  await BarcodeScanner.checkPermissions()
  await BarcodeScanner.requestPermissions()
  await BarcodeScanner.removeAllListeners()

  return new Promise<string>(async (resolve, reject) => {
    let resolved = false

    await BarcodeScanner.addListener('barcodesScanned', (event) => {
      if (resolved) return
      const barcode = event.barcodes?.[0]
      if (barcode?.displayValue) {
        resolved = true
        stopLiveScan()
        resolve(barcode.displayValue)
      }
    })

    await BarcodeScanner.addListener('scanError', (error) => {
      if (resolved) return
      resolved = true
      stopLiveScan()
      reject(new Error(error.message || '扫描失败'))
    })

    try {
      await BarcodeScanner.startScan()
    } catch (err: any) {
      if (!resolved) {
        resolved = true
        reject(new Error(err?.message || '无法启动相机扫描'))
      }
    }
  })
}

export async function stopLiveScan(): Promise<void> {
  try {
    await BarcodeScanner.stopScan()
    await BarcodeScanner.removeAllListeners()
  } catch {}
}

// Legacy API compatibility
export async function startScanner(
  onResult: (code: string) => void,
  onError?: (err: string) => void,
): Promise<void> {
  try {
    const code = await startLiveScan()
    onResult(code)
  } catch (err: any) {
    if (onError) onError(err?.message || '扫码失败')
  }
}

export async function stopScanner(): Promise<void> {
  await stopLiveScan()
}

export function isScanning(): boolean {
  return false
}
