import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export class Player {
    constructor(scene, nickname = "Игрок", isMe = true) {
        this.isMe = isMe;
        this.nickname = nickname;
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.model = null;
        this.mixer = null;
        this.actions = {};
        this.activeAction = null;
        this.isLocked = false;

        // Невидимый коллайдер
        this.collider = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.3, 0.3),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
        );
        this.collider.position.y = 0.25;
        this.scene.add(this.collider);
        this.createLabel();
        this.init();
    }

    async init() {
        // Загрузка тела
        const gltf = await this.loader.loadAsync('./assets/character/character2.glb');
        this.model = gltf.scene;

        // Авто-центрирование и масштабирование
        const box = new THREE.Box3().setFromObject(this.model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 0.3 / size.y;
        this.model.scale.set(scale, scale, scale);

        this.model.traverse(obj => {
            if (obj.isMesh) {
                obj.position.x -= center.x;
                obj.position.z -= center.z;
                obj.position.y -= box.min.y;
            }
        });
        this.model.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;     // Персонаж отбрасывает тень
                node.receiveShadow = true;  // Персонаж принимает тени
            }
        });

        this.scene.add(this.model);
        this.mixer = new THREE.AnimationMixer(this.model);

        // Загрузка анимаций
        await Promise.all([
            this.loadAnim('idle', './assets/anim/com_idle.glb'),
            this.loadAnim('walk', './assets/anim/walk.glb'),
            this.loadAnim('praying', './assets/anim/praying.glb'),
            this.loadAnim('jump', './assets/anim/jump.glb')
        ]);

        if (this.actions['idle']) {
            this.actions['idle'].play();
            this.activeAction = this.actions['idle'];
        }
    }

    async loadAnim(name, path) {
        const animGltf = await this.loader.loadAsync(path);
        if (animGltf.animations.length > 0) {
            this.actions[name] = this.mixer.clipAction(animGltf.animations[0]);
        }
    }

    fadeToAction(name, duration = 0.2) {
        const nextAction = this.actions[name];
        if (nextAction && nextAction !== this.activeAction) {
            if (this.activeAction) this.activeAction.fadeOut(duration);
            nextAction.reset().fadeIn(duration).play();
            this.activeAction = nextAction;
        }
    }

    playActionOnce(name) {
        const action = this.actions[name];
        if (action) {
            this.isLocked = true;

            if (name === 'jump') {
                const jumpDir = new THREE.Vector3(0, 0, 1);
                jumpDir.applyQuaternion(this.model.quaternion);
                this.jumpVelocity = jumpDir.multiplyScalar(0.06);
            }

            this.mixer.stopAllAction();
            action.reset().setLoop(THREE.LoopOnce, 1).play();
            action.clampWhenFinished = true;

            const onFinished = (e) => {
                if (e.action === action) {
                    this.mixer.removeEventListener('finished', onFinished);
                    this.isLocked = false;
                    this.jumpVelocity = null;
                    this.fadeToAction('idle', 0.5);
                }
            };
            this.mixer.addEventListener('finished', onFinished);
        }
    }

    createLabel() {
        const div = document.createElement('div');
        div.className = 'player-label';
        div.textContent = this.nickname;

        div.style.color = 'white';
        div.style.background = 'rgba(0, 0, 0, 0.6)';
        div.style.padding = '2px 8px';
        div.style.borderRadius = '4px';
        div.style.fontSize = '20px';
        div.style.fontWeight = 'bold';
        div.style.pointerEvents = 'none';

        this.label = new CSS2DObject(div);
        this.label.position.set(0, 2, 0);
        this.collider.add(this.label);
    }

    canMove() {
        return !this.isLocked;
    }

    update(dt) {
        if (this.mixer) this.mixer.update(dt);

        if (this.model && this.collider) {
            this.model.position.set(
                this.collider.position.x,
                0,
                this.collider.position.z
            );
        }
    }

    showSpeechBubble(text) {
        // Удаляем старый баббл если есть
        if (this.currentBubble) {
            const oldBubble = this.currentBubble;
            this.collider.remove(oldBubble);
            if (oldBubble.element) oldBubble.element.remove();
            this.currentBubble = null;
        }

        const div = document.createElement('div');
        div.className = 'speech-bubble';
        div.textContent = text;

        const bubble = new CSS2DObject(div);
        bubble.position.set(0, 2.8, 0);
        this.collider.add(bubble);
        this.currentBubble = bubble;

        // Ждем два кадра, чтобы CSS2DRenderer успел проставить transform
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this.currentBubble === bubble) {
                    div.classList.add('visible');
                }
            });
        });

        // Плавное удаление через 5 сек
        const clearTimer = setTimeout(() => {
            if (this.currentBubble === bubble) {
                div.classList.remove('visible');
                div.style.transform = 'scale(0.8) translateY(10px)';

                setTimeout(() => {
                    if (this.currentBubble === bubble) {
                        this.collider.remove(bubble);
                        div.remove();
                        this.currentBubble = null;
                    }
                }, 500);
            }
        }, 5000);
    }

    destroy() {
        if (this.model) this.scene.remove(this.model);
        if (this.collider) {
            this.collider.remove(this.label);
            this.scene.remove(this.collider);
        }
        if (this.label && this.label.element) {
            this.label.element.remove();
        }
    }
}