export class InventoryUI {
    constructor() {
        this.isOpen = false;
        this.createUI();
        this.setupListeners();
    }

    createUI() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'inventory-overlay';

        const window = document.createElement('div');
        window.className = 'inventory-window';

        const header = document.createElement('div');
        header.className = 'inventory-header';

        const title = document.createElement('div');
        title.className = 'inventory-title';
        title.textContent = 'ИНВЕНТАРЬ';

        header.appendChild(title);
        window.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'inventory-grid';

        const items = [
            { name: 'Меч Правосудия', icon: '⚔️', count: 1 },
            { name: 'Зелье Маны', icon: '🧪', count: 5 },
            { name: 'Древний Свиток', icon: '📜', count: 2 },
            { name: 'Золотая Монета', icon: '🪙', count: 120 },
            { name: 'Лечебная Трава', icon: '🌿', count: 4 }
        ];

        // Create 20 slots
        for (let i = 0; i < 20; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.index = i;

            if (items[i]) {
                const icon = document.createElement('div');
                icon.className = 'item-icon';
                icon.style.display = 'flex';
                icon.style.justifyContent = 'center';
                icon.style.alignItems = 'center';
                icon.style.fontSize = '32px';
                icon.textContent = items[i].icon;
                slot.appendChild(icon);

                if (items[i].count > 1) {
                    const count = document.createElement('div');
                    count.className = 'item-count';
                    count.textContent = items[i].count;
                    slot.appendChild(count);
                }

                slot.title = items[i].name;
            }
            grid.appendChild(slot);
        }

        window.appendChild(grid);

        const hint = document.createElement('div');
        hint.className = 'close-hint';
        hint.textContent = 'Нажмите [ I ], чтобы закрыть';
        window.appendChild(hint);

        this.overlay.appendChild(window);
        document.body.appendChild(this.overlay);
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyI') {
                this.toggle();
            }
        });

        // Close on clicking overlay (outside window)
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.overlay.classList.add('active');
        // If OrbitControls are active, we might want to disable them
        // But for now, just the visual part
    }

    close() {
        this.isOpen = false;
        this.overlay.classList.remove('active');
    }
}
