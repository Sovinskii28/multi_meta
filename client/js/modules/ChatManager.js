export class ChatManager {
    constructor(networkManager, myID) {
        this.nm = networkManager;
        this.myID = myID;
        this.createUI();
        this.setupListeners();
    }

    createUI() {
        this.container = document.createElement('div');
        this.container.className = 'chat-container';

        this.messagesArea = document.createElement('div');
        this.messagesArea.className = 'chat-messages';

        this.inputWrapper = document.createElement('div');
        this.inputWrapper.className = 'chat-input-wrapper';

        this.input = document.createElement('input');
        this.input.className = 'chat-input';
        this.input.placeholder = 'Нажмите Enter, чтобы написать...';
        this.input.maxLength = 100;

        this.inputWrapper.appendChild(this.input);
        this.container.appendChild(this.messagesArea);
        this.container.appendChild(this.inputWrapper);
        document.body.appendChild(this.container);
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Enter') {
                if (document.activeElement === this.input) {
                    this.sendMessage();
                } else {
                    this.input.focus();
                }
            }
        });
    }

    sendMessage() {
        const text = this.input.value.trim();
        if (text) {
            // Отправляем через NetworkManager
            this.nm.sendChat(text);

            // Показываем у себя
            this.addMessage("Я", text);
            this.showBubble(this.nm.em.myPlayer, text);

            this.input.value = '';
            this.input.blur();
        } else {
            this.input.blur();
        }
    }

    addMessage(sender, text) {
        // Ограничение количества сообщений (для оптимизации DOM)
        if (this.messagesArea.children.length > 50) {
            this.messagesArea.removeChild(this.messagesArea.firstChild);
        }

        const msgEl = document.createElement('div');
        msgEl.className = 'chat-message';

        const senderSpan = document.createElement('span');
        senderSpan.className = 'sender';
        senderSpan.textContent = sender + ":";

        const textSpan = document.createElement('span');
        textSpan.className = 'text';
        textSpan.textContent = text;

        msgEl.appendChild(senderSpan);
        msgEl.appendChild(textSpan);

        this.messagesArea.appendChild(msgEl);

        // Оптимизированный скролл
        requestAnimationFrame(() => {
            this.messagesArea.scrollTo({
                top: this.messagesArea.scrollHeight,
                behavior: 'smooth'
            });
        });

        // Удаляем старые сообщения через время (визуально)
        setTimeout(() => {
            msgEl.classList.add('fading');
            setTimeout(() => {
                if (msgEl.parentNode) msgEl.remove();
            }, 500);
        }, 8000);
    }

    showBubble(player, text) {
        if (player) player.showSpeechBubble(text);
    }
}
