// This is your full, updated app/layout.js file

export const metadata = {
  title: 'ENV.MONITOR | Real-Time Dashboard',
  description: 'A real-time dashboard monitoring indoor sensor data and local outdoor weather conditions.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}