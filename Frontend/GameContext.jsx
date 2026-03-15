import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext.jsx'
import { api }    from '../services/api.js'

const GameContext = createContext(null)

export function GameProvider({ children }) {
  const { user } = useAuth()

  const [profile,     setProfile]     = useState(null)
  const [leaderboard, setLeaderboard] = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [toast,       setToast]       = useState(null)  // { type, title, msg }

  const showToast = useCallback((type, title, msg) => {
    setToast({ type, title, msg })
    setTimeout(() => setToast(null), 3200)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await api.getProfile()
      setProfile(data)
    } catch (e) {
      showToast('error', 'Error', e.message)
    } finally {
      setLoading(false)
    }
  }, [user, showToast])

  const refreshLeaderboard = useCallback(async (params) => {
    try {
      const data = await api.getLeaderboard(params)
      setLeaderboard(data)
    } catch (e) {
      showToast('error', 'Error', e.message)
    }
  }, [showToast])

  // Auto-load profile when user logs in
  useEffect(() => {
    if (user) refreshProfile()
    else      setProfile(null)
  }, [user, refreshProfile])

  const submitTask = useCallback(async (body) => {
    const data = await api.addTask(body)
    await refreshProfile()
    return data
  }, [refreshProfile])

  const takeLoan = useCallback(async (body) => {
    const data = await api.takeLoan(body)
    await refreshProfile()
    return data
  }, [refreshProfile])

  const repayLoan = useCallback(async (body) => {
    const data = await api.repayLoan(body)
    await refreshProfile()
    return data
  }, [refreshProfile])

  return (
    <GameContext.Provider value={{
      profile, leaderboard, loading, toast,
      refreshProfile, refreshLeaderboard,
      submitTask, takeLoan, repayLoan, showToast,
    }}>
      {children}
    </GameContext.Provider>
  )
}

export const useGame = () => useContext(GameContext)
