import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { buildWorld, SCREEN_W } from './world.js';
import { paper } from '../paper.js';

// iframe rendered at this pixel size; SCREEN_W / IFRAME_W gives the Three.js scale
const IFRAME_W = 1280;
const IFRAME_H = 800;
const IFRAME_SCALE = SCREEN_W / IFRAME_W; // 0.001875

let renderer, css3dRenderer, css3dScene;
let camera, scene, controls, animFrameId;
let screenMesh;
let active = false;
let paperWasActive = false;

const keys = { w: false, a: false, s: false, d: false };
const SPEED = 3;

export function enterSpace() {
    if (active) return;
    active = true;

    document.getElementById('enter-space').style.display = 'none';
    document.getElementById('space-backdrop').style.display = 'block';

    paperWasActive = paper ? paper.active : false;
    if (paper) paper.active = false;

    // Scene — no background so WebGL canvas stays transparent where not drawn
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
    camera.position.set(0, 1.7, 1.7);

    // CSS3D renderer sits BEHIND the WebGL canvas (lower z-index, appended first)
    css3dScene = new THREE.Scene();
    css3dRenderer = new CSS3DRenderer();
    css3dRenderer.setSize(window.innerWidth, window.innerHeight);
    Object.assign(css3dRenderer.domElement.style, {
        position: 'fixed', top: '0', left: '0', zIndex: '1000',
    });
    document.body.appendChild(css3dRenderer.domElement);

    // iframe as a CSS3DObject at the screen wall position.
    // Relative URL avoids Firefox's localhost iframe restriction (Enhanced Tracking Protection).
    const iframe = document.createElement('iframe');
    iframe.src = window.location.pathname + window.location.search;
    Object.assign(iframe.style, {
        width: IFRAME_W + 'px', height: IFRAME_H + 'px',
        border: 'none', background: '#14141a',
    });
    const css3dObject = new CSS3DObject(iframe);
    css3dObject.scale.setScalar(IFRAME_SCALE);
    css3dObject.position.set(0, 1.5, -1.99);
    css3dScene.add(css3dObject);

    // WebGL renderer on top, alpha:true so the screen hole reveals CSS3D behind
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.useLegacyLights = true;
    renderer.domElement.id = 'space-canvas';
    document.body.appendChild(renderer.domElement);

    const world = buildWorld(scene);
    screenMesh = world.screen;

    controls = new PointerLockControls(camera, renderer.domElement);
    scene.add(controls.getObject());
    controls.addEventListener('lock', onPointerLock);
    controls.addEventListener('unlock', onPointerUnlock);

    renderer.domElement.addEventListener('click', onCanvasClick);
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    document.getElementById('space-exit').addEventListener('click', exitSpace);
    document.getElementById('space-click-to-start').addEventListener('click', onClickToStart);

    document.getElementById('space-overlay').style.display = 'block';
    setUnlockedUI();

    const vel = new THREE.Vector3();
    let lastTime = performance.now();

    function animate(now) {
        animFrameId = requestAnimationFrame(animate);
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        if (controls.isLocked) {
            vel.set(0, 0, 0);
            if (keys.w) vel.z -= 1;
            if (keys.s) vel.z += 1;
            if (keys.a) vel.x -= 1;
            if (keys.d) vel.x += 1;
            if (vel.lengthSq() > 0) {
                vel.normalize().multiplyScalar(SPEED * dt);
                controls.moveRight(vel.x);
                controls.moveForward(-vel.z);
            }

            const pos = controls.getObject().position;
            pos.x = Math.max(-1.8, Math.min(1.8, pos.x));
            pos.z = Math.max(-1.8, Math.min(1.8, pos.z));
            pos.y = 1.7;
        }

        css3dRenderer.render(css3dScene, camera);
        renderer.render(scene, camera);
    }
    animate(lastTime);
}

export function exitSpace() {
    if (!active) return;
    active = false;

    cancelAnimationFrame(animFrameId);

    controls.removeEventListener('lock', onPointerLock);
    controls.removeEventListener('unlock', onPointerUnlock);
    controls.unlock();

    renderer.domElement.removeEventListener('click', onCanvasClick);
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', onResize);
    document.getElementById('space-exit').removeEventListener('click', exitSpace);
    document.getElementById('space-click-to-start').removeEventListener('click', onClickToStart);

    renderer.dispose();
    renderer.domElement.remove();
    css3dRenderer.domElement.remove();

    keys.w = false; keys.a = false; keys.s = false; keys.d = false;

    document.getElementById('space-backdrop').style.display = 'none';
    document.getElementById('space-overlay').style.display = 'none';
    document.getElementById('enter-space').style.display = '';

    if (paper && paperWasActive) paper.active = true;

    renderer = null;
    css3dRenderer = null;
    camera = null;
    scene = null;
    css3dScene = null;
    controls = null;
    screenMesh = null;
}

function onClickToStart() {
    if (controls) controls.lock();
}

function onCanvasClick() {
    if (controls && !controls.isLocked) controls.lock();
}

function onDocumentClick() {
    if (!controls || !controls.isLocked) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    // Looking at screen + click → unlock pointer so the iframe becomes interactive
    if (raycaster.intersectObject(screenMesh).length > 0) controls.unlock();
}

function onPointerLock() {
    renderer.domElement.style.pointerEvents = 'auto';
    document.getElementById('space-click-to-start').style.display = 'none';
    document.getElementById('space-crosshair').style.display = 'block';
    document.getElementById('space-hint').textContent =
        'wasd to move   |   look at screen · click to interact   |   esc to free mouse';
}

function onPointerUnlock() {
    if (!active) return;
    // Let clicks pass through WebGL canvas to the CSS3D iframe
    renderer.domElement.style.pointerEvents = 'none';
    setUnlockedUI();
}

function setUnlockedUI() {
    document.getElementById('space-click-to-start').style.display = 'flex';
    document.getElementById('space-crosshair').style.display = 'none';
    document.getElementById('space-hint').textContent = '';
}

function onKeyDown(e) {
    if (e.code === 'KeyW') keys.w = true;
    if (e.code === 'KeyA') keys.a = true;
    if (e.code === 'KeyS') keys.s = true;
    if (e.code === 'KeyD') keys.d = true;
}

function onKeyUp(e) {
    if (e.code === 'KeyW') keys.w = false;
    if (e.code === 'KeyA') keys.a = false;
    if (e.code === 'KeyS') keys.s = false;
    if (e.code === 'KeyD') keys.d = false;
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    css3dRenderer.setSize(window.innerWidth, window.innerHeight);
}
