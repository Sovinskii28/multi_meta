export class Auth {
    constructor() {
        this.baseUrl = `http://${window.location.hostname}:3000/api`;
        this.token = localStorage.getItem('auth_token');
        this.userData = JSON.parse(localStorage.getItem('user_data')) || null;
    }

    async login(login, password) {
        try {
            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username_or_email: login, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || 'Ошибка входа');
            }

            const data = await response.json();
            this.token = data.token;
            this.userData = data.user || { login };

            // Сохраняем данные
            localStorage.setItem('auth_token', this.token);
            localStorage.setItem('user_data', JSON.stringify(this.userData));

            return data;
        } catch (error) {
            console.error('Login error detail:', error);
            throw error;
        }
    }

    isAuthenticated() {
        return !!this.token;
    }

    logout() {
        this.token = null;
        this.userData = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
    }

    getHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }
}
