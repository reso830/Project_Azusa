export const DEFAULT_LOCAL_ACTOR = 'local:sm';
export function resolveActor(
  explicitActor?: string | null,
  envActor?: string | null,
): string {
  return (
    explicitActor?.trim() ||
    (envActor ?? process.env.AZUSA_ACTOR_ID)?.trim() ||
    DEFAULT_LOCAL_ACTOR
  );
}
