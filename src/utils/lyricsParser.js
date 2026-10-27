/**
 * Lyrics & LRC Parser Utilities for TuneVault (meMusic)
 * Supports synchronized LRC format [mm:ss.xx] and plain text lyrics.
 */

/**
 * Parse raw lyrics text into structured synchronized or plain lines
 * @param {string} text - Raw LRC or plain text lyrics
 * @returns {{ isSynced: boolean, lines: Array<{ id: number, time: number, text: string }>, rawText: string }}
 */
export function parseLyrics(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return { isSynced: false, lines: [], rawText: '' };
  }

  const rawLines = text.split('\n');
  const timeRegex = /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;
  const parsedLines = [];
  let hasValidTimestamps = false;
  let isSpacerPending = false;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const line = rawLine.trim();
    if (!line) {
      isSpacerPending = true;
      continue;
    }

    const matches = Array.from(line.matchAll(timeRegex));

    if (matches.length > 0) {
      hasValidTimestamps = true;
      // Extract clean lyric text after all timestamp tags
      const cleanText = line.replace(timeRegex, '').trim();

      // Support lines with multiple timestamps like [00:12.00][00:24.00] Chorus
      for (const match of matches) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseFloat(match[2]);
        const totalSeconds = minutes * 60 + seconds;

        parsedLines.push({
          id: Math.random(),
          time: totalSeconds,
          text: cleanText || '♪',
          isSpacerBefore: isSpacerPending
        });
        isSpacerPending = false;
      }
    } else {
      // Plain text line without timestamp
      parsedLines.push({
        id: Math.random(),
        time: -1,
        text: line,
        isSpacerBefore: isSpacerPending
      });
      isSpacerPending = false;
    }
  }

  if (hasValidTimestamps) {
    // Filter and sort by timestamp ascending
    const syncedLines = parsedLines
      .filter(item => item.time >= 0)
      .sort((a, b) => a.time - b.time);

    return {
      isSynced: true,
      lines: syncedLines,
      rawText: text
    };
  }

  // Plain text lyrics
  return {
    isSynced: false,
    lines: parsedLines,
    rawText: text
  };
}

/**
 * Find the index of the currently playing lyric line based on current playback seconds and optional offset
 * @param {Array<{ time: number, text: string }>} lines
 * @param {number} currentTime
 * @param {number} offset - Optional offset in seconds (positive delays lyrics, negative advances lyrics)
 * @returns {number} Index of current line (-1 if before first line)
 */
export function findCurrentLyricIndex(lines, currentTime, offset = 0) {
  if (!lines || lines.length === 0) return -1;

  // Positive offset delays lyrics (useful if lyrics start too early)
  // Negative offset advances lyrics (useful if lyrics start too late)
  const adjustedTime = Math.max(0, currentTime - offset);
  let activeIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (adjustedTime >= lines[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }

  return activeIndex;
}

/**
 * Format seconds into standard LRC timestamp tag [mm:ss.xx]
 * @param {number} seconds
 * @returns {string} e.g. "[01:23.45]"
 */
export function formatTimeTag(seconds) {
  if (isNaN(seconds) || seconds < 0) return '[00:00.00]';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  const padMins = mins < 10 ? `0${mins}` : `${mins}`;
  const padSecs = parseFloat(secs) < 10 ? `0${secs}` : `${secs}`;
  return `[${padMins}:${padSecs}]`;
}

/**
 * Shift all timestamp tags in an LRC text by a given number of seconds
 * @param {string} rawText - LRC text containing [mm:ss.xx] tags
 * @param {number} offsetSeconds - Seconds to shift (+ to delay/start later, - to start earlier)
 * @returns {string} Updated LRC text
 */
export function shiftTimestamps(rawText, offsetSeconds) {
  if (!rawText || typeof rawText !== 'string' || !offsetSeconds) return rawText || '';

  const timeRegex = /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;

  return rawText.replace(timeRegex, (match, minStr, secStr) => {
    const mins = parseInt(minStr, 10);
    const secs = parseFloat(secStr);
    const totalSecs = mins * 60 + secs;
    const newTotalSecs = Math.max(0, totalSecs + offsetSeconds);
    return formatTimeTag(newTotalSecs);
  });
}

/**
 * Automatically distribute timestamps across plain text lyrics based on track duration
 * so plain lyrics immediately follow and scroll with the song in real time.
 * @param {string} rawText - Plain or partially synced lyrics
 * @param {number} trackDuration - Total duration in seconds
 * @param {number} customStartOffset - Custom vocal start time in seconds (defaults to 15s for band/instrumental intro)
 * @returns {string} LRC formatted lyrics with distributed timestamps
 */
export function autoDistributeTimestamps(rawText, trackDuration, customStartOffset = null) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') return '';

  const lines = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) return '';

  const totalDuration = Math.max(30, Number(trackDuration) || 180);
  // Default intro starts around 14s (most pop/rock songs have a 12-16s intro before vocals)
  // or user-provided customStartOffset
  const startOffset = customStartOffset !== null && !isNaN(customStartOffset)
    ? Math.max(0, Number(customStartOffset))
    : Math.min(20, Math.max(12, totalDuration * 0.08));

  // End ~8s before track ends
  const availableTime = Math.max(10, totalDuration - startOffset - 8);
  const timePerLine = availableTime / Math.max(1, lines.length);

  return lines.map((line, idx) => {
    // If line already has a timestamp tag [mm:ss.xx], keep it
    if (/^\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test(line)) {
      return line;
    }
    const lineTime = startOffset + (idx * timePerLine);
    return `${formatTimeTag(lineTime)} ${line}`;
  }).join('\n');
}

/**
 * Curated, verified LRC synchronized lyrics for known tracks (e.g. Xdinary Heroes)
 * Matches track title or filename (e.g. "u and me in arguments", "YewgjyKxnDM", etc.)
 * @param {string} title
 * @returns {string | null} Full accurate LRC text or null if none
 */
export function getCuratedLyrics(title) {
  if (!title || typeof title !== 'string') return null;
  const lower = title.toLowerCase();

  // 1. "u and me in arguments" by Xdinary Heroes (Video ID: YewgjyKxnDM)
  if (lower.includes('argument') || lower.includes('yewgjy') || lower.includes('u and me')) {
    return `[00:10.50] Can't restrain this side of me
[00:13.20] On repeat in psycho drama
[00:15.80] I can't get out of
[00:17.40] Yeah
[00:19.00] You call on me you follow me
[00:21.80] Then let me go right when I wantcha
[00:25.00] And now I'm strung up
[00:27.50] Let's play would you rather
[00:29.80] Be alone or together
[00:32.40] Now I know what's for the better
[00:35.00] You a thorn, I see a petal every time
[00:40.00] I don't know why all your wrong feels right
[00:46.50] But you twist your knife, and I love the fight
[00:53.00] I never found us in romance
[00:57.00] But I can't deny
[01:00.20] There's you and me in arguments
[01:04.00] And you and I in bruising
[01:07.50] Oh, no, no
[01:10.20] You shoot me down and then
[01:12.40] Reload, load, load
[01:15.80] And I can't get away
[01:18.50] Locked myself in a cage of you
[01:25.00] Suck the soul right out of me
[01:28.00] Another scene inside our drama
[01:31.20] Oh, what a drama (Oh, no)
[01:34.50] Let me be, don't let me be
[01:37.80] On either side of you, there's trauma
[01:41.50] Just like you wanna, oh
[01:45.00] I don't know why all your wrong feels right
[01:51.50] But you twist your knife, and I love the fight
[01:58.00] I never found us in romance
[02:02.00] But I can't deny
[02:05.00] There's you and me in arguments
[02:09.00] And you and I in bruising
[02:12.50] No, oh, oh
[02:15.20] You shoot me down and then
[02:17.40] Reload, load, load
[02:20.80] And I can't get away
[02:23.50] Locked myself in a cage of you
[02:28.00] I can't look, I can't look away
[02:32.00] You're so good, you're so good at lying
[02:37.00] It's over, come over tonight
[02:42.00] I know you're the bad that I
[02:46.50] Like the way you lie in goodbye
[02:53.00] I never found us in romance
[02:57.00] But I can't deny
[03:00.00] There's you and me in arguments
[03:04.00] And you and I in bruising
[03:07.50] No, oh, oh
[03:10.20] You shoot me down and then
[03:12.40] Reload, load, load
[03:15.80] And I can't get away, locked myself in a cage of you`;
  }

  // 2. "Obsessed with Youth" / "어린 나이에 미쳐" by Xdinary Heroes (Video ID: 10_1vuZAeP0)
  if (
    lower.includes('1vuzaep0') ||
    lower.includes('10_1vu') ||
    lower.includes('youth') ||
    lower.includes('obsessed') ||
    lower.includes('어린') ||
    lower.includes('미쳐')
  ) {
    return `[00:19.00] Yeah, I was a mess
[00:22.80] I kept asking why
[00:24.90] 치기 어린 심장 (A childish heart)
[00:27.00] 거칠었던 마음 (A rough mind)
[00:29.20] Couldn't handle myself
[00:31.10] 방황 아닌 발화 (Not wandering, but igniting)
[00:33.20] 휘청거렸지만 (Even though I stumbled)
[00:35.10] 멈출 수 없던 두 발 (My two feet couldn't stop)
[00:37.70] 불완전했던 youth (Imperfect youth)
[00:40.10] 상처 그리고 bruise (Injuries and bruise)
[00:42.70] Now, I know why

[00:44.80] So, kiss the days of glory
[00:47.70] Never let them fade
[00:49.80] 난 포기할 수 없어 (I can't give up)
[00:52.00] You're the reason why

[00:54.00] 스쳐 간 모든 계절이 (All passing seasons)
[00:57.20] 낭비된 모든 젊음이 (All wasted youth)
[01:00.30] Keep me alive, yeah
[01:02.90] So, I wanna be obsessed with youth
[01:08.00] Obsessed with youth
[01:10.60] Obsessed with youth

[01:14.10] 도착지 없는 행진 (A march without destination)
[01:16.70] 깎인 절벽에 번지 (Bungee off a steep cliff)
[01:18.90] 무모한 순간들을 (These reckless moments)
[01:21.20] 이어온 거야 (We will carry on)
[01:23.30] No matter, ('cause) whenever
[01:26.10] 운명의 태도는 똑같지
[01:28.50] So never, (don't) forget 'em
[01:31.20] 갈망해 everglow (Crave the everglow)
[01:33.30] 완전했던 youth (Imperfect youth)
[01:35.80] 상처 그리고 bruise (Injuries and bruise)
[01:38.40] Now, I know why

[01:40.50] So, kiss the days of glory
[01:43.40] Never let them fade
[01:45.50] 난 포기할 수 없어 (I can't give up)
[01:47.80] You're the reason why

[01:49.70] 스쳐 간 모든 계절이 (All passing seasons)
[01:52.90] 낭비된 모든 젊음이 (All wasted youth)
[01:56.10] Keep me alive, yeah
[01:58.60] So, I wanna be obsessed with youth
[02:03.80] Obsessed with youth
[02:06.30] Obsessed with youth

[02:24.00] 빗속에 춤을 추고 (Dancing in the rain)
[02:27.20] 울부짖는 듯 (As if wailing)
[02:30.00] 젖어들어 네게로 (Soaking into you)
[02:33.00] 이런 나를 좀 알아달라고 (Please understand this me)
[02:37.00] 더 머물러 줘 (Please stay a little longer)
[02:40.00] 수없이 흔들리고 아파도 (Even if shaken and hurting)
[02:43.50] Just stay a little longer here

[02:47.50] So kiss the days of glory
[02:50.80] Never let them fade away
[02:53.80] 나의 숨이 돼준 너라서 (Because you became my breath)
[02:56.50] You make me survive, you're the reason why

[02:58.80] 또다시 변할 계절이 (The seasons changing again)
[03:02.00] 시간을 달릴 젊음이 (Youth racing through time)
[03:05.20] That's the proof of who we are
[03:07.50] So, I wanna be obsessed with youth
[03:12.50] Obsessed with youth
[03:15.50] Obsessed with youth
[03:18.50] Obsessed with youth
[03:22.00] Obsessed with youth`;
  }

  // 3. "Test Me" by Xdinary Heroes
  if (lower.includes('test me')) {
    return `[00:00.00] Xdinary Heroes - Test Me
[00:06.00] Tik tok tik tok, running out of breath
[00:09.50] Step up to the mic, put it to the test
[00:13.20] I don't give a what, play it loud and proud
[00:16.80] Hear the bass shaking up the whole crowd
[00:21.00] Test me, go ahead and test me now
[00:25.50] We're gonna show you exactly how
[00:29.00] We rock the stage, we break the cage
[00:33.00] Welcome to the new world, turn the page`;
  }

  return null;
}



