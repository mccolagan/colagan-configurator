# Colagan Configurator

Configurateur web du clavier split **Colagan V2** (firmware Vial) : édition visuelle des touches, réglage du RGB en
direct, sauvegarde / restauration `.vil`. Communique avec le clavier depuis le navigateur via **WebHID**.

Cahier des charges et avancement : [`SPEC.md`](SPEC.md). Firmware : dépôt `colagan-pico-split-keyboard`.

> État : squelette (Docker, Vite + TypeScript, lint, tests, CI). Le bouton « Connecter » ne fait encore qu'ouvrir
> le clavier pour vérifier l'accès.

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
