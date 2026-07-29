import { Html5Qrcode } from 'html5-qrcode'

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
 * Creates a full-screen overlay with a viewfinder. When a barcode is
 * detected, returns the barcode text.
 */
export async function startLiveScan(): Promise<string> {
  cleanup()

  // Test camera permission before creating the UI
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    })
    stream.getTracks().forEach((t) => t.stop())
  } catch {
    throw new Error('无法访问摄像头，请检查相机权限')
  }

  const containerId = 'scanner-overlay-' + Date.now()
  const container = document.createElement('div')
  container.id = containerId
  container.style.cssText = [
    'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;',
    'background:#000;display:flex;flex-direction:column;overflow:hidden;',
  ].join('')

  // --- Top bar with close button ---
  const topBar = document.createElement('div')
  topBar.style.cssText = [
    'display:flex;justify-content:space-between;align-items:center;',
    'padding:12px 16px;background:rgba(0,0,0,0.85);z-index:1;',
    'flex-shrink:0;',
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

  // --- Camera preview area ---
  const viewId = containerId + '-view'
  const view = document.createElement('div')
  view.id = viewId
  view.style.cssText = [
    'flex:1;display:flex;align-items:center;justify-content:center;',
    'overflow:hidden;position:relative;min-height:0;',
  ].join('')
  container.appendChild(view)

  // --- Bottom hint text ---
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
        },
        (decodedText) => done(decodedText),
        () => {},
      )
      .catch((err: any) =>
        done(null, new Error(err?.message || '无法启动相机扫码')),
      )
  })
}

export async function stopLiveScan(): Promise<void> {
  cleanup()
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
  return activeScanner !== null
}