import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { pwaRegisterMock } from '../../test/pwa-register.mock';
import { PwaUpdatePrompt } from './PwaUpdatePrompt';

describe('PwaUpdatePrompt', () => {
  beforeEach(() => {
    pwaRegisterMock.reset();
  });

  it('скрыт без ожидающего обновления', () => {
    render(<PwaUpdatePrompt />);

    expect(screen.queryByText('Доступно обновление')).not.toBeInTheDocument();
  });

  it('показывает recovery flow и запускает обновление', async () => {
    pwaRegisterMock.needRefresh = true;
    render(<PwaUpdatePrompt />);

    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }));
    expect(pwaRegisterMock.updateServiceWorker).toHaveBeenCalledWith(true);

    await userEvent.click(screen.getByRole('button', { name: 'Закрыть уведомление' }));
    expect(pwaRegisterMock.setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
