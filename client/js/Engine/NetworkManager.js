import * as THREE from 'three';
import { setupSocket, sendMove } from '../socket.js';

export class NetworkManager {
    constructor(entityManager, myID) {
        this.em = entityManager;
        this.myID = myID;
        this.lastSentPos = new THREE.Vector3();
        this.lastSentRy = 0;
        this.lastSentAction = 'idle';

        setupSocket(this.myID, (data) => {
            if (data.id === this.myID) return;

            if (data.type === 'leave') {
                this.em.removeRemote(data.id);
                return;
            }

            if (data.type === 'chat') {
                const p = this.em.otherPlayers[data.id];
                if (p) {
                    p.showSpeechBubble(data.text);
                    if (this.onChatReceived) this.onChatReceived(data.id, data.text);
                }
                return;
            }

            // Добавляем игрока, если его еще нет
            this.em.addRemote(data.id);
            const p = this.em.otherPlayers[data.id];

            // Если в сообщении есть координаты, обновляем положение
            if (data.x !== undefined && data.z !== undefined) {
                if (!p.targetPosition) p.targetPosition = new THREE.Vector3();
                p.targetPosition.set(data.x, 0, data.z);
                p.targetRotationY = data.ry;
            }

            // Синхронизируем анимации
            if (data.action) {
                if (data.action === 'jump' || data.action === 'praying') {
                    p.playActionOnce(data.action);
                } else {
                    p.fadeToAction(data.action);
                }
            }
        });
    }

    sendChat(text) {
        sendMove(this.myID, 0, 0, 0, null, 'chat', text);
    }

    sendUpdate(myPlayer) {
        const ry = myPlayer.model ? myPlayer.model.rotation.y : 0;
        let action = 'idle';

        if (myPlayer.activeAction) {
            for (let name in myPlayer.actions) {
                if (myPlayer.actions[name] === myPlayer.activeAction) {
                    action = name;
                    break;
                }
            }
        }

        // Оптимизация: отправляем только если есть изменения
        const posChanged = this.lastSentPos.distanceTo(myPlayer.collider.position) > 0.01;
        const ryChanged = Math.abs(this.lastSentRy - ry) > 0.01;
        const actionChanged = this.lastSentAction !== action;

        if (posChanged || ryChanged || actionChanged) {
            sendMove(this.myID, myPlayer.collider.position.x, myPlayer.collider.position.z, ry, action);
            this.lastSentPos.copy(myPlayer.collider.position);
            this.lastSentRy = ry;
            this.lastSentAction = action;
        }
    }
}