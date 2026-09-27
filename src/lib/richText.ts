// The bank's light markup: ``` fenced snippets, with an optional language tag on the opening line, and
// `inline` code. Splitting on a capture group puts the code at the odd indexes. A fence takes the blank
// lines around it, since a code block already sits on lines of its own.
const FENCE = /\n*```(?:[\w-]*\n)?([\s\S]*?)\n?```\n*/
const INLINE = /`([^`\n]+)`/

export const splitFences = (text: string): string[] => text.split(FENCE)
export const splitInline = (text: string): string[] => text.split(INLINE)

// The same text without the markup, for one-line previews and accessible names.
export const plainText = (text: string): string => splitFences(text).join('\n').split(INLINE).join('')
