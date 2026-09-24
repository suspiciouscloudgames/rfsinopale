import * as THREE from "/video/vendor/three/three.module.js";
import { GLTFLoader } from "/video/vendor/three/addons/loaders/GLTFLoader.js";
import { clone } from "/video/vendor/three/addons/utils/SkeletonUtils.js";
import { jellyPose, localPoint, seeded } from "/shared/show/scene.js";
import {createSwarm} from '/video/swarm.js';
import {heroRevealTime} from '/video/swarm-layout.js';
import {DEFAULTS} from '/video/config.js';
export async function createWorld(root, view, onFailure) {
  let renderer,
    template,
    clips = [],
    instances = [],
    fallback = false;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(
      35,
      view.fullWidth / view.fullHeight,
      0.025,
      50,
    );
  camera.setViewOffset(
    view.fullWidth,
    view.fullHeight,
    view.x,
    view.y,
    view.width,
    view.height,
  );
  const swarm=createSwarm(scene),aspect=view.fullWidth/view.fullHeight,heroReady=heroRevealTime(t=>jellyPose(0,t,1,aspect),aspect);
  scene.add(new THREE.HemisphereLight(0xd5fff1, 0x29486f, 3));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(2, 5, 4);
  scene.add(light);
  scene.fog = new THREE.FogExp2(0x092738, 0.045);
  const silhouettes = document.createElement("div");
  silhouettes.className = "silhouettes";
  root.append(silhouettes);
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    renderer.setClearColor(0, 0);
    root.prepend(renderer.domElement);
    renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      onFailure("WebGL 컨텍스트 손실");
    });
    const gltf = await new GLTFLoader().loadAsync("/media/model");
    template = gltf.scene;
    clips = gltf.animations;
    template.traverse((node) => {
      if (node.isMesh) {
        node.frustumCulled = false;
        for (const m of Array.isArray(node.material)
          ? node.material
          : [node.material]) {
          m.side = THREE.DoubleSide;
          if (m.emissive) {
            m.emissive.setHex(0x3c766f);
            m.emissiveIntensity = 0.3;
          }
        }
      }
    });
  } catch (error) {
    fallback = true;
    onFailure(error.message);
  }
  function resize() {
    if (renderer)
      renderer.setSize(
        Math.max(1, root.clientWidth),
        Math.max(1, root.clientHeight),
        false,
      );
  }
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();
  function clear() {
    for (const i of instances) {
      scene.remove(i.group);
      i.mixer?.stopAllAction();
      i.mixer?.uncacheRoot(i.model);
      i.el?.remove();
    }
    instances = [];
    renderer?.clear();
  }
  function add() {
    if (fallback || !template) {
      const el = document.createElement("div");
      el.className = "silhouette";
      el.innerHTML =
        '<svg viewBox="0 0 100 150"><path d="M12 53 C12 0 88 0 88 53 Q50 70 12 53" fill="#b1f4e2" fill-opacity=".48" stroke="#d4fff4"/><g fill="none" stroke="#b1f4e2" stroke-width="2"><path d="M24 56 Q6 88 30 112 T22 146"/><path d="M40 62 Q60 91 38 123 T46 146"/><path d="M57 62 Q35 97 62 123 T55 146"/><path d="M75 56 Q96 90 72 117 T80 146"/></g></svg>';
      silhouettes.append(el);
      return { el, group: new THREE.Group() };
    }
    const model = clone(template),
      box = new THREE.Box3().setFromObject(model),
      size = box.getSize(new THREE.Vector3()),
      center = box.getCenter(new THREE.Vector3());
    const offset = new THREE.Group();
    offset.position.copy(center).multiplyScalar(-1);
    offset.add(model);
    const normalized = new THREE.Group();
    normalized.scale.setScalar(1 / (Math.max(size.x, size.y, size.z) || 1));
    normalized.add(offset);
    const group = new THREE.Group();
    group.add(normalized);
    scene.add(group);
    const mixer = new THREE.AnimationMixer(model);
    clips.forEach((clip) => mixer.clipAction(clip).play());
    return { model, group, mixer };
  }
  return {
    get mode() {
      return fallback ? "fallback" : "model";
    },
    fallback() {
      if (fallback) return;
      fallback = true;
      clear();
      if (renderer) renderer.domElement.style.display = "none";
    },
    frame({ count, fade, time, seed, births = [], settings=DEFAULTS }) {
      root.style.opacity = String(fade);
      root.dataset.visibleCount = String(fade > 0 ? count : 0);
      root.dataset.mode = fallback ? "fallback" : "model";
      root.dataset.sceneTime = time.toFixed(3);
      const desired = fade > 0 ? count : 0;
      if (instances.length > desired) clear();
      while (instances.length < desired) instances.push(add());
      instances.forEach((item, i) => {
        const p = jellyPose(i, time, seed, view.fullWidth / view.fullHeight);
        const birth = births[i] ?? 0,
          arrival = Math.min(1, Math.max(0, (time - birth) / 0.7));
        item.group.position.set(p.x, p.y, p.z);
        item.group.rotation.set(0, p.rotationY, p.rotationZ);
        item.group.scale.setScalar(p.scale * p.edge * arrival);
        item.mixer?.setTime(p.animationTime);
        if (item.el) {
          const q = localPoint(p, view),
            h = 2 * Math.tan((35 * Math.PI) / 360) * Math.max(0.025, -p.z);
          Object.assign(item.el.style, {
            left: `${q.x * 100}%`,
            top: `${q.y * 100}%`,
            width: `${(((p.scale / h) * view.fullHeight) / view.width) * 100}%`,
            opacity: String(p.z < -0.025 ? p.edge * arrival : 0),
          });
        }
      });
      const swarmCount=swarm.frame({time,seed,aspect,ready:heroReady,settings,visible:fade>0&&!fallback});
      root.dataset.swarmCount=String(swarmCount);root.dataset.swarmReady=String(heroReady);root.dataset.jellyMode=settings.jellyMode;
      if (renderer && !fallback) {renderer.render(scene, camera);root.dataset.drawCalls=String(renderer.info.render.calls)}
    },
    dispose() {
      swarm.dispose();
      clear();
      observer.disconnect();
      renderer?.dispose();
    },
  };
}
