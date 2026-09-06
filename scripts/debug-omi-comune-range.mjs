import { OmiOfficialRepository } from '../server/services/OmiOfficialRepository.js'

const cap = process.argv[2] || process.env.TEST_CAP || '71010'
const uiTypology = process.argv[3] || 'APPARTAMENTO'
const comuneName = process.argv[4] || process.env.COMUNE_NAME || null

const repo = new OmiOfficialRepository()
const comuni = repo.findComuniByCap(cap)

if (!comuni.length) {
  console.log(
    JSON.stringify({ cap, uiTypology, comuneName, error: 'NO_COMUNI_FOR_CAP' }, null, 2)
  )
  process.exit(0)
}

let comune = null

if (comuneName) {
  const target = String(comuneName).replace(/_/g, ' ').trim().toLowerCase()
  comune =
    comuni.find(
      c =>
        String(c.denominazione_comune).trim().toLowerCase() === target
    ) || null
} else {
  comune = comuni[0]
}

if (!comune) {
  console.log(
    JSON.stringify(
      { cap, uiTypology, comuneName, error: 'NO_MATCHING_COMUNE' },
      null,
      2
    )
  )
  process.exit(0)
}

const semestre = repo.getLatestSemesterCode()
const range = repo.getComuneRangeByUiTypology({
  comuneId: comune.comune_id,
  semestreCode: semestre,
  uiTypology
})

console.log(
  JSON.stringify({ cap, uiTypology, comuneName, comuni, comune, semestre, range }, null, 2)
)
