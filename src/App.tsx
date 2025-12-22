import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Toaster } from 'sonner'
import LandingPage from './pages/LandingPage'
import RealtimeMessenger from './pages/RealtimeMessenger'
import { Loader2 } from 'lucide-react'

// Component that shows messenger if authenticated, landing page if not
function RootRoute() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  // If authenticated, show messenger; otherwise show landing page
  return user ? <RealtimeMessenger /> : <LandingPage />;
}

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<RootRoute />} />
          {/* Redirect /messenger to root for backwards compatibility */}
          <Route path="/messenger" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </div>
    </AuthProvider>
  )
}

export default App

