const keys = {};
window.onkeydown = (e) => keys[e.code] = true;
window.onkeyup = (e) => keys[e.code] = false;

import * as THREE from 'three';

export function updateInput(player, camera) {
    let moved = false;
    const speed = 0.04;
    const limit = 18.5;

    // 1. Получаем направление, куда смотрит камера
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    // Нам нужно движение только по горизонтали (X и Z)
    direction.y = 0;
    direction.normalize();

    // Вектор "вправо" (теперь считаем корректно)
    const side = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0));

    if (keys['KeyW']) {
        player.position.addScaledVector(direction, speed);
        moved = true;
    }
    if (keys['KeyS']) {
        player.position.addScaledVector(direction, -speed);
        moved = true;
    }
    // Поменяли знаки здесь:
    if (keys['KeyA']) {
        player.position.addScaledVector(side, -speed); // Было -speed
        moved = true;
    }
    if (keys['KeyD']) {
        player.position.addScaledVector(side, +speed); // Было speed
        moved = true;
    }
//     // Если мы двигаемся, поворачиваем модель лицом по вектору движения
//     if (moved) {
//     // В main.js мы должны будем передать модель в эту функцию или вращать куб
//     player.rotation.y = Math.atan2(direction.x, direction.z);
// }
    // 4. Ограничение перемещения (чтобы не убежать за 20x20)
    player.position.x = Math.max(-limit, Math.min(limit, player.position.x));
    player.position.z = Math.max(-limit, Math.min(limit, player.position.z));

    return moved;
}