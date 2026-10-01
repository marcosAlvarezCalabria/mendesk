/** Preserve atomic version checks for both initial and subsequently updated records. */
export function directusVersionFilter(expected: string) {
  return {
    _or: [
      { date_updated: { _eq: expected } },
      { _and: [{ date_updated: { _null: true } }, { date_created: { _eq: expected } }] },
    ],
  };
}
