# Diagnostic d'aide à la décision — Val-d'Oise

Outil d'analyse territoriale au point pour la DDT du Val-d'Oise (95) : urbanisme, risques, bâti, environnement, logement et accessibilité à 15 minutes.

Extrait du module `decision-territoriale` de l'[Atlas territorial du Val-d'Oise](https://github.com/DDT95/atlas-territorial-95) pour vivre comme un service autonome, à l'image des autres observatoires de la DDT 95.

## Développement local

Prérequis : Node.js 22.13 ou version ultérieure.

    npm install
    npm run dev

## Vérification

    npm run build:github

## Données

`npm run sync:decision` régénère les fichiers sous `public/data/decision/` à partir des sources listées dans `config/decision-sources.json` (services, réseau de bus, profils logement). Ce script tourne aussi automatiquement chaque semaine via `.github/workflows/update-decision-data.yml`.
