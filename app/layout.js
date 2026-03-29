import './globals.css'
import AppFrame from '@/components/AppFrame'

export const metadata = {
  title: 'GYC Dashboard',
  description: 'GYC KPI Dashboard',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          fontFamily: "'Avenir', 'Avenir Next', 'Nunito Sans', system-ui, sans-serif",
          backgroundColor: '#0a0a0a',
        }}
        className="text-white min-h-screen"
      >
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  )
}
