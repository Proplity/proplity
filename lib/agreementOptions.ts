// The choices behind the rent agreement settings, with the wording the admin screen shows. Kept
// apart from the database code so the screen can import it. The first value of each list is the
// default.
export const RENT_ACTIVATION_RULES = [
  {
    value: 'INDEPENDENT',
    label: 'Independent of the agreement',
    hint: 'A rent starts when the manager or landlord activates it, whether or not the agreement is signed. This is how rents work today.',
  },
  {
    value: 'AFTER_BOTH_SIGN',
    label: 'Once both sides have signed',
    hint: 'A rent that has an agreement cannot be activated until the agreement is signed by both sides, and it starts by itself when the second signature is added.',
  },
] as const;

export const RULE_MODES = [
  { value: 'OFF', label: 'Off' },
  { value: 'WARN', label: 'Warn' },
  { value: 'BLOCK', label: 'Block' },
] as const;
