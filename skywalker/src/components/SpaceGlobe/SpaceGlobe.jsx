import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createYellowBlueGlobeCanvas } from "../../utils/proceduralGlobeTexture";
import "./SpaceGlobe.css";

function makeGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(59, 130, 246, 0.55)");
  gradient.addColorStop(0.4, "rgba(37, 99, 235, 0.22)");
  gradient.addColorStop(1, "rgba(10, 20, 40, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function makeStarfield(count) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 40 + Math.random() * 60;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: 0.16,
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  });
  return new THREE.Points(geometry, material);
}

export default function SpaceGlobe() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(0, 0.4, 5.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Bright, theme-matching lighting so the globe never reads as a dark
    // silhouette — a soft ambient fill plus a strong key light on the face.
    const ambient = new THREE.AmbientLight(0xffffff, 2.0);
    const sun = new THREE.DirectionalLight(0xfff6d8, 2.0);
    sun.position.set(-4, 2, 3);
    scene.add(ambient, sun);

    // The hero globe always renders the stylized yellow-landmass/blue-ocean
    // texture drawn on a canvas — there is no network image to fail to load,
    // so this can never render black.
    const earthCanvas = createYellowBlueGlobeCanvas();
    const earthMap = new THREE.CanvasTexture(earthCanvas);
    earthMap.colorSpace = THREE.SRGBColorSpace;

    const earthGeometry = new THREE.SphereGeometry(1.7, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthMap,
      specular: new THREE.Color(0x224488),
      shininess: 10,
      emissive: new THREE.Color(0x0a1a3a),
      emissiveIntensity: 0.35,
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.rotation.y = 4.2;
    scene.add(earth);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    glow.scale.set(5.2, 5.2, 1);
    scene.add(glow);

    const stars = makeStarfield(2600);
    scene.add(stars);

    // Drag-to-rotate only: OrbitControls owns all pointer interaction, with
    // damping for smooth deceleration and gentle autoRotate when idle. No
    // pointermove/hover listeners are attached, so the camera never jitters
    // on plain mouse movement.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = !prefersReducedMotion;
    controls.autoRotateSpeed = 0.8;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = (Math.PI * 3) / 4;
    controls.target.set(0, 0, 0);

    let frameId;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = mount;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    });
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      earthGeometry.dispose();
      earthMaterial.dispose();
      earthMap.dispose();
      stars.geometry.dispose();
      stars.material.dispose();
      glow.material.map.dispose();
      glow.material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="space-globe-canvas" />;
}
