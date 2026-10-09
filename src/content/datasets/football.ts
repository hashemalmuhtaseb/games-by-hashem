/**
 * Football dataset. Reference date: 2025-08 (start of the 2025/26 season).
 *
 * Rules for this file (enforced by tests/unit/datasets.test.ts):
 *  - Club lists are senior clubs the player has represented, in order, as public record.
 *    Questions only ever say "has played for", never "currently plays for",
 *    so a later transfer cannot make a question wrong.
 *  - Trophy counts are only filled in where they are settled facts; unknown → omitted.
 *  - No invented statistics. Goal tallies that change weekly are deliberately not stored.
 */

export type Position = "Goalkeeper" | "Defender" | "Midfielder" | "Forward";

export interface Footballer {
  id: string;
  name: string;
  aliases?: string[];
  nationality: string;
  position: Position;
  born: number;
  clubs: string[];
  legend?: boolean; // retired
  worldCup?: number[]; // years won
  ucl?: number; // Champions League / European Cup titles
  ballonDor?: number[]; // years won
  continental?: string; // e.g. "Euro 2016", "Copa América 2021"
  teammates?: { club: string; names: string[] };
  fact?: string;
  difficulty: number;
}

const f = (
  id: string,
  name: string,
  nationality: string,
  position: Position,
  born: number,
  clubs: string[],
  difficulty: number,
  opts: Partial<Footballer> = {},
): Footballer => ({ id, name, nationality, position, born, clubs, difficulty, ...opts });

export const FOOTBALLERS: Footballer[] = [
  f("messi", "Lionel Messi", "Argentina", "Forward", 1987, ["Barcelona", "Paris Saint-Germain", "Inter Miami"], 1, { aliases: ["Messi", "Leo Messi"], worldCup: [2022], ucl: 4, ballonDor: [2009, 2010, 2011, 2012, 2015, 2019, 2021, 2023], continental: "Copa América 2021 & 2024", teammates: { club: "Barcelona", names: ["Xavi", "Andrés Iniesta", "Carles Puyol"] }, fact: "Has won the Ballon d'Or a record eight times." }),
  f("ronaldo", "Cristiano Ronaldo", "Portugal", "Forward", 1985, ["Sporting CP", "Manchester United", "Real Madrid", "Juventus", "Manchester United", "Al Nassr"], 1, { aliases: ["Ronaldo", "CR7", "Cristiano"], ucl: 5, ballonDor: [2008, 2013, 2014, 2016, 2017], continental: "Euro 2016", teammates: { club: "Real Madrid", names: ["Karim Benzema", "Gareth Bale", "Luka Modrić"] }, fact: "Has won the Champions League with two different clubs." }),
  f("neymar", "Neymar", "Brazil", "Forward", 1992, ["Santos", "Barcelona", "Paris Saint-Germain", "Al Hilal", "Santos"], 1, { aliases: ["Neymar Jr", "Neymar Junior"], ucl: 1, teammates: { club: "Barcelona", names: ["Lionel Messi", "Luis Suárez"] }, fact: "Became the world's most expensive player in 2017." }),
  f("mbappe", "Kylian Mbappé", "France", "Forward", 1998, ["Monaco", "Paris Saint-Germain", "Real Madrid"], 1, { aliases: ["Mbappe", "Kylian Mbappe"], worldCup: [2018], fact: "Scored a hat-trick in the 2022 World Cup final." }),
  f("haaland", "Erling Haaland", "Norway", "Forward", 2000, ["Bryne", "Molde", "Red Bull Salzburg", "Borussia Dortmund", "Manchester City"], 1, { aliases: ["Haaland", "Erling Braut Haaland"], ucl: 1, fact: "His father Alf-Inge also played in the Premier League." }),
  f("salah", "Mohamed Salah", "Egypt", "Forward", 1992, ["Al Mokawloon", "Basel", "Chelsea", "Fiorentina", "Roma", "Liverpool"], 1, { aliases: ["Salah", "Mo Salah"], ucl: 1, fact: "Nicknamed 'The Egyptian King'." }),
  f("benzema", "Karim Benzema", "France", "Forward", 1987, ["Lyon", "Real Madrid", "Al Ittihad"], 1, { aliases: ["Benzema"], ucl: 5, ballonDor: [2022] }),
  f("modric", "Luka Modrić", "Croatia", "Midfielder", 1985, ["Dinamo Zagreb", "Tottenham Hotspur", "Real Madrid", "AC Milan"], 1, { aliases: ["Modric", "Luka Modric"], ucl: 6, ballonDor: [2018], fact: "Led Croatia to the 2018 World Cup final." }),
  f("kroos", "Toni Kroos", "Germany", "Midfielder", 1990, ["Bayern Munich", "Bayer Leverkusen", "Real Madrid"], 2, { aliases: ["Kroos"], worldCup: [2014], ucl: 6, legend: true }),
  f("debruyne", "Kevin De Bruyne", "Belgium", "Midfielder", 1991, ["Genk", "Chelsea", "Werder Bremen", "VfL Wolfsburg", "Manchester City", "Napoli"], 1, { aliases: ["De Bruyne", "KDB"], ucl: 1 }),
  f("lewandowski", "Robert Lewandowski", "Poland", "Forward", 1988, ["Znicz Pruszków", "Lech Poznań", "Borussia Dortmund", "Bayern Munich", "Barcelona"], 1, { aliases: ["Lewandowski", "Lewy"], ucl: 1, fact: "Once scored five goals in nine minutes in the Bundesliga." }),
  f("kane", "Harry Kane", "England", "Forward", 1993, ["Tottenham Hotspur", "Leyton Orient", "Millwall", "Norwich City", "Leicester City", "Bayern Munich"], 1, { aliases: ["Kane"], fact: "England's all-time record goalscorer." }),
  f("vandijk", "Virgil van Dijk", "Netherlands", "Defender", 1991, ["Groningen", "Celtic", "Southampton", "Liverpool"], 2, { aliases: ["Van Dijk", "VVD"], ucl: 1 }),
  f("bellingham", "Jude Bellingham", "England", "Midfielder", 2003, ["Birmingham City", "Borussia Dortmund", "Real Madrid"], 1, { aliases: ["Bellingham"], ucl: 1, fact: "Birmingham City retired his shirt number 22 when he was 17." }),
  f("vinicius", "Vinícius Júnior", "Brazil", "Forward", 2000, ["Flamengo", "Real Madrid"], 1, { aliases: ["Vinicius", "Vini Jr", "Vinicius Junior"], ucl: 2 }),
  f("rodri", "Rodri", "Spain", "Midfielder", 1996, ["Villarreal", "Atlético Madrid", "Manchester City"], 2, { aliases: ["Rodrigo Hernández"], ucl: 1, ballonDor: [2024], continental: "Euro 2024" }),
  f("yamal", "Lamine Yamal", "Spain", "Forward", 2007, ["Barcelona"], 1, { aliases: ["Yamal"], continental: "Euro 2024", fact: "Became the youngest scorer in European Championship history in 2024." }),
  f("pedri", "Pedri", "Spain", "Midfielder", 2002, ["Las Palmas", "Barcelona"], 2, { aliases: ["Pedro González López"] }),
  f("saka", "Bukayo Saka", "England", "Forward", 2001, ["Arsenal"], 2, { aliases: ["Saka"] }),
  f("odegaard", "Martin Ødegaard", "Norway", "Midfielder", 1998, ["Strømsgodset", "Real Madrid", "Heerenveen", "Vitesse", "Real Sociedad", "Arsenal"], 2, { aliases: ["Odegaard", "Martin Odegaard"] }),
  f("son", "Son Heung-min", "South Korea", "Forward", 1992, ["Hamburg", "Bayer Leverkusen", "Tottenham Hotspur", "Los Angeles FC"], 1, { aliases: ["Son", "Heung-min Son", "Sonny"], fact: "Won the Premier League Golden Boot in 2021–22." }),
  f("griezmann", "Antoine Griezmann", "France", "Forward", 1991, ["Real Sociedad", "Atlético Madrid", "Barcelona", "Atlético Madrid"], 2, { aliases: ["Griezmann"], worldCup: [2018] }),
  f("kante", "N'Golo Kanté", "France", "Midfielder", 1991, ["Boulogne", "Caen", "Leicester City", "Chelsea", "Al Ittihad"], 2, { aliases: ["Kante", "N'Golo Kante", "Ngolo Kante"], worldCup: [2018], ucl: 1, fact: "Won back-to-back Premier League titles with two different clubs." }),
  f("suarez", "Luis Suárez", "Uruguay", "Forward", 1987, ["Nacional", "Groningen", "Ajax", "Liverpool", "Barcelona", "Atlético Madrid", "Nacional", "Grêmio", "Inter Miami"], 1, { aliases: ["Suarez", "Luis Suarez"], ucl: 1, continental: "Copa América 2011" }),
  f("bale", "Gareth Bale", "Wales", "Forward", 1989, ["Southampton", "Tottenham Hotspur", "Real Madrid", "Tottenham Hotspur", "Los Angeles FC"], 2, { aliases: ["Bale"], ucl: 5, legend: true }),
  f("cavani", "Edinson Cavani", "Uruguay", "Forward", 1987, ["Danubio", "Palermo", "Napoli", "Paris Saint-Germain", "Manchester United", "Valencia", "Boca Juniors"], 3, { aliases: ["Cavani"] }),
  f("aguero", "Sergio Agüero", "Argentina", "Forward", 1988, ["Independiente", "Atlético Madrid", "Manchester City", "Barcelona"], 2, { aliases: ["Aguero", "Kun Agüero", "Kun Aguero"], legend: true, fact: "Scored a 93:20 title-winning goal in 2012." }),
  f("dimaria", "Ángel Di María", "Argentina", "Forward", 1988, ["Rosario Central", "Benfica", "Real Madrid", "Manchester United", "Paris Saint-Germain", "Juventus", "Benfica", "Rosario Central"], 2, { aliases: ["Di Maria", "Angel Di Maria"], worldCup: [2022], ucl: 1 }),
  f("ozil", "Mesut Özil", "Germany", "Midfielder", 1988, ["Schalke 04", "Werder Bremen", "Real Madrid", "Arsenal", "Fenerbahçe", "İstanbul Başakşehir"], 2, { aliases: ["Ozil", "Mesut Ozil"], worldCup: [2014], legend: true }),
  f("hazard", "Eden Hazard", "Belgium", "Forward", 1991, ["Lille", "Chelsea", "Real Madrid"], 2, { aliases: ["Hazard"], legend: true }),
  f("neuer", "Manuel Neuer", "Germany", "Goalkeeper", 1986, ["Schalke 04", "Bayern Munich"], 2, { aliases: ["Neuer"], worldCup: [2014], ucl: 2 }),
  f("courtois", "Thibaut Courtois", "Belgium", "Goalkeeper", 1992, ["Genk", "Chelsea", "Atlético Madrid", "Real Madrid"], 2, { aliases: ["Courtois"], ucl: 2 }),
  f("alisson", "Alisson Becker", "Brazil", "Goalkeeper", 1992, ["Internacional", "Roma", "Liverpool"], 2, { aliases: ["Alisson"], ucl: 1, fact: "Scored a headed winner as a goalkeeper in 2021." }),
  f("cech", "Petr Čech", "Czech Republic", "Goalkeeper", 1982, ["Chmel Blšany", "Sparta Prague", "Rennes", "Chelsea", "Arsenal"], 3, { aliases: ["Cech", "Petr Cech"], ucl: 1, legend: true, fact: "Famous for wearing a protective rugby-style helmet." }),
  f("dembele", "Ousmane Dembélé", "France", "Forward", 1997, ["Rennes", "Borussia Dortmund", "Barcelona", "Paris Saint-Germain"], 2, { aliases: ["Dembele", "Ousmane Dembele"], worldCup: [2018], ucl: 1, ballonDor: [2025] }),
  f("brunofernandes", "Bruno Fernandes", "Portugal", "Midfielder", 1994, ["Novara", "Udinese", "Sampdoria", "Sporting CP", "Manchester United"], 2, { aliases: ["Bruno"] }),
  f("bernardo", "Bernardo Silva", "Portugal", "Midfielder", 1994, ["Benfica", "Monaco", "Manchester City"], 2, { ucl: 1 }),
  f("foden", "Phil Foden", "England", "Midfielder", 2000, ["Manchester City"], 2, { aliases: ["Foden"], ucl: 1 }),
  f("rice", "Declan Rice", "England", "Midfielder", 1999, ["West Ham United", "Arsenal"], 2, { aliases: ["Rice"] }),
  f("rashford", "Marcus Rashford", "England", "Forward", 1997, ["Manchester United", "Aston Villa", "Barcelona"], 2, { aliases: ["Rashford"] }),
  f("trent", "Trent Alexander-Arnold", "England", "Defender", 1998, ["Liverpool", "Real Madrid"], 2, { aliases: ["Alexander-Arnold", "Trent", "TAA"], ucl: 1 }),
  f("wirtz", "Florian Wirtz", "Germany", "Midfielder", 2003, ["Bayer Leverkusen", "Liverpool"], 3, { aliases: ["Wirtz"] }),
  f("musiala", "Jamal Musiala", "Germany", "Midfielder", 2003, ["Bayern Munich"], 3, { aliases: ["Musiala"], ucl: 1 }),
  f("osimhen", "Victor Osimhen", "Nigeria", "Forward", 1998, ["VfL Wolfsburg", "Charleroi", "Lille", "Napoli", "Galatasaray"], 3, { aliases: ["Osimhen"] }),
  f("kvara", "Khvicha Kvaratskhelia", "Georgia", "Forward", 2001, ["Dinamo Tbilisi", "Lokomotiv Moscow", "Rubin Kazan", "Napoli", "Paris Saint-Germain"], 3, { aliases: ["Kvaratskhelia", "Kvara"], ucl: 1 }),
  f("lautaro", "Lautaro Martínez", "Argentina", "Forward", 1997, ["Racing Club", "Inter Milan"], 2, { aliases: ["Lautaro", "Lautaro Martinez"], worldCup: [2022] }),
  f("julianalvarez", "Julián Álvarez", "Argentina", "Forward", 2000, ["River Plate", "Manchester City", "Atlético Madrid"], 2, { aliases: ["Julian Alvarez", "Alvarez"], worldCup: [2022], ucl: 1 }),
  f("emimartinez", "Emiliano Martínez", "Argentina", "Goalkeeper", 1992, ["Arsenal", "Aston Villa"], 3, { aliases: ["Emi Martinez", "Dibu Martínez", "Emiliano Martinez"], worldCup: [2022] }),
  f("hakimi", "Achraf Hakimi", "Morocco", "Defender", 1998, ["Real Madrid", "Borussia Dortmund", "Inter Milan", "Paris Saint-Germain"], 2, { aliases: ["Hakimi"] }),
  f("mahrez", "Riyad Mahrez", "Algeria", "Forward", 1991, ["Le Havre", "Leicester City", "Manchester City", "Al Ahli"], 2, { aliases: ["Mahrez"], ucl: 1, continental: "Africa Cup of Nations 2019" }),
  f("mane", "Sadio Mané", "Senegal", "Forward", 1992, ["Metz", "Red Bull Salzburg", "Southampton", "Liverpool", "Bayern Munich", "Al Nassr"], 2, { aliases: ["Mane", "Sadio Mane"], ucl: 1, continental: "Africa Cup of Nations 2021", fact: "Scored the fastest hat-trick in Premier League history (2 min 56 s)." }),
  f("firmino", "Roberto Firmino", "Brazil", "Forward", 1991, ["Figueirense", "Hoffenheim", "Liverpool", "Al Ahli"], 3, { aliases: ["Firmino", "Bobby Firmino"], ucl: 1 }),
  f("fabinho", "Fabinho", "Brazil", "Midfielder", 1993, ["Rio Ave", "Monaco", "Liverpool", "Al Ittihad"], 3, { ucl: 1 }),
  f("brozovic", "Marcelo Brozović", "Croatia", "Midfielder", 1992, ["Lokomotiva", "Dinamo Zagreb", "Inter Milan", "Al Nassr"], 3, { aliases: ["Brozovic", "Marcelo Brozovic"] }),
  f("koulibaly", "Kalidou Koulibaly", "Senegal", "Defender", 1991, ["Metz", "Genk", "Napoli", "Chelsea", "Al Hilal"], 3, { aliases: ["Koulibaly"], continental: "Africa Cup of Nations 2021" }),
  f("bounou", "Yassine Bounou", "Morocco", "Goalkeeper", 1991, ["Wydad Casablanca", "Atlético Madrid", "Girona", "Sevilla", "Al Hilal"], 3, { aliases: ["Bono", "Bounou"], fact: "Helped Morocco become the first African semi-finalist at a World Cup (2022)." }),
  f("milinkovic", "Sergej Milinković-Savić", "Serbia", "Midfielder", 1995, ["Vojvodina", "Genk", "Lazio", "Al Hilal"], 3, { aliases: ["Milinkovic-Savic", "SMS"] }),
  f("rubenneves", "Rúben Neves", "Portugal", "Midfielder", 1997, ["Porto", "Wolverhampton Wanderers", "Al Hilal"], 3, { aliases: ["Ruben Neves", "Neves"] }),
  f("mitrovic", "Aleksandar Mitrović", "Serbia", "Forward", 1994, ["Partizan", "Anderlecht", "Newcastle United", "Fulham", "Al Hilal"], 3, { aliases: ["Mitrovic", "Aleksandar Mitrovic"] }),
  f("toney", "Ivan Toney", "England", "Forward", 1996, ["Northampton Town", "Newcastle United", "Peterborough United", "Brentford", "Al Ahli"], 3, { aliases: ["Toney"] }),
  f("aldawsari", "Salem Al-Dawsari", "Saudi Arabia", "Forward", 1991, ["Al Hilal", "Villarreal"], 3, { aliases: ["Al-Dawsari", "Salem Aldawsari", "Salem Al Dawsari"], fact: "Scored the winner as Saudi Arabia beat Argentina at the 2022 World Cup." }),
  f("valverde", "Federico Valverde", "Uruguay", "Midfielder", 1998, ["Peñarol", "Deportivo La Coruña", "Real Madrid"], 3, { aliases: ["Fede Valverde", "Valverde"], ucl: 2 }),
  f("ramos", "Sergio Ramos", "Spain", "Defender", 1986, ["Sevilla", "Real Madrid", "Paris Saint-Germain", "Sevilla", "Monterrey"], 1, { aliases: ["Ramos"], worldCup: [2010], ucl: 4, continental: "Euro 2008 & 2012" }),
  // ── Legends ──
  f("pele", "Pelé", "Brazil", "Forward", 1940, ["Santos", "New York Cosmos"], 1, { aliases: ["Pele", "Edson Arantes do Nascimento"], legend: true, worldCup: [1958, 1962, 1970], fact: "The only player to win three World Cups." }),
  f("maradona", "Diego Maradona", "Argentina", "Forward", 1960, ["Argentinos Juniors", "Boca Juniors", "Barcelona", "Napoli", "Sevilla", "Newell's Old Boys", "Boca Juniors"], 1, { aliases: ["Maradona", "Diego Armando Maradona"], legend: true, worldCup: [1986], fact: "Scored the 'Hand of God' goal against England in 1986." }),
  f("cruyff", "Johan Cruyff", "Netherlands", "Forward", 1947, ["Ajax", "Barcelona", "Los Angeles Aztecs", "Washington Diplomats", "Levante", "Ajax", "Feyenoord"], 2, { aliases: ["Cruyff", "Johan Cruijff"], legend: true, ucl: 3, ballonDor: [1971, 1973, 1974], fact: "Gave his name to a famous turn." }),
  f("zidane", "Zinedine Zidane", "France", "Midfielder", 1972, ["Cannes", "Bordeaux", "Juventus", "Real Madrid"], 1, { aliases: ["Zidane", "Zizou"], legend: true, worldCup: [1998], ucl: 1, ballonDor: [1998], continental: "Euro 2000", fact: "Scored a famous left-footed volley in the 2002 Champions League final." }),
  f("r9", "Ronaldo Nazário", "Brazil", "Forward", 1976, ["Cruzeiro", "PSV Eindhoven", "Barcelona", "Inter Milan", "Real Madrid", "AC Milan", "Corinthians"], 1, { aliases: ["R9", "Ronaldo Nazario", "O Fenômeno", "Il Fenomeno", "Brazilian Ronaldo"], legend: true, worldCup: [1994, 2002], ballonDor: [1997, 2002], fact: "Scored both goals in the 2002 World Cup final." }),
  f("ronaldinho", "Ronaldinho", "Brazil", "Midfielder", 1980, ["Grêmio", "Paris Saint-Germain", "Barcelona", "AC Milan", "Flamengo", "Atlético Mineiro", "Querétaro", "Fluminense"], 1, { aliases: ["Ronaldinho Gaúcho"], legend: true, worldCup: [2002], ucl: 1, ballonDor: [2005] }),
  f("kaka", "Kaká", "Brazil", "Midfielder", 1982, ["São Paulo", "AC Milan", "Real Madrid", "AC Milan", "São Paulo", "Orlando City"], 2, { aliases: ["Kaka", "Ricardo Kaká"], legend: true, worldCup: [2002], ucl: 1, ballonDor: [2007] }),
  f("henry", "Thierry Henry", "France", "Forward", 1977, ["Monaco", "Juventus", "Arsenal", "Barcelona", "New York Red Bulls"], 1, { aliases: ["Henry", "Titi"], legend: true, worldCup: [1998], ucl: 1, continental: "Euro 2000", fact: "Arsenal's all-time record goalscorer." }),
  f("beckham", "David Beckham", "England", "Midfielder", 1975, ["Manchester United", "Preston North End", "Real Madrid", "LA Galaxy", "AC Milan", "Paris Saint-Germain"], 1, { aliases: ["Beckham", "Becks"], legend: true, ucl: 1 }),
  f("maldini", "Paolo Maldini", "Italy", "Defender", 1968, ["AC Milan"], 2, { aliases: ["Maldini"], legend: true, ucl: 5, fact: "Played his entire 25-season career for one club." }),
  f("beckenbauer", "Franz Beckenbauer", "Germany", "Defender", 1945, ["Bayern Munich", "New York Cosmos", "Hamburg", "New York Cosmos"], 3, { aliases: ["Beckenbauer", "Der Kaiser"], legend: true, worldCup: [1974], ucl: 3, ballonDor: [1972, 1976], fact: "Won the World Cup as both captain and manager." }),
  f("pirlo", "Andrea Pirlo", "Italy", "Midfielder", 1979, ["Brescia", "Inter Milan", "Reggina", "AC Milan", "Juventus", "New York City FC"], 2, { aliases: ["Pirlo"], legend: true, worldCup: [2006], ucl: 2 }),
  f("iniesta", "Andrés Iniesta", "Spain", "Midfielder", 1984, ["Barcelona", "Vissel Kobe", "Emirates Club"], 1, { aliases: ["Iniesta", "Andres Iniesta"], legend: true, worldCup: [2010], ucl: 4, continental: "Euro 2008 & 2012", fact: "Scored the winning goal in the 2010 World Cup final." }),
  f("xavi", "Xavi", "Spain", "Midfielder", 1980, ["Barcelona", "Al Sadd"], 2, { aliases: ["Xavi Hernández", "Xavi Hernandez"], legend: true, worldCup: [2010], ucl: 4, continental: "Euro 2008 & 2012" }),
  f("gerrard", "Steven Gerrard", "England", "Midfielder", 1980, ["Liverpool", "LA Galaxy"], 1, { aliases: ["Gerrard", "Stevie G"], legend: true, ucl: 1, fact: "Captained his club to a comeback from 3–0 down in the 2005 Champions League final." }),
  f("lampard", "Frank Lampard", "England", "Midfielder", 1978, ["West Ham United", "Swansea City", "Chelsea", "Manchester City", "New York City FC"], 2, { aliases: ["Lampard", "Super Frank"], legend: true, ucl: 1, fact: "Chelsea's all-time record goalscorer." }),
  f("rooney", "Wayne Rooney", "England", "Forward", 1985, ["Everton", "Manchester United", "Everton", "DC United", "Derby County"], 1, { aliases: ["Rooney", "Wazza"], legend: true, ucl: 1, fact: "Manchester United's all-time record goalscorer." }),
  f("drogba", "Didier Drogba", "Ivory Coast", "Forward", 1978, ["Le Mans", "Guingamp", "Marseille", "Chelsea", "Shanghai Shenhua", "Galatasaray", "Chelsea", "Montreal Impact", "Phoenix Rising"], 2, { aliases: ["Drogba"], legend: true, ucl: 1, fact: "Scored the equaliser and winning penalty in the 2012 Champions League final." }),
  f("etoo", "Samuel Eto'o", "Cameroon", "Forward", 1981, ["Real Madrid", "Mallorca", "Barcelona", "Inter Milan", "Anzhi Makhachkala", "Chelsea", "Everton", "Sampdoria", "Antalyaspor", "Konyaspor", "Qatar SC"], 2, { aliases: ["Eto'o", "Etoo", "Samuel Etoo"], legend: true, ucl: 3, fact: "Won back-to-back trebles with two different clubs." }),
  f("buffon", "Gianluigi Buffon", "Italy", "Goalkeeper", 1978, ["Parma", "Juventus", "Paris Saint-Germain", "Juventus", "Parma"], 1, { aliases: ["Buffon", "Gigi Buffon"], legend: true, worldCup: [2006] }),
  f("casillas", "Iker Casillas", "Spain", "Goalkeeper", 1981, ["Real Madrid", "Porto"], 2, { aliases: ["Casillas", "San Iker"], legend: true, worldCup: [2010], ucl: 3, continental: "Euro 2008 & 2012" }),
  f("zlatan", "Zlatan Ibrahimović", "Sweden", "Forward", 1981, ["Malmö FF", "Ajax", "Juventus", "Inter Milan", "Barcelona", "AC Milan", "Paris Saint-Germain", "Manchester United", "LA Galaxy", "AC Milan"], 1, { aliases: ["Zlatan", "Ibrahimovic", "Zlatan Ibrahimovic", "Ibra"], legend: true, fact: "Won league titles in four different countries' top divisions and never the Champions League." }),
  f("weah", "George Weah", "Liberia", "Forward", 1966, ["Monaco", "Paris Saint-Germain", "AC Milan", "Chelsea", "Manchester City", "Marseille", "Al Jazira"], 3, { aliases: ["Weah"], legend: true, ballonDor: [1995], fact: "Later became President of his country." }),
  f("figo", "Luís Figo", "Portugal", "Midfielder", 1972, ["Sporting CP", "Barcelona", "Real Madrid", "Inter Milan"], 2, { aliases: ["Figo", "Luis Figo"], legend: true, ucl: 1, ballonDor: [2000], fact: "His transfer between two bitter rivals in 2000 caused a famous uproar." }),
  f("eusebio", "Eusébio", "Portugal", "Forward", 1942, ["Benfica"], 4, { aliases: ["Eusebio"], legend: true, ballonDor: [1965], fact: "Top scorer at the 1966 World Cup; nicknamed 'The Black Panther'." }),
  f("matthaus", "Lothar Matthäus", "Germany", "Midfielder", 1961, ["Borussia Mönchengladbach", "Bayern Munich", "Inter Milan", "Bayern Munich", "MetroStars"], 3, { aliases: ["Matthaus", "Lothar Matthaus"], legend: true, worldCup: [1990], ballonDor: [1990] }),
  f("vanbasten", "Marco van Basten", "Netherlands", "Forward", 1964, ["Ajax", "AC Milan"], 3, { aliases: ["Van Basten"], legend: true, ballonDor: [1988, 1989, 1992], continental: "Euro 1988", fact: "Scored a famous volley from a tight angle in the Euro 1988 final." }),
  f("bergkamp", "Dennis Bergkamp", "Netherlands", "Forward", 1969, ["Ajax", "Inter Milan", "Arsenal"], 2, { aliases: ["Bergkamp"], legend: true, fact: "Was famously afraid of flying." }),
  f("baggio", "Roberto Baggio", "Italy", "Forward", 1967, ["Vicenza", "Fiorentina", "Juventus", "AC Milan", "Bologna", "Inter Milan", "Brescia"], 3, { aliases: ["Baggio", "Il Divin Codino"], legend: true, ballonDor: [1993], fact: "Missed the decisive penalty in the 1994 World Cup final shoot-out." }),
  f("totti", "Francesco Totti", "Italy", "Forward", 1976, ["Roma"], 2, { aliases: ["Totti"], legend: true, worldCup: [2006], fact: "Spent his entire 25-year career at his hometown club." }),
  f("delpiero", "Alessandro Del Piero", "Italy", "Forward", 1974, ["Padova", "Juventus", "Sydney FC", "Delhi Dynamos"], 3, { aliases: ["Del Piero"], legend: true, worldCup: [2006], ucl: 1 }),
  f("raul", "Raúl", "Spain", "Forward", 1977, ["Real Madrid", "Schalke 04", "Al Sadd", "New York Cosmos"], 3, { aliases: ["Raul", "Raúl González"], legend: true, ucl: 3 }),
  f("puyol", "Carles Puyol", "Spain", "Defender", 1978, ["Barcelona"], 2, { aliases: ["Puyol"], legend: true, worldCup: [2010], ucl: 3, fact: "Headed the winning goal in the 2010 World Cup semi-final." }),
  f("lahm", "Philipp Lahm", "Germany", "Defender", 1983, ["Bayern Munich", "VfB Stuttgart"], 3, { aliases: ["Lahm"], legend: true, worldCup: [2014], ucl: 1 }),
  f("klose", "Miroslav Klose", "Germany", "Forward", 1978, ["Kaiserslautern", "Werder Bremen", "Bayern Munich", "Lazio"], 2, { aliases: ["Klose"], legend: true, worldCup: [2014], fact: "Holds the record for most goals at World Cups (16)." }),
  f("robben", "Arjen Robben", "Netherlands", "Forward", 1984, ["Groningen", "PSV Eindhoven", "Chelsea", "Real Madrid", "Bayern Munich", "Groningen"], 2, { aliases: ["Robben"], legend: true, ucl: 1, fact: "Scored the winner in the 2013 Champions League final." }),
  f("sneijder", "Wesley Sneijder", "Netherlands", "Midfielder", 1984, ["Ajax", "Real Madrid", "Inter Milan", "Galatasaray", "Nice", "Al-Gharafa"], 3, { aliases: ["Sneijder"], legend: true, ucl: 1 }),
  f("yayatoure", "Yaya Touré", "Ivory Coast", "Midfielder", 1983, ["Beveren", "Metalurh Donetsk", "Olympiacos", "Monaco", "Barcelona", "Manchester City", "Olympiacos", "Qingdao Huanghai"], 3, { aliases: ["Yaya Toure", "Toure"], legend: true, ucl: 1, continental: "Africa Cup of Nations 2015" }),
  f("aboutrika", "Mohamed Aboutrika", "Egypt", "Midfielder", 1978, ["Tersana", "Al Ahly", "Baniyas"], 4, { aliases: ["Aboutrika", "Abou Treka", "Mohamed Abou Treika"], legend: true, continental: "Africa Cup of Nations 2006 & 2008" }),
  f("aljaber", "Sami Al-Jaber", "Saudi Arabia", "Forward", 1972, ["Al Hilal", "Wolverhampton Wanderers"], 4, { aliases: ["Al-Jaber", "Sami Al Jaber"], legend: true, fact: "Played at four World Cups (1994–2006)." }),
  f("majed", "Majed Abdullah", "Saudi Arabia", "Forward", 1959, ["Al Nassr"], 5, { aliases: ["Majed Abdulla"], legend: true, fact: "Known as the 'Desert Pele'." }),
  f("owairan", "Saeed Al-Owairan", "Saudi Arabia", "Forward", 1967, ["Al Shabab"], 5, { aliases: ["Al-Owairan", "Saeed Owairan"], legend: true, fact: "Scored a solo wonder goal against Belgium at the 1994 World Cup." }),
  f("rivaldo", "Rivaldo", "Brazil", "Midfielder", 1972, ["Santa Cruz", "Mogi Mirim", "Corinthians", "Palmeiras", "Deportivo La Coruña", "Barcelona", "AC Milan", "Cruzeiro", "Olympiacos", "AEK Athens", "Bunyodkor"], 3, { legend: true, worldCup: [2002], ballonDor: [1999] }),
  f("nedved", "Pavel Nedvěd", "Czech Republic", "Midfielder", 1972, ["Dukla Prague", "Sparta Prague", "Lazio", "Juventus"], 4, { aliases: ["Nedved", "Pavel Nedved"], legend: true, ballonDor: [2003] }),
  f("shevchenko", "Andriy Shevchenko", "Ukraine", "Forward", 1976, ["Dynamo Kyiv", "AC Milan", "Chelsea", "AC Milan", "Dynamo Kyiv"], 3, { aliases: ["Shevchenko", "Sheva"], legend: true, ucl: 1, ballonDor: [2004] }),
  f("cannavaro", "Fabio Cannavaro", "Italy", "Defender", 1973, ["Napoli", "Parma", "Inter Milan", "Juventus", "Real Madrid", "Juventus", "Al Ahli"], 3, { aliases: ["Cannavaro"], legend: true, worldCup: [2006], ballonDor: [2006], fact: "Captained his country to the 2006 World Cup." }),
  f("owen", "Michael Owen", "England", "Forward", 1979, ["Liverpool", "Real Madrid", "Newcastle United", "Manchester United", "Stoke City"], 3, { aliases: ["Owen"], legend: true, ballonDor: [2001] }),
  f("shearer", "Alan Shearer", "England", "Forward", 1970, ["Southampton", "Blackburn Rovers", "Newcastle United"], 2, { aliases: ["Shearer"], legend: true, fact: "The Premier League's all-time record goalscorer (260)." }),
  f("cantona", "Eric Cantona", "France", "Forward", 1966, ["Auxerre", "Marseille", "Bordeaux", "Montpellier", "Nîmes", "Leeds United", "Manchester United"], 3, { aliases: ["Cantona", "King Eric"], legend: true, fact: "Famous for playing with his collar turned up." }),
  f("robertocarlos", "Roberto Carlos", "Brazil", "Defender", 1973, ["União São João", "Palmeiras", "Inter Milan", "Real Madrid", "Fenerbahçe", "Corinthians", "Anzhi Makhachkala", "Delhi Dynamos"], 2, { aliases: ["Roberto Carlos"], legend: true, worldCup: [2002], ucl: 3, fact: "Scored a famous swerving free kick against France in 1997." }),
  f("cafu", "Cafu", "Brazil", "Defender", 1970, ["São Paulo", "Zaragoza", "Juventude", "Palmeiras", "Roma", "AC Milan"], 3, { legend: true, worldCup: [1994, 2002], ucl: 1, fact: "The only player to appear in three consecutive World Cup finals." }),
  f("dani-alves", "Dani Alves", "Brazil", "Defender", 1983, ["Bahia", "Sevilla", "Barcelona", "Juventus", "Paris Saint-Germain", "São Paulo", "Barcelona", "Pumas UNAM"], 3, { aliases: ["Daniel Alves"], legend: true, ucl: 3 }),
];

export const FOOTBALLER_BY_ID = new Map(FOOTBALLERS.map((p) => [p.id, p]));

export interface Manager {
  id: string;
  name: string;
  aliases?: string[];
  nationality: string;
  teams: string[]; // clubs / national teams managed, in order
  fact: string;
  difficulty: number;
}

export const MANAGERS: Manager[] = [
  { id: "guardiola", name: "Pep Guardiola", aliases: ["Guardiola", "Pep"], nationality: "Spain", teams: ["Barcelona", "Bayern Munich", "Manchester City"], fact: "Won the treble in his first season as a top-flight manager.", difficulty: 1 },
  { id: "mourinho", name: "José Mourinho", aliases: ["Mourinho", "Jose Mourinho", "The Special One"], nationality: "Portugal", teams: ["Benfica", "União de Leiria", "Porto", "Chelsea", "Inter Milan", "Real Madrid", "Chelsea", "Manchester United", "Tottenham Hotspur", "Roma", "Fenerbahçe", "Benfica"], fact: "Called himself 'a special one' at his first Chelsea press conference.", difficulty: 1 },
  { id: "klopp", name: "Jürgen Klopp", aliases: ["Klopp", "Jurgen Klopp"], nationality: "Germany", teams: ["Mainz 05", "Borussia Dortmund", "Liverpool"], fact: "Ended his club's 30-year wait for a league title in 2020.", difficulty: 1 },
  { id: "ancelotti", name: "Carlo Ancelotti", aliases: ["Ancelotti"], nationality: "Italy", teams: ["Reggiana", "Parma", "Juventus", "AC Milan", "Chelsea", "Paris Saint-Germain", "Real Madrid", "Bayern Munich", "Napoli", "Everton", "Real Madrid", "Brazil"], fact: "Won the Champions League five times as a manager, more than anyone else.", difficulty: 1 },
  { id: "ferguson", name: "Sir Alex Ferguson", aliases: ["Alex Ferguson", "Ferguson", "Fergie"], nationality: "Scotland", teams: ["East Stirlingshire", "St Mirren", "Aberdeen", "Manchester United"], fact: "Managed one club for 26 years and 13 league titles.", difficulty: 1 },
  { id: "wenger", name: "Arsène Wenger", aliases: ["Wenger", "Arsene Wenger"], nationality: "France", teams: ["Nancy", "Monaco", "Nagoya Grampus Eight", "Arsenal"], fact: "Led the 'Invincibles' through a 38-game unbeaten league season.", difficulty: 2 },
  { id: "zidane-m", name: "Zinedine Zidane", aliases: ["Zidane", "Zizou"], nationality: "France", teams: ["Real Madrid", "Real Madrid"], fact: "Won three consecutive Champions League titles as a manager.", difficulty: 2 },
  { id: "simeone", name: "Diego Simeone", aliases: ["Simeone", "Cholo Simeone"], nationality: "Argentina", teams: ["Racing Club", "Estudiantes", "River Plate", "San Lorenzo", "Catania", "Racing Club", "Atlético Madrid"], fact: "Has managed the same Madrid club since December 2011.", difficulty: 2 },
  { id: "arteta", name: "Mikel Arteta", aliases: ["Arteta"], nationality: "Spain", teams: ["Arsenal"], fact: "Was an assistant to Pep Guardiola before his first head-coach job.", difficulty: 2 },
  { id: "luisenrique", name: "Luis Enrique", aliases: ["Luis Enrique Martínez"], nationality: "Spain", teams: ["Roma", "Celta Vigo", "Barcelona", "Spain", "Paris Saint-Germain"], fact: "Won the treble with two different clubs, ten years apart.", difficulty: 2 },
  { id: "xabialonso", name: "Xabi Alonso", aliases: ["Alonso"], nationality: "Spain", teams: ["Real Sociedad B", "Bayer Leverkusen", "Real Madrid"], fact: "Led his first Bundesliga club to an unbeaten league title in 2023–24.", difficulty: 2 },
  { id: "flick", name: "Hansi Flick", aliases: ["Flick"], nationality: "Germany", teams: ["Bayern Munich", "Germany", "Barcelona"], fact: "Won a sextuple of trophies in his first year in charge of a Bavarian giant.", difficulty: 3 },
  { id: "conte", name: "Antonio Conte", aliases: ["Conte"], nationality: "Italy", teams: ["Arezzo", "Bari", "Atalanta", "Siena", "Juventus", "Italy", "Chelsea", "Inter Milan", "Tottenham Hotspur", "Napoli"], fact: "Won league titles in both Italy and England.", difficulty: 2 },
  { id: "tuchel", name: "Thomas Tuchel", aliases: ["Tuchel"], nationality: "Germany", teams: ["Mainz 05", "Borussia Dortmund", "Paris Saint-Germain", "Chelsea", "Bayern Munich", "England"], fact: "Won the Champions League months after taking over a London club mid-season.", difficulty: 2 },
  { id: "scaloni", name: "Lionel Scaloni", aliases: ["Scaloni"], nationality: "Argentina", teams: ["Argentina"], fact: "Won the World Cup in his first senior head-coach job.", difficulty: 3 },
  { id: "deschamps", name: "Didier Deschamps", aliases: ["Deschamps"], nationality: "France", teams: ["Monaco", "Juventus", "Marseille", "France"], fact: "Won the World Cup as a player and as a manager.", difficulty: 2 },
  { id: "delbosque", name: "Vicente del Bosque", aliases: ["Del Bosque"], nationality: "Spain", teams: ["Real Madrid", "Beşiktaş", "Spain"], fact: "Won both the World Cup and a European Championship with his national team.", difficulty: 3 },
  { id: "renard", name: "Hervé Renard", aliases: ["Renard", "Herve Renard"], nationality: "France", teams: ["Zambia", "Angola", "USM Alger", "Sochaux", "Ivory Coast", "Lille", "Morocco", "Saudi Arabia", "France women", "Saudi Arabia"], fact: "Won the Africa Cup of Nations with two different countries.", difficulty: 4 },
];

export interface Club {
  id: string;
  name: string;
  aliases?: string[];
  city: string;
  country: string;
  stadium: string;
  founded: number;
  nickname: string;
  colors: string;
  difficulty: number;
}

export const CLUBS: Club[] = [
  { id: "barcelona", name: "Barcelona", aliases: ["FC Barcelona", "Barca", "Barça"], city: "Barcelona", country: "Spain", stadium: "Camp Nou", founded: 1899, nickname: "Blaugrana", colors: "Blue and garnet", difficulty: 1 },
  { id: "realmadrid", name: "Real Madrid", aliases: ["Madrid", "Real Madrid CF"], city: "Madrid", country: "Spain", stadium: "Santiago Bernabéu", founded: 1902, nickname: "Los Blancos", colors: "White", difficulty: 1 },
  { id: "atletico", name: "Atlético Madrid", aliases: ["Atletico Madrid", "Atleti", "Atletico"], city: "Madrid", country: "Spain", stadium: "Metropolitano", founded: 1903, nickname: "Los Colchoneros", colors: "Red and white stripes", difficulty: 2 },
  { id: "manutd", name: "Manchester United", aliases: ["Man United", "Man Utd", "United"], city: "Manchester", country: "England", stadium: "Old Trafford", founded: 1878, nickname: "The Red Devils", colors: "Red", difficulty: 1 },
  { id: "mancity", name: "Manchester City", aliases: ["Man City", "City"], city: "Manchester", country: "England", stadium: "Etihad Stadium", founded: 1880, nickname: "The Citizens", colors: "Sky blue", difficulty: 1 },
  { id: "liverpool", name: "Liverpool", aliases: ["Liverpool FC"], city: "Liverpool", country: "England", stadium: "Anfield", founded: 1892, nickname: "The Reds", colors: "Red", difficulty: 1 },
  { id: "arsenal", name: "Arsenal", aliases: ["Arsenal FC"], city: "London", country: "England", stadium: "Emirates Stadium", founded: 1886, nickname: "The Gunners", colors: "Red and white", difficulty: 1 },
  { id: "chelsea", name: "Chelsea", aliases: ["Chelsea FC"], city: "London", country: "England", stadium: "Stamford Bridge", founded: 1905, nickname: "The Blues", colors: "Blue", difficulty: 1 },
  { id: "tottenham", name: "Tottenham Hotspur", aliases: ["Tottenham", "Spurs"], city: "London", country: "England", stadium: "Tottenham Hotspur Stadium", founded: 1882, nickname: "Spurs", colors: "White and navy", difficulty: 2 },
  { id: "bayern", name: "Bayern Munich", aliases: ["Bayern", "FC Bayern", "Bayern München"], city: "Munich", country: "Germany", stadium: "Allianz Arena", founded: 1900, nickname: "Die Roten", colors: "Red and white", difficulty: 1 },
  { id: "dortmund", name: "Borussia Dortmund", aliases: ["Dortmund", "BVB"], city: "Dortmund", country: "Germany", stadium: "Signal Iduna Park", founded: 1909, nickname: "Die Schwarzgelben", colors: "Yellow and black", difficulty: 2 },
  { id: "juventus", name: "Juventus", aliases: ["Juve"], city: "Turin", country: "Italy", stadium: "Allianz Stadium", founded: 1897, nickname: "The Old Lady (La Vecchia Signora)", colors: "Black and white stripes", difficulty: 1 },
  { id: "acmilan", name: "AC Milan", aliases: ["Milan"], city: "Milan", country: "Italy", stadium: "San Siro", founded: 1899, nickname: "I Rossoneri", colors: "Red and black stripes", difficulty: 1 },
  { id: "inter", name: "Inter Milan", aliases: ["Inter", "Internazionale"], city: "Milan", country: "Italy", stadium: "San Siro", founded: 1908, nickname: "I Nerazzurri", colors: "Blue and black stripes", difficulty: 1 },
  { id: "napoli", name: "Napoli", aliases: ["SSC Napoli"], city: "Naples", country: "Italy", stadium: "Stadio Diego Armando Maradona", founded: 1926, nickname: "I Partenopei", colors: "Sky blue", difficulty: 2 },
  { id: "roma", name: "Roma", aliases: ["AS Roma"], city: "Rome", country: "Italy", stadium: "Stadio Olimpico", founded: 1927, nickname: "I Giallorossi", colors: "Burgundy and gold", difficulty: 2 },
  { id: "psg", name: "Paris Saint-Germain", aliases: ["PSG", "Paris SG"], city: "Paris", country: "France", stadium: "Parc des Princes", founded: 1970, nickname: "Les Parisiens", colors: "Navy, red and white", difficulty: 1 },
  { id: "marseille", name: "Marseille", aliases: ["Olympique de Marseille", "OM"], city: "Marseille", country: "France", stadium: "Stade Vélodrome", founded: 1899, nickname: "Les Phocéens", colors: "White and sky blue", difficulty: 2 },
  { id: "ajax", name: "Ajax", aliases: ["AFC Ajax"], city: "Amsterdam", country: "Netherlands", stadium: "Johan Cruyff Arena", founded: 1900, nickname: "De Godenzonen (Sons of the Gods)", colors: "White with a red band", difficulty: 2 },
  { id: "benfica", name: "Benfica", aliases: ["SL Benfica"], city: "Lisbon", country: "Portugal", stadium: "Estádio da Luz", founded: 1904, nickname: "As Águias (The Eagles)", colors: "Red and white", difficulty: 2 },
  { id: "porto", name: "Porto", aliases: ["FC Porto"], city: "Porto", country: "Portugal", stadium: "Estádio do Dragão", founded: 1893, nickname: "Os Dragões (The Dragons)", colors: "Blue and white stripes", difficulty: 2 },
  { id: "celtic", name: "Celtic", aliases: ["Celtic FC"], city: "Glasgow", country: "Scotland", stadium: "Celtic Park", founded: 1887, nickname: "The Bhoys", colors: "Green and white hoops", difficulty: 2 },
  { id: "boca", name: "Boca Juniors", aliases: ["Boca"], city: "Buenos Aires", country: "Argentina", stadium: "La Bombonera", founded: 1905, nickname: "Xeneizes", colors: "Blue and gold", difficulty: 2 },
  { id: "river", name: "River Plate", aliases: ["River"], city: "Buenos Aires", country: "Argentina", stadium: "Estadio Monumental", founded: 1901, nickname: "Los Millonarios", colors: "White with a red sash", difficulty: 2 },
  { id: "flamengo", name: "Flamengo", aliases: ["CR Flamengo"], city: "Rio de Janeiro", country: "Brazil", stadium: "Maracanã", founded: 1895, nickname: "Mengão", colors: "Red and black hoops", difficulty: 3 },
  { id: "alhilal", name: "Al Hilal", aliases: ["Al-Hilal"], city: "Riyadh", country: "Saudi Arabia", stadium: "Kingdom Arena", founded: 1957, nickname: "Al Za'eem (The Leader)", colors: "Blue and white", difficulty: 2 },
  { id: "alnassr", name: "Al Nassr", aliases: ["Al-Nassr"], city: "Riyadh", country: "Saudi Arabia", stadium: "Al-Awwal Park", founded: 1955, nickname: "Al-Alami (The International)", colors: "Yellow and blue", difficulty: 2 },
  { id: "alittihad", name: "Al Ittihad", aliases: ["Al-Ittihad", "Ittihad Jeddah"], city: "Jeddah", country: "Saudi Arabia", stadium: "King Abdullah Sports City", founded: 1927, nickname: "Al-Ameed (The Dean)", colors: "Yellow and black", difficulty: 3 },
  { id: "alahli-sa", name: "Al Ahli", aliases: ["Al-Ahli", "Al Ahli Saudi"], city: "Jeddah", country: "Saudi Arabia", stadium: "King Abdullah Sports City", founded: 1937, nickname: "The Royal (Al-Malaki)", colors: "Green and white", difficulty: 3 },
  { id: "alahly-eg", name: "Al Ahly", aliases: ["Al-Ahly", "Al Ahly SC"], city: "Cairo", country: "Egypt", stadium: "Cairo International Stadium", founded: 1907, nickname: "The Red Devils (Club of the Century)", colors: "Red and white", difficulty: 3 },
  { id: "galatasaray", name: "Galatasaray", aliases: ["Gala"], city: "Istanbul", country: "Turkey", stadium: "RAMS Park", founded: 1905, nickname: "Cimbom", colors: "Yellow and red", difficulty: 2 },
];

export const WORLD_CUPS: { year: number; host: string; winner: string; runnerUp: string }[] = [
  { year: 1930, host: "Uruguay", winner: "Uruguay", runnerUp: "Argentina" },
  { year: 1934, host: "Italy", winner: "Italy", runnerUp: "Czechoslovakia" },
  { year: 1938, host: "France", winner: "Italy", runnerUp: "Hungary" },
  { year: 1950, host: "Brazil", winner: "Uruguay", runnerUp: "Brazil" },
  { year: 1954, host: "Switzerland", winner: "West Germany", runnerUp: "Hungary" },
  { year: 1958, host: "Sweden", winner: "Brazil", runnerUp: "Sweden" },
  { year: 1962, host: "Chile", winner: "Brazil", runnerUp: "Czechoslovakia" },
  { year: 1966, host: "England", winner: "England", runnerUp: "West Germany" },
  { year: 1970, host: "Mexico", winner: "Brazil", runnerUp: "Italy" },
  { year: 1974, host: "West Germany", winner: "West Germany", runnerUp: "Netherlands" },
  { year: 1978, host: "Argentina", winner: "Argentina", runnerUp: "Netherlands" },
  { year: 1982, host: "Spain", winner: "Italy", runnerUp: "West Germany" },
  { year: 1986, host: "Mexico", winner: "Argentina", runnerUp: "West Germany" },
  { year: 1990, host: "Italy", winner: "West Germany", runnerUp: "Argentina" },
  { year: 1994, host: "United States", winner: "Brazil", runnerUp: "Italy" },
  { year: 1998, host: "France", winner: "France", runnerUp: "Brazil" },
  { year: 2002, host: "South Korea & Japan", winner: "Brazil", runnerUp: "Germany" },
  { year: 2006, host: "Germany", winner: "Italy", runnerUp: "France" },
  { year: 2010, host: "South Africa", winner: "Spain", runnerUp: "Netherlands" },
  { year: 2014, host: "Brazil", winner: "Germany", runnerUp: "Argentina" },
  { year: 2018, host: "Russia", winner: "France", runnerUp: "Croatia" },
  { year: 2022, host: "Qatar", winner: "Argentina", runnerUp: "France" },
];

export const UCL_WINNERS: { year: number; winner: string; runnerUp: string }[] = [
  { year: 1999, winner: "Manchester United", runnerUp: "Bayern Munich" },
  { year: 2000, winner: "Real Madrid", runnerUp: "Valencia" },
  { year: 2001, winner: "Bayern Munich", runnerUp: "Valencia" },
  { year: 2002, winner: "Real Madrid", runnerUp: "Bayer Leverkusen" },
  { year: 2003, winner: "AC Milan", runnerUp: "Juventus" },
  { year: 2004, winner: "Porto", runnerUp: "Monaco" },
  { year: 2005, winner: "Liverpool", runnerUp: "AC Milan" },
  { year: 2006, winner: "Barcelona", runnerUp: "Arsenal" },
  { year: 2007, winner: "AC Milan", runnerUp: "Liverpool" },
  { year: 2008, winner: "Manchester United", runnerUp: "Chelsea" },
  { year: 2009, winner: "Barcelona", runnerUp: "Manchester United" },
  { year: 2010, winner: "Inter Milan", runnerUp: "Bayern Munich" },
  { year: 2011, winner: "Barcelona", runnerUp: "Manchester United" },
  { year: 2012, winner: "Chelsea", runnerUp: "Bayern Munich" },
  { year: 2013, winner: "Bayern Munich", runnerUp: "Borussia Dortmund" },
  { year: 2014, winner: "Real Madrid", runnerUp: "Atlético Madrid" },
  { year: 2015, winner: "Barcelona", runnerUp: "Juventus" },
  { year: 2016, winner: "Real Madrid", runnerUp: "Atlético Madrid" },
  { year: 2017, winner: "Real Madrid", runnerUp: "Juventus" },
  { year: 2018, winner: "Real Madrid", runnerUp: "Liverpool" },
  { year: 2019, winner: "Liverpool", runnerUp: "Tottenham Hotspur" },
  { year: 2020, winner: "Bayern Munich", runnerUp: "Paris Saint-Germain" },
  { year: 2021, winner: "Chelsea", runnerUp: "Manchester City" },
  { year: 2022, winner: "Real Madrid", runnerUp: "Liverpool" },
  { year: 2023, winner: "Manchester City", runnerUp: "Inter Milan" },
  { year: 2024, winner: "Real Madrid", runnerUp: "Borussia Dortmund" },
  { year: 2025, winner: "Paris Saint-Germain", runnerUp: "Inter Milan" },
];

export const BALLON_DOR: { year: number; winner: string }[] = FOOTBALLERS.flatMap((p) =>
  (p.ballonDor ?? []).map((year) => ({ year, winner: p.name })),
).sort((a, b) => a.year - b.year);

/** World Cup titles per nation (verified from WORLD_CUPS; West Germany counted with Germany). */
export function worldCupTitles(): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of WORLD_CUPS) {
    const k = w.winner === "West Germany" ? "Germany" : w.winner;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
