import * as THREE from 'three';
import { Player } from '../modules/Player.js';
import { updateInput } from '../controls.js';

// Вспомогательная функция для плавного вращения углов
function lerpAngle(start, end, t) {
    let d = end - start;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return start + d * t;
}

export class EntityManager {
    constructor(scene, myNickname = "Я") {
        this.scene = scene;
        this.myPlayer = new Player(scene, myNickname, true);
        this.otherPlayers = {};
        this.moveDir = new THREE.Vector3(); // Вектор для расчета направления
    }

    update(dt, camera) {
        // 1. Свой игрок
        const startPos = this.myPlayer.collider.position.clone();
        const isMoving = this.myPlayer.canMove() ? updateInput(this.myPlayer.collider, camera) : false;

        if (this.myPlayer.model && !this.myPlayer.isLocked) {
            if (isMoving) {
                this.myPlayer.fadeToAction('walk', 0.2);

                // Расчет направления движения для поворота
                this.moveDir.subVectors(this.myPlayer.collider.position, startPos);

                if (this.moveDir.lengthSq() > 0.00001) {
                    const targetAngle = Math.atan2(this.moveDir.x, this.moveDir.z);
                    // Заменяем сломанный THREE.MathUtils.lerpAngle на нашу функцию
                    this.myPlayer.model.rotation.y = lerpAngle(
                        this.myPlayer.model.rotation.y,
                        targetAngle,
                        0.15
                    );
                }
            } else {
                this.myPlayer.fadeToAction('idle', 0.5);
            }
        }

        // Обновляем миксер анимаций
        this.myPlayer.update(dt);

        // 2. Другие игроки (Сетевая часть)
        for (let id in this.otherPlayers) {
            const p = this.otherPlayers[id];
            if (p.targetPosition) {
                const dist = p.collider.position.distanceTo(p.targetPosition);
                p.collider.position.lerp(p.targetPosition, 0.15);

                // Автоматическая анимация ходьбы только если игрок не занят спец. действием
                if (p.canMove()) {
                    if (dist > 0.05) p.fadeToAction('walk', 0.2);
                    else p.fadeToAction('idle', 0.5);
                }
            }
            if (p.model && p.targetRotationY !== undefined) {
                // Здесь тоже меняем на исправленную функцию
                p.model.rotation.y = lerpAngle(p.model.rotation.y, p.targetRotationY, 0.15);
            }
            p.update(dt);
        }
    }

    addRemote(id) {
        if (!this.otherPlayers[id]) {
            this.otherPlayers[id] = new Player(this.scene, "Игрок " + id.slice(-3), false);
        }
    }

    removeRemote(id) {
        const p = this.otherPlayers[id];
        if (p) {
            p.destroy();
            delete this.otherPlayers[id];
        }
    }
}