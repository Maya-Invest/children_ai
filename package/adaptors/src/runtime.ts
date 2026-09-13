import type { Clock, IdGenerator } from "@children-ai/domain";

export class SystemClock implements Clock {
	nowIso(): string {
		return new Date().toISOString();
	}
}

export class CryptoIdGenerator implements IdGenerator {
	next(): string {
		return crypto.randomUUID();
	}
}
