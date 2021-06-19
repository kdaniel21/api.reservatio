type CookieFlags = { [flagName: string]: string }

const shapeFlags = (flags: string[]): CookieFlags =>
  flags.reduce((shapedFlags, flag) => {
    const [flagName, rawValue] = flag.split('=')
    const value = rawValue ? rawValue.replace(';', '') : true
    return { ...shapedFlags, [flagName.toLowerCase()]: value }
  }, {})

type ExtractedCookies = {
  [cookieName: string]: {
    value: string
    flags: CookieFlags
  }
}

export const extractCookies = (headers: { ['set-cookie']: string[] }): ExtractedCookies => {
  const cookies = headers['set-cookie']
  if (!cookies) return {}

  return cookies?.reduce((shapedCookies, cookieString) => {
    const [rawCookie, ...flags] = cookieString.split('; ')
    const [cookieName, value] = rawCookie.split('=')
    return { ...shapedCookies, [cookieName]: { value, flags: shapeFlags(flags) } }
  }, {})
}
