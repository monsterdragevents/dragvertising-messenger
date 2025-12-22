import { Routes, Route } from 'react-router-dom'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Routes>
        <Route path="/" element={
          <div className="container mx-auto p-8">
            <h1 className="text-4xl font-bold">Dragvertising Messenger</h1>
            <p className="mt-4 text-muted-foreground">
              Real-time messaging platform for the Dragvertising ecosystem
            </p>
          </div>
        } />
      </Routes>
    </div>
  )
}

export default App
