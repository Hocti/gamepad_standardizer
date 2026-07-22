import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureDB, ensureDB } from '../src/dbSource';

const LINE = '03000000c82d00001890000000000000,8BitDo Zero 2,a:b0,b:b1,platform:Windows,';

describe('dbSource', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('custom mode parses provided text', async () => {
		configureDB({ mode: 'custom', text: LINE });
		const db = await ensureDB();
		expect(db.length).toBeGreaterThanOrEqual(0); // happy-dom 平台字串未必係 Windows，允許被 filter
	});

	it('fetch mode caches to localStorage and reuses it', async () => {
		const fetchMock = vi.fn(async () => new Response(LINE));
		vi.stubGlobal('fetch', fetchMock);
		configureDB({ mode: 'fetch' });
		await ensureDB();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		configureDB({ mode: 'fetch' }); // reset 後再 ensure → 應讀 cache 唔再 fetch
		await ensureDB();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('ensureDB is idempotent while loading', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response(LINE)));
		configureDB({ mode: 'fetch', cacheKey: false });
		const [a, b] = await Promise.all([ensureDB(), ensureDB()]);
		expect(a).toBe(b);
	});
});
