# Handover

- Version: `0.1.0`
- Live dashboard: `/hjem-overblik/hyacintvej`, tidligere prisblok på kortindeks 5
- Installeret sti: `/mnt/ha-config/www/ha-electricity-price-card`
- Resource: `/local/ha-electricity-price-card/ha-electricity-price-card.js?v=0.1.0`
- Backup: `/mnt/ha-config/_archive/backups/lovelace/hyacintvej-electricity-price-20260909-175500`
- Den gamle 87 KB blok med tre `local-conditional-card`/`button-card`-varianter er erstattet af ét `custom:ha-electricity-price-card`.
- Kortet understøtter automatisk valg samt tvunget valg af Strømligning eller Energi Data Service.
- I dag, i morgen, forecast, aktuel pris, min/snit/max, 24 timesøjler, tooltip og navigation mellem forecastdage er bevaret i den samlede komponent.
- Strømligning og Energi Data Service er begge testet med live entities. Ingen fysiske handlinger udføres af kortet.
- Kortet har GUI-editor og bruger dashboardets tema-variabler.
- Git: `a6fb343 Add unified electricity price card` er pushed til `MRDonnii/ha-electricity-price-card` på `main`.
- Åbent punkt: Puppet screenshot-appen var stoppet; browserbaseret rendering blev valideret, men et nyt `docs/preview.png` mangler fortsat.
