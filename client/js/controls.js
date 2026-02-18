const keys = {};
window.onkeydown = (e) => keys[e.code] = true;
window.onkeyup = (e) => keys[e.code] = false;

import * as THREE from 'three';

const _direction = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function updateInput(player, camera) {
    let moved = false;
    const speed = 0.04;
    const limit = 18.5;

    // Получаем направление, куда смотрит камера
    camera.getWorldDirection(_direction);
    _direction.y = 0;
    _direction.normalize();

    // Вектор "вправо"
    _side.crossVectors(_direction, _up);

    if (keys['KeyW']) {
        player.position.addScaledVector(_direction, speed);
        moved = true;
    }
    if (keys['KeyS']) {
        player.position.addScaledVector(_direction, -speed);
        moved = true;
    }
    if (keys['KeyA']) {
        player.position.addScaledVector(_side, -speed);
        moved = true;
    }
    if (keys['KeyD']) {
        player.position.addScaledVector(_side, +speed);
        moved = true;
    }

    // Ограничение перемещения
    player.position.x = Math.max(-limit, Math.min(limit, player.position.x));
    player.position.z = Math.max(-limit, Math.min(limit, player.position.z));

    return moved;
}