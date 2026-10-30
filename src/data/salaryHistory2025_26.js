// Prior-season fallback amounts from the 2025-26 salary export.
// Source mirror: https://github.com/LeeChien-Huang/NBA-Player-Value-Analysis/blob/main/data/nba_salaries_2025_26.csv
// Keys use the Basketball-Reference player ID (-9999 column); values are dollars.
export const SALARY_HISTORY = Object.freeze({
  "brownbr01": { salary2025_26: 2296274 }, // Bruce Brown
  "westbru01": { salary2025_26: 2296274 }, // Russell Westbrook
  "spencpa01": { salary2025_26: 857804 }, // Pat Spencer
  "ruperra01": { salary2025_26: 2353647 }, // Rayan Rupert
  "yabusgu01": { salary2025_26: 5500000 }, // Guerschon Yabusele
  "agbajoc01": { salary2025_26: 6383525 }, // Ochai Agbaji
  "brownko01": { salary2025_26: 2654880, salary2026_27: 4792059 }, // Kobe Brown
  "poweldw01": { salary2025_26: 4000000 }, // Dwight Powell
  "thomaca02": { salary2025_26: 6837779 }, // Cam Thomas
  "vincega01": { salary2025_26: 11500000 }, // Gabe Vincent
  "valanjo01": { salary2025_26: 10395000, salary2026_27: 10000000 }, // Jonas Valančiūnas
  "wilsoja03": { salary2025_26: 2221677 }, // Jalen Wilson
  "willivi01": { salary2025_26: 2301587 }, // Vince Williams Jr.
  "pickeja02": { salary2025_26: 2221677, salary2026_27: 2406205 }, // Jalen Pickett
  "holidaa01": { salary2025_26: 2296274 }, // Aaron Holiday
  "martity01": { salary2025_26: 2191897 }, // Tyrese Martin
  "balllo01": { salary2025_26: 10000000 }, // Lonzo Ball
  "howarje01": { salary2025_26: 5529720, salary2026_27: 7337939 }, // Jett Howard
  "iveyja01": { salary2025_26: 10107163 }, // Jaden Ivey
  "joneska03": { salary2025_26: 1272870, salary2026_27: 2150917 }, // Kam Jones
  "loveke01": { salary2025_26: 4150000 }, // Kevin Love
  "eubandr01": { salary2025_26: 2296274 }, // Drew Eubanks
  "terryda01": { salary2025_26: 5399118 }, // Dalen Terry
  "wallake01": { salary2025_26: 2296274 }, // Keaton Wallace
  "coffeam01": { salary2025_26: 2296274 }, // Amir Coffey
  "chrisca02": { salary2025_26: 1955377, salary2026_27: 2296271 }, // Cam Christie
  "sochaje01": { salary2025_26: 7874853 }, // Jeremy Sochan
  "klebima01": { salary2025_26: 11000000 }, // Maxi Kleber
  "bradlto01": { salary2025_26: 3204816 }, // Tony Bradley
  "mcderdo01": { salary2025_26: 2296274 }, // Doug McDermott
  "phillju01": { salary2025_26: 2221677, salary2026_27: 2406205 }, // Julian Phillips
  "jacksan01": { salary2025_26: 2221677, salary2026_27: 2406205 }, // Andre Jackson Jr.
  "hayeski01": { salary2025_26: 263940 }, // Killian Hayes
  "smithni01": { salary2025_26: 2710680 }, // Nick Smith Jr.
  "payneca01": { salary2025_26: 712637 }, // Cameron Payne
  "robinje02": { salary2025_26: 131970 }, // Jeremiah Robinson-Earl
  "weslebl01": { salary2025_26: 5643732 }, // Blake Wesley
  "olynyke01": { salary2025_26: 13445122 }, // Kelly Olynyk
  "smithma02": { salary2025_26: 73153 }, // Malachi Smith
  "kolokch01": { salary2025_26: 263940 }, // Christian Koloko
  "waterli01": { salary2025_26: 2296274 }, // Lindy Waters III
  "johnske10": { salary2025_26: 1955377 }, // Keshad Johnson
  "branhma01": { salary2025_26: 4962033 }, // Malaki Branham
  "reathdu01": { salary2025_26: 2221677 }, // Duop Reath
  "mogbojo01": { salary2025_26: 1955377, salary2026_27: 2296271 }, // Jonathan Mogbo
  "balad01": { salary2025_26: 117045 }, // Adama-Alpha Bal
  "timmedr01": { salary2025_26: 1955377 }, // Drew Timme
  "paulch01": { salary2025_26: 2296274 }, // Chris Paul
  "willilu01": { salary2025_26: 21946 }, // Lucas Williamson
  "davisjd01": { salary2025_26: 2270735 }, // JD Davison
  "mathega01": { salary2025_26: 429325 }, // Garrison Mathews
  "hayesni01": { salary2025_26: 2048494 }, // Nigel Hayes-Davis
  "tillmxa01": { salary2025_26: 2546675 }, // Xavier Tillman Sr.
  "whiteda01": { salary2025_26: 3262560 }, // Dariq Whitehead
  "scotttr01": { salary2025_26: 129503 }, // Tre Scott
  "greenje02": { salary2025_26: 2296274 }, // Jeff Green
  "plumlma01": { salary2025_26: 3022108 }, // Mason Plumlee
  "smithty02": { salary2025_26: 1955377 }, // Tyler Smith
  "tysonhu01": { salary2025_26: 2221677 }, // Hunter Tyson
  "inglejo01": { salary2025_26: 2296274 }, // Joe Ingles
  // Supplemental 2025-26 salary rows for players absent from the original export.
  // Source: https://huggingface.co/datasets/Mr-Bridge/nba-salary-cap-contracts-2016-2026/blob/main/player_salaries.csv
  // Compiled from HoopsHype salary snapshots accessed 2026-07-07.
  "watkija01": { salary2025_26: 1546981 }, // Jamir Watkins
  "loveca01": { salary2025_26: 636435 }, // Caleb Love
  "cardwdy01": { salary2025_26: 1218461 }, // Dylan Cardwell
  "jacksqu01": { salary2025_26: 1022998 }, // Quenton Jackson
  "smallja01": { salary2025_26: 636435 }, // Javon Small
  "coopesh01": { salary2025_26: 636435 }, // Sharife Cooper
  "mashaja01": { salary2025_26: 476136 }, // Jahmai Mashack
  "vukcetr01": { salary2025_26: 3256068 }, // Tristan Vukcevic
  "thompet01": { salary2025_26: 431096 }, // Ethan Thompson
  "harklej01": { salary2025_26: 636434 }, // Elijah Harkless
  "mbengbe01": { salary2025_26: 219459 }, // Bez Mbeng
  "peterta01": { salary2025_26: 636434 }, // Taelon Peter
  "tshieos01": { salary2025_26: 636434 }, // Oscar Tshiebwe
  "blackle01": { salary2025_26: 164074 }, // Leaky Black
  "reeseju01": { salary2025_26: 141554 }, // Julian Reese
  "etienty01": { salary2025_26: 636435 }, // Tyson Etienne
  "chandke01": { salary2025_26: 235460 }, // Kennedy Chandler
  "barnhbr01": { salary2025_26: 636435 }, // Brooks Barnhizer
  "johnsch06": { salary2025_26: 347451 }, // Chaney Johnson
  "liveris01": { salary2025_26: 636435 }, // Isaiah Livers
  "olbrila01": { salary2025_26: 636435 }, // Lachlan Olbrich
  "slawsja01": { salary2025_26: 141554 }, // Jalen Slawson
  "burtoty01": { salary2025_26: 146306 }, // Tyler Burton
  "cryerlj01": { salary2025_26: 424662 }, // LJ Cryer
  "hinsobl01": { salary2025_26: 202680 }, // Blake Hinson
  "leonsma01": { salary2025_26: 405359 }, // Malevy Leons
  "ryanco01": { salary2025_26: 147988 }, // Cormac Ryan
  "simpskj01": { salary2025_26: 806942 }, // KJ Simpson
  "poulajo01": { salary2025_26: 141554 }, // John Poulakidas
  "lawsoaj01": { salary2025_26: 660121 }, // A.J. Lawson
  "okanito01": { salary2025_26: 73153 }, // Toby Okani
  "hallpj01": { salary2025_26: 353885 }, // PJ Hall
  "kawamyu01": { salary2025_26: 312062 }, // Yuki Kawamura
  "dennira01": { salary2025_26: 530535 }, // RayJ Dennis
  "beaucma01": { salary2025_26: 347451 }, // MarJon Beauchamp
  "youngch01": { salary2025_26: 768338 }, // Chris Youngblood
  "garcian01": { salary2025_26: 73153 }, // Andersson Garcia
});
