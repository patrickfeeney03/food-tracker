export type DiaryEntryFeedback =
  | { kind: 'deleted'; entryId: string; foodName: string; deletedAt: number }
  | { kind: 'restored'; foodName: string };
