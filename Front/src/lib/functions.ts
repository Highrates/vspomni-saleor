export function formatCurrency(value: number | string): string {
  const num = Number(value)

  if (isNaN(num)) return String(value)

  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export const decodeUnicode = (str: string) => {
  return str.replace(/\\u[\dA-F]{4}/gi, (match) => {
    return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
  })
}

export const parseEditorJS = (jsonString: string) => {
  try {
    const decoded = decodeUnicode(jsonString)
    const parsed = JSON.parse(decoded)
    return parsed.blocks
      .map((block: any) => block.data?.text || '')
      .join('<br>')
  } catch (error) {
    console.error('Error parsing Editor.js content:', error)
    return ''
  }
}
