# Raccourcis : tout passe par Docker, aucun Node requis sur l'hôte.
COMPOSE = docker compose
RUN = $(COMPOSE) run --rm --no-deps app
PROD = $(COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml

.PHONY: up down install lint format typecheck test build e2e check prod prod-down shell

up: ## Serveur de dev sur http://localhost:5173
	$(COMPOSE) up -d app

down:
	$(COMPOSE) down

install:
	$(RUN) npm install --no-audit --no-fund

lint:
	$(RUN) npm run lint

format:
	$(RUN) npm run format

typecheck:
	$(RUN) npm run typecheck

test:
	$(RUN) npm test

build:
	$(RUN) npm run build

e2e:
	$(COMPOSE) --profile e2e run --rm e2e

check: lint test build e2e

prod: ## Image nginx sur http://localhost:8080
	$(PROD) up -d --build web

prod-down:
	$(PROD) down

shell:
	$(RUN) sh
