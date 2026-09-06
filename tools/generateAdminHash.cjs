const bcrypt = require('bcryptjs')

const password = 'ValutatoreStaff2025!'
const rounds = 10

bcrypt
  .hash(password, rounds)
  .then(hash => {
    console.log(hash)
  })
  .catch(err => {
    console.error('Errore generazione hash:', err)
    process.exit(1)
  })

