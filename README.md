# WC3 - Fan Votes

WC3 - Fan Votes est une mini-application NoSQL de votes supporters pour la Coupe du Monde. Un supporter choisit un vote ouvert, vote pour un joueur ou une equipe, puis voit le classement se mettre a jour. L'application garde aussi un historique horodate des votes.

L'interface affiche aussi un tableau Redis live :

- classement du vote actif ;
- equipes les plus soutenues ;
- joueurs les plus populaires ;
- matchs les plus actifs ;
- ajout d'un nouveau choix dans un vote ouvert.

## Principe NoSQL

- MongoDB stocke les donnees durables : votes, matchs, choix et historique.
- Redis stocke les compteurs rapides avec des sorted sets pour obtenir le classement.
- Les donnees de depart viennent du dataset Coupe du Monde fourni pour le TP. Elles sont preparees dans `src/seed-data.js`, donc les dossiers `docs` et `json` ne sont plus necessaires.

Au demarrage Docker, l'API remplit automatiquement MongoDB et Redis si MongoDB est vide.

## Lancer avec Docker Desktop

Depuis ce dossier :

```powershell
docker compose up --build
```

Services disponibles :

- Application : <http://localhost:3000>
- Mongo Express : <http://localhost:8082>
- Redis Commander : <http://localhost:8083>
- Redis local : `localhost:6380`

Dans Docker Desktop, tu verras les conteneurs :

- `wc3-fan-votes-app`
- `wc3-fan-votes-mongo`
- `wc3-fan-votes-redis`
- `wc3-fan-votes-mongo-express`
- `wc3-fan-votes-redis-commander`

## Consulter les donnees

Dans Mongo Express :

1. Ouvre <http://localhost:8082>.
2. Va dans la base `wc3_fan_votes`.
3. Consulte les collections `polls` et `votehistories`.

Dans Redis Commander :

1. Ouvre <http://localhost:8083>.
2. Cherche les cles `poll:vote_001:ranking`, `poll:vote_002:ranking` et `poll:vote_003:ranking`.
3. Ces sorted sets contiennent les compteurs utilises pour le classement du vote actif.
4. Consulte aussi les tendances globales :
   - `team:popularity:ranking`
   - `player:popularity:ranking`
   - `match:activity:ranking`

## Lancer en local pendant que Docker tourne

Le conteneur de l'application utilise deja le port `3000`. Pour lancer aussi le serveur Node local, utilise le port `3001` :

```powershell
npm.cmd run start:local
```

Interface locale : <http://localhost:3001>

Cette commande se connecte aux bases Docker :

- MongoDB : `mongodb://127.0.0.1:27017/wc3_fan_votes`
- Redis : `redis://127.0.0.1:6380`

## Application mobile Expo Go

Un projet Expo est disponible dans `mobile/`. Il reprend le design sombre analytics et consomme la meme API Express.

Le projet mobile utilise Expo SDK 52 pour rester compatible avec une version Expo Go plus ancienne.

Installation :

```powershell
cd C:\Dev\NoSQL\WC3-Fan-Votes\mobile
npm.cmd install
npm.cmd run start:offline
```

Ensuite, scanne le QR code avec Expo Go.

Depuis un telephone physique, `localhost` pointe vers le telephone, pas vers ton PC. Dans l'app mobile, remplace donc l'URL API par l'adresse IP locale de ton ordinateur :

```text
http://10.149.132.235:3000
```

Si tu lances le serveur Node local sur le port `3001`, utilise plutot :

```text
http://192.168.1.xx:3001
```

## Lancer sans Docker

L'application peut aussi tourner en mode memoire si MongoDB et Redis ne sont pas configures :

```powershell
npm.cmd install
npm.cmd start
```

Pour utiliser MongoDB et Redis locaux hors Docker, copie `.env.example` vers `.env`, puis renseigne :

```env
MONGO_URI=mongodb://127.0.0.1:27017/wc3_fan_votes
REDIS_URL=redis://127.0.0.1:6379
```

## Requetes utiles

Afficher les votes ouverts :

```http
GET /api/polls
```

Creer un vote :

```http
POST /api/polls
Content-Type: application/json

{
  "pollId": "vote_003",
  "match": "Japon - Maroc",
  "competition": "Coupe du Monde",
  "question": "Quel joueur a le plus influence le match ?",
  "category": "player",
  "choices": [
    { "choiceId": "c1", "label": "Ito", "team": "Japon" },
    { "choiceId": "c2", "label": "Hakimi", "team": "Maroc" }
  ]
}
```

Voter pour un choix :

```http
POST /api/polls/vote_001/vote
Content-Type: application/json

{
  "userId": "user_12",
  "choiceId": "c1"
}
```

Afficher le classement :

```http
GET /api/polls/vote_001/ranking
```

Consulter l'historique :

```http
GET /api/polls/vote_001/history
```

Afficher le dashboard Redis :

```http
GET /api/dashboard
```

Ajouter un choix au vote actif :

```http
POST /api/polls/vote_003/options
Content-Type: application/json

{
  "choiceId": "team_bel",
  "label": "Belgique",
  "team": "Europe"
}
```

## Architecture

```text
Interface Web
     |
     v
API Express.js
     |-- MongoDB : votes, matchs, choix, historique horodate
     |-- Redis   : compteurs et classement temps reel
```
