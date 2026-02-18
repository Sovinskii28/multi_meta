import { Engine } from './Engine/Engine.js';
import { Auth } from './modules/Auth.js';

const auth = new Auth();
const overlay = document.getElementById('auth-overlay');
const form = document.getElementById('auth-form');
const errorEl = document.getElementById('auth-error');
const button = document.getElementById('login-button');

async function startApp() {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const login = document.getElementById('login').value;
        const password = document.getElementById('password').value;

        button.disabled = true;
        button.textContent = 'Входим...';
        errorEl.classList.remove('visible');

        try {
            await auth.login(login, password);

            // Скрываем оверлей
            overlay.classList.add('hidden');

            // Запуск движка с данными пользователя
            const game = new Engine(auth.userData.username);
            console.log("Движок запущен для пользователя:", auth.userData.username);

        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.classList.add('visible');
            button.disabled = false;
            button.textContent = 'Войти в мир';
        }
    });
}

startApp();