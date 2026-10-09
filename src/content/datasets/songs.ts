/**
 * Songs. Title, artist, original release year (of the single, or the album when the song
 * was not a single) and genre are public record. Descriptions and emoji clues are original.
 * NO lyrics beyond short title fragments, and NO audio is bundled.
 * Audio previews are an optional provider (Apple iTunes Search API 30-second previews,
 * which Apple permits for promotional use) — see src/content/providers/itunes.ts.
 */

export type Genre = "pop" | "rock" | "hip-hop" | "r&b" | "arabic" | "latin" | "k-pop" | "afrobeats" | "classic" | "dance" | "country" | "reggae";

export interface Song {
  id: string;
  title: string;
  aliases?: string[];
  artist: string;
  artistAliases?: string[];
  year?: number;
  genre: Genre;
  lang: string;
  emoji: string;
  description: string;
  difficulty: number;
}

const s = (id: string, title: string, artist: string, year: number | undefined, genre: Genre, emoji: string, description: string, difficulty = 2, opts: Partial<Song> = {}): Song => ({
  id, title, artist, year, genre, emoji, description, difficulty, lang: "English", ...opts,
});

export const SONGS: Song[] = [
  // Pop
  s("shapeofyou", "Shape of You", "Ed Sheeran", 2017, "pop", "🍷💃🛏️❤️", "A marimba-driven pop hit about being attracted to someone's figure after meeting at a bar.", 1),
  s("blindinglights", "Blinding Lights", "The Weeknd", 2019, "pop", "🌃🚗💡😵", "A synth-heavy 80s-style anthem about driving through the city at night desperate to see someone.", 1),
  s("badguy", "Bad Guy", "Billie Eilish", 2019, "pop", "😈🦹‍♀️🤫🖤", "A whispery, bass-heavy pop track mocking someone who pretends to be tough.", 1, { aliases: ["bad guy"] }),
  s("shakeitoff", "Shake It Off", "Taylor Swift", 2014, "pop", "💃🙅‍♀️👂🤷‍♀️", "An upbeat anthem about ignoring the haters and dancing it out.", 1),
  s("antihero", "Anti-Hero", "Taylor Swift", 2022, "pop", "🪞😬🦸‍♀️❌", "A self-deprecating synth-pop song in which the singer calls herself the problem.", 2),
  s("rollinginthedeep", "Rolling in the Deep", "Adele", 2010, "pop", "🌊🔥💔🥁", "A stomping, gospel-tinged song about the fury of being left.", 1),
  s("hello", "Hello", "Adele", 2015, "pop", "☎️👋🏠💔", "A piano ballad calling an old lover from the other side of years and regret.", 1),
  s("someonelikeyou", "Someone Like You", "Adele", 2011, "pop", "🎹💔💍😢", "A sparse piano ballad about hearing that an ex has settled down with someone new.", 1),
  s("uptownfunk", "Uptown Funk", "Mark Ronson ft. Bruno Mars", 2014, "pop", "🕺🎺🔥🏙️", "A brassy funk revival about being too hot to handle.", 1, { artistAliases: ["Mark Ronson", "Bruno Mars"] }),
  s("happy", "Happy", "Pharrell Williams", 2013, "pop", "😀👏🏠🎩", "A handclap-driven feel-good song from an animated film, inviting you to clap along.", 1, { artistAliases: ["Pharrell"] }),
  s("billiejean", "Billie Jean", "Michael Jackson", 1983, "pop", "🕺👶🚫🧍‍♂️", "A tense, bass-led track in which the singer denies being the father of a woman's child.", 1),
  s("badromance", "Bad Romance", "Lady Gaga", 2009, "pop", "💔🧛‍♀️🕺🎭", "A dark dance-pop song about wanting a lover's ugliness and revenge.", 1),
  s("pokerface", "Poker Face", "Lady Gaga", 2008, "pop", "🃏😐🎰💃", "A dance hit about hiding your feelings like a card player.", 1),
  s("umbrella", "Umbrella", "Rihanna ft. Jay-Z", 2007, "pop", "☔🌂🤝💧", "A thunder-cracked R&B-pop hit promising shelter to a partner.", 1, { artistAliases: ["Rihanna"] }),
  s("diamonds", "Diamonds", "Rihanna", 2012, "pop", "💎✨🌌😍", "A soaring ballad comparing a couple to gems glittering in the night sky.", 1),
  s("singleladies", "Single Ladies (Put a Ring on It)", "Beyoncé", 2008, "pop", "💍💃👋🙌", "A handclap anthem telling an ex he should have committed.", 1, { aliases: ["Single Ladies"] }),
  s("crazyinlove", "Crazy in Love", "Beyoncé ft. Jay-Z", 2003, "r&b", "🎺💘🤪👠", "A horn-blasting debut solo hit about being swept away by love.", 1, { artistAliases: ["Beyoncé", "Beyonce"] }),
  s("babyonemore", "...Baby One More Time", "Britney Spears", 1998, "pop", "🏫👧📞1️⃣", "A teen-pop debut set in a school hallway, pleading for another chance.", 1, { aliases: ["Baby One More Time"] }),
  s("likeaprayer", "Like a Prayer", "Madonna", 1989, "pop", "🙏⛪🎤🕯️", "A gospel-choir pop song mixing faith and desire.", 2),
  s("wannabe", "Wannabe", "Spice Girls", 1996, "pop", "👯‍♀️🌶️🤝🗣️", "A girl-group debut about friendship coming before romance.", 1),
  s("despacito", "Despacito", "Luis Fonsi ft. Daddy Yankee", 2017, "latin", "🐢💃🇵🇷🔥", "A reggaeton-pop hit about taking things slowly, which became a global record-breaker.", 1, { lang: "Spanish", artistAliases: ["Luis Fonsi"] }),
  s("gangnamstyle", "Gangnam Style", "PSY", 2012, "k-pop", "🐴🕺🇰🇷🕶️", "A satirical K-pop dance track with a famous invisible horse-riding move.", 1, { lang: "Korean" }),
  s("dynamite", "Dynamite", "BTS", 2020, "k-pop", "🧨🕺✨🌃", "A disco-pop single that was a boy band's first fully English-language release.", 1),
  s("levitating", "Levitating", "Dua Lipa", 2020, "pop", "🌙🚀💃✨", "A disco-pop song about love lifting you up into the stars.", 1),
  s("flowers", "Flowers", "Miley Cyrus", 2023, "pop", "💐🙋‍♀️💃💪", "A self-love anthem about treating yourself to a bouquet after a breakup.", 1),
  s("asitwas", "As It Was", "Harry Styles", 2022, "pop", "⏳🔄🎹💔", "A wistful synth-pop song about change and things not being the same.", 1),
  s("driverslicense", "drivers license", "Olivia Rodrigo", 2021, "pop", "🚗🪪💔🏘️", "A piano ballad about driving past an ex's street after getting a licence.", 1),
  s("espresso", "Espresso", "Sabrina Carpenter", 2024, "pop", "☕😏💤✨", "A cheeky summer pop hit comparing the singer to a caffeine buzz.", 1),
  s("firework", "Firework", "Katy Perry", 2010, "pop", "🎆🛍️💥🌟", "An empowerment anthem telling listeners they can shine.", 1),
  s("roar", "Roar", "Katy Perry", 2013, "pop", "🦁🐯🥊🌴", "A jungle-themed self-confidence anthem.", 1),
  s("baby", "Baby", "Justin Bieber ft. Ludacris", 2010, "pop", "👶😢💔🎤", "A teen-pop breakup song with a rap verse.", 1, { artistAliases: ["Justin Bieber"] }),
  s("someoneyouloved", "Someone You Loved", "Lewis Capaldi", 2018, "pop", "🎹💔😭🇬🇧", "A heartbroken piano ballad about losing the person you leaned on.", 2),
  s("shallow", "Shallow", "Lady Gaga & Bradley Cooper", 2018, "pop", "🌊⭐🎸🎤", "An Oscar-winning duet from a film about a rising star.", 1, { artistAliases: ["Lady Gaga"] }),
  s("vivalavida", "Viva la Vida", "Coldplay", 2008, "rock", "👑🔔🎻🏰", "A string-driven song narrated by a king who has lost his throne.", 1),
  s("yellow", "Yellow", "Coldplay", 2000, "rock", "⭐💛🌊🎸", "A breakthrough ballad about the stars shining golden for someone.", 2),
  s("hipsdontlie", "Hips Don't Lie", "Shakira ft. Wyclef Jean", 2006, "latin", "💃🎺🇨🇴🎶", "A trumpet-laced dance hit about honest hips.", 1, { artistAliases: ["Shakira"] }),
  s("wakawaka", "Waka Waka (This Time for Africa)", "Shakira", 2010, "latin", "⚽🌍🥁🙌", "The official song of the 2010 World Cup in South Africa.", 1, { aliases: ["Waka Waka"] }),
  s("africa", "Africa", "Toto", 1982, "rock", "🌍🌧️⛰️🎹", "A soft-rock classic about longing and rains on a continent.", 2),
  s("takeonme", "Take On Me", "a-ha", 1985, "pop", "✏️📖🎹🇳🇴", "A synth-pop hit with a famous pencil-sketch animated video.", 2),
  s("dontstopbelievin", "Don't Stop Believin'", "Journey", 1981, "rock", "🚂🌃🎹🙌", "A power ballad about a small-town girl and a city boy on a midnight train.", 2),
  s("dancingqueen", "Dancing Queen", "ABBA", 1976, "pop", "👸💃🕺1️⃣7️⃣", "A disco classic about a seventeen-year-old ruling the dance floor.", 1),
  s("iwillalwayslove", "I Will Always Love You", "Whitney Houston", 1992, "r&b", "❤️🎤🕴️🎬", "A powerhouse ballad cover from a film about a bodyguard.", 1),
  s("myheartwillgoon", "My Heart Will Go On", "Celine Dion", 1997, "pop", "🚢❤️🪈🌊", "A tin-whistle-opened ballad from a film about a sinking ship.", 1),
  s("carelesswhisper", "Careless Whisper", "George Michael", 1984, "pop", "🎷🤫💃💔", "A ballad famous for its saxophone riff about guilty feet having no rhythm.", 2, { artistAliases: ["Wham!"] }),
  s("heyjude", "Hey Jude", "The Beatles", 1968, "rock", "👦🎹😢➡️😀", "A long, sing-along ballad encouraging a boy not to be afraid.", 1),
  s("yesterday", "Yesterday", "The Beatles", 1965, "rock", "📅🎸😔🕰️", "A short acoustic ballad longing for the past.", 2),
  s("imagine", "Imagine", "John Lennon", 1971, "rock", "🌍☮️🎹💭", "A piano ballad dreaming of a world without borders or possessions.", 1),
  s("bohemianrhapsody", "Bohemian Rhapsody", "Queen", 1975, "rock", "🎹👨‍🦱⚡🎭", "A six-minute operatic rock epic about a young man's confession.", 1),
  s("wewillrockyou", "We Will Rock You", "Queen", 1977, "rock", "👏🦶🏟️🎸", "A stadium chant built on stomps and claps.", 1),
  s("hotelcalifornia", "Hotel California", "Eagles", 1976, "rock", "🏨🌴🎸🔒", "A mysterious tale of a luxury hotel you can never leave.", 2),
  s("stairway", "Stairway to Heaven", "Led Zeppelin", 1971, "rock", "🪜☁️🎸👼", "An eight-minute epic that builds from folk to hard rock.", 2),
  s("teenspirit", "Smells Like Teen Spirit", "Nirvana", 1991, "rock", "🧴👦🎸🔊", "A grunge anthem that turned a Seattle trio into stars.", 2),
  s("sweetchild", "Sweet Child o' Mine", "Guns N' Roses", 1987, "rock", "👶🌹🔫🎸", "A hard-rock ballad with a famous opening guitar riff.", 2),
  s("wonderwall", "Wonderwall", "Oasis", 1995, "rock", "🧱🌟🎸🇬🇧", "A Britpop strummer about someone who might be the one to save you.", 1),
  s("mrbrightside", "Mr. Brightside", "The Killers", 2004, "rock", "😬💡🛌🎸", "A jealous indie-rock anthem that refuses to leave the charts.", 2),
  s("sevennation", "Seven Nation Army", "The White Stripes", 2003, "rock", "7️⃣🪖⚔️🎸", "A riff-driven garage-rock song now chanted in football stadiums.", 2),
  s("livinonaprayer", "Livin' on a Prayer", "Bon Jovi", 1986, "rock", "🙏💑🏭🎸", "A working-class love story about Tommy and Gina halfway there.", 2),
  s("backinblack", "Back in Black", "AC/DC", 1980, "rock", "🖤🔙🎸⚡", "A hard-rock tribute recorded after the band lost its singer.", 2),
  s("numb", "Numb", "Linkin Park", 2003, "rock", "😶🧊🎹🎸", "A nu-metal song about feeling pressured to be someone else.", 2),
  s("entersandman", "Enter Sandman", "Metallica", 1991, "rock", "😴🌙👹🎸", "A heavy-metal nightmare lullaby.", 2),
  s("smokeonthewater", "Smoke on the Water", "Deep Purple", 1972, "rock", "💨🌊🔥🎸", "A riff-famous song about a casino fire on Lake Geneva.", 3),
  s("johnnybgoode", "Johnny B. Goode", "Chuck Berry", 1958, "rock", "🎸👦🛤️⭐", "A rock-and-roll foundation stone about a country boy guitar prodigy.", 3),
  s("hounddog", "Hound Dog", "Elvis Presley", 1956, "rock", "🐶😢🕺🎸", "A rock-and-roll hit dismissing someone as nothing but a dog.", 2),
  // Hip-hop
  s("loseyourself", "Lose Yourself", "Eminem", 2002, "hip-hop", "🍝🎤⏱️🔥", "An Oscar-winning rap about seizing one shot at your dream.", 1),
  s("stan", "Stan", "Eminem ft. Dido", 2000, "hip-hop", "✉️🌧️🚗😱", "A storytelling rap about an obsessed fan's letters.", 2, { artistAliases: ["Eminem"] }),
  s("stilldre", "Still D.R.E.", "Dr. Dre ft. Snoop Dogg", 1999, "hip-hop", "🎹🚗🌴🩺", "A West Coast comeback track with an iconic piano loop.", 2, { artistAliases: ["Dr. Dre", "Dr Dre"] }),
  s("indaclub", "In Da Club", "50 Cent", 2003, "hip-hop", "🎂🍾🕺💰", "A party anthem about celebrating a birthday at the club.", 1),
  s("ginandjuice", "Gin and Juice", "Snoop Dogg", 1994, "hip-hop", "🍸🍊🌴🚗", "A laid-back G-funk song about a house party in Long Beach.", 2),
  s("juicy", "Juicy", "The Notorious B.I.G.", 1994, "hip-hop", "💭📈🏙️👑", "A rags-to-riches story from a Brooklyn rapper.", 2, { artistAliases: ["Biggie", "Notorious B.I.G.", "Biggie Smalls"] }),
  s("californialove", "California Love", "2Pac ft. Dr. Dre", 1995, "hip-hop", "🌴🏜️🚗🎉", "A talk-box West Coast party anthem celebrating a state.", 2, { artistAliases: ["2Pac", "Tupac"] }),
  s("humble", "HUMBLE.", "Kendrick Lamar", 2017, "hip-hop", "🙇‍♂️🎹🍑👑", "A hard-hitting track telling rivals to sit down and stay modest.", 1, { aliases: ["Humble"] }),
  s("notlikeus", "Not Like Us", "Kendrick Lamar", 2024, "hip-hop", "🦉🎯🌴🏆", "A West Coast diss track that won Record of the Year.", 1),
  s("godsplan", "God's Plan", "Drake", 2018, "hip-hop", "🙏💸🛒🤲", "A hit whose video showed the rapper giving away the budget to strangers.", 1),
  s("hotlinebling", "Hotline Bling", "Drake", 2015, "hip-hop", "📞🕺🌈🔔", "A song about a late-night phone call, famous for its dance-meme video.", 1),
  s("sickomode", "Sicko Mode", "Travis Scott ft. Drake", 2018, "hip-hop", "🎢🌵🔀🔥", "A multi-part track with several beat switches.", 2, { artistAliases: ["Travis Scott"] }),
  s("oldtownroad", "Old Town Road", "Lil Nas X ft. Billy Ray Cyrus", 2019, "hip-hop", "🐴🤠🛣️🎵", "A country-trap crossover that set a record run at number one.", 1, { artistAliases: ["Lil Nas X"] }),
  s("golddigger", "Gold Digger", "Kanye West ft. Jamie Foxx", 2005, "hip-hop", "💰⛏️👠🎹", "A Ray Charles-sampling song about a partner chasing money.", 2, { artistAliases: ["Kanye West", "Kanye", "Ye"] }),
  s("empirestate", "Empire State of Mind", "Jay-Z ft. Alicia Keys", 2009, "hip-hop", "🗽🎹🌃🍎", "A piano-led love letter to New York City.", 1, { artistAliases: ["Jay-Z", "Jay Z"] }),
  s("rappersdelight", "Rapper's Delight", "The Sugarhill Gang", 1979, "hip-hop", "🎤🎉🕺📼", "One of the first rap singles to become a mainstream hit.", 3),
  s("iceicebaby", "Ice Ice Baby", "Vanilla Ice", 1990, "hip-hop", "🧊🧊👶🎤", "A rap hit built on a famous borrowed bassline.", 2),
  s("canttouchthis", "U Can't Touch This", "MC Hammer", 1990, "hip-hop", "🙅‍♂️👖🕺🔨", "A dance-rap hit famous for baggy trousers.", 2, { artistAliases: ["Hammer"] }),
  s("heyya", "Hey Ya!", "OutKast", 2003, "hip-hop", "📸🥶🍰🎸", "A frantic funk-pop song that told everyone to shake it like a Polaroid picture.", 2, { aliases: ["Hey Ya"] }),
  s("rockstar", "Rockstar", "Post Malone ft. 21 Savage", 2017, "hip-hop", "🎸⭐🍾😎", "A trap hit comparing the rapper's lifestyle to rock legends.", 2, { artistAliases: ["Post Malone"] }),
  s("sunflower", "Sunflower", "Post Malone & Swae Lee", 2018, "hip-hop", "🌻🕷️🎬🌞", "A breezy song from an animated Spider-Man film.", 1, { artistAliases: ["Post Malone"] }),
  s("luciddreams", "Lucid Dreams", "Juice WRLD", 2018, "hip-hop", "💤💔🎸🌀", "An emo-rap breakup song built on a Sting sample.", 2),
  // R&B / soul
  s("noscrubs", "No Scrubs", "TLC", 1999, "r&b", "🚫🧽🚗📞", "An R&B anthem rejecting men who can't get any love from the group.", 2),
  s("yeah", "Yeah!", "Usher ft. Lil Jon & Ludacris", 2004, "r&b", "🕺👠🗣️🔥", "A crunk-and-B club smash.", 1, { aliases: ["Yeah"], artistAliases: ["Usher"] }),
  s("killbill", "Kill Bill", "SZA", 2022, "r&b", "🔪💔😇🎬", "A deceptively sweet song about violent thoughts toward an ex, named after a film.", 2),
  s("thinkinboutyou", "Thinkin Bout You", "Frank Ocean", 2012, "r&b", "🌪️💭🎹🌊", "A falsetto ballad comparing feelings to a tornado.", 3),
  s("respect", "Respect", "Aretha Franklin", 1967, "r&b", "🙇‍♀️🔤🎤👑", "A soul anthem that spells out what a woman demands.", 1),
  s("superstition", "Superstition", "Stevie Wonder", 1972, "r&b", "🪞🐈‍⬛🎹🔮", "A clavinet-funk warning about believing in omens.", 2),
  s("whatsgoingon", "What's Going On", "Marvin Gaye", 1971, "r&b", "❓🕊️🎷🌍", "A soul protest song asking about war and injustice.", 3),
  s("standbyme", "Stand by Me", "Ben E. King", 1961, "r&b", "🧍‍♂️🧍🌙🎻", "A soul classic promising not to be afraid as long as a loved one stays close.", 2),
  s("iwillsurvive", "I Will Survive", "Gloria Gaynor", 1978, "r&b", "💪🪩💔🚪", "A disco anthem of resilience after a breakup.", 1),
  s("doowop", "Doo Wop (That Thing)", "Lauryn Hill", 1998, "r&b", "🎤👩🏾📜🎶", "A neo-soul hit warning about relationships that are only about one thing.", 3, { aliases: ["Doo Wop"] }),
  // Arabic
  s("tamallymaak", "Tamally Maak", "Amr Diab", 2000, "arabic", "❤️🕰️🎶🇪🇬", "A tender Egyptian pop love song whose title means 'Always with you'.", 3, { lang: "Arabic", artistAliases: ["Amr Diyab"] }),
  s("nourelain", "Nour El Ain", "Amr Diab", 1996, "arabic", "👁️✨💃🌍", "A Mediterranean-pop hit whose title means 'light of the eye'.", 2, { lang: "Arabic", aliases: ["Habibi Ya Nour El Ain", "Nour El Ein", "Habibi"], artistAliases: ["Amr Diyab"] }),
  s("entaomri", "Enta Omri", "Umm Kulthum", 1964, "arabic", "🎻⏳❤️🌙", "An hour-long classic whose title means 'You are my life'.", 3, { lang: "Arabic", aliases: ["Inta Omri"], artistAliases: ["Oum Kalthoum", "Om Kalthoum"] }),
  s("akhasmakah", "Akhasmak Ah", "Nancy Ajram", 2003, "arabic", "😤❤️☕🇱🇧", "A playful Lebanese pop hit about being mad at someone — but not really.", 3, { lang: "Arabic" }),
  s("ahwnoss", "Ah W Noss", "Nancy Ajram", 2004, "arabic", "🤏💃🎶🇱🇧", "A coy pop song whose title means 'Yes and a half'.", 4, { lang: "Arabic" }),
  s("boshretkheir", "Boshret Kheir", "Hussain Al Jassmi", 2014, "arabic", "🗳️🇪🇬🎉🕺", "An upbeat Egyptian-style song encouraging people to go out and vote.", 3, { lang: "Arabic", artistAliases: ["Hussain Al-Jassmi"] }),
  s("lmaallem", "Lm3allem", "Saad Lamjarred", 2015, "arabic", "👑🎩💃🇲🇦", "A Moroccan pop hit whose video became one of the most-watched Arabic videos online.", 3, { lang: "Arabic", aliases: ["Lmaallem", "LM3ALLEM", "Al Maalem"] }),
  s("kifakinta", "Kifak Inta", "Fairuz", 1991, "arabic", "👋❓☕🇱🇧", "A jazzy Lebanese song asking an old love 'How are you?' after years apart.", 4, { lang: "Arabic", artistAliases: ["Fayrouz"] }),
  s("didi", "Didi", "Khaled", 1992, "arabic", "🇩🇿🥁💃🎺", "A raï hit that took Algerian pop onto European charts.", 3, { lang: "Arabic", artistAliases: ["Cheb Khaled"] }),
  s("aicha", "Aïcha", "Khaled", 1996, "arabic", "👩💍🎶🇩🇿", "A raï love song pleading with a woman named in the title.", 3, { lang: "French", aliases: ["Aicha"], artistAliases: ["Cheb Khaled"] }),
  s("desertrose", "Desert Rose", "Sting ft. Cheb Mami", 1999, "pop", "🌹🏜️🎶🚗", "A crossover hit blending English pop with Algerian raï vocals.", 3, { artistAliases: ["Sting"] }),
  s("3daqat", "3 Daqat", "Abu ft. Yousra", 2017, "arabic", "💓3️⃣🎺🇪🇬", "A swinging Egyptian hit about a heart skipping three beats.", 3, { lang: "Arabic", aliases: ["Thalath Daqat", "Talat Daqat"], artistAliases: ["Abu"] }),
  // Latin
  s("labamba", "La Bamba", "Ritchie Valens", 1958, "latin", "🎸💃🇲🇽⛵", "A rock-and-roll version of a Mexican folk song.", 2, { lang: "Spanish" }),
  s("livinlavidaloca", "Livin' la Vida Loca", "Ricky Martin", 1999, "latin", "🔥💃🤪🎺", "A horn-blasting hit about a wild woman who leads a crazy life.", 1),
  s("bailando", "Bailando", "Enrique Iglesias", 2014, "latin", "💃🕺🔥🇪🇸", "A Latin-pop hit about dancing.", 2, { lang: "Spanish", artistAliases: ["Enrique"] }),
  s("gasolina", "Gasolina", "Daddy Yankee", 2004, "latin", "⛽🏍️💃🇵🇷", "A reggaeton anthem that helped take the genre global.", 2, { lang: "Spanish" }),
  s("dakiti", "Dákiti", "Bad Bunny & Jhay Cortez", 2020, "latin", "🌊🌙🐰💫", "A moody reggaeton track set by the sea at night.", 3, { lang: "Spanish", aliases: ["Dakiti"], artistAliases: ["Bad Bunny"] }),
  s("macarena", "Macarena", "Los del Río", 1993, "latin", "💃🙆‍♀️🔁🇪🇸", "A dance craze with a hand-on-hips routine.", 1, { lang: "Spanish" }),
  s("migente", "Mi Gente", "J Balvin & Willy William", 2017, "latin", "🎺👥💃🇨🇴", "A reggaeton hit with a vocal-sample horn hook.", 2, { lang: "Spanish", artistAliases: ["J Balvin"] }),
  s("tusa", "Tusa", "Karol G & Nicki Minaj", 2019, "latin", "💔🍹💃🇨🇴", "A reggaeton heartbreak anthem about being over someone — or not.", 3, { lang: "Spanish", artistAliases: ["Karol G"] }),
  // K-pop
  s("howyoulikethat", "How You Like That", "BLACKPINK", 2020, "k-pop", "🖤💗👑🔥", "A girl-group hit about rising up after being knocked down.", 2, { lang: "Korean", artistAliases: ["Blackpink"] }),
  s("apt", "APT.", "Rosé & Bruno Mars", 2024, "k-pop", "🏢🍻🎲🎸", "A punk-pop duet named after a Korean drinking game.", 1, { aliases: ["APT", "Apateu"], artistAliases: ["Rosé", "Rose", "Bruno Mars"] }),
  // Afrobeats
  s("lastlast", "Last Last", "Burna Boy", 2022, "afrobeats", "💔🍷🌴🇳🇬", "An Afro-fusion breakup song sampling a Toni Braxton hit.", 2),
  s("essence", "Essence", "Wizkid ft. Tems", 2020, "afrobeats", "🌙💃🇳🇬✨", "A mellow Afrobeats love song that crossed over to US radio.", 3, { artistAliases: ["Wizkid"] }),
  s("calmdown", "Calm Down", "Rema", 2022, "afrobeats", "🧘‍♀️💃🇳🇬🎶", "An Afrobeats hit that became one of the biggest African songs ever.", 2),
  s("jerusalema", "Jerusalema", "Master KG ft. Nomcebo Zikode", 2019, "afrobeats", "🙏💃🇿🇦🌍", "A gospel-house song that inspired a global dance challenge.", 2, { artistAliases: ["Master KG"] }),
  // Classics / jazz / dance / country / reggae
  s("flymetothemoon", "Fly Me to the Moon", "Frank Sinatra", 1964, "classic", "🚀🌕🎺🎷", "A swing standard asking to be flown among the stars.", 2, { artistAliases: ["Sinatra"] }),
  s("wonderfulworld", "What a Wonderful World", "Louis Armstrong", 1967, "classic", "🌳🌹🌈🎺", "A gentle ballad marvelling at trees, roses and rainbows.", 1),
  s("myway", "My Way", "Frank Sinatra", 1969, "classic", "🛣️🎙️🕴️🥃", "A defiant ballad looking back on a life lived on one's own terms.", 2, { artistAliases: ["Sinatra"] }),
  s("feelinggood", "Feeling Good", "Nina Simone", 1965, "classic", "🐦🌅🎺😌", "A brassy, defiant song about a new dawn and a new day.", 3),
  s("hallelujah", "Hallelujah", "Leonard Cohen", 1984, "classic", "🙏🎹👑🎶", "A hymn-like song about love and faith, famous through many covers.", 2),
  s("bridgeover", "Bridge over Troubled Water", "Simon & Garfunkel", 1970, "classic", "🌉🌊🎹🤝", "A gospel-tinged ballad promising support through hard times.", 3),
  s("titanium", "Titanium", "David Guetta ft. Sia", 2011, "dance", "🛡️🔫💥🎧", "An EDM anthem about being bulletproof.", 2, { artistAliases: ["David Guetta"] }),
  s("wakemeup", "Wake Me Up", "Avicii", 2013, "dance", "😴⏰🎸🎧", "A folk-meets-EDM hit about finding yourself.", 1),
  s("levels", "Levels", "Avicii", 2011, "dance", "📶🎹🎧🙌", "A progressive-house anthem built on a classic soul vocal sample.", 2),
  s("getlucky", "Get Lucky", "Daft Punk ft. Pharrell Williams", 2013, "dance", "🍀🕺🤖🎸", "A disco-funk hit about staying up all night hoping for romance.", 1, { artistAliases: ["Daft Punk"] }),
  s("onemoretime", "One More Time", "Daft Punk", 2000, "dance", "1️⃣🔁🎉🤖", "A French-house party anthem about celebrating just once again.", 2),
  s("sandstorm", "Darude - Sandstorm", "Darude", 1999, "dance", "🏜️🌪️🎹🇫🇮", "A pounding instrumental trance track and internet meme.", 2, { aliases: ["Sandstorm"] }),
  s("leanon", "Lean On", "Major Lazer & DJ Snake ft. MØ", 2015, "dance", "🤝🎧🇮🇳💃", "A moombahton hit about leaning on each other.", 2, { artistAliases: ["Major Lazer", "DJ Snake"] }),
  s("jolene", "Jolene", "Dolly Parton", 1973, "country", "👩‍🦰🙏💔🎸", "A country plea to a beautiful rival not to take her man.", 2),
  s("countryroads", "Take Me Home, Country Roads", "John Denver", 1971, "country", "🛣️⛰️🏡🎸", "A sing-along about West Virginia and going home.", 1, { aliases: ["Country Roads"] }),
  s("tennesseewhiskey", "Tennessee Whiskey", "Chris Stapleton", 2015, "country", "🥃🍓🎸🤠", "A slow, soulful country cover comparing love to whiskey.", 3),
  s("texasholdem", "Texas Hold 'Em", "Beyoncé", 2024, "country", "🤠🃏🪕💃", "A banjo-led country hit that topped the country chart.", 2, { artistAliases: ["Beyonce"] }),
  s("onelove", "One Love", "Bob Marley & The Wailers", 1977, "reggae", "❤️☮️🇯🇲🤝", "A reggae anthem calling for unity.", 1, { artistAliases: ["Bob Marley"] }),
  s("threelittlebirds", "Three Little Birds", "Bob Marley & The Wailers", 1977, "reggae", "🐦🐦🐦☀️", "A reassuring reggae song promising every little thing will be all right.", 1, { artistAliases: ["Bob Marley"] }),
  s("nowomannocry", "No Woman, No Cry", "Bob Marley & The Wailers", 1974, "reggae", "👩😢🔥🇯🇲", "A reggae ballad remembering friends in a Kingston government yard.", 2, { artistAliases: ["Bob Marley"] }),
];

export const SONG_BY_ID = new Map(SONGS.map((x) => [x.id, x]));

export function songArtistNames(sg: Song): string[] {
  return [sg.artist, ...(sg.artistAliases ?? [])];
}
