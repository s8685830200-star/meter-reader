import { Html5Qrcode } from 'html5-qrcode'

const SCANNER_ELEMENT_ID = 'qr-scanner-element'
let scanner: Html5Qrcode | null = null

export async function startScanner(onResult: (code: string) => void, onError?: (err: string) => void): Promise<void> {
  if (scanner) await stopScanner()
  const container = document.getElementById(SCANNER_ELEMENT_ID)
  if (!container) {
    throw new Error('扫码元素未就绪，请重试')
  }
  scanner = new Html5Qrcode(SCANNER_ELEMENT_ID)
  try {
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      (text) => { onResult(text); stopScanner() },
      (err) => { if (onError && err) onError(err) },
    )
  } catch (err) {
    if (onError) onError(`启动扫码失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function stopScanner(): Promise<void> {
  if (!scanner) return
  try { await scanner.stop(); scanner.clear() } catch {}
  scanner = null
}

export function isScanning(): boolean { return scanner !== null }
