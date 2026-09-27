// Build settings.
//
// HAS_SERVER is false in the public GitHub Pages version (built with VITE_NO_SERVER=1).
// That version has no PC server, so sign-in, online duels and the leaderboard are hidden;
// everything else works and progress is saved on the player's own device.
export const HAS_SERVER = import.meta.env.VITE_NO_SERVER !== '1';
