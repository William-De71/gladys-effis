# EFFIS

## Présentation

EFFIS, le système européen d’information sur les feux de forêt du service de gestion des urgences Copernicus (Commission européenne), dans Gladys. Pour chacun de vos lieux (jusqu’à trois) :

- le **danger d’incendie** du jour et des 9 jours suivants : l’indice forêt météo (FWI) de la prévision EFFIS et son niveau, de faible à très extrême ;
- les **feux vus par satellite** ces dernières 24 heures dans un rayon que vous choisissez (points chauds MODIS, VIIRS et Sentinel-3) ;
- les **surfaces brûlées** cartographiées par EFFIS ces 7 derniers jours dans ce rayon.

Aucun compte, aucune clé : les données d’EFFIS sont ouvertes, sous licence CC BY 4.0. Ce n’est pas un service d’alerte officiel : un feu vu par satellite peut être un brûlage agricole ou une source de chaleur industrielle, et une absence de détection ne veut pas dire qu’il n’y a pas de feu. Suivez toujours les consignes des autorités.

![Les widgets Danger feux de forêt et Feux à proximité d’une maison près de Barcelone, d’après des données EFFIS enregistrées (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-effis/main/docs/assets/widgets.fr.png)

## Prérequis

- Gladys Assistant 5.3.0 ou plus récent.
- Une maison localisée dans Gladys (Paramètres > Maisons), ou les coordonnées du lieu à surveiller.
- Un accès à Internet depuis Gladys : les données viennent des serveurs d’EFFIS.

## Configuration

1. Installez l’intégration depuis **Intégrations** (EFFIS).
2. Pour chaque lieu, choisissez une **Maison**, ou saisissez des **coordonnées** (« 43.2965, 5.3698 » ; elles sont prioritaires sur la maison).
3. Choisissez le **rayon** autour de chaque lieu, puis enregistrez. **Vérifier les lieux** affiche les coordonnées utilisées et ce qu’EFFIS indique là-bas maintenant.
4. Dans l’onglet **Découverte**, ajoutez les appareils voulus.

| Champ              | Par défaut  | Effet                                                                                    |
| ------------------ | ----------- | ---------------------------------------------------------------------------------------- |
| Maison             |             | Une maison de Gladys : sa position est utilisée.                                         |
| Ou des coordonnées |             | Latitude, longitude : résidence secondaire, forêt proche. Prioritaires sur la maison.    |
| Rayon              | 25 km       | Les feux et surfaces brûlées sont surveillés dans cette distance (10, 25, 50 ou 100 km). |
| Langue             | Automatique | Noms des fonctionnalités, textes des scènes et état.                                     |

## Utilisation

### Appareils

Un appareil par lieu, « EFFIS <lieu> », en lecture seule :

- **Indice forêt météo (FWI)** : le FWI du jour, arrondi.
- **Danger d’incendie aujourd’hui** et **Danger d’incendie demain** : 0 faible (FWI sous 11,2), 1 modéré, 2 élevé (dès 21,3), 3 très élevé (dès 38), 4 extrême (dès 50), 5 très extrême (dès 70), les classes des cartes d’EFFIS.
- **Feux à proximité (24 h)** : les feux vus par satellite dans le rayon. Des points chauds distants de moins de 2 km comptent pour un seul feu.
- **Situation** : le danger et le feu le plus proche, en une phrase.

La prévision est lue toutes les 3 heures et à chaque nouveau jour, les points chauds toutes les 30 minutes, les surfaces brûlées toutes les heures.

### Scènes

Déclencheurs :

- **Niveau de danger changé** : quand le niveau du jour change (nouvelle prévision ou nouveau jour). Filtres : appareil, nouveau niveau, monte ou baisse.
- **Feu détecté à proximité** : un feu vu par satellite dans le rayon, jamais vu auparavant. Variables : distance, direction, heure, points chauds, position.
- **Surface brûlée à proximité** : une surface brûlée cartographiée par EFFIS dans le rayon. Variables : surface en hectares, commune, province, pays, date du feu, distance.

La première lecture après un démarrage sert de référence : aucun déclencheur ne rejoue un feu ou un niveau déjà présent.

Action **Obtenir le danger d’incendie** (aujourd’hui, demain ou après-demain) : FWI, niveau, feux à proximité, feu le plus proche, et une phrase de résumé.

Exemples :

- « Niveau de danger changé », niveau très élevé, extrême ou très extrême → envoyer « {{triggerEvent.data.summary}} » et lancer l’arrosage du jardin le soir.
- « Feu détecté à proximité » → envoyer « {{triggerEvent.data.summary}} » à la famille.
- Chaque matin à 7 h (scène planifiée) → « Obtenir le danger d’incendie » (aujourd’hui) → envoyer son résumé quand le niveau est élevé ou plus.

### Widgets

- **Danger feux de forêt** : le niveau du jour et des jours suivants (3 à 9, réglage « Jours »), avec le FWI.
- **Feux à proximité** : les feux vus par satellite en 24 heures (distance, direction, heure) et les surfaces brûlées cartographiées en 7 jours (commune, surface, distance, date).

Les deux citent la source, comme le demande la licence d’EFFIS.

## Dépannage

- **« La maison n’a pas de position »** : placez la maison dans Paramètres > Maisons, ou saisissez des coordonnées.
- **« Coordonnées non comprises »** : saisissez la latitude puis la longitude, en degrés décimaux : « 43.2965, 5.3698 ».
- **« EFFIS ne répond pas pour l’instant »** : les serveurs d’EFFIS sont occupés ou en maintenance ; l’intégration réessaie d’elle-même et garde les dernières données.
- **Un feu sur la carte d’EFFIS mais pas dans Gladys** : les satellites passent quelques fois par jour, et les nuages ou la fumée peuvent masquer un feu ; EFFIS cartographie une surface brûlée d’après les images satellite, en général un jour ou plus après le feu.
- Journaux : l’onglet **Journaux** de l’intégration. En mode développeur, `DEBUG=gladys-integration-sdk` ajoute les journaux du SDK.
