package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type PlayerData struct {
	ID string  `json:"id"`
	X  float32 `json:"x"`
	Z  float32 `json:"z"`
}

var (
	clients = make(map[*websocket.Conn]string)
	mu      sync.Mutex
)

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer ws.Close()

	for {
		_, msg, err := ws.ReadMessage()
		if err != nil {
			mu.Lock()
			delete(clients, ws)
			mu.Unlock()
			break
		}

		// Рассылка всем, кроме отправителя
		mu.Lock()
		for client := range clients {
			if client != ws {
				client.WriteMessage(websocket.TextMessage, msg)
			}
		}
		clients[ws] = "active"
		mu.Unlock()
	}
}

func main() {
	http.HandleFunc("/ws", handleConnections)
	log.Println("Go Server запущен на :3000")
	log.Fatal(http.ListenAndServe(":3000", nil))
}
