import { EditorState, StateField, type Extension, type Transaction } from '@codemirror/state'
import { editableBytes } from '../../shared/documents'

function changedBytes(transaction: Transaction): number {
  let bytes = transaction.startState.field(documentBytes)
  transaction.changes.iterChanges((from, to, _newFrom, _newTo, inserted) => {
    bytes += new TextEncoder().encode(inserted.toString()).byteLength
    bytes -= new TextEncoder().encode(transaction.startState.sliceDoc(from, to)).byteLength
  })
  return bytes
}

const documentBytes = StateField.define<number>({
  create: state => new TextEncoder().encode(state.sliceDoc()).byteLength,
  update: (value, transaction) => (transaction.docChanged ? changedBytes(transaction) : value)
})

export function editBudget(reject: () => void): Extension {
  return [
    documentBytes,
    EditorState.transactionFilter.of(transaction => {
      if (!transaction.docChanged) {
        return transaction
      }
      let binary = false
      const splitsCharacter = (position: number): boolean =>
        position > 0 &&
        position < transaction.startState.doc.length &&
        /^[\uD800-\uDBFF][\uDC00-\uDFFF]$/.test(
          transaction.startState.sliceDoc(position - 1, position + 1)
        )
      transaction.changes.iterChanges((from, to, _newFrom, _newTo, inserted) => {
        const text = inserted.toString()
        if (
          !text.isWellFormed() ||
          text.includes('\0') ||
          splitsCharacter(from) ||
          splitsCharacter(to)
        ) {
          binary = true
        }
      })
      if (binary || changedBytes(transaction) > editableBytes) {
        reject()
        return []
      }
      return transaction
    })
  ]
}
