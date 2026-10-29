-- Ranking de Helden: tabellen in het Familieplanner-project (public, prefix helden_).
-- Raakt geen bestaande tabellen.
create table if not exists public.helden_players (
  id text primary key, name text not null, sort int not null default 0);
create table if not exists public.helden_questions (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('pre','live')),
  nr int, cat text, title text not null, secret text,
  mode text not null check (mode in ('gemeten','groep','ranker')),
  push_at timestamptz,
  status text not null default 'closed' check (status in ('closed','voting','open','revealed')),
  ranker_id text references public.helden_players(id),
  truth text[], ts timestamptz, sort int not null default 0);
create table if not exists public.helden_answers (
  question_id bigint not null references public.helden_questions(id) on delete cascade,
  player_id text not null references public.helden_players(id),
  kind text not null check (kind in ('pred','vote')),
  picks text[] not null, updated_at timestamptz not null default now(),
  primary key (question_id, player_id, kind));

alter table public.helden_players enable row level security;
alter table public.helden_questions enable row level security;
alter table public.helden_answers enable row level security;
create policy helden_players_read on public.helden_players for select to anon using (true);
create policy helden_questions_all on public.helden_questions for all to anon using (true) with check (true);
create policy helden_answers_all on public.helden_answers for all to anon using (true) with check (true);
grant select on public.helden_players to anon;
grant select, insert, update, delete on public.helden_questions, public.helden_answers to anon;
alter publication supabase_realtime add table public.helden_questions, public.helden_answers;

insert into public.helden_players (id, name, sort) values
 ('niels', 'Niels', 1),
 ('ruben', 'Ruben', 2),
 ('rick', 'Rick', 3),
 ('joost', 'Joost', 4),
 ('stijn', 'Stijn', 5),
 ('mike', 'Mike', 6)
on conflict (id) do nothing;

insert into public.helden_questions (kind, nr, cat, title, secret, mode, push_at, sort) values
 ('pre', 1, null, 'Wie laat de anderen het langst wachten?', 'Laatst aangekomen bij Nala', 'gemeten', '2026-11-06T18:00:00+01:00', 1),
 ('pre', 2, null, 'Wie heeft de heetste handen?', 'Beste pizzabakker (blind geproefd)', 'groep', '2026-11-06T20:30:00+01:00', 2),
 ('pre', 3, null, 'Wie houdt het het langst uit in de soep?', 'Langst in de hottub', 'gemeten', '2026-11-06T23:00:00+01:00', 3),
 ('pre', 4, null, 'Wie kan het beste scrollen?', 'Beste in Memester', 'gemeten', '2026-11-06T23:00:00+01:00', 4),
 ('pre', 5, null, 'Wie gaat als eerste onder zeil?', 'Als eerste naar bed', 'gemeten', '2026-11-07T09:00:00+01:00', 5),
 ('pre', 6, null, 'Wie moet het vaakst rapen?', 'Grootste verliezer bij padel', 'gemeten', '2026-11-07T11:45:00+01:00', 6),
 ('pre', 7, null, 'Wie kijkt het meest tegen ruggen aan?', 'Laatste bij het karten', 'gemeten', '2026-11-07T15:00:00+01:00', 7),
 ('pre', 8, null, 'Wie heeft de minste remmen?', 'Gevaarlijkste coureur op de kartbaan', 'groep', '2026-11-07T15:00:00+01:00', 8),
 ('pre', 9, null, 'Wie heeft de grootste neus en het kleinste verstand?', 'Weet het minst van wijn, praat het meest', 'groep', '2026-11-07T17:30:00+01:00', 9),
 ('pre', 10, null, 'Wie heeft zijn kast het slechtst geplunderd?', 'Slechtste outfit voor de stad', 'groep', '2026-11-07T20:00:00+01:00', 10),
 ('pre', 11, null, 'Wie zegt het vaakst "nog eentje dan"?', 'Laatste uit de kroeg', 'gemeten', '2026-11-08T10:00:00+01:00', 11),
 ('pre', 12, null, 'Wie hangt als eerste aan de lijn?', 'Belt als eerste naar huis', 'gemeten', '2026-11-08T10:00:00+01:00', 12),
 ('pre', 14, null, 'Wie ziet de zon zondag als laatste?', 'Slaapt het langst uit', 'gemeten', '2026-11-08T10:00:00+01:00', 14),
 ('pre', 15, null, 'Wie heeft zondag de zwaarste kop?', 'Ergste kater', 'groep', '2026-11-08T10:00:00+01:00', 15),
 ('pre', 16, null, 'Wie neemt het meeste Zeddam mee naar huis?', 'Viest na het veldrijden in Zeddam', 'groep', '2026-11-08T16:30:00+01:00', 16),
 ('pre', 17, null, 'Wie is de echte Held?', 'De finale', 'groep', '2026-11-08T18:00:00+01:00', 17);

insert into public.helden_questions (kind, cat, title, mode, sort) values
 ('live', 'Wie zou…', 'Wie zou zich het eerst aanmelden voor Expeditie Robinson?', 'ranker', 101),
 ('live', 'Wie zou…', 'Wie zou het langst overleven op een onbewoond eiland?', 'ranker', 102),
 ('live', 'Wie zou…', 'Wie zou het eerst een midlifecrisis-cabrio kopen?', 'ranker', 103),
 ('live', 'Wie zou…', 'Wie zou als eerste een eigen podcast beginnen?', 'ranker', 104),
 ('live', 'Wie zou…', 'Wie zou het snelst ontmaskerd worden als Mol?', 'ranker', 105),
 ('live', 'Wie zou…', 'Wie zou de beste burgemeester van Deventer zijn?', 'ranker', 106),
 ('live', 'Wie zou…', 'Wie zou het eerst al zijn geld kwijtraken aan crypto?', 'ranker', 107),
 ('live', 'Wie zou…', 'Wie zou als eerste een tattoo van zijn club laten zetten?', 'ranker', 108),
 ('live', 'De toekomst', 'Wie wordt als eerste opa?', 'ranker', 109),
 ('live', 'De toekomst', 'Wie stopt als eerste met werken?', 'ranker', 110),
 ('live', 'De toekomst', 'Wie is het eerst kaal?', 'ranker', 111),
 ('live', 'De toekomst', 'Wie heeft over tien jaar de dikste buik?', 'ranker', 112),
 ('live', 'De toekomst', 'Wie rijdt over vijf jaar de duurste auto?', 'ranker', 113),
 ('live', 'De toekomst', 'Wie wordt ooit nog wethouder?', 'ranker', 114),
 ('live', 'De toekomst', 'Wie loopt als eerste een marathon?', 'ranker', 115),
 ('live', 'De toekomst', 'Wie woont over twintig jaar nog in hetzelfde huis?', 'ranker', 116),
 ('live', 'Karakter', 'Wie is de grootste regelneef?', 'ranker', 117),
 ('live', 'Karakter', 'Wie heeft de kortste lont?', 'ranker', 118),
 ('live', 'Karakter', 'Wie maakt de meeste blunders?', 'ranker', 119),
 ('live', 'Karakter', 'Wie is de slechtste verliezer?', 'ranker', 120),
 ('live', 'Karakter', 'Wie kan het slechtst een geheim bewaren?', 'ranker', 121),
 ('live', 'Karakter', 'Wie is de grootste opschepper?', 'ranker', 122),
 ('live', 'Karakter', 'Wie staat het meest onder de plak?', 'ranker', 123),
 ('live', 'Karakter', 'Wie heeft de meeste praatjes en de minste daden?', 'ranker', 124),
 ('live', 'Karakter', 'Wie weet altijd als eerste de roddels?', 'ranker', 125),
 ('live', 'Karakter', 'Wie is het gevoeligst voor complimenten?', 'ranker', 126),
 ('live', 'Karakter', 'Wie is het koppigst?', 'ranker', 127),
 ('live', 'Karakter', 'Wie bel je als je om 3 uur ''s nachts ergens gestrand bent?', 'ranker', 128),
 ('live', 'Gewoontes', 'Wie heeft de meeste ongelezen appjes?', 'ranker', 129),
 ('live', 'Gewoontes', 'Wie zit het langst met zijn telefoon op de wc?', 'ranker', 130),
 ('live', 'Gewoontes', 'Wie is het vaakst te laat?', 'ranker', 131),
 ('live', 'Gewoontes', 'Wie stuurt de meeste memes in de groepsapp?', 'ranker', 132),
 ('live', 'Gewoontes', 'Wie kijkt het meeste voetbal?', 'ranker', 133),
 ('live', 'Gewoontes', 'Wie heeft de slechtste muzieksmaak?', 'ranker', 134),
 ('live', 'Gewoontes', 'Wie danst het slechtst?', 'ranker', 135),
 ('live', 'Gewoontes', 'Wie kookt het vaakst thuis?', 'ranker', 136),
 ('live', 'Gewoontes', 'Wie heeft de meeste sneakers?', 'ranker', 137),
 ('live', 'Gewoontes', 'Wie gaat het vaakst naar de sportschool, maar zie je het het minst?', 'ranker', 138),
 ('live', 'Gewoontes', 'Wie heeft het hoogste IQ?', 'ranker', 139),
 ('live', 'Gewoontes', 'Wie was in de studietijd het grootste feestbeest?', 'ranker', 140),
 ('live', 'Gewoontes', 'Wie heeft de beste verhalen uit de studietijd?', 'ranker', 141),
 ('live', 'Gewoontes', 'Wie is sinds de studie het minst veranderd?', 'ranker', 142);
