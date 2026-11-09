# Colagan Configurator

Configurateur web du clavier split **Colagan V2** (firmware Vial) : touches et éclairage de chaque couche sur
une même page, aperçu des LED en direct, macros / tap-dance / combos, sauvegarde / restauration `.vil`.
Communique avec le clavier depuis le navigateur via **WebHID**.

Cahier des charges et avancement : [`SPEC.md`](SPEC.md). Firmware : dépôt `colagan-pico-split-keyboard`.

## Fonctions

- **Touches** : onglets de couche, dessin du clavier (pouces en arc), choix du keycode avec étiquettes AZERTY
  (ou QWERTY), écriture immédiate, annuler / rétablir, garde-fous (QK_BOOT, dernière sortie d'une couche).
- **Couleurs** (même page, mode _Couleurs_) : pinceau (palette, couleur libre, éteinte, « Effet »), clic ou
  glisser pour peindre, Alt+clic pour reprendre une couleur, effet propre à une couche, effet global sur la
  couche 0. Pendant l'édition, le clavier affiche la couche choisie.
- **Éclairage sur le dessin** : _Couche affichée_ (couleurs de la couche sélectionnée, effet réel sous les touches
  « Effet »), _Clavier en direct_ (état réel des LED, ~20 i/s), ou _Masqué_. L'onglet de la couche active sur le
  clavier est marqué ●.
- **Vue 3D** (par défaut, _Vue : 3D / Plan_) : keycaps aux légendes rétroéclairées par les LED réelles, coque
  noir mat au contour du PCB (profil Colagan), vues _Produit_ / _Dessus_, mêmes clics et glisser que le plan.
  three.js est chargé à la demande ; sans WebGL, le plan SVG reste affiché. Maquette de design :
  [`maquette-3d.html`](https://mccolagan.github.io/colagan-configurator/maquette-3d.html).
- **Macros & co** : macros (texte converti en frappes AZERTY), tap-dance, combos.
- **Sauvegarde** : export / import `.vil` compatible Vial, instantanés locaux avant import.
- **Mode démo** : clavier simulé, sans matériel.

Couleurs par couche et aperçu : firmware Colagan avec la commande `0xC0` v2 (voir le dépôt firmware). Avec un
autre firmware Vial, seules les fonctions Vial / VialRGB sont proposées.

## Navigateurs

Chrome ou Edge (WebHID). Firefox et Safari ne donnent pas accès au clavier.
La page doit être ouverte en **https://** ou sur **http://localhost** : par l'IP du réseau local
(`http://192.168.x.x:5173`), WebHID est désactivé.

## Développement (Docker uniquement)

| Commande                                 | Effet                                                  |
| ---------------------------------------- | ------------------------------------------------------ |
| `make up` / `docker compose up -d`       | serveur Vite sur <http://localhost:5173> (HMR)         |
| `make down`                              | arrête le serveur                                      |
| `make lint` · `make test` · `make build` | lint + format, tests unitaires (Vitest), build         |
| `make e2e`                               | tests Playwright (Chromium) dans leur conteneur        |
| `make check`                             | tout ce qui précède                                    |
| `make prod` · `make prod-down`           | image nginx de prod locale sur <http://localhost:8080> |
| `make shell`                             | shell dans le conteneur Node                           |

Variables par défaut dans `.env` (ports, `BASE_PATH`, UID) ; surcharges dans `.env.local` (non versionné).
`node_modules` vit dans des volumes Docker (un pour Alpine, un pour l'image Playwright).

## Linux : accès au clavier

Le navigateur doit pouvoir ouvrir `/dev/hidraw*`. Règle udev (ex. `/etc/udev/rules.d/50-qmk.rules`) :

```
KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="feed", ATTRS{idProduct}=="0004", MODE="0660", TAG+="uaccess"
```

puis `sudo udevadm control --reload && sudo udevadm trigger`.

## Déploiement

GitHub Actions (`.github/workflows/ci.yml`) : lint, tests, build et E2E à chaque push ; publication sur GitHub
Pages depuis `main` (`BASE_PATH=/colagan-configurator/`).

## Licence

GPL-2.0-or-later, comme le firmware.
