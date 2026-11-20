export const WELCOME_SEEN_KEY = 'orpela-welcome-seen';

export interface WelcomeStepCopy {
  id: string;
  title: string;
  body: string;
}

export const WELCOME_STEPS: readonly WelcomeStepCopy[] = [
  {
    id: 'one-word',
    title: 'Read one word at a time',
    body: 'Orpela shows words one at a time in the same spot, so your eyes can stay still instead of jumping across lines. The highlighted letter is where to look.',
  },
  {
    id: 'words-per-flash',
    title: 'Words per flash',
    body: 'Your speed is always measured in words per minute. Showing more words at once means fewer, longer flashes. Start with 1 word. When that feels easy, try 2 or 3, which is closer to how you read naturally. With more than 1 word, look at the middle of the line.',
  },
  {
    id: 'start-gently',
    title: 'Start gently',
    body: 'Begin around 250 to 300 words per minute. If you can explain what you just read, nudge the speed up by 25. If you lose the thread, slow down. Short sessions of 10 to 15 minutes work best. Rapidly changing text can feel tiring, so take breaks, and use Plain Text anytime.',
  },
];

export const WELCOME_CONTROLS = {
  dialogLabel: 'Welcome to Orpela',
  back: 'Back',
  next: 'Next',
  skip: 'Skip',
  trySample: 'Try the sample',
  close: 'Close',
  showAgain: 'Show the welcome tour again',
  howOrpelaWorks: 'How Orpela works',
} as const;

export type ControlInfoTopicId =
  | 'speed'
  | 'wordsPerFlash'
  | 'highlightLetter'
  | 'punctuationPause'
  | 'speedRamp'
  | 'chunkExpansion'
  | 'contextPane';

export interface ControlInfoCopy {
  id: ControlInfoTopicId;
  title: string;
  ariaLabel: string;
  description: string;
}

export const CONTROL_INFO_TOPICS: Record<ControlInfoTopicId, ControlInfoCopy> = {
  speed: {
    id: 'speed',
    title: 'Speed (WPM)',
    ariaLabel: 'About speed (WPM)',
    description:
      'Words per minute. Most people start comfortably between 200 and 300. Raise it a little at a time.',
  },
  wordsPerFlash: {
    id: 'wordsPerFlash',
    title: 'Words per flash',
    ariaLabel: 'About words per flash',
    description:
      'How many words appear at once. Your speed stays the same, so more words means fewer, longer flashes. 1 word is the easiest place to start. 2 to 3 words feels closer to normal reading. 4 words works best with short, common words.',
  },
  highlightLetter: {
    id: 'highlightLetter',
    title: 'Highlight letter',
    ariaLabel: 'About highlight letter',
    description:
      'Marks the best spot to look in a single word. It only applies when you show 1 word at a time.',
  },
  punctuationPause: {
    id: 'punctuationPause',
    title: 'Punctuation pause',
    ariaLabel: 'About punctuation pause',
    description:
      'Adds a short pause after commas, periods, and paragraph ends so sentences are easier to follow. Turn it down for a steadier pace.',
  },
  speedRamp: {
    id: 'speedRamp',
    title: 'Speed ramp',
    ariaLabel: 'About speed ramp',
    description:
      'Raises your speed by a small step every so often, up to a limit you choose. It is an optional experiment. Turn it off if you start missing the meaning.',
  },
  chunkExpansion: {
    id: 'chunkExpansion',
    title: 'Chunk expansion',
    ariaLabel: 'About chunk expansion',
    description:
      'Slowly increases how many words show at once during a session, up to 4. It is an optional experiment.',
  },
  contextPane: {
    id: 'contextPane',
    title: 'Context pane',
    ariaLabel: 'About context pane',
    description:
      'Shows faded text around the current word so you can glance back. Turning it off discourages re-reading, but it is fine to leave on.',
  },
};

export interface HelpExpandedStep {
  title: string;
  paragraphs: readonly string[];
}

export interface WordsPerFlashGuideItem {
  label: string;
  detail: string;
}

export const HELP_GUIDANCE = {
  howToRead: {
    title: 'How to read with Orpela',
    intro:
      'Orpela is built for calm, steady practice. You can adjust every control in the reader settings anytime, or switch to Plain Text whenever you want a normal page view.',
    steps: [
      {
        title: '1. Read one word at a time',
        paragraphs: [
          'Orpela shows words one at a time in the same spot, so your eyes can stay still instead of jumping across lines. The highlighted letter is where to look.',
          'Keeping your gaze on one steady point reduces eye movement while each word appears in place.',
        ],
      },
      {
        title: '2. Words per flash',
        paragraphs: [
          'Your speed is always measured in words per minute. Showing more words at once means fewer, longer flashes. Start with 1 word. When that feels easy, try 2 or 3, which is closer to how you read naturally. With more than 1 word, look at the middle of the line.',
          'You can change this setting at the bottom of the reader or inside the settings sheet whenever a passage feels too choppy or too wide.',
        ],
      },
      {
        title: '3. Start gently',
        paragraphs: [
          'Begin around 250 to 300 words per minute. If you can explain what you just read, nudge the speed up by 25. If you lose the thread, slow down. Short sessions of 10 to 15 minutes work best. Rapidly changing text can feel tiring, so take breaks, and use Plain Text anytime.',
        ],
      },
    ] satisfies readonly HelpExpandedStep[],
  },
  wordsPerFlashExplained: {
    title: 'Words per flash, explained',
    intro:
      'No matter how many words appear per flash, your speed in words per minute stays the same. Showing multiple words together simply gives you fewer, longer flashes.',
    items: [
      {
        label: '1 word',
        detail:
          'The easiest place to start. One word appears at a time, and the key letter stays aligned with the center mark.',
      },
      {
        label: '2 to 3 words',
        detail:
          'Feels closer to normal reading once single words feel comfortable. Phrases stay together when possible without crossing sentences.',
      },
      {
        label: '4 words',
        detail:
          'Works best with short, common words on wider screens where your eyes can take in a short phrase cleanly.',
      },
    ] satisfies readonly WordsPerFlashGuideItem[],
    whyNoHighlight:
      'Why no letter is highlighted above 1 word: when 2, 3, or 4 words appear together, the whole phrase is centered on the focal stage. There is no single anchor letter to target, so the center of the line becomes your focus point.',
  },
  howToPractice: {
    title: 'How to practice',
    tips: [
      'Start at a comfortable speed, around 250 to 300 words per minute.',
      'Check yourself by pausing after a section and saying the main points of what you read in your own words.',
      'Raise your speed in small steps of 25 to 50 words per minute only while the meaning stays clear.',
      'Drop back whenever you lose the thread or notice words blurring past.',
      'Use short sessions of 10 to 15 minutes and take breaks if your eyes feel tired.',
      'Use faster speeds for light, familiar material and slower speeds for dense or technical writing.',
      'Remember that skimming and careful reading are different jobs. Switch to Plain Text whenever you want to re-read or study a passage closely.',
    ] as const,
  },
  speedReadingNote: {
    title: 'A note on speed reading',
    body: 'Research is mixed, and reading very fast often costs understanding. Orpela is a tool for practice, not a promise. Features like speed ramp, chunk expansion, and hiding the context pane are optional experiments you can turn off anytime.',
  },
} as const;
