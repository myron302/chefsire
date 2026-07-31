export function cateringProviderActionState(
  isAuthLoading: boolean,
  viewerId: string | null | undefined,
  providerId: string,
) {
  return {
    isAuthLoading,
    isSelf: !isAuthLoading && viewerId === providerId,
    canResolveAuthentication: !isAuthLoading,
  };
}

export function localCalendarDate(date = new Date()): string {
  return `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}
