import 'dotenv/config'
import express    from 'express'
import cors       from 'cors'
import rateLimit  from 'express-rate-limit'
import evaluateRouter from './routes.js'

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json({ limit: '32kb' }))

// Rate limit AI endpoint specifically — protect Gemini quota
app.use('/evaluate', rateLimit({
  windowMs: 60 * 1000,
  max:      30,
  message:  { success: false, error: 'Too many evaluation requests — slow down a little' },
}))

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'life-rpg-ai', time: new Date().toISOString() }))

app.use('/', evaluateRouter)

app.use((err, req, res, next) => {
  console.error('[error]', err.message)
  res.status(err.status ?? 500).json({ success: false, error: err.message ?? 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`\n🤖 Life RPG AI Evaluator running on port ${PORT}`)
  console.log(`   POST http://localhost:${PORT}/evaluate`)
  console.log(`   POST http://localhost:${PORT}/evaluate/batch\n`)
})
