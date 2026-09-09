# Handover

- Version: `0.2.2`
- Live dashboard: `/hjem-overblik/hyacintvej`, tidligere prisblok på kortindeks 5
- Installeret sti: `/mnt/ha-config/www/ha-electricity-price-card`
- Resource: `/local/ha-electricity-price-card/ha-electricity-price-card.js?v=0.2.2`
- Backups: `/mnt/ha-config/_archive/backups/lovelace/hyacintvej-electricity-price-20260909-175500` og `/mnt/ha-config/_archive/backups/lovelace/ha-electricity-price-card-20260909-184500`
- Den gamle 87 KB blok med tre `local-conditional-card`/`button-card`-varianter er erstattet af ét `custom:ha-electricity-price-card`.
- Kortet understøtter automatisk valg samt tvunget valg af Strømligning eller Energi Data Service.
- I dag, i morgen, uge, aktuel pris, min/snit/max, 24 timesøjler, tooltip og navigation mellem forecastdage er bevaret i den samlede komponent.
- Version 0.2.2 genskaber de oprindelige 62 px fanekort med titel, undertitel, venstre accent og baggrundsikon. Den valgte fane vises alene med accentfarve; tekstbadgen er fjernet. Hver forecastdag har desuden sin egen ugedags- og datoknap.
- Strømligning og Energi Data Service er begge testet med live entities. Ingen fysiske handlinger udføres af kortet.
- Kortet har GUI-editor og bruger dashboardets tema-variabler.
- Browservalidering: version 0.2.1 blev hentet live; fem ugedagsknapper blev vist, og mobilrenderingen målte 389 px for alle tre faner med `scrollHeight == clientHeight`. Ugefanen ændrer derfor ikke kortets højde og giver intet internt overflow.
- Preview: `docs/preview.png` er genereret fra den faktiske HA-rendering og indeholder ingen personnavne, adresse eller personbilleder.
- Git: udfyldes med 0.2.0-commit efter commit/push.
- Åbent punkt: Ingen kendte fejl.
