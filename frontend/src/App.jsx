import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import AnalyzeEpoch from './pages/AnalyzeEpoch'
import TrustGraph from './pages/TrustGraph'
import Simulate from './pages/Simulate'
import AnalyzeProject from './pages/AnalyzeProject'
import About from './pages/About'

function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analyze-epoch" element={<AnalyzeEpoch />} />
          <Route path="/trust-graph" element={<TrustGraph />} />
          <Route path="/simulate" element={<Simulate />} />
          <Route path="/analyze-project" element={<AnalyzeProject />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
