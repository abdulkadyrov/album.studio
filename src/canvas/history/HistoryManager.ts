export interface HistoryCommand {
  label: string;
  undo: () => void;
  redo: () => void;
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string;
  redoLabel?: string;
}

export class HistoryManager {
  private readonly undoStack: HistoryCommand[] = [];
  private readonly redoStack: HistoryCommand[] = [];

  constructor(
    private readonly limit = 100,
    private readonly onChange?: (state: HistoryState) => void,
  ) {}

  record(command: HistoryCommand): void {
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
    this.emit();
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
    this.emit();
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.redo();
    this.undoStack.push(command);
    this.emit();
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emit();
  }

  getState(): HistoryState {
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoLabel: this.undoStack.at(-1)?.label,
      redoLabel: this.redoStack.at(-1)?.label,
    };
  }

  private emit(): void {
    this.onChange?.(this.getState());
  }
}
