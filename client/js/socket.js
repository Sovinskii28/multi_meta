let socket;

export function setupSocket(myID, onMessageReceived) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

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