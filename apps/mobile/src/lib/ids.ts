import { randomUUID } from "expo-crypto";

/** Row ids made on the phone: they double as the outbox's idempotency keys (docs/05 M5). */
export const newId = (): string => randomUUID();
