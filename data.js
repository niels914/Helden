// Vragen voor Ranking de Helden. Tijden in Nederlandse tijd (CET, +01:00).
export const PLAYERS = [
  ['niels', 'Niels'], ['ruben', 'Ruben'], ['rick', 'Rick'],
  ['joost', 'Joost'], ['stijn', 'Stijn'], ['mike', 'Mike'],
];

// mode: 'gemeten' = spelleider vult echte volgorde in; 'groep' = ter plekke stemt iedereen, gemiddelde telt
export const PRE = [
  [1,  'Wie laat de anderen het langst wachten?',             'Laatst aangekomen bij Nala',                  'gemeten', '2026-11-06T18:00'],
  [2,  'Wie heeft de heetste handen?',                         'Beste pizzabakker (blind geproefd)',          'groep',   '2026-11-06T20:30'],
  [3,  'Wie houdt het het langst uit in de soep?',             'Langst in de hottub',                         'gemeten', '2026-11-06T23:00'],
  [4,  'Wie kan het beste scrollen?',                          'Beste in Memester',                           'gemeten', '2026-11-06T23:00'],
  [5,  'Wie gaat als eerste onder zeil?',                      'Als eerste naar bed',                         'gemeten', '2026-11-07T09:00'],
  [6,  'Wie moet het vaakst rapen?',                           'Grootste verliezer bij padel',                'gemeten', '2026-11-07T11:45'],
  [7,  'Wie kijkt het meest tegen ruggen aan?',                'Laatste bij het karten',                      'gemeten', '2026-11-07T15:00'],
  [8,  'Wie heeft de minste remmen?',                          'Gevaarlijkste coureur op de kartbaan',        'groep',   '2026-11-07T15:00'],
  [9,  'Wie heeft de grootste neus en het kleinste verstand?', 'Weet het minst van wijn, praat het meest',    'groep',   '2026-11-07T17:30'],
  [10, 'Wie heeft zijn kast het slechtst geplunderd?',         'Slechtste outfit voor de stad',               'groep',   '2026-11-07T20:00'],
  [11, 'Wie zegt het vaakst "nog eentje dan"?',                'Laatste uit de kroeg',                        'gemeten', '2026-11-08T10:00'],
  [12, 'Wie hangt als eerste aan de lijn?',                    'Belt als eerste naar huis',                   'gemeten', '2026-11-08T10:00'],
  [14, 'Wie ziet de zon zondag als laatste?',                  'Slaapt het langst uit',                       'gemeten', '2026-11-08T10:00'],
  [15, 'Wie heeft zondag de zwaarste kop?',                    'Ergste kater',                                'groep',   '2026-11-08T10:00'],
  [16, 'Wie neemt het meeste Zeddam mee naar huis?',           'Viest na het veldrijden in Zeddam',           'groep',   '2026-11-08T16:30'],
  [17, 'Wie is de echte Held?',                                'De finale',                                   'groep',   '2026-11-08T18:00'],
];

export const LIVE = {
  'Wie zou…': [
    'Wie zou zich het eerst aanmelden voor Expeditie Robinson?', 'Wie zou het langst overleven op een onbewoond eiland?',
    'Wie zou het eerst een midlifecrisis-cabrio kopen?', 'Wie zou als eerste een eigen podcast beginnen?',
    'Wie zou het snelst ontmaskerd worden als Mol?', 'Wie zou de beste burgemeester van Deventer zijn?',
    'Wie zou het eerst al zijn geld kwijtraken aan crypto?', 'Wie zou als eerste een tattoo van zijn club laten zetten?',
  ],
  'De toekomst': [
    'Wie wordt als eerste opa?', 'Wie stopt als eerste met werken?', 'Wie is het eerst kaal?',
    'Wie heeft over tien jaar de dikste buik?', 'Wie rijdt over vijf jaar de duurste auto?', 'Wie wordt ooit nog wethouder?',
    'Wie loopt als eerste een marathon?', 'Wie woont over twintig jaar nog in hetzelfde huis?',
  ],
  'Karakter': [
    'Wie is de grootste regelneef?', 'Wie heeft de kortste lont?', 'Wie maakt de meeste blunders?',
    'Wie is de slechtste verliezer?', 'Wie kan het slechtst een geheim bewaren?', 'Wie is de grootste opschepper?',
    'Wie staat het meest onder de plak?', 'Wie heeft de meeste praatjes en de minste daden?',
    'Wie weet altijd als eerste de roddels?', 'Wie is het gevoeligst voor complimenten?', 'Wie is het koppigst?',
    'Wie bel je als je om 3 uur \'s nachts ergens gestrand bent?',
  ],
  'Gewoontes': [
    'Wie heeft de meeste ongelezen appjes?', 'Wie zit het langst met zijn telefoon op de wc?', 'Wie is het vaakst te laat?',
    'Wie stuurt de meeste memes in de groepsapp?', 'Wie kijkt het meeste voetbal?', 'Wie heeft de slechtste muzieksmaak?',
    'Wie danst het slechtst?', 'Wie kookt het vaakst thuis?', 'Wie heeft de meeste sneakers?',
    'Wie gaat het vaakst naar de sportschool, maar zie je het het minst?', 'Wie heeft het hoogste IQ?',
    'Wie was in de studietijd het grootste feestbeest?', 'Wie heeft de beste verhalen uit de studietijd?',
    'Wie is sinds de studie het minst veranderd?',
  ],
};

// Challenges: de quizmaster zet ze open en vult de top 3 in (3, 2 en 1 punt)
export const CHALLENGES = [
  'Wie heeft de meeste smaken goed geraden bij de wijnproeverij?',
  'Wie wint karten heat 1?',
  'Wie wint karten heat 2?',
  'Wie wint padel?',
  'Wie wint Memester?',
  'Wie heeft het snelst een adje?',
];
