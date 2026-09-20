const MAX_PLAYERS_PER_ROOM = 5;
const MIN_PLAYERS_TO_START = 2;
const STARTING_LIVES = 2;
const TURN_TIMER_SECONDS = 15;
const MIN_WORD_LENGTH = 2;
const MAX_HINTS_PER_PRACTICE_SESSION = 3;
const ROOM_CODE_LENGTH = 6;
const MAX_DISPLAY_NAME_LENGTH = 10;
// Difficulty cycle: Phase1 (single) -> Phase2 (single+double) -> Phase3 (all) -> repeat
const DIFFICULTY_PHASE_1_END = 45;   // 0-45s: single letter only
const DIFFICULTY_PHASE_2_END = 95;   // 45-95s: single + double letter
const DIFFICULTY_CYCLE_TOTAL = 155;  // 95-155s: single + double + triple, then reset

module.exports = {
  MAX_PLAYERS_PER_ROOM,
  MIN_PLAYERS_TO_START,
  STARTING_LIVES,
  TURN_TIMER_SECONDS,
  MIN_WORD_LENGTH,
  MAX_HINTS_PER_PRACTICE_SESSION,
  ROOM_CODE_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  DIFFICULTY_PHASE_1_END,
  DIFFICULTY_PHASE_2_END,
  DIFFICULTY_CYCLE_TOTAL
};
