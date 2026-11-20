import type {ReadingDescription} from '../types';

export type BookCoverTone =
  | 'slate'
  | 'amber'
  | 'rose'
  | 'emerald'
  | 'indigo'
  | 'red'
  | 'teal'
  | 'sky'
  | 'purple'
  | 'violet'
  | 'stone'
  | 'blue';

export interface PublicDomainBook {
  id: string;
  title: string;
  author: string;
  publicationYear: string;
  edition: string;
  sourceName: string;
  sourceUrl: string;
  publicDomainStatus: string;
  coverTone: BookCoverTone;
}

export interface PublicDomainExcerpt {
  id: string;
  bookId: string;
  title: string;
  description: ReadingDescription;
  wordCount: number;
  isDefault?: boolean;
}

export const DEFAULT_EXCERPT_ID = 'meditations-4';

export const PUBLIC_DOMAIN_BOOKS: readonly PublicDomainBook[] = [
  {
    "id": "sherlock-holmes",
    "title": "The Adventures of Sherlock Holmes",
    "author": "Arthur Conan Doyle",
    "publicationYear": "1892",
    "edition": "First collected edition (1892)",
    "sourceName": "Project Gutenberg (eBook #1661)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1661",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "slate"
  },
  {
    "id": "the-time-machine",
    "title": "The Time Machine",
    "author": "H. G. Wells",
    "publicationYear": "1895",
    "edition": "First edition (1895)",
    "sourceName": "Project Gutenberg (eBook #35)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/35",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "amber"
  },
  {
    "id": "pride-and-prejudice",
    "title": "Pride and Prejudice",
    "author": "Jane Austen",
    "publicationYear": "1813",
    "edition": "First edition (1813)",
    "sourceName": "Project Gutenberg (eBook #1342)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1342",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "rose"
  },
  {
    "id": "the-call-of-the-wild",
    "title": "The Call of the Wild",
    "author": "Jack London",
    "publicationYear": "1903",
    "edition": "First edition (1903)",
    "sourceName": "Project Gutenberg (eBook #215)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/215",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "emerald"
  },
  {
    "id": "great-expectations",
    "title": "Great Expectations",
    "author": "Charles Dickens",
    "publicationYear": "1861",
    "edition": "First book edition (1861)",
    "sourceName": "Project Gutenberg (eBook #1400)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1400",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "indigo"
  },
  {
    "id": "dracula",
    "title": "Dracula",
    "author": "Bram Stoker",
    "publicationYear": "1897",
    "edition": "First edition (1897)",
    "sourceName": "Project Gutenberg (eBook #345)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/345",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "red"
  },
  {
    "id": "walden",
    "title": "Walden",
    "author": "Henry David Thoreau",
    "publicationYear": "1854",
    "edition": "First edition (1854)",
    "sourceName": "Project Gutenberg (eBook #205)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/205",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "teal"
  },
  {
    "id": "origin-of-species",
    "title": "On the Origin of Species",
    "author": "Charles Darwin",
    "publicationYear": "1859",
    "edition": "First edition (1859)",
    "sourceName": "Project Gutenberg (eBook #1228)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1228",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "emerald"
  },
  {
    "id": "moby-dick",
    "title": "Moby-Dick",
    "author": "Herman Melville",
    "publicationYear": "1851",
    "edition": "First American edition (1851)",
    "sourceName": "Project Gutenberg (eBook #2701)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/2701",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "sky"
  },
  {
    "id": "jane-eyre",
    "title": "Jane Eyre",
    "author": "Charlotte Brontë",
    "publicationYear": "1847",
    "edition": "First edition (1847)",
    "sourceName": "Project Gutenberg (eBook #1260)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1260",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "purple"
  },
  {
    "id": "dorian-gray",
    "title": "The Picture of Dorian Gray",
    "author": "Oscar Wilde",
    "publicationYear": "1890",
    "edition": "1891 book edition (revised from 1890)",
    "sourceName": "Project Gutenberg (eBook #174)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/174",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "violet"
  },
  {
    "id": "wuthering-heights",
    "title": "Wuthering Heights",
    "author": "Emily Brontë",
    "publicationYear": "1847",
    "edition": "First edition (1847)",
    "sourceName": "Project Gutenberg (eBook #768)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/768",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "stone"
  },
  {
    "id": "the-republic",
    "title": "The Republic",
    "author": "Plato",
    "publicationYear": "c. 375 BCE",
    "edition": "Translated by Benjamin Jowett (1871)",
    "sourceName": "Project Gutenberg (eBook #1497)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1497",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "amber"
  },
  {
    "id": "on-liberty",
    "title": "On Liberty",
    "author": "John Stuart Mill",
    "publicationYear": "1859",
    "edition": "First edition (1859)",
    "sourceName": "Project Gutenberg (eBook #34901)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/34901",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "blue"
  },
  {
    "id": "wealth-of-nations",
    "title": "The Wealth of Nations",
    "author": "Adam Smith",
    "publicationYear": "1776",
    "edition": "First edition (1776)",
    "sourceName": "Project Gutenberg (eBook #3300)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/3300",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "emerald"
  },
  {
    "id": "decline-and-fall",
    "title": "The History of the Decline and Fall of the Roman Empire",
    "author": "Edward Gibbon",
    "publicationYear": "1776–1789",
    "edition": "Volume I, with notes by H. H. Milman (1845)",
    "sourceName": "Project Gutenberg (eBook #731)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/731",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "red"
  },
  {
    "id": "the-art-of-war",
    "title": "The Art of War",
    "author": "Sun Tzu",
    "publicationYear": "c. 5th century BCE",
    "edition": "Translated by Lionel Giles (1910)",
    "sourceName": "Project Gutenberg (eBook #132)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/132",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "amber"
  },
  {
    "id": "meditations",
    "title": "Meditations",
    "author": "Marcus Aurelius",
    "publicationYear": "c. 180 CE",
    "edition": "Translated by George Long (1862)",
    "sourceName": "Project Gutenberg (eBook #15877)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/15877",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "stone"
  },
  {
    "id": "the-prince",
    "title": "The Prince",
    "author": "Niccolò Machiavelli",
    "publicationYear": "1532",
    "edition": "Translated by W. K. Marriott (1908)",
    "sourceName": "Project Gutenberg (eBook #1232)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/1232",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "red"
  },
  {
    "id": "franklin-autobiography",
    "title": "The Autobiography of Benjamin Franklin",
    "author": "Benjamin Franklin",
    "publicationYear": "1791",
    "edition": "Edited by Frank Woodworth Pine (1916)",
    "sourceName": "Project Gutenberg (eBook #20203)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/20203",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "blue"
  },
  {
    "id": "montaigne-essays",
    "title": "The Essays",
    "author": "Michel de Montaigne",
    "publicationYear": "1580",
    "edition": "Translated by Charles Cotton (1685), ed. W. C. Hazlitt (1877)",
    "sourceName": "Project Gutenberg (eBook #3600)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/3600",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "purple"
  },
  {
    "id": "souls-of-black-folk",
    "title": "The Souls of Black Folk",
    "author": "W. E. B. Du Bois",
    "publicationYear": "1903",
    "edition": "First edition (1903)",
    "sourceName": "Project Gutenberg (eBook #408)",
    "sourceUrl": "https://www.gutenberg.org/ebooks/408",
    "publicDomainStatus": "Public Domain (US)",
    "coverTone": "indigo"
  }
];

export const PUBLIC_DOMAIN_EXCERPTS: readonly PublicDomainExcerpt[] = [
  {
    "id": "sherlock-bohemia-opening",
    "bookId": "sherlock-holmes",
    "title": "A Scandal in Bohemia — The Opening Deduction",
    "description": "Accessible",
    "wordCount": 682
  },
  {
    "id": "sherlock-red-headed-league",
    "bookId": "sherlock-holmes",
    "title": "The Red-Headed League — Jabez Wilson Arrives",
    "description": "Accessible",
    "wordCount": 647
  },
  {
    "id": "sherlock-case-of-identity",
    "bookId": "sherlock-holmes",
    "title": "A Case of Identity — Strangeness of Real Life",
    "description": "Intermediate",
    "wordCount": 625
  },
  {
    "id": "sherlock-boscombe-valley",
    "bookId": "sherlock-holmes",
    "title": "The Boscombe Valley Mystery — Reading the Ground",
    "description": "Accessible",
    "wordCount": 642
  },
  {
    "id": "sherlock-speckled-band",
    "bookId": "sherlock-holmes",
    "title": "The Adventure of the Speckled Band — Helen Stoner’s Account",
    "description": "Intermediate",
    "wordCount": 683
  },
  {
    "id": "time-machine-fourth-dimension",
    "bookId": "the-time-machine",
    "title": "Chapter I — The Fourth Dimension",
    "description": "Intermediate",
    "wordCount": 690
  },
  {
    "id": "time-machine-model-demo",
    "bookId": "the-time-machine",
    "title": "Chapter I — The Miniature Time Machine",
    "description": "Accessible",
    "wordCount": 727
  },
  {
    "id": "time-machine-first-flight",
    "bookId": "the-time-machine",
    "title": "Chapter III — First Flight Through Time",
    "description": "Accessible",
    "wordCount": 642
  },
  {
    "id": "time-machine-year-802701",
    "bookId": "the-time-machine",
    "title": "Chapter V — In the Golden Age",
    "description": "Accessible",
    "wordCount": 773
  },
  {
    "id": "time-machine-further-vision",
    "bookId": "the-time-machine",
    "title": "Chapter XI — The Further Vision",
    "description": "Intermediate",
    "wordCount": 688
  },
  {
    "id": "pride-opening-dialogue",
    "bookId": "pride-and-prejudice",
    "title": "Chapter I — A Truth Universally Acknowledged",
    "description": "Accessible",
    "wordCount": 629
  },
  {
    "id": "pride-meryton-assembly",
    "bookId": "pride-and-prejudice",
    "title": "Chapter III — The Meryton Assembly",
    "description": "Accessible",
    "wordCount": 632
  },
  {
    "id": "pride-wit-and-folly",
    "bookId": "pride-and-prejudice",
    "title": "Chapter IV — Candour and Folly",
    "description": "Intermediate",
    "wordCount": 639
  },
  {
    "id": "pride-first-proposal",
    "bookId": "pride-and-prejudice",
    "title": "Chapter XXXIV — Mr. Darcy’s First Proposal",
    "description": "Intermediate",
    "wordCount": 636
  },
  {
    "id": "pride-pemberley",
    "bookId": "pride-and-prejudice",
    "title": "Chapter XLIII — First Sight of Pemberley",
    "description": "Intermediate",
    "wordCount": 630
  },
  {
    "id": "call-wild-primitive",
    "bookId": "the-call-of-the-wild",
    "title": "Chapter I — Into the Primitive",
    "description": "Accessible",
    "wordCount": 659
  },
  {
    "id": "call-wild-club-and-fang",
    "bookId": "the-call-of-the-wild",
    "title": "Chapter II — The Law of Club and Fang",
    "description": "Accessible",
    "wordCount": 732
  },
  {
    "id": "call-wild-primordial-beast",
    "bookId": "the-call-of-the-wild",
    "title": "Chapter III — The Dominant Primordial Beast",
    "description": "Intermediate",
    "wordCount": 675
  },
  {
    "id": "call-wild-love-of-a-man",
    "bookId": "the-call-of-the-wild",
    "title": "Chapter VI — For the Love of a Man",
    "description": "Accessible",
    "wordCount": 656
  },
  {
    "id": "call-wild-sounding-call",
    "bookId": "the-call-of-the-wild",
    "title": "Chapter VII — The Sounding of the Call",
    "description": "Intermediate",
    "wordCount": 677
  },
  {
    "id": "great-exp-marshes",
    "bookId": "great-expectations",
    "title": "Chapter I — The Marshes and the Convict",
    "description": "Accessible",
    "wordCount": 676
  },
  {
    "id": "great-exp-satis-house",
    "bookId": "great-expectations",
    "title": "Chapter VIII — Satis House and Miss Havisham",
    "description": "Intermediate",
    "wordCount": 634
  },
  {
    "id": "great-exp-announced",
    "bookId": "great-expectations",
    "title": "Chapter XVIII — Great Expectations Announced",
    "description": "Intermediate",
    "wordCount": 737
  },
  {
    "id": "great-exp-london-arrival",
    "bookId": "great-expectations",
    "title": "Chapter XX — Arrival in London",
    "description": "Intermediate",
    "wordCount": 780
  },
  {
    "id": "great-exp-benefactor",
    "bookId": "great-expectations",
    "title": "Chapter XXXIX — The Benefactor Returns",
    "description": "Advanced",
    "wordCount": 661
  },
  {
    "id": "dracula-borgo-pass",
    "bookId": "dracula",
    "title": "Chapter I — Journey to the Borgo Pass",
    "description": "Intermediate",
    "wordCount": 708
  },
  {
    "id": "dracula-castle-welcome",
    "bookId": "dracula",
    "title": "Chapter II — Welcome to Castle Dracula",
    "description": "Intermediate",
    "wordCount": 665
  },
  {
    "id": "dracula-prisoner",
    "bookId": "dracula",
    "title": "Chapter III — The Prisoner in the Castle",
    "description": "Intermediate",
    "wordCount": 603
  },
  {
    "id": "dracula-demeter-log",
    "bookId": "dracula",
    "title": "Chapter VII — Log of the Demeter",
    "description": "Intermediate",
    "wordCount": 670
  },
  {
    "id": "dracula-van-helsing",
    "bookId": "dracula",
    "title": "Chapter XIV — Van Helsing on the Unexplained",
    "description": "Advanced",
    "wordCount": 563
  },
  {
    "id": "walden-quiet-desperation",
    "bookId": "walden",
    "title": "Economy — Lives of Quiet Desperation",
    "description": "Intermediate",
    "wordCount": 727
  },
  {
    "id": "walden-reading",
    "bookId": "walden",
    "title": "Reading — What True Books Demand",
    "description": "Advanced",
    "wordCount": 972
  },
  {
    "id": "walden-sounds",
    "bookId": "walden",
    "title": "Sounds — Morning Stillness at the Pond",
    "description": "Intermediate",
    "wordCount": 884
  },
  {
    "id": "walden-solitude",
    "bookId": "walden",
    "title": "Solitude — Company in Nature",
    "description": "Intermediate",
    "wordCount": 689
  },
  {
    "id": "walden-conclusion",
    "bookId": "walden",
    "title": "Conclusion — Stepping to a Different Drummer",
    "description": "Advanced",
    "wordCount": 646
  },
  {
    "id": "origin-introduction",
    "bookId": "origin-of-species",
    "title": "Introduction — Voyage of the Beagle",
    "description": "Intermediate",
    "wordCount": 846
  },
  {
    "id": "origin-struggle-existence",
    "bookId": "origin-of-species",
    "title": "Chapter III — The Struggle for Existence",
    "description": "Intermediate",
    "wordCount": 669
  },
  {
    "id": "origin-natural-selection",
    "bookId": "origin-of-species",
    "title": "Chapter IV — Natural Selection at Work",
    "description": "Advanced",
    "wordCount": 861
  },
  {
    "id": "origin-organs-perfection",
    "bookId": "origin-of-species",
    "title": "Chapter VI — Organs of Extreme Perfection",
    "description": "Advanced",
    "wordCount": 675
  },
  {
    "id": "origin-entangled-bank",
    "bookId": "origin-of-species",
    "title": "Chapter XIV — The Entangled Bank",
    "description": "Advanced",
    "wordCount": 621
  },
  {
    "id": "moby-loomings",
    "bookId": "moby-dick",
    "title": "Chapter 1 — Loomings",
    "description": "Intermediate",
    "wordCount": 609
  },
  {
    "id": "moby-ahab",
    "bookId": "moby-dick",
    "title": "Chapter 28 — Ahab",
    "description": "Advanced",
    "wordCount": 839
  },
  {
    "id": "moby-quarter-deck",
    "bookId": "moby-dick",
    "title": "Chapter 36 — The Quarter-Deck",
    "description": "Advanced",
    "wordCount": 718
  },
  {
    "id": "moby-whiteness",
    "bookId": "moby-dick",
    "title": "Chapter 42 — The Whiteness of the Whale",
    "description": "Expert",
    "wordCount": 696
  },
  {
    "id": "moby-chase-third-day",
    "bookId": "moby-dick",
    "title": "Chapter 135 — The Chase, Third Day",
    "description": "Advanced",
    "wordCount": 654
  },
  {
    "id": "jane-eyre-gateshead",
    "bookId": "jane-eyre",
    "title": "Chapter I — The Window-Seat at Gateshead",
    "description": "Intermediate",
    "wordCount": 672
  },
  {
    "id": "jane-eyre-thornfield-leads",
    "bookId": "jane-eyre",
    "title": "Chapter XII — Restlessness on the Leads",
    "description": "Advanced",
    "wordCount": 649
  },
  {
    "id": "jane-eyre-orchard",
    "bookId": "jane-eyre",
    "title": "Chapter XXIII — Equality in the Orchard",
    "description": "Advanced",
    "wordCount": 730
  },
  {
    "id": "jane-eyre-conscience",
    "bookId": "jane-eyre",
    "title": "Chapter XXVII — The Law of Conscience",
    "description": "Advanced",
    "wordCount": 640
  },
  {
    "id": "jane-eyre-ferndean",
    "bookId": "jane-eyre",
    "title": "Chapter XXXVII — Return to Ferndean",
    "description": "Intermediate",
    "wordCount": 682
  },
  {
    "id": "dorian-studio",
    "bookId": "dorian-gray",
    "title": "Chapter I — The Studio of Basil Hallward",
    "description": "Intermediate",
    "wordCount": 620
  },
  {
    "id": "dorian-portrait-unveiled",
    "bookId": "dorian-gray",
    "title": "Chapter II — The Portrait Unveiled",
    "description": "Advanced",
    "wordCount": 638
  },
  {
    "id": "dorian-first-alteration",
    "bookId": "dorian-gray",
    "title": "Chapter VII — The First Alteration",
    "description": "Advanced",
    "wordCount": 740
  },
  {
    "id": "dorian-study-sensation",
    "bookId": "dorian-gray",
    "title": "Chapter XI — The Worship of the Senses",
    "description": "Advanced",
    "wordCount": 660
  },
  {
    "id": "dorian-final-reckoning",
    "bookId": "dorian-gray",
    "title": "Chapter XX — The Final Reckoning",
    "description": "Advanced",
    "wordCount": 635
  },
  {
    "id": "wuthering-visit",
    "bookId": "wuthering-heights",
    "title": "Chapter I — Visit to Wuthering Heights",
    "description": "Intermediate",
    "wordCount": 833
  },
  {
    "id": "wuthering-oak-bed",
    "bookId": "wuthering-heights",
    "title": "Chapter III — The Tapping at the Lattice",
    "description": "Advanced",
    "wordCount": 686
  },
  {
    "id": "wuthering-catherine-confession",
    "bookId": "wuthering-heights",
    "title": "Chapter IX — Catherine’s Confession",
    "description": "Advanced",
    "wordCount": 632
  },
  {
    "id": "wuthering-last-meeting",
    "bookId": "wuthering-heights",
    "title": "Chapter XV — The Last Meeting",
    "description": "Advanced",
    "wordCount": 636
  },
  {
    "id": "wuthering-quiet-earth",
    "bookId": "wuthering-heights",
    "title": "Chapter XXXIV — Quiet Earth on the Moors",
    "description": "Intermediate",
    "wordCount": 657
  },
  {
    "id": "republic-cephalus",
    "bookId": "the-republic",
    "title": "Book I — Cephalus on Old Age and Justice",
    "description": "Intermediate",
    "wordCount": 628
  },
  {
    "id": "republic-ring-of-gyges",
    "bookId": "the-republic",
    "title": "Book II — The Ring of Gyges",
    "description": "Advanced",
    "wordCount": 656
  },
  {
    "id": "republic-three-parts-soul",
    "bookId": "the-republic",
    "title": "Book IV — The Three Parts of the Soul",
    "description": "Expert",
    "wordCount": 706
  },
  {
    "id": "republic-divided-line",
    "bookId": "the-republic",
    "title": "Book VI — The Sun and the Good",
    "description": "Expert",
    "wordCount": 620
  },
  {
    "id": "republic-allegory-cave",
    "bookId": "the-republic",
    "title": "Book VII — The Allegory of the Cave",
    "description": "Expert",
    "wordCount": 638
  },
  {
    "id": "on-liberty-tyranny-majority",
    "bookId": "on-liberty",
    "title": "Chapter I — The Tyranny of the Majority",
    "description": "Expert",
    "wordCount": 655
  },
  {
    "id": "on-liberty-harm-principle",
    "bookId": "on-liberty",
    "title": "Chapter I — The Harm Principle",
    "description": "Expert",
    "wordCount": 562
  },
  {
    "id": "on-liberty-silencing-opinion",
    "bookId": "on-liberty",
    "title": "Chapter II — Silencing Opinion Robs Humanity",
    "description": "Expert",
    "wordCount": 621
  },
  {
    "id": "on-liberty-dead-dogma",
    "bookId": "on-liberty",
    "title": "Chapter II — Knowing Both Sides of the Case",
    "description": "Expert",
    "wordCount": 878
  },
  {
    "id": "on-liberty-individuality",
    "bookId": "on-liberty",
    "title": "Chapter III — Of Individuality",
    "description": "Advanced",
    "wordCount": 809
  },
  {
    "id": "wealth-pin-maker",
    "bookId": "wealth-of-nations",
    "title": "Book I, Chapter I — The Division of Labour",
    "description": "Intermediate",
    "wordCount": 681
  },
  {
    "id": "wealth-truck-barter",
    "bookId": "wealth-of-nations",
    "title": "Book I, Chapter II — The Propensity to Exchange",
    "description": "Advanced",
    "wordCount": 751
  },
  {
    "id": "wealth-origin-money",
    "bookId": "wealth-of-nations",
    "title": "Book I, Chapter IV — The Origin and Use of Money",
    "description": "Advanced",
    "wordCount": 780
  },
  {
    "id": "wealth-market-price",
    "bookId": "wealth-of-nations",
    "title": "Book I, Chapter VII — Natural and Market Price",
    "description": "Expert",
    "wordCount": 723
  },
  {
    "id": "wealth-invisible-hand",
    "bookId": "wealth-of-nations",
    "title": "Book IV, Chapter II — The Invisible Hand",
    "description": "Expert",
    "wordCount": 741
  },
  {
    "id": "decline-extent-empire",
    "bookId": "decline-and-fall",
    "title": "Chapter I — The Empire in the Age of the Antonines",
    "description": "Expert",
    "wordCount": 675
  },
  {
    "id": "decline-roads-prosperity",
    "bookId": "decline-and-fall",
    "title": "Chapter II — Union and Internal Prosperity",
    "description": "Advanced",
    "wordCount": 623
  },
  {
    "id": "decline-constitution-augustus",
    "bookId": "decline-and-fall",
    "title": "Chapter III — The Constitution of Augustus",
    "description": "Expert",
    "wordCount": 727
  },
  {
    "id": "decline-commodus",
    "bookId": "decline-and-fall",
    "title": "Chapter IV — From Marcus Aurelius to Commodus",
    "description": "Advanced",
    "wordCount": 831
  },
  {
    "id": "decline-secular-games",
    "bookId": "decline-and-fall",
    "title": "Chapter VII — The Secular Games and Imperial Power",
    "description": "Expert",
    "wordCount": 695
  },
  {
    "id": "art-of-war-laying-plans",
    "bookId": "the-art-of-war",
    "title": "Chapter I — Laying Plans",
    "description": "Accessible",
    "wordCount": 636
  },
  {
    "id": "art-of-war-stratagem",
    "bookId": "the-art-of-war",
    "title": "Chapter III — Attack by Stratagem",
    "description": "Accessible",
    "wordCount": 627
  },
  {
    "id": "art-of-war-waging-war",
    "bookId": "the-art-of-war",
    "title": "Chapter II — Waging War",
    "description": "Accessible",
    "wordCount": 598
  },
  {
    "id": "art-of-war-energy",
    "bookId": "the-art-of-war",
    "title": "Chapter V — Energy",
    "description": "Intermediate",
    "wordCount": 633
  },
  {
    "id": "art-of-war-weak-strong",
    "bookId": "the-art-of-war",
    "title": "Chapter VI — Weak Points and Strong",
    "description": "Intermediate",
    "wordCount": 685
  },
  {
    "id": "meditations-4",
    "bookId": "meditations",
    "title": "Meditations — Book IV (Excerpt)",
    "description": "Advanced",
    "wordCount": 212,
    "isDefault": true
  },
  {
    "id": "meditations-book-2-morning",
    "bookId": "meditations",
    "title": "Book II — Meeting the Morning",
    "description": "Intermediate",
    "wordCount": 669
  },
  {
    "id": "meditations-book-3-present",
    "bookId": "meditations",
    "title": "Book III — Living in the Present",
    "description": "Advanced",
    "wordCount": 653
  },
  {
    "id": "meditations-book-5-duty",
    "bookId": "meditations",
    "title": "Book V — The Work of a Human Being",
    "description": "Intermediate",
    "wordCount": 706
  },
  {
    "id": "meditations-book-6-ruling-faculty",
    "bookId": "meditations",
    "title": "Book VI — The Ruling Faculty",
    "description": "Advanced",
    "wordCount": 712
  },
  {
    "id": "meditations-book-8-inner-citadel",
    "bookId": "meditations",
    "title": "Book VIII — The Inner Citadel",
    "description": "Expert",
    "wordCount": 655
  },
  {
    "id": "prince-new-order",
    "bookId": "the-prince",
    "title": "Chapter VI — Introducing a New Order of Things",
    "description": "Advanced",
    "wordCount": 774
  },
  {
    "id": "prince-effectual-truth",
    "bookId": "the-prince",
    "title": "Chapter XV — Effectual Truth",
    "description": "Advanced",
    "wordCount": 506
  },
  {
    "id": "prince-loved-or-feared",
    "bookId": "the-prince",
    "title": "Chapter XVII — Whether It Is Better to Be Loved or Feared",
    "description": "Intermediate",
    "wordCount": 717
  },
  {
    "id": "prince-fox-and-lion",
    "bookId": "the-prince",
    "title": "Chapter XVIII — The Fox and the Lion",
    "description": "Intermediate",
    "wordCount": 688
  },
  {
    "id": "prince-fortune",
    "bookId": "the-prince",
    "title": "Chapter XXV — How Much Fortune Can Effect",
    "description": "Advanced",
    "wordCount": 644
  },
  {
    "id": "franklin-learning-to-write",
    "bookId": "franklin-autobiography",
    "title": "Chapter II — Learning to Write Prose",
    "description": "Accessible",
    "wordCount": 697
  },
  {
    "id": "franklin-arrival-philadelphia",
    "bookId": "franklin-autobiography",
    "title": "Chapter III — Arrival in Philadelphia",
    "description": "Accessible",
    "wordCount": 650
  },
  {
    "id": "franklin-junto",
    "bookId": "franklin-autobiography",
    "title": "Chapter VII — Founding the Junto",
    "description": "Accessible",
    "wordCount": 842
  },
  {
    "id": "franklin-moral-perfection",
    "bookId": "franklin-autobiography",
    "title": "Chapter IX — Plan for Attaining Moral Perfection",
    "description": "Intermediate",
    "wordCount": 806
  },
  {
    "id": "franklin-subscription-library",
    "bookId": "franklin-autobiography",
    "title": "Chapter VIII — The First Subscription Library",
    "description": "Intermediate",
    "wordCount": 788
  },
  {
    "id": "montaigne-liars",
    "bookId": "montaigne-essays",
    "title": "Book I, Chapter IX — Of Liars",
    "description": "Intermediate",
    "wordCount": 731
  },
  {
    "id": "montaigne-friendship",
    "bookId": "montaigne-essays",
    "title": "Book I, Chapter XXVII — Of Friendship",
    "description": "Advanced",
    "wordCount": 679
  },
  {
    "id": "montaigne-solitude",
    "bookId": "montaigne-essays",
    "title": "Book I, Chapter XXXVIII — Of Solitude",
    "description": "Advanced",
    "wordCount": 669
  },
  {
    "id": "montaigne-books",
    "bookId": "montaigne-essays",
    "title": "Book II, Chapter X — Of Books",
    "description": "Intermediate",
    "wordCount": 775
  },
  {
    "id": "montaigne-experience",
    "bookId": "montaigne-essays",
    "title": "Book III, Chapter XIII — Of Experience",
    "description": "Expert",
    "wordCount": 768
  },
  {
    "id": "dubois-spiritual-strivings",
    "bookId": "souls-of-black-folk",
    "title": "Chapter I — Of Our Spiritual Strivings",
    "description": "Advanced",
    "wordCount": 644
  },
  {
    "id": "dubois-dawn-of-freedom",
    "bookId": "souls-of-black-folk",
    "title": "Chapter II — Of the Dawn of Freedom",
    "description": "Advanced",
    "wordCount": 663
  },
  {
    "id": "dubois-meaning-of-progress",
    "bookId": "souls-of-black-folk",
    "title": "Chapter IV — Of the Meaning of Progress",
    "description": "Intermediate",
    "wordCount": 706
  },
  {
    "id": "dubois-training-black-men",
    "bookId": "souls-of-black-folk",
    "title": "Chapter VI — Of the Training of Black Men",
    "description": "Advanced",
    "wordCount": 672
  },
  {
    "id": "dubois-sorrow-songs",
    "bookId": "souls-of-black-folk",
    "title": "Chapter XIV — Of the Sorrow Songs",
    "description": "Intermediate",
    "wordCount": 741
  }
];

export const PUBLIC_DOMAIN_BOOK_BY_ID: ReadonlyMap<string, PublicDomainBook> = new Map(
  PUBLIC_DOMAIN_BOOKS.map((book) => [book.id, book])
);

export const PUBLIC_DOMAIN_EXCERPT_BY_ID: ReadonlyMap<string, PublicDomainExcerpt> = new Map(
  PUBLIC_DOMAIN_EXCERPTS.map((excerpt) => [excerpt.id, excerpt])
);

export async function loadPublicDomainExcerptText(
  bookId: string,
  excerptId: string
): Promise<string | null> {
  switch (bookId) {
    case 'sherlock-holmes':
      return (await import('./excerpts/sherlock-holmes')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'the-time-machine':
      return (await import('./excerpts/the-time-machine')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'pride-and-prejudice':
      return (await import('./excerpts/pride-and-prejudice')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'the-call-of-the-wild':
      return (await import('./excerpts/the-call-of-the-wild')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'great-expectations':
      return (await import('./excerpts/great-expectations')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'dracula':
      return (await import('./excerpts/dracula')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'walden':
      return (await import('./excerpts/walden')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'origin-of-species':
      return (await import('./excerpts/origin-of-species')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'moby-dick':
      return (await import('./excerpts/moby-dick')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'jane-eyre':
      return (await import('./excerpts/jane-eyre')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'dorian-gray':
      return (await import('./excerpts/dorian-gray')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'wuthering-heights':
      return (await import('./excerpts/wuthering-heights')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'the-republic':
      return (await import('./excerpts/the-republic')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'on-liberty':
      return (await import('./excerpts/on-liberty')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'wealth-of-nations':
      return (await import('./excerpts/wealth-of-nations')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'decline-and-fall':
      return (await import('./excerpts/decline-and-fall')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'the-art-of-war':
      return (await import('./excerpts/the-art-of-war')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'meditations':
      return (await import('./excerpts/meditations')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'the-prince':
      return (await import('./excerpts/the-prince')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'franklin-autobiography':
      return (await import('./excerpts/franklin-autobiography')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'montaigne-essays':
      return (await import('./excerpts/montaigne-essays')).EXCERPT_TEXTS[excerptId] ?? null;
    case 'souls-of-black-folk':
      return (await import('./excerpts/souls-of-black-folk')).EXCERPT_TEXTS[excerptId] ?? null;
    default:
      return null;
  }
}
