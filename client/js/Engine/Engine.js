import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { EntityManager } from './EntityManager.js';
import { NetworkManager } from './NetworkManager.js';
import { World } from '../modules/World.js';
import { InventoryUI } from '../modules/InventoryUI.js';
import { ChatManager } from '../modules/ChatManager.js';

export class Engine {
    constructor(playerLogin = null) {
        this.myID = playerLogin || "user_" + Math.floor(Math.random() * 10000);
        this.clock = new THREE.Clock();
        this.lastNetworkUpdate = 0;

        this.sm = new SceneManager();
        this.world = new World(this.sm.scene);
        this.em = new EntityManager(this.sm.scene, this.myID);
        this.nm = new NetworkManager(this.em, this.myID);
        this.inventory = new InventoryUI();
        this.chat = new ChatManager(this.nm, this.myID);

        this.nm.onChatReceived = (id, text) => {
            const senderName = "Игрок " + id.slice(-3);
            this.chat.addMessage(senderName, text);
        };

        this.animate();
    }


    update() {
        const dt = this.clock.getDelta();
        const now = performance.now();

        const lastPos = this.em.myPlayer.collider.position.clone();

        // Обновляем позицию и поворот игрока
        this.em.update(dt, this.sm.camera);

        // Двигаем камеру вслед за перемещением коллайдера
        const deltaMove = new THREE.Vector3().subVectors(this.em.myPlayer.collider.position, lastPos);
        this.sm.camera.position.add(deltaMove);

        // Центрируем взгляд OrbitControls на голове
        this.sm.controls.target.set(
            this.em.myPlayer.collider.position.x,
            1.8,
            this.em.myPlayer.collider.position.z
        );

        this.sm.controls.update();

        if (this.inventory.isOpen || document.activeElement === this.chat.input) return;

        // Отправляем обновление на сервер (20 раз в секунду)
        if (now - this.lastNetworkUpdate > 50) {
            this.nm.sendUpdate(this.em.myPlayer);
            this.lastNetworkUpdate = now;
        }
    }
    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
        this.sm.render();
    }
}