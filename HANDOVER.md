# Handover

- Version: `0.2.4`
- Live dashboard: `/hjem-overblik/hyacintvej`, tidligere prisblok på kortindeks 5
- Installeret sti: `/mnt/ha-config/www/ha-electricity-price-card`
- Resource: `/local/ha-electricity-price-card/ha-electricity-price-card.js?v=0.2.4`
- Backups: `/mnt/ha-config/_archive/backups/lovelace/hyacintvej-electricity-price-20260909-175500` og `/mnt/ha-config/_archive/backups/lovelace/ha-electricity-price-card-20260909-184500`
- Den gamle 87 KB blok med tre `local-conditional-card`/`button-card`-varianter er erstattet af ét `custom:ha-electricity-price-card`.
- Kortet understøtter automatisk valg samt tvunget valg af Strømligning eller Energi Data Service.
- I dag, i morgen, uge, aktuel pris, min/snit/max, 24 timesøjler, tooltip og navigation mellem forecastdage er bevaret i den samlede komponent.
- Version 0.2.2 genskaber de oprindelige 62 px fanekort med titel, undertitel, venstre accent og baggrundsikon. Den valgte fane vises alene med accentfarve; tekstbadgen er fjernet. Hver forecastdag har desuden sin egen ugedags- og datoknap.
- Version 0.2.3 bruger igen originalens præcise statistikskala via `--dashboard-success`, `--yellow`, `--dashboard-warning` og `--dashboard-danger`. Mobilgrafens søjleafstand er øget fra 2 til 5 px, og den faste mobilhøjde er reduceret fra 389 til 369 px.
- Version 0.2.4 lader uge-dagsvælgeren erstatte hele dato/statistikrækken. Lav/snit/høj vises derfor kun i I dag og I morgen. Den faste mobilhøjde er reduceret yderligere til 329 px uden højdeskift.
- Strømligning og Energi Data Service er begge testet med live entities. Ingen fysiske handlinger udføres af kortet.
- Kortet har GUI-editor og bruger dashboardets tema-variabler.
- Browservalidering: version 0.2.4 blev hentet live. I dag, I morgen og Uge målte alle 329 px på mobil med `scrollHeight == clientHeight`; Uge viste fem dagknapper i stedet for statistikrækken.
- Preview: `docs/preview.png` er genereret fra den faktiske HA-rendering og indeholder ingen personnavne, adresse eller personbilleder.
- Git: `79f5ac3 Compact forecast day navigation` er pushed til `MRDonnii/ha-electricity-price-card` på `main`.
- Åbent punkt: Ingen kendte fejl.
