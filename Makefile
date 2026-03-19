.PHONY: up down logs shell migrate migrate-deploy seed reset studio build rebuild type-check

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f api

shell:
	docker compose exec api sh

migrate:
	docker compose exec api pnpm prisma:migrate

migrate-deploy:
	docker compose exec api pnpm prisma:migrate:deploy

seed:
	docker compose exec api pnpm prisma:seed

reset:
	docker compose exec api pnpm db:reset

studio:
	pnpm prisma:studio

build:
	docker compose build api

rebuild:
	docker compose up -d --build api

type-check:
	docker compose exec api pnpm type-check
