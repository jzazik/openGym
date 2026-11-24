// @vitest-environment happy-dom
// #428, #329: the phone app pairs with a plain http:// server too (the Android WebView allows the
// mixed content and the cleartext now), so an http:// address that fails is probed like any
// other instead of being blamed on http. And a home server typed without a scheme is tried as
// https://, which a plain-http server never answers: that failure says to type http:// instead.
import { afterEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ native: true, platform: 'android' }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => (h.native ? h.platform : 'web'), isNativePlatform: () => h.native },
  CapacitorHttp: { request: () => Promise.reject(new Error('unreachable')) },
  registerPlugin: () => ({}),
}))

const { pairRedeem, looksLocal } = await import('./api.js')

afterEach(() => { vi.unstubAllGlobals(); h.native = true; h.platform = 'android' })
const failed = () => Promise.reject(new TypeError('Failed to fetch'))
const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('pairRedeem from the phone app with an http:// address', () => {
  it('pairs: the request goes out to the http:// address as typed', async () => {
    const fetch = vi.fn(async () => json({ token: 'T', user: { id: 'u1', name: 'andi' } }, 200))
    vi.stubGlobal('fetch', fetch)
    const r = await pairRedeem('http://192.168.1.20:8080', 'ABCD2345')
    expect(r.token).toBe('T')
    expect(fetch.mock.calls[0][0]).toBe('http://192.168.1.20:8080/api/pair/redeem')
  })

  it('a failure is probed like any other address, never blamed on http', async () => {
    const fetch = vi.fn(failed)
    vi.stubGlobal('fetch', fetch)
    const e = await pairRedeem('http://192.168.1.20:8080', 'ABCD2345', { probeMs: 20 }).catch(x => x)
    expect(e.code).toBe('unreachable')
    expect(e.message).toBe('Could not reach 192.168.1.20:8080. Check the address and that this phone can reach it.')
    expect(fetch.mock.calls[1][0]).toBe('http://192.168.1.20:8080/api/health')
  })

  it('a server that answers over http:// is passed on as it is', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'invalid or expired code' }, 400)))
    await expect(pairRedeem('http://192.168.1.20:8080', 'ABCD2345')).rejects.toMatchObject({ status: 400 })
  })
})

describe('an https:// try at a home address that gets nowhere', () => {
  it.each(['https://192.168.1.20:8080', 'https://nas:8080', 'https://gym.local', 'https://10.0.0.5'])('%s: suggests http://', async base => {
    vi.stubGlobal('fetch', vi.fn(failed))
    const e = await pairRedeem(base, 'ABCD2345', { probeMs: 20 }).catch(x => x)
    const host = base.slice('https://'.length)
    expect(e.code).toBe('unreachable')
    expect(e.message).toBe(`Could not reach ${host} over https://. If your server runs on plain http (common at home), type http://${host} instead.`)
  })

  it('a public name keeps the plain message', async () => {
    vi.stubGlobal('fetch', vi.fn(failed))
    const e = await pairRedeem('https://gym.example.com', 'ABCD2345', { probeMs: 20 }).catch(x => x)
    expect(e.message).toBe('Could not reach gym.example.com. Check the address and that this phone can reach it.')
  })
})

describe('looksLocal', () => {
  it('private, link-local, loopback and CGNAT (Tailscale) addresses', () => {
    for (const a of ['10.1.2.3', '172.16.0.1', '172.31.255.1', '192.168.0.10', '169.254.1.1', '127.0.0.1', '100.64.0.1', '100.101.102.103', '[fd00::1]', 'fe80::1', '::1']) expect(looksLocal(a), a).toBe(true)
  })
  it('home-network names', () => {
    for (const a of ['nas', 'gym.local', 'server.lan', 'box.home.arpa', 'gym.internal', 'GYM.LOCAL.']) expect(looksLocal(a), a).toBe(true)
  })
  it('public addresses and names', () => {
    for (const a of ['8.8.8.8', '172.32.0.1', '100.128.0.1', 'gym.example.com', 'localhost.example.org', '2001:db8::1', '']) expect(looksLocal(a), a).toBe(false)
  })
})

// #870: the Android WebView refused a self-hosted server (home network, private CA) that the
// phone's browser opened fine: pairing said "Could not reach" over https and over http alike.
describe('a server only the app itself can reach (#870)', () => {
  it.each(['android', 'ios'])('pairs through the native network stack on %s, and keeps talking to it that way', async platform => {
    h.platform = platform
    const { _viaNativeForTests, api, setRemoteAuth } = await import('./api.js')
    const core = await import('@capacitor/core')
    const native = vi.fn(async ({ url }) => ({ status: 200, data: url.endsWith('/redeem') ? JSON.stringify({ token: 'T', user: { id: 'u1' } }) : JSON.stringify({ rev: 7 }) }))
    core.CapacitorHttp.request = native
    const fetch = vi.fn(failed)
    vi.stubGlobal('fetch', fetch)
    try {
      const r = await pairRedeem('https://192.168.1.20:8443', 'ABCD2345', { probeMs: 20 })
      expect(r.token).toBe('T')
      expect(native.mock.calls[0][0]).toMatchObject({ url: 'https://192.168.1.20:8443/api/pair/redeem', method: 'POST', data: { code: 'ABCD2345' } })
      setRemoteAuth('https://192.168.1.20:8443', 'T')
      await expect(api('/api/data/rev')).resolves.toEqual({ rev: 7 })
      // The web view is not tried again for that server.
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(native.mock.calls[1][0].headers.Authorization).toBe('Bearer T')
    } finally {
      _viaNativeForTests.clear()
      setRemoteAuth('', null)
      core.CapacitorHttp.request = () => Promise.reject(new Error('unreachable'))
    }
  })
  it('off the phone app nothing changes', async () => {
    h.native = false
    vi.stubGlobal('fetch', vi.fn(failed))
    const e = await pairRedeem('https://gym.example.com', 'ABCD2345', { probeMs: 20 }).catch(x => x)
    expect(e.code).toBe('unreachable')
  })
})

// A VPN the web view stops following: fetch never answers, while the phone's own connection
// still reaches the server. One short try goes that way, and a server that answers stays on it.
describe('a web view that never answers while the phone can still reach the server', () => {
  const hang = () => new Promise(() => {})
  async function withNative(native, run) {
    h.platform = 'ios'
    const { _viaNativeForTests, api, setRemoteAuth } = await import('./api.js')
    const core = await import('@capacitor/core')
    core.CapacitorHttp.request = native
    const fetch = vi.fn(hang)
    vi.stubGlobal('fetch', fetch)
    setRemoteAuth('https://gym.example.com', 'T')
    try { await run({ api, fetch, native, via: _viaNativeForTests }) }
    finally {
      _viaNativeForTests.clear()
      setRemoteAuth('', null)
      core.CapacitorHttp.request = () => Promise.reject(new Error('unreachable'))
    }
  }

  it('retries once through the app connection and keeps that server there', async () => {
    const native = vi.fn(async () => ({ status: 200, data: JSON.stringify({ rev: 4 }) }))
    await withNative(native, async ({ api, fetch }) => {
      await expect(api('/api/data/rev', { timeout: 40 })).resolves.toEqual({ rev: 4 })
      expect(native).toHaveBeenCalledTimes(1)
      await expect(api('/api/data/rev', { timeout: 40 })).resolves.toEqual({ rev: 4 })
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(native).toHaveBeenCalledTimes(2)
    })
  })

  it('keeps an HTTP answer from that connection, instead of the timeout', async () => {
    const native = vi.fn(async () => ({ status: 502, data: JSON.stringify({ error: 'nope' }) }))
    await withNative(native, async ({ api, fetch }) => {
      await expect(api('/api/data/rev', { timeout: 40 })).rejects.toMatchObject({ status: 502, message: 'nope' })
      await expect(api('/api/data/rev', { timeout: 40 })).rejects.toMatchObject({ status: 502 })
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  it('stays a timeout when the app connection does not answer either, and tries the web view again next time', async () => {
    const native = vi.fn(hang)
    await withNative(native, async ({ api, fetch, via }) => {
      await expect(api('/api/data/rev', { timeout: 30 })).rejects.toMatchObject({ code: 'timeout', status: undefined })
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(native).toHaveBeenCalledTimes(1)
      expect(via.size).toBe(0)
      await expect(api('/api/data/rev', { timeout: 30 })).rejects.toMatchObject({ code: 'timeout' })
      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('does not spend that second try when the phone itself reports no network', async () => {
    const prev = Object.getOwnPropertyDescriptor(navigator, 'onLine')
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    const native = vi.fn(async () => ({ status: 200, data: JSON.stringify({ rev: 1 }) }))
    try {
      await withNative(native, async ({ api }) => {
        await expect(api('/api/data/rev', { timeout: 30 })).rejects.toMatchObject({ code: 'timeout' })
        expect(native).not.toHaveBeenCalled()
      })
    } finally {
      if (prev) Object.defineProperty(navigator, 'onLine', prev)
    }
  })
})
