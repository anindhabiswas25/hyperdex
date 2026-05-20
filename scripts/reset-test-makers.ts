import mongoose from 'mongoose'
import { Maker } from '../backend/src/db/models/Maker'
import { ApiKey } from '../backend/src/db/models/ApiKey'
import { PendingMaker } from '../backend/src/db/models/PendingMaker'

async function resetTestMakers() {
  await mongoose.connect(process.env.MONGODB_URI!)

  const makers = await Maker.find({})
  const pending = await PendingMaker.find({})

  console.log('\nCurrent Makers:')
  makers.forEach(m => console.log(` ${m.stellarAddress} | ${m.name} | ${m.createdAt}`))

  console.log('\nCurrent PendingMakers:')
  pending.forEach(p => console.log(` ${p.stellarAddress} | ${p.name} | ${p.status}`))

  const orphanMakers = makers.filter(maker =>
    !pending.find(p =>
      p.stellarAddress === maker.stellarAddress &&
      p.status !== 'rejected'
    )
  )

  if (orphanMakers.length === 0) {
    console.log('\nNo orphan makers found — database is clean.')
    process.exit(0)
  }

  console.log(`\nFound ${orphanMakers.length} orphan maker(s) to remove:`)
  orphanMakers.forEach(m => console.log(` ${m.stellarAddress} | ${m.name}`))

  const readline = require('readline').createInterface({
    input: process.stdin, output: process.stdout
  })

  readline.question('\nDelete these? (y/N) ', async (answer: string) => {
    if (answer.toLowerCase() !== 'y') {
      console.log('Cancelled.')
      process.exit(0)
    }

    for (const maker of orphanMakers) {
      await ApiKey.deleteMany({ makerId: maker._id })
      await Maker.deleteOne({ _id: maker._id })
      console.log(`Deleted: ${maker.stellarAddress}`)
    }

    await PendingMaker.deleteMany({
      status: { $in: ['pending', 'approved'] },
      makerId: null
    })

    console.log('\nDatabase cleaned. All test wallets will now')
    console.log('start from the application form.')
    process.exit(0)
  })
}

resetTestMakers()
