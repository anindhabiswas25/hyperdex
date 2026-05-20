import express from 'express'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import readline from 'readline'
import prompts from 'prompts'
import axios from 'axios'
import { QuoteSigner } from './signer'
import { MakerWsClient } from './ws-client'
import { priceOracle } from './oracle'
import { inventoryChecker } from './inventory-checker'
import { buildPriceLevels } from './price-levels'
import { GHOST_PRICE_USDC_TO_EURC, setGhostPrice } from './ghost-price'

// ── Load credentials ──────────────────────────────────────────────────────────

require('dotenv').config()

const credentialName = process.argv[2]

if (credentialName) {
  const credPath = path.join(__dirname, '../credentials', `${credentialName}.cred`)
  if (!fs.existsSync(credPath)) {
    console.log(chalk.red(`\n  Credential not found: credentials/${credentialName}.cred`))
    console.log(chalk.gray('  Run npm run setup to create credentials.\n'))
    process.exit(1)
  }
  const credContent = fs.readFileSync(credPath, 'utf8')
  for (const line of credContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
} else {
  const credDir = path.join(__dirname, '../credentials')
  if (fs.existsSync(credDir)) {
    const creds = fs.readdirSync(credDir).filter((f: string) => f.endsWith('.cred'))
    if (creds.length === 1) {
      const autoName = creds[0].replace('.cred', '')
      console.log(chalk.gray(`  Using credential: ${autoName}`))
      const credPath = path.join(credDir, creds[0])
      const credContent = fs.readFileSync(credPath, 'utf8')
      for (const line of credContent.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
      }
    } else if (creds.length > 1) {
      console.log(chalk.red('\n  Multiple credentials found.'))
      console.log(chalk.white('  Specify which maker to run:'))
      creds.forEach((c: string) => {
        console.log(chalk.cyan(`    npm run dev ${c.replace('.cred', '')}`))
      })
      process.exit(1)
    }
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

const MAKER_ADDRESS = process.env.MAKER_ADDRESS || ''
const MAKER_API_KEY = process.env.MAKER_API_KEY || ''
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || ''
const PORT = parseInt(process.env.PORT || '3001', 10)
const BACKEND_HTTP_URL = process.env.BACKEND_HTTP_URL ?? 'http://localhost:4000'
const BACKEND_WS_URL = process.env.BACKEND_WS_URL ?? 'ws://localhost:4000/ws/maker'
const USDC_CONTRACT = process.env.USDC_CONTRACT || process.env.USDC_CONTRACT_ADDRESS || ''
const EURC_CONTRACT = process.env.EURC_CONTRACT || process.env.EURC_CONTRACT_ADDRESS || ''

const _required = [
  'MAKER_API_KEY',
  'SIGNER_PRIVATE_KEY',
  'MAKER_ADDRESS',
  'USDC_CONTRACT',
  'EURC_CONTRACT',
  'BACKEND_WS_URL',
]
const _missing = _required.filter(key => !process.env[key])
if (_missing.length > 0) {
  console.error(chalk.red('\n  ✗ Missing required configuration:'))
  _missing.forEach(key => {
    console.error(chalk.red(`    • ${key} is not set`))
  })
  console.error(chalk.yellow('\n  Fix by editing your credential file:'))
  console.error(chalk.cyan(`    nano credentials/${credentialName || '<name>'}.cred`))
  console.error(chalk.yellow('  Or run npm run setup again\n'))
  process.exit(1)
}

if (!process.env.POOL_ADDRESS) {
  console.warn(chalk.yellow('  ⚠ POOL_ADDRESS not set — inventory will read as 0'))
  console.warn(chalk.yellow('  Deploy your pool at localhost:3000/maker then add:'))
  console.warn(chalk.cyan(`  POOL_ADDRESS=C... to credentials/${credentialName || '<name>'}.cred`))
}

// ── Mutable globals ────────────────────────────────────────────────────────────

let MAKER_NAME = 'Unknown'
let POOL_ADDRESS_DISPLAY = process.env.POOL_ADDRESS || 'Not deployed'

// ── Express app ───────────────────────────────────────────────────────────────

const signer = new QuoteSigner(SIGNER_PRIVATE_KEY)
const wsClient = new MakerWsClient(signer)
const app = express()
app.use(express.json())
let httpServer: ReturnType<typeof app.listen> | null = null

app.get('/health', async (_req, res) => {
  const balance = await inventoryChecker.getBalance()
  const oracleStatus = priceOracle.getStatus() as { midRate: number; volatility: number; stale: boolean }
  res.json({
    status: 'ok',
    maker: MAKER_ADDRESS,
    connected: true,
    midRate: oracleStatus.midRate,
    volatility: oracleStatus.volatility,
    vault: {
      usdc: balance.usdc.toFixed(7),
      eurc: balance.eurc.toFixed(7),
    },
    oracle: oracleStatus,
  })
})

// ── Ghost price prompt ─────────────────────────────────────────────────────────

async function promptGhostPrice(): Promise<number> {
  const midRate = priceOracle.getMidRate()

  console.log()
  console.log(chalk.hex('#7c3aed')('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(chalk.white.bold('  Set Your Ghost Price'))
  console.log(chalk.hex('#7c3aed')('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log()
  console.log(chalk.gray('  Live market rate: ') + chalk.cyan(`1 USDC = ${midRate.toFixed(6)} EURC`))
  console.log()
  console.log(chalk.gray('  Your ghost price is the EURC amount you'))
  console.log(chalk.gray('  will offer per 1 USDC on every trade.'))
  console.log(chalk.gray('  Higher = better for trader = more likely to win.'))
  console.log()

  const response = await prompts({
    type: 'text',
    name: 'value',
    message: 'Ghost price (EURC per USDC):',
    initial: midRate.toFixed(6),
    validate: (v: string) => {
      const n = parseFloat(v)
      if (isNaN(n) || n <= 0) return 'Enter a valid positive number'
      if (n > midRate * 1.5) return `Too high (max ${(midRate * 1.5).toFixed(4)})`
      if (n < midRate * 0.5) return `Too low (min ${(midRate * 0.5).toFixed(4)})`
      return true
    },
  })

  if (response.value === undefined) {
    console.log(chalk.red('\n  Cancelled. Exiting.'))
    process.exit(0)
  }

  const ghostPrice = parseFloat(response.value)
  const diff = (ghostPrice - midRate) / midRate * 100
  const diffStr = diff >= 0
    ? chalk.green(`+${diff.toFixed(3)}%`)
    : chalk.red(`${diff.toFixed(3)}%`)
  const vsMarket = diff >= 0
    ? chalk.green('better than market')
    : chalk.yellow('below market')

  console.log()
  console.log(
    chalk.green('  ✓ Ghost price set: ') +
    chalk.white.bold(`1 USDC = ${ghostPrice.toFixed(6)} EURC`) +
    chalk.gray(` (${diffStr} vs market, ${vsMarket})`)
  )
  console.log()

  return ghostPrice
}

// ── Live dashboard ─────────────────────────────────────────────────────────────

function printLiveDashboard(): void {
  process.stdout.write('\x1B[2J\x1B[H')

  const midRate    = priceOracle.getMidRate()
  const volatility = priceOracle.getVolatility()
  const balance    = inventoryChecker.getCachedBalance()
  const poolShort  = POOL_ADDRESS_DISPLAY.length > 8
    ? POOL_ADDRESS_DISPLAY.slice(0, 8) + '...'
    : POOL_ADDRESS_DISPLAY

  console.log(chalk.hex('#7c3aed')('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(
    chalk.white.bold('  HyperDEX Maker SDK') +
    '  ' + chalk.green('●') + chalk.green(' LIVE')
  )
  console.log(chalk.hex('#7c3aed')('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(chalk.gray('  Maker:       ') + chalk.white(MAKER_NAME))
  console.log(chalk.gray('  Pool:        ') + chalk.cyan(poolShort))
  console.log(chalk.hex('#7c3aed')('  ─────────────────────────────────────────'))
  console.log(chalk.gray('  Live rate:   ') + chalk.cyan(`1 USDC = ${midRate.toFixed(6)} EURC`))
  console.log(
    chalk.gray('  Ghost price: ') +
    chalk.yellow(`1 USDC = ${GHOST_PRICE_USDC_TO_EURC.toFixed(6)} EURC`) +
    chalk.gray(' ← your bid rate')
  )
  console.log(chalk.gray('  Volatility:  ') + chalk.white((volatility * 100).toFixed(3) + '%'))
  console.log(chalk.hex('#7c3aed')('  ─────────────────────────────────────────'))
  console.log(chalk.gray('  Pool USDC:   ') + chalk.white(balance.usdc.toFixed(4)))
  console.log(chalk.gray('  Pool EURC:   ') + chalk.white(balance.eurc.toFixed(4)))
  console.log(chalk.hex('#7c3aed')('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(chalk.gray('  Auto-bidding at ghost price on all RFQs...'))
  console.log(
    chalk.gray('  Press Ctrl+C to disconnect | Ctrl+R to update ghost price')
  )
  console.log()
}

// ── Dashboard loop ─────────────────────────────────────────────────────────────

let dashboardInterval: NodeJS.Timeout | null = null

function startDashboardLoop(): void {
  dashboardInterval = setInterval(printLiveDashboard, 3000)
}

function stopDashboardLoop(): void {
  if (dashboardInterval) {
    clearInterval(dashboardInterval)
    dashboardInterval = null
  }
}

// ── Keypress handler ───────────────────────────────────────────────────────────

function setupKeypressHandler(): void {
  if (!process.stdin.isTTY) return

  readline.emitKeypressEvents(process.stdin)
  process.stdin.setRawMode(true)

  process.stdin.on('keypress', async (_str: string, key: { ctrl: boolean; name: string } | undefined) => {
    if (!key) return

    if (key.ctrl && key.name === 'c') {
      console.log()
      console.log(chalk.yellow('  Disconnecting...'))
      stopDashboardLoop()
      priceOracle.stop()
      wsClient.stop()
      httpServer?.close()
      process.exit(0)
    }

    if (key.ctrl && key.name === 'r') {
      stopDashboardLoop()
      console.log()
      console.log(chalk.yellow('  Updating ghost price...'))
      const newPrice = await promptGhostPrice()
      setGhostPrice(newPrice)
      printLiveDashboard()
      startDashboardLoop()
    }
  })
}

// ── Helper functions ───────────────────────────────────────────────────────────

async function fetchMakerIdentity(): Promise<{ name: string; stellarAddress: string }> {
  try {
    const res = await axios.post(`${BACKEND_HTTP_URL}/api/makers/verify-key`, { apiKey: MAKER_API_KEY })
    if (res.data.success) return res.data.maker
  } catch {}
  return {
    name: MAKER_ADDRESS ? `${MAKER_ADDRESS.slice(0, 6)}…` : 'Unknown',
    stellarAddress: MAKER_ADDRESS,
  }
}

async function fetchPoolAddress(address: string): Promise<string | null> {
  try {
    const res = await axios.get(`${BACKEND_HTTP_URL}/api/makers/${address}/pool`, { timeout: 5000 })
    return res.data.poolAddress ?? null
  } catch {
    return null
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

;(async () => {
  // 1. Start oracle (fetches initial rates)
  await priceOracle.start()

  // 2. Load initial inventory
  await inventoryChecker.getBalance()

  // 3. Fetch maker identity + pool address
  const [identity, poolAddr] = await Promise.all([
    fetchMakerIdentity(),
    fetchPoolAddress(MAKER_ADDRESS),
  ])
  MAKER_NAME = identity.name
  POOL_ADDRESS_DISPLAY = poolAddr || process.env.POOL_ADDRESS || 'Not deployed'

  // 4. Print startup header
  const addrDisplay = identity.stellarAddress || MAKER_ADDRESS || 'unknown'
  const shortAddr = addrDisplay.length > 8
    ? `${addrDisplay.slice(0, 4)}...${addrDisplay.slice(-4)}`
    : addrDisplay

  console.log()
  console.log(chalk.hex('#7c3aed')('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(chalk.white.bold('  HyperDEX Maker SDK'))
  console.log(chalk.hex('#7c3aed')('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
  console.log(chalk.gray('  Maker:   ') + chalk.white(identity.name))
  console.log(chalk.gray('  Address: ') + chalk.white(shortAddr))
  console.log(chalk.gray('  Pool:    ') + (poolAddr
    ? chalk.cyan(poolAddr)
    : chalk.yellow('NOT DEPLOYED — visit /maker')
  ))
  console.log(chalk.gray('  Backend: ') + chalk.cyan(BACKEND_WS_URL))
  console.log(chalk.hex('#7c3aed')('  ─────────────────────────────────────────'))

  // 5. Prompt for ghost price (or use GHOST_PRICE env var for non-interactive mode)
  let ghostPrice: number
  if (process.env.GHOST_PRICE) {
    ghostPrice = parseFloat(process.env.GHOST_PRICE)
    if (isNaN(ghostPrice) || ghostPrice <= 0) {
      console.error(chalk.red('  ✗ Invalid GHOST_PRICE env var — must be a positive number'))
      process.exit(1)
    }
    console.log(chalk.green('  ✓ Ghost price loaded from env: ') + chalk.white.bold(`1 USDC = ${ghostPrice.toFixed(6)} EURC`))
    console.log()
  } else {
    ghostPrice = await promptGhostPrice()
  }
  setGhostPrice(ghostPrice)

  // 6. Print live dashboard
  printLiveDashboard()

  // 7. Connect to backend WebSocket
  wsClient.start()

  // 8. Start price level streaming (every 3 seconds)
  setInterval(async () => {
    if (USDC_CONTRACT && EURC_CONTRACT && GHOST_PRICE_USDC_TO_EURC > 0) {
      const balance = await inventoryChecker.getBalance()
      const levels = buildPriceLevels(USDC_CONTRACT, EURC_CONTRACT, balance)
      wsClient.sendPriceLevels(levels)
    }
  }, 3000)

  // 9. Start live dashboard loop
  startDashboardLoop()

  // 10. Start HTTP health server
  httpServer = app.listen(PORT)

  // 11. Setup keypress handler (Ctrl+C / Ctrl+R)
  setupKeypressHandler()

  process.on('SIGTERM', () => {
    stopDashboardLoop()
    priceOracle.stop()
    wsClient.stop()
    httpServer?.close()
    process.exit(0)
  })
})()
