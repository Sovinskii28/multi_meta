let socket;

export function setupSocket(myID, onMessageReceived) {
    // Подключаемся к серверу
    socket = new WebSocket(`ws://${window.location.hostname}:3000/ws`);

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