import { COUNTRIES } from "./datasets/countries";
import { MOVIES } from "./datasets/movies";
import { FOOTBALLERS } from "./datasets/football";
import { CELEBRITIES } from "./datasets/celebrities";
import { SONGS } from "./datasets/songs";
import {
  ANIMALS, BRANDS, CAR_BRANDS, CITIES, ELEMENTS, FICTIONAL_CHARACTERS, FOODS, FRUITS_VEG, HISTORICAL_FIGURES,
  JOBS, LANGUAGES, SPORTS, US_STATES, VIDEO_GAMES, type WordEntry,
} from "./datasets/wordlists";
import { compact, findMatch, type MatchCandidate } from "@/engine/normalize";

export interface Category {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  entries: WordEntry[];
  /** Supports "starting with letter X" variants. */
  letters: boolean;
}

const EXTRA_FOOTBALLERS = `Mohamed Salah;Kevin De Bruyne;Luis Figo;Xavi;Gareth Bale;Sergio Busquets;Gerard Piqué|Pique;Jordi Alba;David Villa;Fernando Torres;Cesc Fàbregas|Fabregas;Xabi Alonso;David Silva;Paul Pogba|Pogba;Antoine Griezmann;Hugo Lloris|Lloris;Raphaël Varane|Varane;Olivier Giroud|Giroud;Franck Ribéry|Ribery;Thomas Müller|Thomas Muller;Bastian Schweinsteiger|Schweinsteiger;Mats Hummels|Hummels;Marco Reus|Reus;İlkay Gündoğan|Gundogan;Leroy Sané|Sane;Joshua Kimmich|Kimmich;Kai Havertz|Havertz;Ederson;Casemiro;Marcelo;Thiago Silva;Raphinha;Rodrygo;Endrick;Gabriel Jesus;Richarlison;Philippe Coutinho|Coutinho;Willian;Oscar;Hulk;Paulo Dybala|Dybala;Gonzalo Higuaín|Higuain;Javier Mascherano|Mascherano;Juan Román Riquelme|Riquelme;Gabriel Batistuta|Batistuta;Carlos Tevez|Tevez;Diego Forlán|Forlan;Radamel Falcao|Falcao;James Rodríguez|James Rodriguez;Carlos Valderrama|Valderrama;Luis Díaz|Luis Diaz;Alexis Sánchez|Alexis Sanchez;Arturo Vidal|Vidal;Christian Pulisic|Pulisic;Landon Donovan;Clint Dempsey;Alphonso Davies;Hirving Lozano|Chucky Lozano;Javier Hernández|Chicharito;Rafael Márquez;Hugo Sánchez;Kaoru Mitoma|Mitoma;Takefusa Kubo|Kubo;Hidetoshi Nakata|Nakata;Park Ji-sung;Kim Min-jae;Mehdi Taremi|Taremi;Sardar Azmoun|Azmoun;Ali Daei;Hakim Ziyech|Ziyech;Sofyan Amrabat|Amrabat;Youssef En-Nesyri|En-Nesyri;Noussair Mazraoui|Mazraoui;Brahim Díaz|Brahim Diaz;Ismaël Bennacer|Bennacer;Islam Slimani;Rabah Madjer;Lakhdar Belloumi;Omar Marmoush|Marmoush;Mohamed Elneny|Elneny;Ahmed Hassan;Hossam Hassan;Mido;Mahmoud Trezeguet|Trezeguet;Mostafa Mohamed;Wahbi Khazri;Youssef Msakni;Akram Afif;Almoez Ali;Hassan Al-Haydos;Omar Abdulrahman|Amoory;Ali Mabkhout;Yasser Al-Qahtani;Nawaf Al-Abed;Saud Abdulhamid;Firas Al-Buraikan;Mohammed Al-Owais;Abdullah Al-Hamdan;Hattan Bahebri;Mohammed Kanno;Salman Al-Faraj;Yasser Al-Shahrani;Ali Al-Bulaihi;Nasser Al-Shamrani;Mohamed Noor;Hussein Abdulghani;Jay-Jay Okocha|Okocha;Nwankwo Kanu|Kanu;Victor Moses;Wilfred Ndidi|Ndidi;Ademola Lookman|Lookman;Alex Iwobi|Iwobi;Mikel John Obi|John Obi Mikel;Kolo Touré|Kolo Toure;Gervinho;Wilfried Zaha|Zaha;Sébastien Haller|Haller;Franck Kessié|Kessie;Nicolas Pépé|Pepe;Michael Essien|Essien;Asamoah Gyan|Gyan;Thomas Partey|Partey;Mohammed Kudus|Kudus;Jordan Ayew;André Ayew;Abedi Pelé;Roger Milla|Milla;André Onana|Onana;Vincent Aboubakar|Aboubakar;Bryan Mbeumo|Mbeumo;Eric Maxim Choupo-Moting|Choupo-Moting;El Hadji Diouf;Idrissa Gueye|Gana Gueye;Nicolas Jackson;Edouard Mendy;Ismaila Sarr;Benni McCarthy;Steven Pienaar;Lucas Radebe;Emmanuel Adebayor|Adebayor;Frédéric Kanouté|Kanoute;Seydou Keita;Yves Bissouma|Bissouma;Naby Keïta|Naby Keita;Serhou Guirassy|Guirassy;Pierre-Emerick Aubameyang|Aubameyang;Denis Bouanga;Jude Bellingham;Cole Palmer|Palmer;Jack Grealish|Grealish;Raheem Sterling|Sterling;John Stones|Stones;Kyle Walker;Jordan Pickford|Pickford;Harry Maguire|Maguire;Jordan Henderson;Mason Mount|Mount;Jadon Sancho|Sancho;Ollie Watkins|Watkins;Jamie Vardy|Vardy;Kieran Trippier|Trippier;Luke Shaw;Ashley Cole;John Terry|Terry;Rio Ferdinand|Ferdinand;Sol Campbell;Gary Neville;Paul Scholes|Scholes;Ryan Giggs|Giggs;Peter Crouch|Crouch;Jermain Defoe|Defoe;Robbie Fowler|Fowler;Ian Wright;Les Ferdinand;Teddy Sheringham;Andy Cole;Dwight Yorke;Gary Lineker|Lineker;Bobby Charlton;Bobby Moore;Geoff Hurst;Kevin Keegan|Keegan;Paul Gascoigne|Gazza;Stuart Pearce;Tony Adams;Patrick Vieira|Vieira;Robert Pirès|Pires;Claude Makélélé|Makelele;Lilian Thuram|Thuram;Marcel Desailly|Desailly;Laurent Blanc;Fabien Barthez|Barthez;David Trezeguet;Jean-Pierre Papin|Papin;Michel Platini|Platini;Just Fontaine;Raymond Kopa;Kingsley Coman|Coman;Theo Hernández|Theo Hernandez;Lucas Hernández;William Saliba|Saliba;Aurélien Tchouaméni|Tchouameni;Eduardo Camavinga|Camavinga;Mike Maignan|Maignan;Marcus Thuram;Randal Kolo Muani|Kolo Muani;Bradley Barcola|Barcola;Désiré Doué|Doue;Warren Zaïre-Emery|Zaire-Emery;Rafael Leão|Rafael Leao;João Félix|Joao Felix;João Cancelo|Joao Cancelo;Diogo Jota|Jota;Pepe;Ricardo Carvalho;Deco;Nuno Gomes;Rui Costa;Vitinha;João Neves|Joao Neves;Nuno Mendes;Gonçalo Ramos|Goncalo Ramos;Rúben Dias|Ruben Dias;Andrea Pirlo;Gennaro Gattuso|Gattuso;Alessandro Nesta|Nesta;Filippo Inzaghi|Inzaghi;Christian Vieri|Vieri;Gianluca Vialli|Vialli;Roberto Mancini;Giorgio Chiellini|Chiellini;Leonardo Bonucci|Bonucci;Ciro Immobile|Immobile;Lorenzo Insigne|Insigne;Marco Verratti|Verratti;Federico Chiesa|Chiesa;Nicolò Barella|Barella;Sandro Tonali|Tonali;Gianluigi Donnarumma|Donnarumma;Dino Zoff|Zoff;Paolo Rossi;Franco Baresi|Baresi;Giuseppe Meazza|Meazza;Mario Balotelli|Balotelli;Antonio Cassano|Cassano;Alessandro Costacurta;Dejan Stanković;Nemanja Vidić|Vidic;Branislav Ivanović|Ivanovic;Dušan Vlahović|Vlahovic;Dušan Tadić|Tadic;Ivan Rakitić|Rakitic;Mario Mandžukić|Mandzukic;Ivan Perišić|Perisic;Davor Šuker|Suker;Joško Gvardiol|Gvardiol;Mateo Kovačić|Kovacic;Edin Džeko|Dzeko;Miralem Pjanić|Pjanic;Hakan Çalhanoğlu|Calhanoglu;Arda Güler|Arda Guler;Arda Turan;Hakan Şükür|Hakan Sukur;Kenan Yıldız|Kenan Yildiz;Gheorghe Hagi|Hagi;Hristo Stoichkov|Stoichkov;Dimitar Berbatov|Berbatov;Gheorghe Popescu;Robert Prosinečki;Tomáš Rosický|Rosicky;Patrik Schick|Schick;Marek Hamšík|Hamsik;Martin Škrtel|Skrtel;Jakub Błaszczykowski;Wojciech Szczęsny|Szczesny;Piotr Zieliński|Zielinski;Grzegorz Lato;Zbigniew Boniek|Boniek;Ferenc Puskás|Puskas;Dominik Szoboszlai|Szoboszlai;Lev Yashin|Yashin;Andrei Arshavin|Arshavin;Oleg Blokhin|Blokhin;Mykhailo Mudryk|Mudryk;Oleksandr Zinchenko|Zinchenko;Henrik Larsson|Larsson;Fredrik Ljungberg|Ljungberg;Alexander Isak|Isak;Viktor Gyökeres|Gyokeres;Dejan Kulusevski|Kulusevski;Christian Eriksen|Eriksen;Peter Schmeichel|Schmeichel;Kasper Schmeichel;Michael Laudrup|Laudrup;Brian Laudrup;Rasmus Højlund|Hojlund;Ole Gunnar Solskjær|Solskjaer;John Arne Riise|Riise;Sami Hyypiä|Hyypia;Jari Litmanen|Litmanen;Eiður Guðjohnsen|Eidur Gudjohnsen;Gylfi Sigurðsson|Gylfi Sigurdsson;Ruud van Nistelrooy|Van Nistelrooy;Robin van Persie|Van Persie;Clarence Seedorf|Seedorf;Edgar Davids|Davids;Patrick Kluivert|Kluivert;Frank de Boer;Ronald Koeman|Koeman;Frank Rijkaard|Rijkaard;Ruud Gullit|Gullit;Edwin van der Sar|Van der Sar;Frenkie de Jong|De Jong;Matthijs de Ligt|De Ligt;Memphis Depay|Memphis;Cody Gakpo|Gakpo;Xavi Simons;Jeremie Frimpong|Frimpong;Romelu Lukaku|Lukaku;Vincent Kompany|Kompany;Jan Vertonghen|Vertonghen;Toby Alderweireld;Axel Witsel|Witsel;Dries Mertens|Mertens;Youri Tielemans|Tielemans;Jérémy Doku|Doku;Leandro Trossard|Trossard;Enzo Scifo|Scifo;Jan Ceulemans;Thomas Vermaelen;Jürgen Klinsmann|Klinsmann;Gerd Müller|Gerd Muller;Rudi Völler|Voller;Karl-Heinz Rummenigge|Rummenigge;Oliver Kahn|Kahn;Michael Ballack|Ballack;Jens Lehmann;Per Mertesacker|Mertesacker;Jérôme Boateng|Boateng;Mario Götze|Gotze;Marc-André ter Stegen|Ter Stegen;Antonio Rüdiger|Rudiger;Granit Xhaka|Xhaka;Xherdan Shaqiri|Shaqiri;Yann Sommer|Sommer;Manuel Akanji|Akanji;Martin Ødegaard;Alexis Mac Allister|Mac Allister;Enzo Fernández|Enzo Fernandez;Rodrigo De Paul|De Paul;Nicolás Otamendi|Otamendi;Cristian Romero|Cuti Romero;Gabriel Heinze|Heinze;Hernán Crespo|Crespo;Juan Sebastián Verón|Veron;Pablo Aimar|Aimar;Ariel Ortega|Ortega;Mario Kempes|Kempes;Alfredo Di Stéfano|Di Stefano;Darwin Núñez|Darwin Nunez;Ronald Araújo|Araujo;Diego Godín|Godin;José María Giménez|Gimenez;Enzo Francescoli|Francescoli;Óscar Tabárez;Roque Santa Cruz;José Luis Chilavert|Chilavert;Claudio Bravo;Iván Zamorano|Zamorano;Marcelo Salas|Salas;Arturo Vidal;Paolo Guerrero|Guerrero;Teófilo Cubillas;Moisés Caicedo|Caicedo;Enner Valencia;Antonio Valencia;Alberto Spencer;Keylor Navas|Navas;Bryan Ruiz;Romário|Romario;Bebeto;Zico;Sócrates|Socrates;Garrincha;Rivelino;Jairzinho;Careca;Taffarel;Dida;Júlio César|Julio Cesar;Adriano;Robinho;Lúcio|Lucio;Juninho Pernambucano|Juninho;Gilberto Silva;Fernandinho;Paulinho;Gabriel Martinelli|Martinelli;Bruno Guimarães|Bruno Guimaraes;Lucas Paquetá|Paqueta;Éder Militão|Militao;Marquinhos;Antony;Gabriel Magalhães|Gabriel;Raúl Jiménez|Raul Jimenez;Andrés Guardado|Guardado;Guillermo Ochoa|Memo Ochoa;Cuauhtémoc Blanco|Cuauhtemoc Blanco;Jorge Campos;Tim Cahill|Cahill;Harry Kewell|Kewell;Mark Viduka|Viduka;Mathew Ryan;Mile Jedinak;Sam Kerr;Alex Morgan;Megan Rapinoe|Rapinoe;Marta;Abby Wambach|Wambach;Mia Hamm;Alexia Putellas|Putellas;Aitana Bonmatí|Aitana Bonmati;Ada Hegerberg|Hegerberg;Lucy Bronze;Beth Mead;Alessia Russo;Chloe Kelly;Vivianne Miedema|Miedema;Lieke Martens;Wendie Renard;Eugénie Le Sommer|Le Sommer;Pernille Harder|Harder;Fridolina Rolfö|Rolfo;Asisat Oshoala|Oshoala;Linda Caicedo;Mary Earps|Earps;Hope Solo;Carli Lloyd;Christine Sinclair|Sinclair;Formiga;Homare Sawa|Sawa`;

function fromRecords<T>(rows: T[], name: (r: T) => string, aliases: (r: T) => string[], difficulty: (r: T) => number): WordEntry[] {
  return rows.map((r) => {
    const d = difficulty(r);
    const tier = (d <= 1 ? 1 : d === 2 ? 2 : d <= 4 ? 3 : 4) as 1 | 2 | 3 | 4;
    return { name: name(r), aliases: aliases(r), tier };
  });
}

function parseFlat(text: string, tier: 1 | 2 | 3 | 4): WordEntry[] {
  return text
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...aliases] = line.split("|");
      return { name, aliases, tier };
    });
}

/** Removes duplicate entries (by any name), keeping the most common tier, and merges aliases. */
export function dedupe(entries: WordEntry[]): WordEntry[] {
  const byKey = new Map<string, WordEntry>();
  const out: WordEntry[] = [];
  for (const e of entries) {
    const keys = [e.name, ...e.aliases].map(compact).filter(Boolean);
    const existing = keys.map((k) => byKey.get(k)).find(Boolean);
    if (existing) {
      existing.tier = Math.min(existing.tier, e.tier) as WordEntry["tier"];
      for (const a of [e.name, ...e.aliases]) if (!existing.aliases.includes(a) && a !== existing.name) existing.aliases.push(a);
      for (const k of keys) if (!byKey.has(k)) byKey.set(k, existing);
      continue;
    }
    const copy = { ...e, aliases: [...e.aliases] };
    out.push(copy);
    for (const k of keys) byKey.set(k, copy);
  }
  return out;
}

const countryEntries: WordEntry[] = COUNTRIES.map((c) => ({
  name: c.name,
  aliases: c.aliases.filter((a) => a !== c.name),
  tier: Math.min(4, c.fame) as WordEntry["tier"],
}));

const capitalEntries: WordEntry[] = COUNTRIES.flatMap((c) =>
  c.capital.map((cap) => ({ name: cap, aliases: [], tier: Math.min(4, c.fame + (c.fame >= 3 ? 0 : 1)) as WordEntry["tier"] })),
);

const musicianSet: WordEntry[] = [
  ...fromRecords(CELEBRITIES.filter((c) => c.profession === "Musician"), (c) => c.name, (c) => c.aliases ?? [], (c) => c.difficulty),
  ...fromRecords(
    SONGS.flatMap((s) => (s.artistAliases?.length ? s.artistAliases : [s.artist.split(" ft. ")[0]]).map((a) => ({ a, d: s.difficulty }))),
    (x) => x.a,
    () => [],
    (x) => x.d + 1,
  ),
  ...parseFlat(
    "Coldplay;Queen;The Beatles|Beatles;Elvis Presley|Elvis;Ed Sheeran;Drake;Eminem;BTS;Taylor Swift;Beyoncé|Beyonce;Rihanna;Michael Jackson;Adele;Bruno Mars;Justin Bieber;Lady Gaga;Kanye West|Kanye|Ye",
    1,
  ),
  ...parseFlat(
    "Imagine Dragons;Maroon 5;Linkin Park;Metallica;Nirvana;AC/DC;Guns N' Roses;Pink Floyd;Led Zeppelin;The Rolling Stones|Rolling Stones;U2;Oasis;Arctic Monkeys;Radiohead;Green Day;Red Hot Chili Peppers;Bon Jovi;ABBA;Bee Gees;Whitney Houston;Mariah Carey;Celine Dion;Britney Spears;Christina Aguilera;Katy Perry;Shakira;Jennifer Lopez|J.Lo;Pitbull;Nicki Minaj;Cardi B;Travis Scott;Post Malone;The Weeknd;SZA;Doja Cat;Billie Eilish;Olivia Rodrigo;Sabrina Carpenter;Dua Lipa;Harry Styles;One Direction;Sam Smith;Lewis Capaldi;Calvin Harris;David Guetta;Avicii;Daft Punk;Snoop Dogg;Jay-Z;Kendrick Lamar;50 Cent;Tupac|2Pac;The Notorious B.I.G.|Biggie;Dr. Dre;Ice Cube;Lil Wayne;Future;Bad Bunny;J Balvin;Karol G;Daddy Yankee;Rosalía|Rosalia;Enrique Iglesias;Ricky Martin;Amr Diab;Fairuz;Umm Kulthum|Oum Kalthoum;Nancy Ajram;Elissa;Haifa Wehbe;Kadim Al Sahir;Mohammed Abdu;Abdel Halim Hafez;Mohamed Mounir;Tamer Hosny;Wegz;Saad Lamjarred;Rashed Al-Majed;Abdul Majeed Abdullah;Balqees;Ahlam;Hussain Al Jassmi;Majid Al Mohandis;Assala;Sherine;Angham;Wael Kfoury;Ragheb Alama;Marwan Khoury;Myriam Fares;Khaled|Cheb Khaled;Burna Boy;Wizkid;Davido;Tems;Rema;Stromae;Edith Piaf;Charles Aznavour;Frank Sinatra;Louis Armstrong;Nina Simone;Aretha Franklin;Stevie Wonder;Marvin Gaye;Prince;David Bowie;Elton John;George Michael;Madonna;Cher;Tina Turner;Dolly Parton;Johnny Cash;Bob Dylan;Bob Marley;Jimi Hendrix;Janis Joplin;Amy Winehouse;Lana Del Rey;Lorde;Sia;Halsey;Ariana Grande;Selena Gomez;Miley Cyrus;Demi Lovato;Shawn Mendes;Charlie Puth;Khalid;Usher;Chris Brown;Alicia Keys;John Legend;Pharrell Williams|Pharrell;Childish Gambino;Tyler, the Creator|Tyler the Creator;Frank Ocean;Lizzo;Megan Thee Stallion;Ice Spice;Central Cee;Stormzy;Dave;Skepta;Blackpink;Twice;Stray Kids;EXO;BigBang;PSY;Jungkook;Rosé|Rose;Lisa",
    2,
  ),
];

const actorEntries: WordEntry[] = [
  ...fromRecords(CELEBRITIES.filter((c) => c.profession === "Actor"), (c) => c.name, (c) => c.aliases ?? [], (c) => c.difficulty),
  ...MOVIES.flatMap((m) => m.stars.map((s) => ({ name: s, aliases: [], tier: Math.min(4, m.difficulty + 1) as WordEntry["tier"] }))),
];

const famousPeople: WordEntry[] = [
  ...fromRecords(CELEBRITIES, (c) => c.name, (c) => c.aliases ?? [], (c) => c.difficulty),
  ...HISTORICAL_FIGURES,
  ...FOOTBALLERS.map((p) => ({ name: p.name, aliases: p.aliases ?? [], tier: Math.min(4, p.difficulty + 1) as WordEntry["tier"] })),
];

const footballerEntries: WordEntry[] = [
  ...fromRecords(FOOTBALLERS, (p) => p.name, (p) => p.aliases ?? [], (p) => p.difficulty),
  ...parseFlat(EXTRA_FOOTBALLERS, 3),
];

export const CATEGORIES: Category[] = [
  { id: "animals", label: "Animals", prompt: "Name an animal", icon: "🦁", entries: ANIMALS, letters: true },
  { id: "countries", label: "Countries", prompt: "Name a country", icon: "🌍", entries: countryEntries, letters: true },
  { id: "capitals", label: "Capital cities", prompt: "Name a capital city", icon: "🏛️", entries: capitalEntries, letters: true },
  { id: "cities", label: "Cities", prompt: "Name a city", icon: "🏙️", entries: [...CITIES, ...capitalEntries], letters: true },
  { id: "foods", label: "Foods & dishes", prompt: "Name a food or dish", icon: "🍕", entries: FOODS, letters: true },
  { id: "fruitveg", label: "Fruits & vegetables", prompt: "Name a fruit or vegetable", icon: "🥕", entries: FRUITS_VEG, letters: true },
  { id: "carbrands", label: "Car brands", prompt: "Name a car manufacturer", icon: "🏎️", entries: CAR_BRANDS, letters: true },
  { id: "brands", label: "Brands", prompt: "Name a famous brand", icon: "🏷️", entries: BRANDS, letters: true },
  { id: "musicians", label: "Musical artists", prompt: "Name a musical artist or band", icon: "🎤", entries: musicianSet, letters: true },
  { id: "actors", label: "Actors", prompt: "Name an actor or actress", icon: "🎭", entries: actorEntries, letters: true },
  { id: "movies", label: "Movies", prompt: "Name a movie", icon: "🎬", entries: fromRecords(MOVIES, (m) => m.title, (m) => m.aliases ?? [], (m) => m.difficulty), letters: true },
  { id: "footballers", label: "Football players", prompt: "Name a football player", icon: "⚽", entries: footballerEntries, letters: true },
  { id: "videogames", label: "Video games", prompt: "Name a video game", icon: "🎮", entries: VIDEO_GAMES, letters: true },
  { id: "fictional", label: "Fictional characters", prompt: "Name a fictional character", icon: "🦸", entries: FICTIONAL_CHARACTERS, letters: true },
  { id: "historical", label: "Historical figures", prompt: "Name a historical figure", icon: "📜", entries: HISTORICAL_FIGURES, letters: true },
  { id: "famous", label: "Famous people", prompt: "Name a famous person", icon: "⭐", entries: famousPeople, letters: true },
  { id: "sports", label: "Sports", prompt: "Name a sport", icon: "🏅", entries: SPORTS, letters: true },
  { id: "elements", label: "Chemical elements", prompt: "Name a chemical element", icon: "⚗️", entries: ELEMENTS, letters: true },
  { id: "jobs", label: "Jobs", prompt: "Name a job or profession", icon: "👷", entries: JOBS, letters: true },
  { id: "languages", label: "Languages", prompt: "Name a language", icon: "🗣️", entries: LANGUAGES, letters: true },
  { id: "usstates", label: "US states", prompt: "Name a US state", icon: "🇺🇸", entries: US_STATES, letters: true },
].map((c) => ({ ...c, entries: dedupe(c.entries) }));

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

const matcherCache = new Map<string, MatchCandidate<WordEntry>[]>();

export function categoryMatchers(cat: Category): MatchCandidate<WordEntry>[] {
  let m = matcherCache.get(cat.id);
  if (!m) {
    m = cat.entries.map((e) => ({ value: e, names: [e.name, ...e.aliases] }));
    matcherCache.set(cat.id, m);
  }
  return m;
}

/** Resolve a free-text answer to a canonical entry in a category (handles typos, aliases, accents). */
export function resolveAnswer(cat: Category, input: string): WordEntry | null {
  const r = findMatch(input, categoryMatchers(cat));
  return r ? r.value : null;
}

export function firstLetter(name: string): string {
  return compact(name).charAt(0).toUpperCase();
}

/** Letters that have at least `min` valid answers in a category. */
export function viableLetters(cat: Category, min: number): string[] {
  const counts = new Map<string, number>();
  for (const e of cat.entries) {
    const l = firstLetter(e.name);
    if (/[A-Z]/.test(l)) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= min).map(([l]) => l);
}
