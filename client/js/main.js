import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupSocket, sendMove } from './socket.js';
import { updateInput } from './controls.js';

// --- 1. НАСТРОЙКИ И ПЕРЕМЕННЫЕ ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const loader = new GLTFLoader();
const clock = new THREE.Clock();
const otherPlayers = {}; 
const myID = "user_" + Math.floor(Math.random() * 1000);

let characterModel = null;
let mixer = null;
let lastUpdateTime = 0;
const updateInterval = 50; 

let actions = {}; // Здесь будем хранить Idle и Walk
let activeAction = null;

let isLocked = false;

// --- 2. КОНТРОЛЛЕРЫ И СВЕТ ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
sunLight.position.set(5, 10, 7);
scene.add(sunLight);

// --- 3. ОБЪЕКТЫ МИРА ---

// 1. Создаем загрузчик текстур
const textureLoader = new THREE.TextureLoader();

// 2. Загружаем текстуру травы (убедись, что файл grass.jpg лежит в папке assets)
const grassTexture = textureLoader.load('./assets/grass.jpg');

// 3. Настраиваем "тайлинг" (повторение)
grassTexture.wrapS = THREE.RepeatWrapping; // Повторение по горизонтали
grassTexture.wrapT = THREE.RepeatWrapping; // Повторение по вертикали
grassTexture.repeat.set(8, 8); // Сколько раз текстура повторится на 40 метрах

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ 
        map: grassTexture, // Накладываем саму картинку
        roughness: 0.8     // Делаем траву матовой, чтобы она не бликовала как лед
    })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true; // Чтобы персонаж отбрасывал тень на траву
scene.add(ground);

// Твой невидимый куб-коллайдер остается без изменений
const myPlayer = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0 }) 
);
myPlayer.position.y = 0.25;
scene.add(myPlayer);

const lastPlayerPosition = new THREE.Vector3().copy(myPlayer.position);
// --- 4. ФУНКЦИИ ОЧИСТКИ И СЕТИ ---

function removePlayer(id) {
    const player = otherPlayers[id];
    if (player) {
        player.traverse((node) => {
            if (node.isMesh) {
                node.geometry.dispose();
                if (Array.isArray(node.material)) {
                    node.material.forEach(m => m.dispose());
                } else {
                    node.material.dispose();
                }
            }
        });
        scene.remove(player);
        delete otherPlayers[id];
    }
}

setupSocket(myID, (data) => {
    if (data.id === myID) return;
    if (data.type === 'leave') {
        removePlayer(data.id);
        return;
    }

    if (!otherPlayers[data.id]) {
        const playerGroup = new THREE.Group();
        scene.add(playerGroup);
        otherPlayers[data.id] = playerGroup;

        if (characterModel) {
            playerGroup.add(characterModel.clone());
        } else {
            const placeholder = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, 1.8, 0.8),
                new THREE.MeshStandardMaterial({ color: 0xff0000 })
            );
            placeholder.position.y = 0.9;
            placeholder.name = "placeholder"; 
            playerGroup.add(placeholder);
        }
    }

    const target = otherPlayers[data.id];
    if (target && data.x !== undefined && data.z !== undefined) {
        target.position.set(data.x, 0, data.z);
        
        const placeholder = target.getObjectByName("placeholder");
        if (placeholder && characterModel) {
            target.remove(placeholder);
            target.add(characterModel.clone());
        }
    }
});

// --- 5. ЗАГРУЗКА МОДЕЛИ И ОТДЕЛЬНОЙ АНИМАЦИИ ---
// Сначала грузим "Тело"
loader.load('./assets/character2.glb', (gltf) => {
    characterModel = gltf.scene;

    const box = new THREE.Box3().setFromObject(characterModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 0.3 / size.y;    
    characterModel.scale.set(scale, scale, scale);

    characterModel.traverse((obj) => {
        if (obj.isMesh) {
            obj.position.x -= center.x;
            obj.position.z -= center.z;
            obj.position.y -= box.min.y;
        }
    });

    scene.add(characterModel);

    // Создаем один миксер для модели
    mixer = new THREE.AnimationMixer(characterModel);

    // Вспомогательная функция для загрузки анимаций в объект actions
    const loadAnim = (name, path) => {
        loader.load(path, (animGltf) => {
            if (animGltf.animations.length > 0) {
                const clip = animGltf.animations[0];
                const action = mixer.clipAction(clip);
                actions[name] = action;

                // Если загрузили idle, сразу его запускаем
                if (name === 'idle') {
                    action.play();
                    activeAction = action;
                    console.log("Анимация Idle готова");
                }
            }
        });
    };

    // Загружаем файлы по отдельности
    loadAnim('idle', './assets/com_idle.glb');
    loadAnim('walk', './assets/walk.glb');
    loadAnim('praying', './assets/praying.glb');
    loadAnim('jump', './assets/jump.glb');
});
    // 2. Функция для плавного перехода (добавь её вне loader.load)
    function fadeToAction(name, duration = 0.2) {
        const nextAction = actions[name];
        if (nextAction && nextAction !== activeAction) {
            // Плавно выключаем текущую и включаем следующую
            if (activeAction) activeAction.fadeOut(duration);
            nextAction
                .reset()
                .setEffectiveTimeScale(1)
                .setEffectiveWeight(1)
                .fadeIn(duration)
                .play();
            activeAction = nextAction;
        }
    }
function playActionOnce(name) {
    const action = actions[name];
    if (action && !isLocked) {
        isLocked = true; // Ставим замок
        
        action.reset();
        action.setLoop(THREE.LoopOnce);
        action.clampWhenFinished = true;
        
        fadeToAction(name, 0.2);

        // Слушаем окончание
        const onFinished = (e) => {
            if (e.action === action) {
                mixer.removeEventListener('finished', onFinished);
                isLocked = false; // Снимаем замок
                fadeToAction('idle', 0.5);
                console.log("Анимация завершена, замок снят");
            }
        };
        mixer.addEventListener('finished', onFinished);
    }
}

// --- 6. ЦИКЛ АНИМАЦИИ ---
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const now = Date.now();

    // 1. Проверяем, движется ли персонаж
    const isMoving = updateInput(myPlayer, camera);

// 2. Управление анимациями (только если нет замка)
    if (!isLocked) {
        if (isMoving) {
            fadeToAction('walk');
        } else {
            fadeToAction('idle');
        }
    }

    // 3. Логика перемещения и сети (работает всегда, независимо от анимации)
    if (isMoving) {
        if (now - lastUpdateTime > updateInterval) {
            sendMove(myID, myPlayer.position.x, myPlayer.position.z);
            lastUpdateTime = now;
        }

        if (characterModel) {
            const moveDir = new THREE.Vector3().subVectors(myPlayer.position, lastPlayerPosition).normalize();
            if (moveDir.length() > 0.01) {
                characterModel.rotation.y = Math.atan2(moveDir.x, moveDir.z);
            }
        }
    }

    // 4. Привязка модели и камеры
    if (characterModel) {
        characterModel.position.set(myPlayer.position.x, 0, myPlayer.position.z);
    }

    const delta = new THREE.Vector3().subVectors(myPlayer.position, lastPlayerPosition);
    camera.position.add(delta);
    // 3. ФОКУС: Игнорируем высоту куба (0.25) и смотрим на уровень головы модели
    // Обычно рост персонажа около 1.5 - 1.8 единиц.
    const lookAtHeight = 1.8; // Настрой это число под свой вкус

    controls.target.set(
        myPlayer.position.x, 
        lookAtHeight, // Фиксированная высота взгляда над землей
        myPlayer.position.z
    );

    lastPlayerPosition.copy(myPlayer.position);

    // 5. Обновление миксера и рендер
    if (mixer) mixer.update(dt);
    
    controls.update();
    renderer.render(scene, camera);
}
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        // Если прыжок загружен
        if (actions['jump']) playActionOnce('jump');
    }
    if (e.code === 'KeyG') {
        // Если анимация praying загружена
        if (actions['praying']) playActionOnce('praying');
    }
});
animate()

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});