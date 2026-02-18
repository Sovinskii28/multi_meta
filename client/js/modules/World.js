import * as THREE from 'three';
import { StaticObject } from './StaticObject.js';
import { MAP_OBJECTS } from './worldObjectConfig.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.collisionObjects = [];
        this.init();
    }

    init() {
        // Свет
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
        sunLight.position.set(6, 15, 7);
        sunLight.castShadow = true;
        // Настройка области теней (чтобы они не обрезались рядом с игроком)
            sunLight.shadow.camera.left = -20;
            sunLight.shadow.camera.right = 20;
            sunLight.shadow.camera.top = 20;
            sunLight.shadow.camera.bottom = -20;
            sunLight.shadow.mapSize.set(2048, 2048); // Качество теней
        this.scene.add(sunLight);

        // Земля
        const textureLoader = new THREE.TextureLoader();
        const grassTexture = textureLoader.load('./assets/grass.jpg');
        grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
        grassTexture.repeat.set(8, 8);

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(40, 40),
            new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 0.8 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        //Дома обхекты и тд
        MAP_OBJECTS.forEach(obj => {
            const staticObj = new StaticObject(
                this.scene, 
                obj.model, 
                obj.pos, 
                obj.scale,
                obj.rotation
            );
            // Сохраняем для будущих коллизий
            this.collisionObjects.push(staticObj);
        });

        // Небо (цвет фона)
        this.scene.background = new THREE.Color(0x87ceeb);
    }
}