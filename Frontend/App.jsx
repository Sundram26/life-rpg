import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }    from './context/AuthContext.jsx'
import { GameProvider }    from './context/GameContext.jsx'
import ProtectedRoute      from './components/ProtectedRoute.jsx'
import AppShell            from './components/AppShell.jsx'
import LoginPage           from './pages/LoginPage.jsx'
import DashboardPage       from './pages/DashboardPage.jsx'
import TasksPage           from './pages/TasksPage.jsx'
import LeaderboardPage     from './pages/LeaderboardPage.jsx'
import LoansPage           from './pages/LoansPage.jsx'
import AchievementsPage    from './pages/AchievementsPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GameProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route path="/" element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }>
              <Route index                  element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"       element={<DashboardPage />} />
              <Route path="tasks"           element={<TasksPage />} />
              <Route path="leaderboard"     element={<LeaderboardPage />} />
              <Route path="loans"           element={<LoansPage />} />
              <Route path="achievements"    element={<AchievementsPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </GameProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
