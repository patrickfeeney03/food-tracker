export type DiaryEntryFeedback =
  | { kind: 'deleted'; entryId: string; foodName: string; deletedAt: number }
  | { kind: 'restored'; foodName: string }
  | { kind: 'shortcut-applied'; applicationId: string; shortcutName: string }
  | { kind: 'shortcut-undone'; shortcutName: string };
