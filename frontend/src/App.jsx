import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import HomePage from './pages/HomePage'
import ListingPage from './pages/ListingPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'

function App() {
  return (
    <Routes>
      <Route path="/login"            element={<LoginPage />} />
      <Route path="/signup"           element={<SignupPage />} />
      <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
      <Route path="/home"             element={<HomePage />} />
      <Route path="/listing/:id"      element={<ListingPage />} />
      <Route path="*"                 element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
