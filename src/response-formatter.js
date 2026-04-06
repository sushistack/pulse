// ===========================================
// pulse - Response Formatter
// ===========================================
// Formats all LobeHub responses using the standard JSON structure.
// Follows F-3 (message format) and F-5 (interactive list format).

const { RECOVERY } = require('./error-codes');

// --- Priority Emoji (F-5) ---

const PRIORITY_EMOJI = {
  urgent: '\uD83D\uDD34',
  high: '\uD83D\uDFE0',
  medium: '\uD83D\uDFE1',
  low: '\uD83D\uDFE2',
  4: '\uD83D\uDD34',
  3: '\uD83D\uDFE0',
  2: '\uD83D\uDFE1',
  1: '\uD83D\uDFE2',
  0: '\uD83D\uDFE2',
};

const getPriorityEmoji = (priority) =>
  PRIORITY_EMOJI[priority] || PRIORITY_EMOJI.medium;

const getPriorityName = (priority) => {
  const names = { 4: 'urgent', 3: 'high', 2: 'medium', 1: 'low', 0: 'none' };
  if (typeof priority === 'number') return names[priority] || 'medium';
  return priority || 'medium';
};

// --- Duration Formatter ---

const formatDuration = (minutes) => {
  if (!minutes) return '';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m}min` : `${h}h`;
  }
  return `${minutes}min`;
};

// --- Standard Response Builder ---

const buildResponse = (responseType, message, data = null, suggestions = [], awaitingInput = false) => ({
  response_type: responseType,
  message,
  data,
  suggestions,
  awaiting_input: awaitingInput,
});

const buildError = (errorCode, detail = '') => {
  const recovery = RECOVERY[errorCode] || '';
  const message = `\u274C [${errorCode}] ${detail}${recovery ? ` ${recovery}` : ''}`;
  return buildResponse('error', message, { error_code: errorCode });
};

const buildSuccess = (message, data = null) =>
  buildResponse('confirmation', `\u2705 ${message}`, data);

// --- Quest Board Formatter (/today) ---

const STATE_ORDER = ['To-Do', 'In Progress', 'Deferred', 'Done', 'Canceled'];
const STATE_EMOJI = {
  'To-Do': '\uD83D\uDCCB',
  'In Progress': '\u23F3',
  'Deferred': '\u23F8\uFE0F',
  'Done': '\u2705',
  'Canceled': '\uD83D\uDEAB',
};

const formatQuestBoard = (quests, todayDate, degradedMode = false) => {
  const dayName = new Date(`${todayDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });

  let header = `\uD83D\uDCCB ${todayDate} (${dayName}) Today's Quests`;
  if (degradedMode) {
    header = `\u26A0\uFE0F [DEGRADED_MODE] AI features temporarily unavailable. Routine-based quests generated normally.\n\n${header}`;
  }

  // Group by state
  const grouped = {};
  for (const state of STATE_ORDER) {
    grouped[state] = [];
  }

  for (const quest of quests) {
    const stateName = quest.state_name || quest.state_detail?.name || 'To-Do';
    if (!grouped[stateName]) grouped[stateName] = [];
    grouped[stateName].push(quest);
  }

  let body = '';
  for (const state of STATE_ORDER) {
    const items = grouped[state];
    if (!items || items.length === 0) continue;

    const emoji = STATE_EMOJI[state] || '';
    body += `\n${emoji} **${state}** (${items.length})\n`;

    for (const quest of items) {
      const pEmoji = getPriorityEmoji(quest.priority);
      const pName = getPriorityName(quest.priority);
      const meta = extractQuestMeta(quest.description_html);
      const time = meta?.routine_time || '--:--';
      const duration = meta?.routine_duration_min ? formatDuration(meta.routine_duration_min) : '';
      const deferSuffix = meta?.defer_count > 0 ? ` (deferred x${meta.defer_count})` : '';
      body += `  ${pEmoji} ${quest.name} \u2014 ${time}${duration ? ` (${duration})` : ''}${deferSuffix}\n`;
    }
  }

  if (quests.length === 0) {
    body = '\n_No quests for today. Enjoy your free day!_\n';
  }

  return buildResponse('quest_board', `${header}\n${body}`, {
    total: quests.length,
    by_state: Object.fromEntries(STATE_ORDER.map((s) => [s, (grouped[s] || []).length])),
  });
};

// --- Interactive List Formatter (F-5) ---

const formatInteractiveList = (quests, prompt = 'Enter number(s) (e.g., 1,3 or 1-3):') => {
  let list = '';
  for (let i = 0; i < quests.length; i++) {
    const quest = quests[i];
    const pEmoji = getPriorityEmoji(quest.priority);
    const pName = getPriorityName(quest.priority);
    const meta = extractQuestMeta(quest.description_html);
    const time = meta?.routine_time || '--:--';
    const duration = meta?.routine_duration_min ? formatDuration(meta.routine_duration_min) : '';
    const deferSuffix = meta?.defer_count > 0 ? ` (deferred x${meta.defer_count})` : '';
    list += `${i + 1}. [${pEmoji} ${pName}] ${quest.name} \u2014 ${time}${duration ? ` (${duration})` : ''}${deferSuffix}\n`;
  }

  return buildResponse('list', list, { quest_ids: quests.map((q) => q.id), count: quests.length }, [prompt], true);
};

// --- Helper: Extract quest meta from description ---

const extractQuestMeta = (descriptionHtml) => {
  if (!descriptionHtml) return null;
  try {
    const decodeEntities = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    let m = descriptionHtml.match(/<pre><code\s+class="language-pulse-meta">([\s\S]*?)<\/code><\/pre>/);
    if (m) return JSON.parse(decodeEntities(m[1].trim()));
    m = descriptionHtml.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/);
    if (m) {
      const content = decodeEntities(m[1].trim());
      if (content.includes('"schema_version"')) return JSON.parse(content);
    }
    m = descriptionHtml.match(/```pulse-meta\s*\n([\s\S]*?)\n\s*```/);
    if (m) return JSON.parse(m[1].trim());
  } catch (e) {
    return null;
  }
  return null;
};

module.exports = {
  PRIORITY_EMOJI,
  getPriorityEmoji,
  getPriorityName,
  formatDuration,
  buildResponse,
  buildError,
  buildSuccess,
  formatQuestBoard,
  formatInteractiveList,
  extractQuestMeta,
};
