/**
 * Capture an image from the device camera using a hidden <input type="file" capture>
 * This bypasses both getUserMedia (html5-qrcode) and EXTRA_OUTPUT (Capacitor Camera) issues.
 * Works reliably on all Android devices including Chinese OEM ROMs (MIUI, MagicOS, ColorOS, etc.)
 */

let activeInput: HTMLInputElement | null = null
let activeReject: ((reason: Error) => void) | null = null

function cleanup() {
  if (activeInput) {
    try { activeInput.remove() } catch {}
    activeInput = null
  }
  activeReject = null
}

// Listen for app returning from camera without taking a photo
const resumeHandler = () => {
  if (!activeInput) return
  // Give the change event a chance to fire first
  setTimeout(() => {
    if (activeInput && activeInput.files && activeInput.files.length > 0) {
      // File was selected, the change handler will process it
      return
    }
    if (activeReject) {
      activeReject(new Error('用户取消拍照'))
      cleanup()
    }
  }, 600)
}

let listenerRegistered = false
function ensureResumeListener() {
  if (listenerRegistered) return
  listenerRegistered = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeHandler()
  })
  window.addEventListener('focus', resumeHandler)
}

export function captureImageFromCamera(): Promise<File> {
  cleanup()
  ensureResumeListener()

  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.setAttribute('capture', 'environment')
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;'

    activeInput = input
    activeReject = reject

    input.onchange = () => {
      const file = input.files?.[0]
      cleanup()
      if (file) {
        if (file.size === 0) {
          reject(new Error('照片文件为空，请重试'))
        } else {
          resolve(file)
        }
      } else {
        reject(new Error('未获取到照片'))
      }
    }

    input.onerror = () => {
      cleanup()
      reject(new Error('无法打开相机'))
    }

    document.body.appendChild(input)

    // Use a tiny delay to ensure the DOM is settled
    setTimeout(() => {
      try {
        input.click()
      } catch (e) {
        cleanup()
        reject(new Error('无法触发相机: ' + (e instanceof Error ? e.message : String(e))))
      }
    }, 100)
  })
}

/**
 * Convert a File to a base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      if (!result) { reject(new Error('文件读取失败')); return }
      // Strip data URL prefix (e.g. "data:image/jpeg;base64,")
      const base64 = result.includes('base64,') ? result.split('base64,')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * Ensure the active input is cleaned up
 */
export function cancelCapture(): void {
  if (activeReject) {
    activeReject(new Error('已取消'))
  }
  cleanup()
}
