// Best-of-3 match rules, shared by online duels (on the server) and split-screen duels.

export const WINS_NEEDED = 2;

export interface RoundEntry {
  score: number;     // 0 if the attempt failed
  finishMs: number;  // how long the player took; used only to break a tie
}

/** Higher score wins; a tie goes to the faster finish. Returns 1 or 2. */
export function roundWinner(p1: RoundEntry, p2: RoundEntry): 1 | 2 {
  if (p1.score !== p2.score) return p1.score > p2.score ? 1 : 2;
  return p1.finishMs <= p2.finishMs ? 1 : 2;
}

export interface Match {
  wins: [number, number];  // wins for player 1 and player 2
  rounds: (1 | 2)[];       // who won each round
  winner: 1 | 2 | null;    // set once someone has 2 wins
}

export const newMatch = (): Match => ({ wins: [0, 0], rounds: [], winner: null });

/** Records a round and returns the updated match (the old one is not changed). */
export function recordRound(m: Match, p1: RoundEntry, p2: RoundEntry): Match {
  if (m.winner) return m; // match already over
  const w = roundWinner(p1, p2);
  const wins: [number, number] = [m.wins[0] + (w === 1 ? 1 : 0), m.wins[1] + (w === 2 ? 1 : 0)];
  const winner = wins[0] >= WINS_NEEDED ? 1 : wins[1] >= WINS_NEEDED ? 2 : null;
  return { wins, rounds: [...m.rounds, w], winner };
}
