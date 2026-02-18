import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class StaticObject {
    constructor(scene, path, position, scale = 1, rotation = 0) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.path = path;
        this.position = position;
        this.scale = scale;
        this.rotation = rotation;
        this.model = null;

        this.init();
    }

    async init() {
        const gltf = await this.loader.loadAsync(this.path);
        this.model = gltf.scene;
        
        this.model.position.set(this.position.x, this.position.y, this.position.z);
        this.model.scale.set(this.scale, this.scale, this.scale);
        this.model.rotation.y = this.rotation;

        this.model.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        this.scene.add(this.model);
    }
}   