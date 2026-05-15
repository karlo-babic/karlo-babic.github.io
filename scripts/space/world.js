import * as THREE from 'three';

// Screen dimensions in 3D metres — must match iframe + scale in space.js
export const SCREEN_W = 2.4;
export const SCREEN_H = 1.5; // 1280 × 800 iframe at scale 2.4/1280

export function buildWorld(scene) {
    addLighting(scene);
    addRoom(scene);
    const screen = addScreenHole(scene);
    addPedestal(scene);
    return { screen };
}

function addLighting(scene) {
    scene.add(new THREE.AmbientLight(0x303050, 0.8));

    const ceiling = new THREE.PointLight(0xfff0e0, 1.4, 7);
    ceiling.position.set(0, 2.85, 0);
    scene.add(ceiling);

    const screenGlow = new THREE.PointLight(0x50c0f0, 0.9, 4.5);
    screenGlow.position.set(0, 1.5, -1.4);
    scene.add(screenGlow);

    const pedestalGlow = new THREE.PointLight(0x50c0f0, 1.2, 2.5);
    pedestalGlow.position.set(0, 1.1, -0.2);
    scene.add(pedestalGlow);
}

function addRoom(scene) {
    // Multi-material box: index 3 = -Y face (floor), all others = walls/ceiling.
    // Single mesh eliminates Z-fighting between a separate floor plane and the box bottom face.
    const wallMat  = new THREE.MeshLambertMaterial({ color: 0x3a3a50, side: THREE.BackSide });
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x252535, side: THREE.BackSide });

    const room = new THREE.Mesh(
        new THREE.BoxGeometry(4, 3, 4),
        // BoxGeometry face order: +x, -x, +y, -y, +z, -z
        [wallMat, wallMat, wallMat, floorMat, wallMat, wallMat]
    );
    room.position.set(0, 1.5, 0);
    scene.add(room);
}

function addScreenHole(scene) {
    // Bezel/frame sits on the wall
    const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(SCREEN_W + 0.14, SCREEN_H + 0.12),
        new THREE.MeshBasicMaterial({ color: 0x1a1a2a })
    );
    frame.position.set(0, 1.5, -1.998);
    scene.add(frame);

    // Transparent punch-through: blending:NoBlending writes alpha=0 to the WebGL canvas,
    // revealing the CSS3DRenderer iframe that sits behind the WebGL canvas in the DOM.
    const screenHole = new THREE.Mesh(
        new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
        new THREE.MeshBasicMaterial({
            color: 0x000000,
            opacity: 0,
            transparent: true,
            depthWrite: true,
            blending: THREE.NoBlending,
        })
    );
    screenHole.position.set(0, 1.5, -1.995);
    screenHole.userData.isScreen = true;
    scene.add(screenHole);

    return screenHole;
}

function addPedestal(scene) {
    const group = new THREE.Group();

    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.28, 0.07, 20),
        new THREE.MeshLambertMaterial({ color: 0x303048 })
    );
    base.position.set(0, 0.035, 0);
    group.add(base);

    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.12, 0.78, 16),
        new THREE.MeshLambertMaterial({ color: 0x282840 })
    );
    stem.position.set(0, 0.46, 0);
    group.add(stem);

    const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.19, 0.03, 24),
        new THREE.MeshBasicMaterial({ color: 0x50c0f0 })
    );
    cap.position.set(0, 0.865, 0);
    group.add(cap);

    group.position.set(0, 0, -0.2);
    scene.add(group);
}
