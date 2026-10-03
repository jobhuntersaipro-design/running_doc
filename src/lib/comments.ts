/** Reactions a runner can leave on a comment. The first is the like. */
export const REACTIONS = ["👍", "❤️", "🔥", "👏", "😂"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const MAX_COMMENT = 1000;

export interface RaceComment {
  id: string;
  name: string;
  body: string;
  /** ISO time */
  createdAt: string;
  /** How many runners left each reaction. */
  counts: Partial<Record<Reaction, number>>;
  /** The viewer's own reactions. */
  mine: Reaction[];
  /** The viewer wrote it, or is the admin, so they can delete it. */
  canDelete: boolean;
}
