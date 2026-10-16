import { writeFileSync } from 'node:fs'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const targets = await fetch('http://127.0.0.1:9222/json').then(response => response.json())
const target = targets.find(item => item.type === 'page' && item.url.startsWith('http://127.0.0.1:5173'))
if (!target) throw new Error('No headless Chrome page target found')
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
let nextId = 1
const pending = new Map()
socket.onmessage = event => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    message.error ? reject(new Error(message.error.message)) : resolve(message.result)
  }
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }))
})
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: 'http://127.0.0.1:5173/' })
await sleep(6000)
let capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
writeFileSync('D:/CODEAPEX_LOCUSAI/.impeccable/review/desktop.png', Buffer.from(capture.data, 'base64'))
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await send('Page.navigate', { url: 'http://127.0.0.1:5173/simulation' })
await sleep(6000)
capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
writeFileSync('D:/CODEAPEX_LOCUSAI/.impeccable/review/mobile.png', Buffer.from(capture.data, 'base64'))
socket.close()
