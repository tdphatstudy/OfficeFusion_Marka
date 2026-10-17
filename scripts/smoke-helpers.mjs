export async function waitForDraft(page, fragment) {
  await page.waitForFunction(async text => {
    return await new Promise(resolve => {
      const request = indexedDB.open('marka-recovery-v2')
      request.onerror = () => resolve(false)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction('drafts')
        const read = transaction.objectStore('drafts').get(sessionStorage.getItem('marka-session'))
        read.onsuccess = () => resolve(read.result?.content?.includes(text) ?? false)
        read.onerror = () => resolve(false)
        transaction.oncomplete = () => db.close()
      }
    })
  }, fragment)
}
