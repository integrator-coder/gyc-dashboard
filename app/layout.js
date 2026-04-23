import './globals.css'
import AppFrame from '@/components/AppFrame'

export const metadata = {
  title: 'GYC Dashboard',
  description: 'GYC KPI Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen text-white executive-app-shell">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  )
}
