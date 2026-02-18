package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Message struct {
	Type   string  `json:"type"`
	ID     string  `json:"id"`
	X      float32 `json:"x"`
	Z      float32 `json:"z"`
	RY     float32 `json:"ry"`
	Action string  `json:"action"`
	Text   string  `json:"text"`
}

type Hub struct {
	clients    map[*websocket.Conn]string
	broadcast  chan broadcastMsg
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.RWMutex
	db         *pgx.Conn
	rdb        *redis.Client
}

type broadcastMsg struct {
	data   Message
	sender *websocket.Conn
}

func newHub(db *pgx.Conn, rdb *redis.Client) *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]string),
		broadcast:  make(chan broadcastMsg),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		db:         db,
		rdb:        rdb,
	}
}

func (h *Hub) run() {
	for {
		select {
		case conn := <-h.register:
			h.mu.Lock()
			h.clients[conn] = ""
			h.mu.Unlock()
		case conn := <-h.unregister:
			h.mu.Lock()
			if id, ok := h.clients[conn]; ok {
				if id != "" {
					// При отключении: достаем состояние из Redis и сохраняем в Postgres
					p, _ := h.getPlayerState(id)
					h.savePlayerToDB(p)

					// Удаляем из оперативного кэша
					h.rdb.Del(context.Background(), "player:"+id)

					log.Printf("Player %s disconnected", id)
					go h.broadcastToAll(Message{Type: "leave", ID: id}, nil)
				}
				delete(h.clients, conn)
				conn.Close()
			}
			h.mu.Unlock()
		case msg := <-h.broadcast:
			h.broadcastToAll(msg.data, msg.sender)
		}
	}
}

func (h *Hub) broadcastToAll(data Message, sender *websocket.Conn) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.clients {
		if client != sender {
			err := client.WriteJSON(data)
			if err != nil {
				client.Close()
			}
		}
	}
}

func (h *Hub) setPlayerState(p Message) {
	if h.rdb == nil || p.ID == "" {
		return
	}
	data, _ := json.Marshal(p)
	// Кэшируем на 1 час активности
	h.rdb.Set(context.Background(), "player:"+p.ID, data, time.Hour)
}

func (h *Hub) getPlayerState(id string) (Message, bool) {
	if h.rdb == nil {
		return Message{}, false
	}
	data, err := h.rdb.Get(context.Background(), "player:"+id).Result()
	if err != nil {
		return Message{}, false
	}
	var p Message
	json.Unmarshal([]byte(data), &p)
	return p, true
}

func (h *Hub) getAllOnlinePlayers() []Message {
	if h.rdb == nil {
		return nil
	}
	keys, _ := h.rdb.Keys(context.Background(), "player:*").Result()
	var players []Message
	for _, key := range keys {
		data, _ := h.rdb.Get(context.Background(), key).Result()
		var p Message
		json.Unmarshal([]byte(data), &p)
		players = append(players, p)
	}
	return players
}

func (h *Hub) savePlayerToDB(p Message) {
	if h.db == nil || p.ID == "" {
		return
	}
	query := `
		INSERT INTO players (id, x, z, ry) 
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE 
		SET x = $2, z = $3, ry = $4;
	`
	_, err := h.db.Exec(context.Background(), query, p.ID, p.X, p.Z, p.RY)
	if err != nil {
		log.Printf("Error persistent saving to PG: %v", err)
	}
}

func (h *Hub) loadPlayerFromDB(id string) (Message, bool) {
	if h.db == nil {
		return Message{}, false
	}
	var p Message
	p.ID = id
	query := `SELECT x, z, ry FROM players WHERE id = $1`
	err := h.db.QueryRow(context.Background(), query, id).Scan(&p.X, &p.Z, &p.RY)
	if err != nil {
		return Message{}, false
	}
	p.Type = "move"
	return p, true
}

var hub *Hub

func handleLoginProxy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, _ := io.ReadAll(r.Body)
	log.Printf("Proxying login request for body: %s", string(body))

	// Создаем новый запрос к внешнему API
	req, err := http.NewRequest("POST", "https://the153.ru/api/auth/login", strings.NewReader(string(body)))
	if err != nil {
		log.Printf("Error creating request: %v", err)
		http.Error(w, "Internal Error", http.StatusInternalServerError)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Proxy error calling external API: %v", err)
		http.Error(w, "Proxy Error", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		log.Printf("External API returned error %d: %s", resp.StatusCode, string(respBody))
	}

	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.WriteHeader(resp.StatusCode)
	w.Write(respBody)
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	hub.register <- ws
	defer func() { hub.unregister <- ws }()

	for {
		_, msg, err := ws.ReadMessage()
		if err != nil {
			break
		}

		var data Message
		if err := json.Unmarshal(msg, &data); err != nil {
			continue
		}

		if data.Type == "join" {
			hub.mu.Lock()
			hub.clients[ws] = data.ID
			hub.mu.Unlock()

			log.Printf("Player %s joined", data.ID)

			// 1. Пытаемся достать из постоянной БД (Postgres)
			p, ok := hub.loadPlayerFromDB(data.ID)
			if !ok {
				p = data // Новый игрок, используем стартовые данные
			}

			// 2. Кладем в кэш (Redis)
			hub.setPlayerState(p)
			ws.WriteJSON(p)

			// 3. Отправляем новичку список всех, кто СЕЙЧАС в Redis
			for _, other := range hub.getAllOnlinePlayers() {
				if other.ID != data.ID {
					ws.WriteJSON(other)
				}
			}
		} else if data.Type == "chat" {
			// Чат не обновляет позицию в Redis
		} else if data.ID != "" {
			// Обновляем быстрое состояние в Redis
			hub.setPlayerState(data)
		}

		hub.broadcast <- broadcastMsg{data: data, sender: ws}
	}
}

func initDB() *pgx.Conn {
	godotenv.Load()
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)

	conn, err := pgx.Connect(context.Background(), connStr)
	if err != nil {
		log.Printf("PG Error: %v. Running without persistent DB.", err)
		return nil
	}

	query := `CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, x REAL, z REAL, ry REAL, last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`
	conn.Exec(context.Background(), query)
	log.Println("PostgreSQL подключена (для долгого хранения)")
	return conn
}

func initRedis() *redis.Client {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr: addr,
	})

	_, err := rdb.Ping(context.Background()).Result()
	if err != nil {
		log.Printf("Redis Error: %v. Running without Redis cache.", err)
		return nil
	}
	log.Println("Redis подключена (для real-time данных)")
	return rdb
}

func main() {
	db := initDB()
	rdb := initRedis()
	hub = newHub(db, rdb)
	go hub.run()

	// Раздача статических файлов клиента
	fs := http.FileServer(http.Dir("../client"))
	http.Handle("/", fs)

	http.HandleFunc("/ws", handleConnections)
	http.HandleFunc("/api/auth/login", handleLoginProxy)
	log.Println("Meta Server запущен на :3000")
	log.Fatal(http.ListenAndServe(":3000", nil))
}
