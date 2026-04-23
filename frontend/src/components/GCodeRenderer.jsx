import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

function parseFilamentColors(lines) {
  for (const line of lines.slice(0, 300)) {
    const m = line.match(/;\s*filament_colour\s*=\s*(.+)/i);
    if (m) return m[1].split(';').map(c => c.trim()).filter(c => /^#[0-9a-f]{6}/i.test(c));
  }
  return ['#ffffff'];
}

function parseGCode(content) {
  const lines = content.split('\n');
  const filamentColors = parseFilamentColors(lines);
  const colorGroups = {};
  const ensure = (c) => { if (!colorGroups[c]) colorGroups[c] = []; };

  let cx = 0, cy = 0, cz = 0, tool = 0, relE = false, lastE = 0;
  const col = () => filamentColors[tool] || filamentColors[0];

  for (const raw of lines) {
    if (/^M83\b/.test(raw.trim())) { relE = true; continue; }
    if (/^M82\b/.test(raw.trim())) { relE = false; continue; }
    const tm = raw.trim().match(/^T(\d+)\b/);
    if (tm) { tool = parseInt(tm[1]); continue; }
    const zc = raw.match(/^;Z:([0-9.]+)/);
    if (zc) { cz = parseFloat(zc[1]); continue; }

    let line = raw.replace(/\(.*?\)/g, '').replace(/;.*$/, '').trim();
    if (!line) continue;
    line = line.toUpperCase().replace(/\s+/g, ' ');

    const gm = line.match(/^G\s*0*([01])(?:\b|\.)/);
    if (!gm) continue;

    const ax = (a) => { const m = line.match(new RegExp(`${a}\\s*([+-]?\\d*\\.?\\d+)`)); return m ? parseFloat(m[1]) : null; };
    const nx = ax('X') ?? cx, ny = ax('Y') ?? cy, nz = ax('Z') ?? cz;
    const eRaw = ax('E');
    let extrude = false;
    if (gm[1] === '1' && eRaw !== null) {
      extrude = relE ? eRaw > 0.0001 : eRaw > lastE + 0.0001;
      if (!relE) lastE = eRaw;
    }
    if (extrude && Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2) > 0.01) {
      const c = col(); ensure(c);
      colorGroups[c].push(cx, cz, -cy, nx, nz, -ny);
    }
    cx = nx; cy = ny; cz = nz;
  }
  return { colorGroups, filamentColors };
}

export default function GCodeRenderer({ content }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const [info, setInfo] = useState('');
  const [colors, setColors] = useState([]);

  useEffect(() => {
    if (!content || !mountRef.current) return;
    const container = mountRef.current;
    const W = container.clientWidth || 700;
    const H = 520;

    if (rendererRef.current) { rendererRef.current.dispose(); container.innerHTML = ''; }

    const { colorGroups, filamentColors } = parseGCode(content);
    setColors(filamentColors);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111318');
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;

    const bbox = new THREE.Box3();
    let total = 0;
    for (const [hex, pts] of Object.entries(colorGroups)) {
      if (pts.length < 6) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      const mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(hex) }));
      scene.add(mesh);
      geo.computeBoundingBox();
      if (geo.boundingBox) bbox.union(geo.boundingBox);
      total += pts.length / 6;
    }

    if (total === 0) { setInfo('No toolpath data found'); return; }

    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    camera.position.set(center.x + maxDim * 1.3, center.y + maxDim, center.z + maxDim * 1.3);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.minDistance = maxDim * 0.05;
    controls.maxDistance = maxDim * 12;
    controls.update();

    const grid = new THREE.GridHelper(maxDim * 2, 30, '#1e2030', '#1a1d24');
    grid.position.set(center.x, bbox.min.y - 0.5, center.z);
    scene.add(grid);

    let animId;
    const animate = () => { animId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
    animate();

    const onResize = () => { const w = container.clientWidth; camera.aspect = w / H; camera.updateProjectionMatrix(); renderer.setSize(w, H); };
    window.addEventListener('resize', onResize);

    setInfo(`${Math.round(total).toLocaleString()} segments · drag to rotate · scroll to zoom · right-drag to pan`);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [content]);

  return (
    <div>
      <div ref={mountRef} className="w-full rounded-lg overflow-hidden bg-[#111318] cursor-grab" style={{ height: 520 }} />
      {colors.length > 0 && (
        <div className="flex items-center gap-4 mt-2.5 flex-wrap">
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="w-2.5 h-2.5 rounded-full border border-gray-600" style={{ background: c }} />
              Filament {i + 1} <span className="font-medium" style={{ color: c }}>{c}</span>
            </div>
          ))}
        </div>
      )}
      {info && <p className="text-xs text-gray-500 mt-1.5">{info}</p>}
    </div>
  );
}
