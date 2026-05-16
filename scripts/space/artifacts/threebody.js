import * as THREE from 'three';

const NUM_BODIES = 4;
const G = 10;
const SIM_SPEED = 1;
const MAX_FORCE = 10000;
// Maps sim-space units (same scale as the 2D version) to Three.js world metres.
// 15 sim units → 0.15 m initial body separation above the pedestal.
const SIM_SCALE = 0.01;
const TRAIL_LENGTH = 200;

// Vertical offset above the pedestal cap — orbital centre floats above the surface
const HOVER_HEIGHT = 0.35;

const COLORS  = [0x50c0f0, 0xf0f0e0, 0xff8844, 0xfff080];
const RADII   = [0.012,   0.025,   0.025,   0.025  ];
const MASSES  = [50,      1000,    1000,    1000   ];

let _scene, _anchor;
let bodies, velBuf, posBuf;
let meshes, trailGeos, trailData, sceneObjects;

function _reset() {
    bodies = null; velBuf = null; posBuf = null;
    meshes = []; trailGeos = []; trailData = []; sceneObjects = [];
}
_reset();

export default {
    init(scene, anchor) {
        _scene  = scene;
        _anchor = anchor.clone();
        _anchor.y += HOVER_HEIGHT;

        // --- physics bodies ---
        bodies = MASSES.map(mass => ({
            pos: new THREE.Vector3(),
            vel: new THREE.Vector3(),
            mass,
        }));

        // Large bodies start in an equilateral triangle in the XZ plane
        const R = 15;
        bodies[1].pos.set(-R,        0,  0);
        bodies[2].pos.set( R * 0.5,  0,  R * 0.866);
        bodies[3].pos.set( R * 0.5,  0, -R * 0.866);
        // Small body gets a small random offset
        bodies[0].pos.set(
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 8,
        );

        // Random velocities for bodies 0–2; body 3 cancels total momentum
        const VR = 30;
        for (let i = 0; i < 3; i++) {
            bodies[i].vel.set(
                (Math.random() - 0.5) * VR,
                (Math.random() - 0.5) * VR,
                (Math.random() - 0.5) * VR,
            );
        }
        let px = 0, py = 0, pz = 0;
        for (let i = 0; i < 3; i++) {
            px += bodies[i].mass * bodies[i].vel.x;
            py += bodies[i].mass * bodies[i].vel.y;
            pz += bodies[i].mass * bodies[i].vel.z;
        }
        bodies[3].vel.set(-px / MASSES[3], -py / MASSES[3], -pz / MASSES[3]);

        // Pre-allocate per-frame physics buffers (avoids GC pressure)
        velBuf = bodies.map(() => new THREE.Vector3());
        posBuf = bodies.map(() => new THREE.Vector3());

        // --- Three.js objects ---
        for (let i = 0; i < NUM_BODIES; i++) {
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(RADII[i], 12, 8),
                new THREE.MeshBasicMaterial({ color: COLORS[i] }),
            );
            _scene.add(mesh);
            meshes.push(mesh);
            sceneObjects.push(mesh);

            const posArr = new Float32Array(TRAIL_LENGTH * 3);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
            geo.setDrawRange(0, 0);
            const line = new THREE.Line(
                geo,
                new THREE.LineBasicMaterial({ color: COLORS[i], opacity: 0.4, transparent: true }),
            );
            _scene.add(line);
            trailGeos.push(geo);
            trailData.push([]);
            sceneObjects.push(line);
        }
    },

    update(dt) {
        if (!bodies) return;
        if (dt > 0.1) dt = 0.02;

        // Copy current state into buffers
        for (let i = 0; i < NUM_BODIES; i++) {
            velBuf[i].copy(bodies[i].vel);
            posBuf[i].copy(bodies[i].pos);
        }

        // Compute forces and integrate (synchronous Euler, same as 2D original)
        for (let i = 0; i < NUM_BODIES; i++) {
            let fx = 0, fy = 0, fz = 0;
            for (let j = 0; j < NUM_BODIES; j++) {
                if (i === j) continue;
                const dx = bodies[j].pos.x - bodies[i].pos.x;
                const dy = bodies[j].pos.y - bodies[i].pos.y;
                const dz = bodies[j].pos.z - bodies[i].pos.z;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.001;
                const f = Math.min(G * bodies[i].mass * bodies[j].mass / Math.pow(dist, 1.7), MAX_FORCE);
                fx += f * dx / dist;
                fy += f * dy / dist;
                fz += f * dz / dist;
            }
            const m = bodies[i].mass;
            velBuf[i].x += (fx / m) * dt * SIM_SPEED;
            velBuf[i].y += (fy / m) * dt * SIM_SPEED;
            velBuf[i].z += (fz / m) * dt * SIM_SPEED;
            posBuf[i].x += velBuf[i].x * dt * SIM_SPEED;
            posBuf[i].y += velBuf[i].y * dt * SIM_SPEED;
            posBuf[i].z += velBuf[i].z * dt * SIM_SPEED;
        }

        for (let i = 0; i < NUM_BODIES; i++) {
            bodies[i].vel.copy(velBuf[i]);
            bodies[i].pos.copy(posBuf[i]);
        }

        // Update meshes and trails
        for (let i = 0; i < NUM_BODIES; i++) {
            const wp = new THREE.Vector3(
                _anchor.x + bodies[i].pos.x * SIM_SCALE,
                _anchor.y + bodies[i].pos.y * SIM_SCALE,
                _anchor.z + bodies[i].pos.z * SIM_SCALE,
            );
            meshes[i].position.copy(wp);

            const td = trailData[i];
            td.push(wp.clone());
            if (td.length > TRAIL_LENGTH) td.shift();

            const pa = trailGeos[i].attributes.position.array;
            for (let j = 0; j < td.length; j++) {
                pa[j * 3]     = td[j].x;
                pa[j * 3 + 1] = td[j].y;
                pa[j * 3 + 2] = td[j].z;
            }
            trailGeos[i].setDrawRange(0, td.length);
            trailGeos[i].attributes.position.needsUpdate = true;
        }
    },

    unload() {
        for (const obj of sceneObjects) {
            _scene.remove(obj);
            obj.geometry?.dispose();
            obj.material?.dispose();
        }
        _reset();
        _scene = null;
        _anchor = null;
    },
};
