import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * Builds the storefront device meshes from geometry and materials.
 */

function createLaptop() {
  const group = new THREE.Group();

  // Materials
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x9f9ab4,
    metalness: 0.88,
    roughness: 0.22,
  });

  const champagneTrim = new THREE.MeshStandardMaterial({
    color: 0xe0d9ff,
    metalness: 0.95,
    roughness: 0.15,
  });

  const wallpaper = document.createElement("canvas");
  wallpaper.width = 512;
  wallpaper.height = 320;
  const context = wallpaper.getContext("2d");
  const background = context.createLinearGradient(0, 0, 512, 320);
  background.addColorStop(0, "#22143c");
  background.addColorStop(0.55, "#6b43ca");
  background.addColorStop(1, "#d8b7ff");
  context.fillStyle = background;
  context.fillRect(0, 0, 512, 320);
  context.fillStyle = "#d2b7ff";
  context.beginPath();
  context.moveTo(0, 285);
  context.bezierCurveTo(205, 335, 280, 35, 512, 65);
  context.lineTo(512, 320);
  context.lineTo(0, 320);
  context.fill();
  const screenTexture = new THREE.CanvasTexture(wallpaper);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  const screenGlassMat = new THREE.MeshBasicMaterial({ map: screenTexture });

  // Base chassis
  const baseGeo = new RoundedBoxGeometry(2.2, 0.08, 1.5, 3, 0.035);
  const base = new THREE.Mesh(baseGeo, titaniumMat);
  group.add(base);

  // Trackpad
  const trackpadGeo = new THREE.PlaneGeometry(0.7, 0.5);
  const trackpad = new THREE.Mesh(trackpadGeo, champagneTrim);
  trackpad.rotation.x = -Math.PI / 2;
  trackpad.position.set(0, 0.045, 0.4);
  group.add(trackpad);

  // Keyboard recess
  const kbGeo = new THREE.PlaneGeometry(1.9, 0.7);
  const kb = new THREE.Mesh(
    kbGeo,
    new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.8 })
  );
  kb.rotation.x = -Math.PI / 2;
  kb.position.set(0, 0.045, -0.2);
  group.add(kb);

  // Lid & Screen (angled back)
  const lidGroup = new THREE.Group();
  lidGroup.position.set(0, 0.04, -0.75);

  const lidBackGeo = new RoundedBoxGeometry(2.2, 1.45, 0.065, 3, 0.03);
  const lidBack = new THREE.Mesh(lidBackGeo, titaniumMat);
  lidBack.position.set(0, 0.7, 0);
  lidGroup.add(lidBack);

  // Glowing Screen
  const screenGeo = new THREE.PlaneGeometry(2.05, 1.3);
  const screen = new THREE.Mesh(screenGeo, screenGlassMat);
  screen.position.set(0, 0.7, 0.039);
  lidGroup.add(screen);

  lidGroup.rotation.x = 0.42; // tilted back ~115 degrees
  group.add(lidGroup);

  const keyGeometry = new RoundedBoxGeometry(0.114, 0.016, 0.114, 2, 0.007);
  const keyMaterial = new THREE.MeshStandardMaterial({ color: 0x242032, roughness: 0.7 });
  const keys = new THREE.InstancedMesh(keyGeometry, keyMaterial, 52);
  const keyTransform = new THREE.Matrix4();
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 13; column++) {
      keyTransform.makeTranslation(-0.84 + column * 0.14, 0.051, -0.47 + row * 0.15);
      keys.setMatrixAt(row * 13 + column, keyTransform);
    }
  }
  group.add(keys);
  return group;
}

function createPhone() {
  const group = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0xc5c0dc, metalness: 0.95, roughness: 0.18 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x302841, metalness: 0.25, roughness: 0.16 });
  const cameraGlass = new THREE.MeshStandardMaterial({ color: 0x151124, metalness: 0.5, roughness: 0.2 });

  function addShell(width, height, depth, material, x, y, z) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 5, 0.07), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }

  addShell(0.94, 1.86, 0.11, frame, 0, 0, 0);
  addShell(0.91, 1.83, 0.06, glass, 0, 0, -0.038);
  addShell(0.19, 0.37, 0.06, cameraGlass, -0.29, 0.64, -0.068);
  for (const y of [0.56, 0.71]) {
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.058, 20, 12), frame);
    lens.scale.z = 0.28;
    lens.position.set(-0.29, y, -0.103);
    group.add(lens);
  }

  const wallpaper = document.createElement("canvas");
  wallpaper.width = 256;
  wallpaper.height = 512;
  const context = wallpaper.getContext("2d");
  context.beginPath();
  context.roundRect(0, 0, 256, 512, 29);
  context.clip();
  context.fillStyle = "#14101e";
  context.fillRect(0, 0, 256, 512);
  context.beginPath();
  context.roundRect(6, 6, 244, 500, 25);
  context.clip();
  const gradient = context.createLinearGradient(0, 0, 256, 512);
  gradient.addColorStop(0, "#fa78a8");
  gradient.addColorStop(0.46, "#5944d8");
  gradient.addColorStop(1, "#c4a7ff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 512);
  context.fillStyle = "#14101e";
  context.beginPath();
  context.roundRect(71, -4, 114, 29, [0, 0, 13, 13]);
  context.fill();
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.font = "42px sans-serif";
  context.fillText("9:41", 128, 112);
  context.beginPath();
  context.roundRect(88, 484, 80, 4, 2);
  context.fill();

  const texture = new THREE.CanvasTexture(wallpaper);
  texture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.91, 1.82),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
  screen.position.z = 0.057;
  group.add(screen);
  return group;
}

function createHeadphones() {
  const group = new THREE.Group();

  const copperMat = new THREE.MeshStandardMaterial({
    color: 0x8558ff,
    metalness: 0.92,
    roughness: 0.2,
  });

  const cushionMat = new THREE.MeshStandardMaterial({
    color: 0x202036,
    roughness: 0.65,
    metalness: 0.2,
  });

  // Headband Arch
  const curve = new THREE.EllipseCurve(0, 0, 0.95, 0.95, 0, Math.PI, false, 0);
  const points = curve.getPoints(36);
  const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, p.y, 0)));
  const archGeo = new THREE.TubeGeometry(path, 40, 0.05, 12, false);
  const arch = new THREE.Mesh(archGeo, copperMat);
  group.add(arch);

  // Left & Right Earcups
  [-0.95, 0.95].forEach((xSide) => {
    const earcupGroup = new THREE.Group();
    earcupGroup.position.set(xSide, -0.05, 0);

    // Cup housing
    const cupGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 24);
    const cup = new THREE.Mesh(cupGeo, copperMat);
    cup.rotation.z = Math.PI / 2;
    earcupGroup.add(cup);

    // Plush Cushion
    const cushionGeo = new THREE.TorusGeometry(0.24, 0.09, 14, 28);
    const cushion = new THREE.Mesh(cushionGeo, cushionMat);
    cushion.rotation.y = Math.PI / 2;
    cushion.position.x = xSide > 0 ? -0.1 : 0.1;
    earcupGroup.add(cushion);

    group.add(earcupGroup);
  });

  group.scale.set(0.95, 0.95, 0.95);
  return group;
}


export function Hero3DCanvas({ device, paused }) {
  const stageRef = useRef(null);
  const [ready, setReady] = useState(false);
  const selectionRef = useRef({ device, paused });

  useEffect(() => {
    selectionRef.current = { device, paused };
  }, [device, paused]);

  useEffect(() => {
    const stage = stageRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-3, 3, 2, -2, 0.1, 40);
    camera.position.set(0, 1.2, 11);
    camera.lookAt(0, 0, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    stage.appendChild(renderer.domElement);

    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(room);
    room.dispose();
    pmrem.dispose();
    scene.environment = environment.texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb29af5, 2.2));
    const light = new THREE.DirectionalLight(0xf9f5ff, 3);
    light.position.set(-3, 5, 4);
    scene.add(light);

    const models = {
      laptop: createLaptop(),
      phone: createPhone(),
      headphones: createHeadphones(),
    };
    const poses = {
      laptop: { y: -0.48, yaw: -0.38, pitch: 0.18, roll: -0.10, scale: 1.42 },
      phone: { y: 0, yaw: -0.32, pitch: 0.08, roll: -0.21, scale: 1.6 },
      headphones: { y: -0.37, yaw: -0.25, pitch: 0.09, roll: -0.16, scale: 1.42 },
    };
    for (const model of Object.values(models)) scene.add(model);
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let activeDevice;
    let selectedAt = 0;
    let wasAnimated = false;

    function render(time, force = false) {
      const { device: selected, paused: still } = selectionRef.current;
      const changed = selected !== activeDevice;
      if (changed) {
        activeDevice = selected;
        selectedAt = time;
        for (const [name, model] of Object.entries(models)) model.visible = name === selected;
      }
      const model = models[selected];
      const pose = poses[selected];
      const animate = !motionPreference.matches && !still;
      if (!force && !changed && !animate && !wasAnimated) return;
      wasAnimated = animate;
      const elapsed = time - selectedAt;
      const entrance = animate ? Math.pow(1 - Math.min(elapsed / 480, 1), 3) : 0;
      model.position.y = pose.y + (animate ? Math.sin(elapsed / 760) * 0.085 - entrance * 0.34 : 0);
      model.rotation.set(pose.pitch, pose.yaw + (animate ? Math.sin(elapsed / 960) * 0.24 - entrance * 0.4 : 0), pose.roll);
      model.scale.setScalar(pose.scale * (1 - entrance * 0.13));
      renderer.render(scene, camera);
    }

    function resize() {
      const { clientWidth: width, clientHeight: height } = stage;
      if (!width || !height) return;
      const aspect = width / height;
      const halfHeight = Math.max(1.9, 2.25 / aspect);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      render(performance.now(), true);
    }
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(stage);
    resize();
    const frame = requestAnimationFrame(() => setReady(true));

    const observer = new IntersectionObserver(([entry]) => {
      renderer.setAnimationLoop(entry.isIntersecting ? (time) => render(time) : null);
    });
    observer.observe(stage);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      sizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      scene.traverse((object) => {
        object.geometry?.dispose();
        object.material?.map?.dispose();
        object.material?.dispose();
      });
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="shop-device-scene">
      {!ready && <img src={`/devices/${device}.svg`} alt="" />}
      <div className="shop-device-stage" ref={stageRef} />
    </div>
  );
}
