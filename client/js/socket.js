let socket;

export function setupSocket(myID, onMessageReceived) {
    // Если используете ngrok, укажите домен здесь (без http://)
    const externalHost = null;

    const host = externalHost || window.location.host;
    let protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Если используем туннель, принудительно ставим wss (безопасное соединение)
    if (externalHost) protocol = 'wss:';

    let finalHost = host;
    if (finalHost.includes('localhost') && !finalHost.includes(':3000')) {
        finalHost = 'localhost:3000';
    }

    socket = new WebSocket(`${protocol}//${finalHost}/ws`);

    socket.onopen = () => {
        console.log("Соединение установлено");
        // Отправляем серверу сигнал, что мы вошли
        socket.send(JSON.stringify({ type: 'join', id: myID }));
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (onMessageReceived) onMessageReceived(data);
        } catch (e) {
            console.error("Ошибка парсинга сообщения:", e);
        }
    };
}

export function sendMove(id, x, z, ry, action = null, type = 'move', text = null) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, id, x, z, ry, action, text }));
    }
}