const onlineRoomStorageKey = "midnight-buffet.online-room-id";

/** Persists the current anonymous seat so a browser refresh can restore it. */
export function rememberOnlineRoom(storage: Pick<Storage, "setItem">, roomId: string): void {
  storage.setItem(onlineRoomStorageKey, roomId);
}

/** Reads a remembered online seat without loading the Supabase SDK. */
export function restoreOnlineRoomId(storage: Pick<Storage, "getItem">): string | undefined {
  return storage.getItem(onlineRoomStorageKey) ?? undefined;
}
