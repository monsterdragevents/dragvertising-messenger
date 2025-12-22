import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Toaster } from 'sonner'
import RealtimeMessenger from './pages/RealtimeMessenger'

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<RealtimeMessenger />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </AuthProvider>
  )
}

export default App
