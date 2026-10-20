import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { Env } from '../config/env.js';
import { ApiException } from '../errors/api.exception.js';
import type { NewsSourceAdapter } from './news-source-adapter.js';
import { FETCH_NEWS_SCHEDULER_ID, NewsSourcesService } from './news-sources.service.js';

describe('NewsSourcesService', () => {
  // Only the queue methods the service uses
  const queue = {
    upsertJobScheduler: vi.fn(),
    removeJobScheduler: vi.fn(),
    getJobs: vi.fn(),
    add: vi.fn(),
  };
  const config = { get: () => 120 } as unknown as ConfigService<Env, true>;
  const source: NewsSourceAdapter = { sourceId: 'fake', fetchLatest: () => Promise.resolve([]) };

  const service = (sources: NewsSourceAdapter[]) =>
    new NewsSourcesService(queue as unknown as Queue, sources, config);

  beforeEach(() => {
    vi.resetAllMocks();
    queue.getJobs.mockResolvedValue([]);
    queue.add.mockImplementation((_name: string, _data: unknown, opts: { jobId: string }) =>
      Promise.resolve({ id: opts.jobId }),
    );
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  describe('on start', () => {
    it('schedules a fetch every NEWS_POLL_INTERVAL_MINUTES', async () => {
      await service([source]).onApplicationBootstrap();

      expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
        FETCH_NEWS_SCHEDULER_ID,
        { every: 120 * 60_000 },
        { name: 'ingest' },
      );
    });

    it('removes the schedule when no source is configured', async () => {
      await service([]).onApplicationBootstrap();

      expect(queue.removeJobScheduler).toHaveBeenCalledWith(FETCH_NEWS_SCHEDULER_ID);
      expect(queue.upsertJobScheduler).not.toHaveBeenCalled();
    });
  });

  describe('fetchNow', () => {
    it('queues a fetch with a new unique id', async () => {
      const first = await service([source]).fetchNow();
      const second = await service([source]).fetchNow();

      expect(first.batchId).toMatch(/^[0-9a-f-]{36}$/);
      expect(second.batchId).not.toBe(first.batchId);
      expect(queue.add).toHaveBeenCalledTimes(2);
    });

    it('returns the queued fetch instead of a second one', async () => {
      queue.getJobs.mockResolvedValue([{ id: 'repeat:fetch-news:1729' }]);

      expect(await service([source]).fetchNow()).toEqual({ batchId: 'repeat:fetch-news:1729' });
      // Running or waiting only: the next scheduled fetch ("delayed") doesn't count
      expect(queue.getJobs).toHaveBeenCalledWith(['active', 'waiting'], 0, 0);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('answers 503 NEWS_SOURCE_NOT_CONFIGURED without a source', async () => {
      const error = await service([])
        .fetchNow()
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({ code: 'NEWS_SOURCE_NOT_CONFIGURED' });
      expect((error as ApiException).getStatus()).toBe(503);
      expect(queue.add).not.toHaveBeenCalled();
    });
  });
});
