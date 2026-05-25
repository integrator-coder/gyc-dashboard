/**
 * google-auth.js
 * Single source of truth for Google API auth.
 * On Vercel: reads credentials from GOOGLE_SERVICE_ACCOUNT_JSON env var (JSON string).
 * Locally: falls back to keyFile at ~/.openclaw/credentials/google-console.json.
 */
import { google } from 'googleapis'
import os from 'os'

export function createGoogleAuth(scopes) {
  // Option 1: Individual env vars (Render preferred - avoids newline mangling)
  if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL) {
    const credentials = {
      type: 'service_account',
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }
    return new google.auth.GoogleAuth({ credentials, scopes })
  }

  // Option 2: Vercel / production: credentials in env var as JSON string
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    return new google.auth.GoogleAuth({ credentials, scopes })
  }

  // Option 3: Local: use keyFile
  const keyFile = process.env.GOOGLE_CREDENTIALS_PATH
    || `${os.homedir()}/.openclaw/credentials/google-console.json`

  return new google.auth.GoogleAuth({ keyFile, scopes })
}

export const SHEETS_READONLY = ['https://www.googleapis.com/auth/spreadsheets.readonly']
export const SHEETS_DRIVE_READONLY = ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly']
