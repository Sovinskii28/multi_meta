#!/bin/bash

# Цвета для терминала
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Запуск инфраструктуры через Docker...${NC}"
docker-compose up -d

echo -e "${BLUE}Ожидание готовности баз данных...${NC}"
sleep 3

echo -e "${GREEN}Инфраструктура запущена!${NC}"
echo -e "PostgreSQL: localhost:5432"
echo -e "Redis: localhost:6379"

# Запуск сервера Go
echo -e "${BLUE}Запуск игрового сервера...${NC}"
cd server
go run main.go
