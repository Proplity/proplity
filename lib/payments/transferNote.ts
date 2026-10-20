/**
 * The note written on a payment when a person confirms a bank transfer without typing one.
 *
 * It is bookkeeping, not something a payer needs on their receipt: the receipt already shows the
 * method and the reference, and who confirmed it is in the audit log (ISS-118). So a receipt shows
 * a note only when a person wrote it.
 */
export const confirmedNote = (reference: string) =>
  `Confirmed from bank transfer reference ${reference}`;

// The wording used before ISS-118 ("Reconciled by MANAGER from bank transfer ref …") is still on
// payments that were already confirmed, so both are recognised.
const AUTOMATIC_NOTE =
  /^(Confirmed from bank transfer reference |Reconciled by [A-Za-z_]+ from bank transfer ref )/;

export function isAutomaticNote(note: string | null | undefined): boolean {
  return !!note && AUTOMATIC_NOTE.test(note.trim());
}
