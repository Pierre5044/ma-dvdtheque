# Ma DVDthèque — guide d'installation

Application web personnelle (PWA) pour inventorier les DVD, rechercher des films, afficher les affiches TMDB, classer par genres, gérer les prêts et exporter/restaurer la collection.

## Fonctionnement et limites
- Les films, codes-barres, prêts et historique sont stockés dans IndexedDB du navigateur sur l'appareil courant.
- La sauvegarde JSON doit être exportée manuellement et conservée ailleurs. Effacer les données du navigateur peut supprimer la collection.
- Les affiches et métadonnées TMDB nécessitent une connexion Internet et une clé API. Les affiches sont stockées sous forme d'URL, pas intégrées au fichier de sauvegarde.
- Le scan utilise l'API BarcodeDetector, prise en charge dans Chrome Android, avec une saisie manuelle en secours. Le scan lit le code-barres EAN mais ne garantit pas que TMDB associe ce code à un film : TMDB ne propose pas de recherche de films par EAN. Après scan, rechercher le titre dans TMDB ou saisir le titre manuellement.
- Cette première version ne synchronise pas automatiquement plusieurs appareils.
- Le code de l'application est public si hébergé sur GitHub Pages. Ne mettez jamais de données de collection ou de clé API dans les fichiers du dépôt. La clé saisie dans les paramètres est conservée dans le stockage local du navigateur. Une clé utilisée dans un navigateur reste visible pour son utilisateur et les requêtes API.
- TMDB attribution: “This product uses the TMDB API but is not endorsed or certified by TMDB.” Afficher le crédit TMDB dans l'application lorsque vous utilisez son API et respecter ses conditions d'utilisation.

## 1. Obtenir une clé API TMDB (ordinateur recommandé)
1. Créez un compte sur https://www.themoviedb.org/
2. Dans les paramètres de votre compte, ouvrez la rubrique API et demandez une clé API.
3. Acceptez les conditions applicables à l'utilisation personnelle.
4. Copiez la clé API v3 (API Key, pas le mot de passe).
5. Dans l'application, ouvrez ⚙ Paramètres, collez la clé puis enregistrez.

Documentation officielle : https://developer.themoviedb.org/docs/getting-started et https://developer.themoviedb.org/docs/image-basics

## 2. Héberger gratuitement avec GitHub Pages
GitHub Pages peut publier un site statique gratuit depuis un dépôt public GitHub Free. Le dépôt et les fichiers de code seront publics. La collection personnelle, elle, reste dans le stockage local du navigateur et ne doit jamais être ajoutée au dépôt.
1. Sur https://github.com/ créez un compte ou connectez-vous.
2. Créez un nouveau dépôt public nommé `ma-dvdtheque`.
3. Dans le dépôt, utilisez **Add file > Upload files** et téléversez les fichiers du dossier (index.html, styles.css, app.js, manifest.json, sw.js, icon.svg). Ne téléversez pas une sauvegarde JSON de votre collection.
4. Cliquez sur **Commit changes**.
5. Ouvrez **Settings > Pages**.
6. Dans **Build and deployment**, sélectionnez **Deploy from a branch**, branche `main`, dossier `/(root)`, puis **Save**.
7. Attendez la publication et ouvrez l'URL indiquée dans la section Pages (généralement `https://VOTRE-NOM.github.io/ma-dvdtheque/`).

Guide officiel : https://docs.github.com/fr/pages/getting-started-with-github-pages/creating-a-github-pages-site

## 3. Installer sur Samsung Android
1. Ouvrez l'URL publiée dans **Google Chrome**.
2. Appuyez sur le menu ⋮ de Chrome.
3. Choisissez **Ajouter à l'écran d'accueil** ou **Installer l'application** si proposé.
4. Confirmez. Lancez ensuite Ma DVDthèque depuis l'icône.
5. Ouvrez ⚙ et enregistrez votre clé API TMDB.
6. Ajoutez un premier film test, testez un prêt et exportez une sauvegarde.

## 4. Sauvegarder et restaurer
- Appuyez sur **Sauvegarde** > **Exporter ma collection (.json)** et conservez le fichier dans un autre emplacement.
- Pour restaurer, ouvrez **Sauvegarde** > **Restaurer depuis un fichier**. Cette action remplace la collection courante sur cet appareil.
- Faites une sauvegarde après une grosse séance d'ajout et avant de vider le cache ou les données de Chrome.

## 5. Ajouter des DVD
- **Ajouter** ouvre la recherche TMDB. Choisissez un résultat pour préremplir titre, année, affiche, réalisateur et genres. Le bouton « Saisir un film manuellement » permet aussi de créer une fiche sans clé API.
- Pour saisir un titre sans TMDB, fermez la recherche et utilisez le formulaire d'ajout via le bouton de scan puis la saisie manuelle du code-barres. Pour un ajout manuel sans code-barres, utilisez la fiche après avoir sélectionné un résultat ou ajoutez un film par une recherche TMDB si possible.
- Pour scanner un code-barres depuis le formulaire, ouvrez une fiche de film et utilisez le bouton **Scanner**. Sur les navigateurs incompatibles, saisissez le code à la main.
- Pour prêter un DVD, ouvrez sa fiche > Modifier, cochez « DVD prêté », puis saisissez prénom, nom et date.
- Dans une fiche prêtée, **Marquer comme rendu** clôt le prêt et conserve l'historique.

## Dépannage
- **Affiches absentes** : vérifiez la connexion et la clé API.
- **Caméra refusée** : autorisez la caméra pour le site HTTPS dans les paramètres Chrome. Le scan automatique peut ne pas être disponible dans certains contextes ; la saisie manuelle reste possible.
- **Collection vide après changement de téléphone/navigateur** : restaurez le fichier JSON exporté. La collection ne se synchronise pas automatiquement.
