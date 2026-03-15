import { auth } from './firebase.js'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

async function getToken() {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (options.auth !== false) {
    headers['Authorization'] = `Bearer ${await getToken()}`
  }
  const res  = await fetch(`${BASE}${path}`, { ...options, headers })
  const data = await res.json()
  if (!data.success) throw new Error(data.error ?? 'Request failed')
  return data
}

export const api = {
  createUser:     (body)   => request('/createUser',  { method: 'POST', body: JSON.stringify(body), auth: false }),
  getProfile:     ()       => request('/profile'),
  addTask:        (body)   => request('/addTask',     { method: 'POST', body: JSON.stringify(body) }),
  takeLoan:       (body)   => request('/takeLoan',    { method: 'POST', body: JSON.stringify(body) }),
  repayLoan:      (body)   => request('/repayLoan',   { method: 'POST', body: JSON.stringify(body) }),
  getLeaderboard: (params) => {
    const q = new URLSearchParams(params ?? {}).toString()
    return request(`/leaderboard${q ? '?' + q : ''}`)
  },
}
