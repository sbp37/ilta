import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { expect, test } from '@playwright/test'

test('배포 서버 연결이 끊겨도 캐시로 재실행하고 기록한다', async ({ page }) => {
  let unavailable = false
  const root = resolve('dist')
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.png': 'image/png',
    '.webmanifest': 'application/manifest+json',
  }
  const server = createServer(async (req, res) => {
    if (unavailable) {
      req.socket.destroy()
      return
    }
    const pathname = new URL(req.url!, 'http://localhost').pathname
    const path = resolve(root, pathname.replace(/^\/ilta\//, '') || 'index.html')
    if (!path.startsWith(root + sep)) {
      res.writeHead(404).end()
      return
    }
    try {
      const body = await readFile(path)
      res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }).end(body)
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing server address')
  try {
    await page.goto(`http://127.0.0.1:${address.port}/ilta/`)
    await page.getByRole('button', { name: '모험 시작', exact: true }).click()
    await page.evaluate(() => navigator.serviceWorker.ready)
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    unavailable = true
    server.closeAllConnections()
    await page.reload()
    await expect(page.locator('.header')).toBeVisible()
    await page.getByRole('button', { name: '+ 여기에 할 일 적기', exact: true }).first().click()
    await page.locator('.slot-input').fill('연결 없이 작성')
    await page.locator('.slot-input').press('Enter')
    await page.reload()
    await expect(page.locator('.quest-card')).toContainText('연결 없이 작성')
  } finally {
    server.closeAllConnections()
    await new Promise<void>((done) => server.close(() => done()))
  }
})
