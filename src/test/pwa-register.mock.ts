import { vi } from 'vitest';

export const pwaRegisterMock = {
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(),
  reset() {
    this.needRefresh = false;
    this.setNeedRefresh.mockReset();
    this.updateServiceWorker.mockReset();
  },
};

export function useRegisterSW() {
  return {
    needRefresh: [pwaRegisterMock.needRefresh, pwaRegisterMock.setNeedRefresh] as const,
    updateServiceWorker: pwaRegisterMock.updateServiceWorker,
  };
}
