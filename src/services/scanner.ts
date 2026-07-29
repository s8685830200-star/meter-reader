import { Html5Qrcode } from 'html5-qrcode'
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'

let activeScanner: Html5Qrcode | null = null
let scannerContainer: HTMLElement | null = null

function cleanup() {
  if (activeScanner) {
    try { activeScanner.stop().catch(() => {}) } catch {}
    activeScanner = null
  }
  if (scannerContainer) {
    try { scannerContainer.remove() } catch {}
    scannerContainer = null
  }
}

/**
 * Start real-time barcode scanning with a live camera preview.
 * Uses html5-qrcode at a constrained resolution (640x480) for speed.
 * Falls back to ML Kit native scanner if WebRTC is unavailable.
 */
export async function startLiveScan(): Promise<string> {
  cleanup()

  // Try html5-qrcode first (has live preview)
  try {
    return await startHtml5Scan()
  } catch (err: any) {
    // If WebRTC/UserMedia is not available, fall back to ML Kit
    if (err?.message?.includes('getUserMedia') || err?.message?.includes('摄像头')) {
      return await startMlKitScan()
    }
    throw err
  }
}

// ──────── html5-qrcode with preview ────────

async function startHtml5Scan(): Promise<string> {
  const containerId = 'scanner-overlay-' + Date.now()
  const container = document.createElement('div')
  container.id = containerId
  container.style.cssText = [
    'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;',
    'background:#000;display:flex;flex-direction:column;overflow:hidden;',
  ].join('')

  // Top bar
  const topBar = document.createElement('div')
  topBar.style.cssText = [
    'display:flex;justify-content:space-between;align-items:center;',
    'padding:12px 16px;background:rgba(0,0,0,0.85);z-index:1;flex-shrink:0;',
  ].join('')
  const title = document.createElement('span')
  title.textContent = '扫码识别电表'
  title.style.cssText = 'color:#fff;font-size:16px;font-weight:600;'
  const closeBtn = document.createElement('button')
  closeBtn.textContent = '关闭'
  closeBtn.style.cssText = [
    'color:#fff;background:rgba(255,255,255,0.15);border:none;',
    'border-radius:20px;padding:8px 20px;font-size:15px;',
  ].join('')
  topBar.appendChild(title)
  topBar.appendChild(closeBtn)
  container.appendChild(topBar)

  // Camera preview area
  const viewId = containerId + '-view'
  const view = document.createElement('div')
  view.id = viewId
  view.style.cssText = [
    'flex:1;display:flex;align-items:center;justify-content:center;',
    'overflow:hidden;position:relative;min-height:0;',
  ].join('')
  container.appendChild(view)

  // Hint
  const hint = document.createElement('div')
  hint.textContent = '将条码对准取景框，自动识别'
  hint.style.cssText = [
    'color:#fff;text-align:center;padding:14px;',
    'background:rgba(0,0,0,0.85);font-size:14px;flex-shrink:0;',
  ].join('')
  container.appendChild(hint)

  document.body.appendChild(container)
  scannerContainer = container

  return new Promise<string>((resolve, reject) => {
    let resolved = false

    const done = (val: string | null, err?: Error) => {
      if (resolved) return
      resolved = true
      cleanup()
      if (err) reject(err)
      else resolve(val!)
    }

    closeBtn.onclick = () => done(null, new Error('用户取消扫码'))

    activeScanner = new Html5Qrcode(viewId)

    activeScanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (vw: number) => ({
            width: Math.min(vw * 0.75, 360),
            height: Math.min(vw * 0.55, 240),
          }),
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        },
        (decodedText) => done(decodedText),
        () => {},
      )
      .catch((err: any) =>
        done(null, new Error(err?.message || '无法启动相机扫码')),
      )
  })
}

// ──────── ML Kit fallback (no preview, but works on more devices) ────────

let mlKitResolve: ((val: string) => void) | null = null
let mlKitReject: ((err: Error) => void) | null = null

async function startMlKitScan(): Promise<string> {
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
        stopMlKitScan()
        resolve(barcode.displayValue)
      }
    })

    await BarcodeScanner.addListener('scanError', (error) => {
      if (resolved) return
      resolved = true
      stopMlKitScan()
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

async function stopMlKitScan(): Promise<void> {
  try {
    await BarcodeScanner.stopScan()
    await BarcodeScanner.removeAllListeners()
  } catch {}
}

// ──────── Public API ────────

export async function stopLiveScan(): Promise<void> {
  cleanup()
  await stopMlKitScan()
}

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
  return activeScanner !== null
}