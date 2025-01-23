const globalConfig = {
  BOT_TYPING_EFFECT_INTERVAL: 50, // in ms

  // Is default prompts enabled?
  IS_DEFAULT_PROMPTS_ENABLED: true,
  // Default prompts to display in the chat
  DISPLAY_DEFAULT_PROMPTS_BUTTON: 'Nicht sicher was du fragen möchtest? Versuche unsere Vorschläge!',
  // This are the labels for the chat button and input
  CHAT_BUTTON_LABEL_TEXT: 'Frag das Wahlprogramm',
  CHAT_CANCEL_BUTTON_LABEL_TEXT: 'Cancel Generation',
  CHAT_VOICE_BUTTON_LABEL_TEXT: 'Spracheingabe',
  CHAT_VOICE_REC_BUTTON_LABEL_TEXT: 'Lausche der Spracheingabe',
  CHAT_INPUT_PLACEHOLDER: 'Stelle eine Frage, z.B. "Wie steht die XYZ Partei zum Thema Migration?"',
  USER_IS_BOT: 'KI-Wahl-o-mat',
  RESET_BUTTON_LABEL_TEXT: 'X',
  RESET_BUTTON_TITLE_TEXT: 'Aktuelle Frage zurücksetzen',
  RESET_CHAT_BUTTON_TITLE: 'Chat zurücksetzen',
  // Copy response to clipboard
  COPY_RESPONSE_BUTTON_LABEL_TEXT: 'Antwort kopieren',
  COPIED_SUCCESSFULLY_MESSAGE: 'Antwort kopiert!',
  // Follow up questions text
  FOLLOW_UP_QUESTIONS_LABEL_TEXT: 'Du kannst auch fragen...',
  SHOW_THOUGH_PROCESS_BUTTON_LABEL_TEXT: 'Zeige den Gedankenprozess',
  HIDE_THOUGH_PROCESS_BUTTON_LABEL_TEXT: 'Verstecke den Gedankenprozess',
  LOADING_INDICATOR_TEXT: 'Bitte warte. Wir suchen und generieren eine Antwort...',
  LOADING_TEXT: 'Lade...',
  // API ERROR HANDLING IN UI
  API_ERROR_MESSAGE: 'Sorry, wir haben ein Problem. Bitte versuche es später erneut.',
  INVALID_REQUEST_ERROR:
    'Wir können keine Antwort für diese Frage generieren. Bitte ändere deine Frage und versuche es erneut.',
  // Config pertaining the response format
  THOUGHT_PROCESS_LABEL: 'Gedankenprozess',
  SUPPORT_CONTEXT_LABEL: 'Wahlprogramm Kontext',
  CITATIONS_LABEL: 'Lerne mehr:',
  CITATIONS_TAB_LABEL: 'Quellen',
  // Custom Branding
  IS_CUSTOM_BRANDING: false,
  // Custom Branding details
  // All these should come from persistence config
  BRANDING_URL: '#',
  BRANDING_LOGO_ALT: 'The AI Software Company Logo',
  BRANDING_HEADLINE: 'Willkommen bei der Wahl-o-mat',
  SHOW_CHAT_HISTORY_LABEL: 'Zeige Chat-Verlauf',
  HIDE_CHAT_HISTORY_LABEL: 'Verstecke Chat-Verlauf',
  CHAT_MAX_COUNT_TAG: '{MAX_CHAT_HISTORY}',
  CHAT_HISTORY_FOOTER_TEXT: 'Zeige vergangene {MAX_CHAT_HISTORY} Konversationen',
};

const teaserListTexts = {
  TEASER_CTA_LABEL: 'Jetzt fragen',
  HEADING_CHAT: 'Chatte mit den Wahlprogrammen',
  HEADING_ASK: 'Stelle eine Frage',
  DEFAULT_PROMPTS: [
    {
      description: 'Wie stehen die Parteien zum Thema KI?',
    },
    {
      description: 'Welche Partei steht zur schwarzen Null?',
    },
    {
      description: 'Welche Partei setzt sich stark für Start-Ups ein?',
    },
  ],
};

const NEXT_QUESTION_INDICATOR = 'Next Questions:';

const requestOptions = {
  approach: 'rrr',
  overrides: {
    retrieval_mode: 'hybrid',
    semantic_ranker: true,
    semantic_captions: false,
    suggest_followup_questions: true,
  },
};

const chatHttpOptions = {
  // API URL for development purposes
  url: 'http://localhost:3000',
  method: 'POST',
  stream: true,
};

const MAX_CHAT_HISTORY = 5;

const APPROACH_MODEL = ['rrr', 'rtr'];

export {
  globalConfig,
  requestOptions,
  chatHttpOptions,
  NEXT_QUESTION_INDICATOR,
  APPROACH_MODEL,
  teaserListTexts,
  MAX_CHAT_HISTORY,
};
