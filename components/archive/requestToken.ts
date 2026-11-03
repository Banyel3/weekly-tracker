/** Hands out increasing tokens; only the latest one issued is still current, so older responses can be dropped. */
export function createRequestToken() {
  let latest = 0;
  return {
    next: () => ++latest,
    isCurrent: (token: number) => token === latest,
  };
}
