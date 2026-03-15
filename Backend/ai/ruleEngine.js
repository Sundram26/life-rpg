// ─── RULE ENGINE ─────────────────────────────────────────────────────────────
// Runs before the AI call. Catches obvious cases instantly (no API cost).
// Returns null if uncertain → falls through to Gemini.

export const STAT_KEYS  = ['intelligence', 'strength', 'discipline', 'social']
export const CATEGORIES = ['productive', 'unproductive', 'neutral', 'mixed']

// ── Keyword dictionaries ──────────────────────────────────────────────────────

const PRODUCTIVE_PATTERNS = {
  intelligence: [
    /\bstud(y|ied|ying)\b/i, /\bread(ing)?\b/i, /\bcourse\b/i, /\blesson\b/i,
    /\blearn(ing|ed)?\b/i,  /\bbook\b/i,        /\bresearch\b/i, /\bpractice\b/i,
    /\bcode|coding|programming\b/i, /\btutorial\b/i, /\blecture\b/i, /\bnote[s]?\b/i,
    /\bproblem.solv/i, /\bmathematics?\b/i, /\bscience\b/i, /\bflashcard/i,
    /\bonline class\b/i, /\bworkshop\b/i, /\bseminar\b/i, /\bdocumentation\b/i,
  ],
  strength: [
    /\bworkout\b/i, /\bexercise\b/i, /\brun(ning)?\b/i, /\bgym\b/i, /\bwalk(ing)?\b/i,
    /\bcycl(e|ing)\b/i, /\bswim(ming)?\b/i, /\byoga\b/i, /\bpush.?up/i, /\bsit.?up/i,
    /\bhike|hiking\b/i, /\bsport[s]?\b/i, /\bfitness\b/i, /\bjog(ging)?\b/i,
    /\bweightlift/i, /\bpull.?up/i, /\bcardio\b/i, /\bstretch/i, /\bcook(ing|ed)? (healthy|fresh|meal)/i,
  ],
  discipline: [
    /\bno.?phone\b/i, /\bno.?social.?media\b/i, /\bjournall?(ing|led|ed)?\b/i,
    /\bplan(ned|ning)?\b/i, /\borganize|organised\b/i, /\bschedule\b/i,
    /\bwoke? up early\b/i, /\bwake up\b/i, /\bmorning routine\b/i,
    /\bfocus(ed)?\b/i, /\bdeep work\b/i, /\bpomodoro\b/i, /\btask list\b/i,
    /\bmedit(ate|ation|ating)\b/i, /\bto.?do\b/i, /\bprioritize\b/i,
    /\bdigital detox\b/i, /\bno distract/i, /\bproductiv/i,
  ],
  social: [
    /\bcall(ed|ing)?\b/i, /\bfriend\b/i, /\bfamily\b/i, /\bnetwork(ing)?\b/i,
    /\bmeeting\b/i, /\bpresent(ation|ing|ed)?\b/i, /\bteam\b/i, /\bgroup\b/i,
    /\bmentor(ing|ed)?\b/i, /\bvolunteer/i, /\bcommunity\b/i, /\bcollab/i,
    /\binterview\b/i, /\bconference\b/i, /\bclub\b/i, /\bevent\b/i,
  ],
}

const UNPRODUCTIVE_PATTERNS = [
  /\bscroll(ing|ed)?\b/i, /\bnetflix\b/i, /\byoutube\b/i, /\btiktok\b/i,
  /\binstagram\b/i, /\btwitter\b/i, /\bsocial.?media\b/i, /\bbrowse\b/i,
  /\bvideo.?game\b/i, /\bmindless(ly)?\b/i, /\b(play|played|playing).{0,20}game/i,
  /\bnap(ping)?\b/i, /\bsleep(ing)? in\b/i,
  /\bjunk.?food\b/i, /\bbinge\b/i, /\blazy\b/i, /\bwast(e|ing|ed) time\b/i,
  /\bprocrastinat/i, /\bdo nothing\b/i, /\bkill(ing)? time\b/i, /\brandom browsing\b/i,
  /\bzoned? out\b/i,
]

// ── Time-based modifiers ──────────────────────────────────────────────────────
// Credit and XP scale with time spent, but with diminishing returns

export function timeMultiplier(minutes) {
  if (minutes <= 0)   return 0.5
  if (minutes <= 15)  return 0.7
  if (minutes <= 30)  return 1.0
  if (minutes <= 60)  return 1.3
  if (minutes <= 90)  return 1.5
  if (minutes <= 120) return 1.7
  if (minutes < 180)  return 1.9
  return 2.0  // cap at 2× for 3h+
}

export function timeToDifficulty(minutes) {
  if (minutes <= 20)  return 'easy'
  if (minutes <= 45)  return 'medium'
  if (minutes <= 90)  return 'hard'
  return 'epic'
}

// ── Rule engine core ──────────────────────────────────────────────────────────

export function runRuleEngine(description, minutesSpent) {
  const desc = description.toLowerCase()

  // 1. Check unproductive patterns first
  const isUnproductive = UNPRODUCTIVE_PATTERNS.some(p => p.test(desc))

  // 2. Check productive patterns — track which stat triggered
  let primaryStat  = null
  let matchScore   = 0

  for (const [stat, patterns] of Object.entries(PRODUCTIVE_PATTERNS)) {
    const hits = patterns.filter(p => p.test(desc)).length
    if (hits > matchScore) {
      matchScore  = hits
      primaryStat = stat
    }
  }

  const isProductive = matchScore > 0

  // 3. Conflicting signals → uncertain → let AI decide
  if (isProductive && isUnproductive) return null

  // 4. Neither pattern matched → uncertain
  if (!isProductive && !isUnproductive) return null

  const timeMult  = timeMultiplier(minutesSpent)
  const difficulty = timeToDifficulty(minutesSpent)

  if (isProductive) {
    const BASE_XP      = { easy: 20, medium: 40, hard: 70,  epic: 120 }
    const BASE_CREDITS = { easy: 15, medium: 30, hard: 60,  epic: 100 }

    return {
      source:       'rules',
      category:     'productive',
      stat:         primaryStat,
      difficulty,
      xp_awarded:   Math.round(BASE_XP[difficulty]      * timeMult),
      credits:      Math.round(BASE_CREDITS[difficulty] * timeMult),
      stat_gain:    { easy: 1, medium: 2, hard: 4, epic: 8 }[difficulty],
      confidence:   matchScore >= 2 ? 'high' : 'medium',
      reasoning:    `Matched ${matchScore} ${primaryStat} pattern(s) in description.`,
    }
  }

  // Unproductive — costs credits, no XP, mild stat penalty
  const COST = { easy: 20, medium: 35, hard: 55, epic: 80 }
  return {
    source:       'rules',
    category:     'unproductive',
    stat:         null,
    difficulty,
    xp_awarded:   0,
    credits:      -Math.round(COST[difficulty] * timeMult),
    stat_gain:    0,
    confidence:   'high',
    reasoning:    'Matched unproductive keyword patterns in description.',
  }
}
