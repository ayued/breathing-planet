import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as CANNON from "cannon-es";

// --- シーン・カメラ・レンダラー ---
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- カメラ操作 ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 10;

// --- 物理エンジン設定 ---
const world = new CANNON.World();
world.gravity.set(0, 0, 0); // 無重力

// --- トーラス（リング）作成 ---
const torusGeometry = new THREE.TorusGeometry(1.6, 0.02, 10, 60);
const torusMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#666666"),
  metalness: 1.0,
  roughness: 0.01,
});
const torus = new THREE.Mesh(torusGeometry, torusMaterial);
torus.rotation.x = Math.PI / 2 + 0.1;
scene.add(torus);

// --- 球体リスト ---
let meshes = [];
let physicsBodies = [];

// --- 初期球体 ---
const geometry = new THREE.SphereGeometry(1, 64, 64);
const material = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#3D485B"),
});
const sphere = new THREE.Mesh(geometry, material);
sphere.userData.baseScale = sphere.scale.x;
scene.add(sphere);
meshes.push(sphere);

// --- 初期球体の物理ボディ ---
const sphereShape = new CANNON.Sphere(1);
const sphereBody = new CANNON.Body({
  mass: 1,
  position: new CANNON.Vec3(0, 0, 0),
});
sphereBody.addShape(sphereShape);
sphereBody.linearDamping = 0.8;
sphereBody.angularDamping = 0.8;
world.addBody(sphereBody);
physicsBodies.push(sphereBody);

// --- ライティング ---
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(0, 2, 4);
scene.add(directionalLight);

const pointLight = new THREE.DirectionalLight(0x07f9fe, 7);
pointLight.position.set(0, 200, 0);
scene.add(pointLight);

const pointLight2 = new THREE.DirectionalLight(0xfc2827, 4);
pointLight2.position.set(10, 0, 0);
scene.add(pointLight2);

// --- アニメーションパラメータ ---
const baseScale = 2;
const amplitude = 0.05;
const clock = new THREE.Clock();

// --- アニメーションループ ---
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  for (let i = 0; i < meshes.length; i++) {
    const m = meshes[i];
    const body = physicsBodies[i];

    if (m && body) {
      // 呼吸アニメーション
      const base = m.userData.baseScale || m.scale.x;
      const scale = base + Math.sin(time * 1.5 + m.uuid.length) * amplitude;
      m.scale.set(scale, scale, scale);

      // メッシュの位置・回転更新
      m.position.copy(body.position);
      m.quaternion.copy(body.quaternion);

      // 画面外に出ないよう制御
      const boundaryLimit = 3;
      if (
        Math.abs(body.position.x) > boundaryLimit ||
        Math.abs(body.position.y) > boundaryLimit ||
        Math.abs(body.position.z) > boundaryLimit
      ) {
        const direction = new CANNON.Vec3(
          -body.position.x * 0.2,
          -body.position.y * 0.2,
          -body.position.z * 0.2
        );
        body.applyForce(direction, body.position);
        body.velocity.scale(0.7, body.velocity);
      }
    }
  }

  world.step(1 / 60);

  controls.update();
  renderer.render(scene, camera);
}
animate();

// --- ウィンドウリサイズ対応 ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Raycasterでクリック検出 ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener("click", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0) {
    const clickedMesh = intersects[0].object;
    const index = meshes.indexOf(clickedMesh);
    if (index !== -1) {
      split(clickedMesh, index);
    }
  }
});

// --- 球体分裂処理 ---
function split(mesh, meshIndex) {
  const originalPos = mesh.position.clone();
  const originalScale = mesh.scale.x;
  const originalBody = physicsBodies[meshIndex];

  // 元のメッシュとボディを削除
  world.removeBody(originalBody);
  physicsBodies.splice(meshIndex, 1);
  scene.remove(mesh);
  meshes.splice(meshIndex, 1);

  // 新しい球体を2つ作成
  for (let i = 0; i < 2; i++) {
    const newScale = originalScale * 0.7;
    const newMaterial = material.clone();
    const newMesh = new THREE.Mesh(geometry.clone(), newMaterial);
    newMesh.scale.set(newScale, newScale, newScale);
    newMesh.userData.baseScale = newScale;
    scene.add(newMesh);
    meshes.push(newMesh);

    const shape = new CANNON.Sphere(newScale);
    const body = new CANNON.Body({
      mass: 1,
      position: new CANNON.Vec3(
        originalPos.x + (i === 0 ? -0.3 : 0.3) * newScale,
        originalPos.y + (Math.random() * 0.1 - 0.05),
        originalPos.z + (Math.random() * 0.1 - 0.05)
      ),
    });
    body.addShape(shape);

    const velocity = new CANNON.Vec3(
      (i === 0 ? -1 : 1) * (0.05 + Math.random() * 0.05),
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05
    );
    body.velocity.copy(velocity);

    body.linearDamping = 0.8;
    body.angularDamping = 0.8;

    world.addBody(body);
    physicsBodies.push(body);

    newMesh.position.copy(body.position);
    newMesh.quaternion.copy(body.quaternion);
  }
}
