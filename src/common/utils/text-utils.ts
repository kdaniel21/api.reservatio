import crypto from 'crypto'
import cuid from 'cuid'

export namespace TextUtils {
  export const generateUuid = () => cuid()

  export const generateRandomCharacters = (numOfCharacters: number = 10): string => {
    return crypto.randomBytes(numOfCharacters).toString('hex')
  }

  export const hashText = (text: string): string => {
    return crypto.createHash('sha256').update(text).digest('hex').toString()
  }
}
