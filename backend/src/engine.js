const fs = require('fs');
const wordListPath = require('word-list');
const { MIN_WORD_LENGTH, DIFFICULTY_SWITCH_SECONDS } = require('./constants');

let dictionary = new Set();
// Prefix maps for O(1) lookups
// prefixMap: Map<string, string[]> (keys are 1, 2, and 3 character prefixes)
const prefixMap = new Map();

function loadDictionary() {
  const startTime = Date.now();
  const actualPath = typeof wordListPath === 'string' ? wordListPath : (wordListPath.default || wordListPath);
  const words = fs.readFileSync(actualPath, 'utf8').split('\n');
  const alphabeticRegex = /^[a-z]+$/;
  let count = 0;

  for (let i = 0; i < words.length; i++) {
    const lower = words[i].toLowerCase().trim();
    if (lower.length >= MIN_WORD_LENGTH && alphabeticRegex.test(lower)) {
      dictionary.add(lower);
      count++;

      // Index 1, 2, and 3 letter prefixes
      const p1 = lower.slice(0, 1);
      const p2 = lower.slice(0, 2);
      const p3 = lower.slice(0, 3);

      let list1 = prefixMap.get(p1);
      if (!list1) {
        list1 = [];
        prefixMap.set(p1, list1);
      }
      list1.push(lower);

      if (lower.length >= 2) {
        let list2 = prefixMap.get(p2);
        if (!list2) {
          list2 = [];
          prefixMap.set(p2, list2);
        }
        list2.push(lower);
      }

      if (lower.length >= 3) {
        let list3 = prefixMap.get(p3);
        if (!list3) {
          list3 = [];
          prefixMap.set(p3, list3);
        }
        list3.push(lower);
      }
    }
  }

  console.log(`Loaded ${count} valid words into dictionary with prefix indices in ${Date.now() - startTime}ms.`);
  return dictionary;
}

// 5.1 Starting a chain - pick 4 letters with at least 3 viable unused words
function getStartingLetters(usedWords = new Set()) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const letters = [];
  const shuffledAlphabet = alphabet.split('').sort(() => Math.random() - 0.5);
  
  for (const candidate of shuffledAlphabet) {
    if (letters.length >= 4) break;
    
    const words = prefixMap.get(candidate);
    if (!words) continue;

    let viableCount = 0;
    for (let i = 0; i < words.length; i++) {
      if (!usedWords.has(words[i])) {
        viableCount++;
        if (viableCount >= 3) break;
      }
    }
    
    if (viableCount >= 3) {
      letters.push(candidate);
    }
  }

  // Fallback if alphabet shuffle didn't fill 4
  if (letters.length < 4) {
    for (const char of ['e', 't', 'a', 'o', 'i', 'n', 's', 'r']) {
      if (!letters.includes(char)) {
        letters.push(char);
        if (letters.length >= 4) break;
      }
    }
  }

  return letters;
}

// 5.3 Word submission — validation pipeline
function validateWord(senderId, activePlayerId, rawWord, currentPrefix, usedWords) {
  if (senderId !== activePlayerId) {
    return { valid: false, reason: 'Not your turn', isSenderError: true };
  }
  
  const word = (rawWord || '').toLowerCase().trim();
  
  if (word.length < MIN_WORD_LENGTH) {
    return { valid: false, reason: `Word must be at least ${MIN_WORD_LENGTH} letters long` };
  }
  
  if (usedWords && (usedWords.has(word) || (Array.isArray(usedWords) && usedWords.includes(word)))) {
    return { valid: false, reason: `"${word.toUpperCase()}" has already been used in this game` };
  }

  if (currentPrefix && !word.startsWith(currentPrefix)) {
    return { valid: false, reason: `Word must start with "${currentPrefix.toUpperCase()}"` };
  }
  
  if (!dictionary.has(word)) {
    return { valid: false, reason: 'Not a valid English word' };
  }
  
  return { valid: true, word };
}

// 5.6 Extracting the next prefix (O(1) with prefixMap)
function getNextPrefix(word, elapsedTime, usedWords) {
  const isHardMode = elapsedTime > DIFFICULTY_SWITCH_SECONDS;
  
  let rollLengths = [];
  const r = Math.random();
  
  if (isHardMode) {
    if (r < 0.15) rollLengths = [1, 2, 3];
    else if (r < 0.45) rollLengths = [2, 3, 1];
    else rollLengths = [3, 2, 1];
  } else {
    if (r < 0.50) rollLengths = [1, 2, 3];
    else if (r < 0.85) rollLengths = [2, 1, 3];
    else rollLengths = [3, 2, 1];
  }
  
  for (let len of rollLengths) {
    if (word.length < len) continue;
    const candidate = word.slice(-len);
    const candidateWords = prefixMap.get(candidate);
    
    if (candidateWords && candidateWords.length > 0) {
      // Viability check: at least one word not used
      for (let i = 0; i < candidateWords.length; i++) {
        if (!usedWords.has(candidateWords[i])) {
          return candidate;
        }
      }
    }
  }
  
  return null; // Signals deadlock, trigger fallback
}

// 7. Practice Mode bot logic (O(1) with prefixMap)
function getBotMove(prefix, elapsedTime, usedWords) {
  let targetLengthMin = 3;
  let targetLengthMax = 5;
  
  if (elapsedTime > 180) { // 3:00+
    targetLengthMin = 8;
    targetLengthMax = 100;
  } else if (elapsedTime > 60) { // 1:00-3:00
    targetLengthMin = 5;
    targetLengthMax = 8;
  }
  
  const candidateWords = prefixMap.get(prefix);
  if (!candidateWords || candidateWords.length === 0) return null;
  
  let bestWord = null;
  let backupWord = null;
  
  // Random sample within candidate words to avoid predictable bot moves
  const sampleStart = Math.floor(Math.random() * Math.max(1, candidateWords.length - 50));
  const sampleEnd = Math.min(candidateWords.length, sampleStart + 150);

  for (let i = sampleStart; i < sampleEnd; i++) {
    const dictWord = candidateWords[i];
    if (!usedWords.has(dictWord)) {
      if (!backupWord) backupWord = dictWord;
      if (dictWord.length >= targetLengthMin && dictWord.length <= targetLengthMax) {
        bestWord = dictWord;
        break;
      }
    }
  }
  
  // If no match in sample, quickly find any unused word
  if (!bestWord && !backupWord) {
    for (let i = 0; i < candidateWords.length; i++) {
      const dictWord = candidateWords[i];
      if (!usedWords.has(dictWord)) {
        backupWord = dictWord;
        if (dictWord.length >= targetLengthMin && dictWord.length <= targetLengthMax) {
          bestWord = dictWord;
          break;
        }
      }
    }
  }
  
  return bestWord || backupWord;
}

// 7. Hints (O(1) with prefixMap)
function getHint(prefix, usedWords) {
  const candidateWords = prefixMap.get(prefix);
  if (!candidateWords) return null;
  
  // Pick an unused word with reasonable length
  for (let i = 0; i < candidateWords.length; i++) {
    if (!usedWords.has(candidateWords[i])) {
      return candidateWords[i];
    }
  }
  return null;
}

module.exports = {
  loadDictionary,
  getStartingLetters,
  validateWord,
  getNextPrefix,
  getBotMove,
  getHint
};
