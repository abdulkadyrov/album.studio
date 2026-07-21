import { HistoryManager } from './HistoryManager';

describe('HistoryManager', () => {
  it('отменяет и повторяет одну завершённую транзакцию', () => {
    let value = 2;
    const history = new HistoryManager();
    history.record({
      label: 'Перемещение',
      undo: () => {
        value = 1;
      },
      redo: () => {
        value = 2;
      },
    });

    history.undo();
    expect(value).toBe(1);
    expect(history.getState().canRedo).toBe(true);

    history.redo();
    expect(value).toBe(2);
    expect(history.getState().canUndo).toBe(true);
  });

  it('очищает redo после новой команды', () => {
    const history = new HistoryManager();
    history.record({ label: 'A', undo: () => undefined, redo: () => undefined });
    history.undo();
    history.record({ label: 'B', undo: () => undefined, redo: () => undefined });

    expect(history.getState().canRedo).toBe(false);
    expect(history.getState().undoLabel).toBe('B');
  });
});
