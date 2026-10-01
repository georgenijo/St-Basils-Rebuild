// Browser upload to a Supabase Storage signed upload URL with progress.
// Mirrors storage-js `uploadToSignedUrl` (same endpoint and multipart body),
// but uses XMLHttpRequest because fetch cannot report upload progress.

export function uploadToSignedUrlWithProgress(
  signedUrl: string,
  file: Blob,
  contentType: string,
  onProgress: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData()
    body.append('cacheControl', '3600')
    // Re-type the blob so Storage records the validated content type even when
    // the browser left File.type empty.
    body.append('', file.slice(0, file.size, contentType))

    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('x-upsert', 'false')
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (anonKey) {
      xhr.setRequestHeader('apikey', anonKey)
      xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1)
        resolve()
        return
      }
      let message = `Upload failed (HTTP ${xhr.status})`
      try {
        const payload = JSON.parse(xhr.responseText) as { message?: string; error?: string }
        message = payload.message || payload.error || message
      } catch {
        // Non-JSON error body; keep the status message.
      }
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error('Network error while uploading'))
    xhr.onabort = () => reject(new Error('Upload was cancelled'))
    xhr.send(body)
  })
}
