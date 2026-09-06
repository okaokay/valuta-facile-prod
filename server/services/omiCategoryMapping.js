export const uiToOmiTypology = {
  APPARTAMENTO: 'Abitazioni civili',
  VILLA: 'Ville e villini',
  'VILLETTA A SCHIERA': 'Ville e villini',
  'LOFT/OPEN SPACE': 'Abitazioni civili',
  MANSARDA: 'Abitazioni civili',
  'STABILE/PALAZZO': 'Abitazioni civili',
  'RUSTICO/CASALE': 'Abitazioni civili',
  ATTICO: 'Abitazioni civili',
  BOX: 'Box',
  NEGOZIO: 'Negozi'
}

export function mapUiCategoryToOmi(uiType) {
  if (!uiType) return null
  const normalized = String(uiType).trim().toUpperCase()
  if (uiToOmiTypology[normalized]) {
    return uiToOmiTypology[normalized]
  }
  const lower = normalized.toLowerCase()
  for (const [key, value] of Object.entries(uiToOmiTypology)) {
    if (key.toLowerCase() === lower) return value
  }
  return null
}
